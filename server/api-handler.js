const uuidV4 = require('uuid/v4');
const nacl = require('tweetnacl');
const packageJSON = require('./package.json');
const _ = require('lodash');

const { InteropSender } = require('./interop.js');

const METHODS = {
  CHALLENGE_RESPONSE: 'challengeResponse',
  CHECK: 'check',
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

          // Remove the pending request after 1 second
          setTimeout(() => {
            this.database.remove(this.body.username, 'requests', challengeId);
          }, 1000);
        }).catch(reject);
      });
    });
  }

  generateChallenge() {
    return this.database.authentication.generateSalt();
  }

  // methods
  check() {
    return Promise.resolve({
      valid: true,
      serverVersion: packageJSON.version
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

  sendMessage() {
    if (
      !this.body.payload.signalVersion ||
      !this.body.payload.recipient ||
      !this.body.payload.data ||
      !this.body.payload.id
    ) {
      return Promise.reject('message has incorrect format');
    }

    const message = {
      signalVersion: this.body.payload.signalVersion,
      recipient: this.body.payload.recipient,
      data: this.body.payload.data,
      id: this.body.payload.id
    };

    return this.sender.sendMessage(message);
  }

  getRecipient() {
    if (!this.body.payload.recipient) {
      return Promise.reject('no recipient specified');
    }

    return this.sender.getRecipient(this.body.payload.recipient);
  }

  pushPreKey() {
    if (!this.body.payload.keyId || !this.body.payload.publicKey) {
      return Promise.reject('requires keyId and publicKey');
    }

    const payload = {
      keyId: this.body.payload.keyId,
      publicKey: this.body.payload.publicKey
    };

    return new Promise((resolve, reject) => {
      this.database.put(
        this.body.username,
        'preKey',
        payload.keyId,
        payload,
        { json: true }
      ).then(() => {
        resolve({ success: true });
      }).catch(reject);
    });
  }

  pushSignedPreKey() {
    if (
      !this.body.payload.keyId ||
      !this.body.payload.publicKey ||
      !this.body.payload.signature
    ) {
      return Promise.reject('requires keyId, publicKey, and signature');
    }

    const payload = {
      keyId: this.body.payload.keyId,
      publicKey: this.body.payload.publicKey,
      signature: this.body.payload.signature
    };

    return new Promise((resolve, reject) => {
      this.database.put(
        this.body.username,
        'signedPreKey',
        payload.keyId,
        payload,
        { json: true }
      ).then(() => {
        resolve({ success: true });
      }).catch(reject);
    });
  }
}

module.exports = ApiHandler;
