const uuidV4 = require('uuid/v4');
const nacl = require('tweetnacl');
const packageJSON = require('./package.json');
const validator = require('validator');
const _ = require('lodash');

const { InteropSender } = require('./interop.js');

const METHODS = {
  CHALLENGE_RESPONSE: 'challengeResponse',
  CHECK: 'check',
  DEREGISTER: 'deregister',
  GET_MESSAGES: 'getMessages',
  SEND_MESSAGE: 'sendMessage',
  GET_RECIPIENT: 'getRecipient',
  PUSH_PRE_KEY: 'pushPreKey',
  PUSH_SIGNED_PRE_KEY: 'pushSignedPreKey'
};

class ApiHandler {
  constructor(req, res, database) {
    this.req = req;
    this.res = res;
    this.body = req.body;
    this.database = database;
    this.sender = new InteropSender();

    if (this.body.username) {
      this.body.username = this.body.username.toLowerCase();
    }
  }

  handle() {
    return new Promise((resolve, reject) => {
      const flushResult = (result) => {
        this.res.json(result);
        resolve();
      };

      const flushError = (err) => {
        this.res.status(400).end();
        reject(err);
      };

      if (this.body.username && this.body.method) {
        this.database.getInfo(this.body.username).then((info) => {
          if (info) {
            if (this.body.method === METHODS.CHALLENGE_RESPONSE) {
              this.handleChallenge(info).then(flushResult).catch(flushError);
            } else {
              this.handleRequest().then(flushResult).catch(flushError);
            }
          } else {
            flushError('user was not found');
          }
        }).catch(flushError);
      } else {
        flushError('missing required schema elements');
      }
    });
  }

  handleChallenge(info) {
    return new Promise((resolve, reject) => {
      const payload = this.body.payload;

      if (payload && payload.challengeId && payload.signedChallenge) {
        if (
          !validator.isUUID(payload.challengeId, 4) ||
          !validator.isBase64(payload.signedChallenge)
        ) {
          return reject('failed validation');
        }

        this.database.get(this.body.username, 'requests', payload.challengeId, { json: true }).then((request) => {
          if (request) {
            this.database.remove(this.body.username, 'requests', payload.challengeId).then(() => {
              this.verifySignature(info, request.challenge, payload.signedChallenge).then(() => {
                const methodHandler = _.includes(_.values(METHODS), request.method);

                if (methodHandler) {
                  this[request.method](request.payload).then(resolve).catch(reject);
                } else {
                  reject('unknown method');
                }
              }).catch(reject);
            }).catch(reject);
          } else {
            reject('no matching request found');
          }
        }).catch(reject);
      } else {
        reject('missing challenge schema elements');
      }
    });
  }

  verifySignature(info, challenge, signedChallenge) {
    return new Promise((resolve, reject) => {
      const challengeBuffer = Buffer.from(challenge, 'base64');
      const signedChallengeBuffer = Buffer.from(signedChallenge, 'base64');
      const publicKeyBuffer = Buffer.from(info.apiPublicKey, 'base64');

      const signatureValid = nacl.sign.detached.verify(
        challengeBuffer,
        signedChallengeBuffer,
        publicKeyBuffer
      );

      if (signatureValid) {
        resolve();
      } else {
        reject('signature is not valid');
      }
    });
  }

  handleRequest() {
    return new Promise((resolve, reject) => {
      this.generateChallenge().then((challenge) => {
        const challengeId = uuidV4();

        const response = {
          challengeId,
          challenge
        };

        const request = {
          payload: this.body.payload,
          method: this.body.method,
          challenge
        };

        this.database.put(this.body.username, 'requests', challengeId, request, { json: true }).then(() => {
          resolve(response);

          // Remove the pending request after 10 seconds
          setTimeout(() => {
            this.database.remove(this.body.username, 'requests', challengeId);
          }, 10000);
        }).catch(reject);
      });
    });
  }

  generateChallenge() {
    return this.database.authentication.generateSalt();
  }

  // methods
  check() {
    return new Promise((resolve, reject) => {
      Promise.all([
        this.database.getAll(this.body.username, 'preKey', { json: true }),
        this.database.getSignedPreKey(this.body.username)
      ]).then((preKeys) => {
        const preKeyCount = preKeys[0].length;

        if (preKeys[1] === null) {
          return reject('missing signed preKey');
        }

        const signedKeyAge = Date.now() - new Date(preKeys[1].savedAt).getTime();
        const threeMonths = 1000 * 30 * 3 * 60 * 60 * 24;

        const response = {
          valid: true,
          serverVersion: packageJSON.version
        }

        response.sendPreKeys = preKeyCount < 10;
        response.sendSignedPreKey = signedKeyAge > threeMonths;

        resolve(response);
      }).catch(reject);
    });
  }

  getMessages() {
    return new Promise((resolve, reject) => {
      this.database.getAll(
        this.body.username,
        'messages',
        { json: true }
      ).then((messages) => {
        this.database.remove(
          this.body.username,
          'messages'
        ).then(() => {
          resolve(messages);
        }).catch(reject);
      }).catch(reject);
    });
  }

  sendMessage(payload) {
    if (
      !payload.signalVersion ||
      !payload.from ||
      !payload.recipient ||
      !payload.data ||
      !payload.id
    ) {
      return Promise.reject('message has incorrect format');
    }

    const message = {
      signalVersion: payload.signalVersion,
      from: payload.from,
      recipient: payload.recipient,
      data: payload.data,
      id: payload.id
    };

    return this.sender.sendMessage(message);
  }

  getRecipient(payload) {
    if (!payload.recipient) {
      return Promise.reject('no recipient specified');
    }

    return this.sender.getRecipient(payload.recipient);
  }

  pushPreKey(payload) {
    if (payload.keyId == null || !payload.publicKey) {
      return Promise.reject('requires keyId and publicKey');
    }

    if (
      !_.isFinite(payload.keyId) ||
      !validator.isBase64(payload.publicKey)
    ) {
      return Promise.reject('failed validation');
    }

    const preKey = {
      keyId: payload.keyId,
      publicKey: payload.publicKey
    };

    return new Promise((resolve, reject) => {
      this.database.put(
        this.body.username,
        'preKey',
        payload.keyId.toString(),
        preKey,
        { json: true }
      ).then(() => {
        resolve({ success: true });
      }).catch(reject);
    });
  }

  pushSignedPreKey(payload) {
    if (
      payload.keyId == null ||
      !payload.publicKey ||
      !payload.signature
    ) {
      return Promise.reject('requires keyId, publicKey, and signature');
    }

    if (
      !_.isFinite(payload.keyId) ||
      !validator.isBase64(payload.publicKey) ||
      !validator.isBase64(payload.signature)
    ) {
      return Promise.reject('failed validation');
    }

    const signedPreKey = {
      keyId: payload.keyId,
      publicKey: payload.publicKey,
      signature: payload.signature,
      savedAt: new Date().toJSON()
    };

    return new Promise((resolve, reject) => {
      this.database.remove(this.body.username, 'signedPreKey').then(() => {
        this.database.put(
          this.body.username,
          'signedPreKey',
          payload.keyId.toString(),
          signedPreKey,
          { json: true }
        ).then(() => {
          resolve({ success: true });
        }).catch(reject);
      }).catch(reject);
    });
  }

  deregister(payload) {
    return this.database.wipeUser(this.body.username).then(() => {
      return { wiped: true };
    });
  }
}

module.exports = ApiHandler;
