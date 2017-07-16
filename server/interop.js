const fetch = require('node-fetch');
const validator = require('validator');
const _ = require('lodash');

function getUsername(recipient) {
  return recipient.split('@')[0];
}

function getServer(recipient) {
  return recipient.split('@')[1];
}

const METHODS = {
  GET_RECIPIENT: 'getRecipient',
  SEND_MESSAGE: 'sendMessage'
};

class InteropSender {
  getRecipient(recipient) {
    return fetch(`http://${getServer(recipient)}/interop`, {
      method: 'POST',
      body: JSON.stringify({
        method: METHODS.GET_RECIPIENT,
        payload: {
          username: getUsername(recipient)
        }
      }),
      headers: { 'content-type': 'application/json' }
    }).then((response) => {
      return response.json();
    });
  }

  sendMessage(message) {
    return fetch(`http://${getServer(message.recipient)}/interop`, {
      method: 'POST',
      body: JSON.stringify({
        method: METHODS.SEND_MESSAGE,
        payload: message
      }),
      headers: { 'content-type': 'application/json' }
    }).then((response) => {
      return response.json();
    });
  }
}

class InteropReceiver {
  constructor(req, res, database) {
    this.req = req;
    this.res = res;
    this.database = database;
    this.body = this.req.body;
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

      if (!this.body.method || !this.body.payload) {
        return flushError('missing method or payload');
      }

      if (!_.includes(_.values(METHODS), this.body.method)) {
        return flushError('unsupported method');
      }

      this[this.body.method](this.body.payload).then(flushResult).catch(flushError);
    });
  }

  getRecipient() {
    if (!this.body.payload.username) {
      return Promise.reject('no username specified');
    }

    return new Promise((resolve, reject) => {
      const username = this.body.payload.username.toLowerCase();

      this.database.getInfo(username).then((info) => {
        if (info) {
          Promise.all([
            this.database.getPreKey(username),
            this.database.getSignedPreKey(username)
          ]).then((preKeys) => {
            const preKey = preKeys[0];
            const signedPreKey = preKeys[1];

            const response = {
              name: info.name,
              registrationId: info.registrationId,
              identityKey: info.publicKey,
              signedPreKey: {
                keyId: signedPreKey.keyId,
                publicKey: signedPreKey.publicKey,
                signature: signedPreKey.signature
              },
              preKey: preKey
            };

            resolve(response);
          }).catch(reject);
        } else {
          reject('no such user found');
        }
      }).catch(reject);
    });
  }

  sendMessage() {
    if (
      !this.body.payload.signalVersion ||
      !this.body.payload.from ||
      !this.body.payload.recipient ||
      !this.body.payload.data ||
      !this.body.payload.id
    ) {
      return Promise.reject('message does not match schema');
    }

    if (
      !_.includes([1,3], this.body.payload.signalVersion) ||
      !validator.isEmail(this.body.payload.from) ||
      !validator.isEmail(this.body.payload.recipient) ||
      !validator.isBase64(this.body.payload.data) ||
      !validator.isUUID(this.body.payload.id, 4)
    ) {
      return Promise.reject('message does not meet validation');
    }

    return new Promise((resolve, reject) => {
      const username = getUsername(this.body.payload.recipient).toLowerCase();

      this.database.getInfo(username).then((info) => {
        if (info) {
          const message = {
            signalVersion: this.body.payload.signalVersion,
            from: this.body.payload.from,
            recipient: this.body.payload.recipient,
            data: this.body.payload.data,
            id: this.body.payload.id
          };

          this.database.put(
            username,
            'messages',
            this.body.payload.id,
            message,
            { json: true }
          ).then(() => {
            resolve({ received: true });
          }).catch(reject);
        } else {
          reject('no such user found');
        }
      }).catch(reject);
    });
  }
}

module.exports = {
  InteropSender,
  InteropReceiver
};
