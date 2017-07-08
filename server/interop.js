const fetch = require('node-fetch');
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
    return fetch(`http://${getServer(message.session)}/interop`, {
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
      const username = this.body.payload.username;

      this.database.getInfo(username).then((info) => {
        if (info) {
          Promise.all([
            this.database.getPreKey(username),
            this.database.getSignedPreKey(username)
          ]).then((preKeys) => {
            const preKey = preKeys[0];
            const signedPreKey = preKeys[1];

            const response = {
              registrationId: info.registrationId,
              identityKey: info.publicKey,
              signedPreKey: signedPreKey,
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
      !this.body.payload.recipient ||
      !this.body.payload.data ||
      !this.body.payload.id
    ) {
      return Promise.reject('message does not match schema');
    }

    return new Promise((resolve, reject) => {
      const username = getUsername(this.body.payload.recipient);

      this.database.getInfo(username).then((info) => {
        if (info) {
          const message = {
            signalVersion: this.body.payload.signalVersion,
            recipient: this.body.recipient,
            data: this.body.payload.data
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
