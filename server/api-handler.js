const uuidV4 = require('uuid/v4');
const nacl = require('tweetnacl');

class ApiHandler {
  constructor(req, res, database) {
    this.req = req;
    this.res = res;
    this.body = req.body;
    this.database = database;
  }

  handle() {
    return new Promise((resolve, reject) => {
      const flushResult = (result) => {
        this.res.json(result);
        resolve();
      };

      const flushError = (err) => {
        this.res.status(400).end();
        reject();
      };

      if (this.body.username && this.body.method) {
        this.database.getInfo(this.body.username).then((info) => {
          if (info) {
            if (this.body.method === 'challengeResponse') {
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
            this.verifySignature(info, request.challenge, payload.signedChallenge).then(() => {
              const methodHandler = this[request.method];

              if (methodHandler) {
                methodHandler(request.payload).then(resolve).catch(reject);
              } else {
                reject('unknown method');
              }
            }).catch(reject);
          } else {
            reject('no matching request found');
          }
        }).catch(reject);
      } else {
        reject('missing challenge schema elements');
      }
      this.database.get(this.body.username, 'requests')
    });
  }

  verifySignature(info, challenge, signedChallenge) {
    return new Promise((resolve, reject) => {
      const challengeBuffer = Buffer.from(challenge, 'base64');
      const signedChallengeBuffer = Buffer.from(signedChallenge, 'base64');
      const publicKeyBuffer = Buffer.from(info.apiPublicKey, 'base64');

      console.log(info.apiPublicKey);
      console.log(signedChallenge);

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

          // Remove the pending request after 2 seconds
          setTimeout(() => {
            this.database.remove(this.body.username, 'requests', challengeId);
          }, 2000);
        }).catch(reject);
      });
    });
  }

  generateChallenge() {
    return this.database.authentication.generateSalt();
  }

  check() {
    return Promise.resolve({ checked: true });
  }
}

module.exports = ApiHandler;
