const SignalStore = require('./signal_store.js');
const fetch = require('node-fetch');

function makeRequest(method, payload = null) {
  return SignalStore.getLoginInfo().then((loginInfo) => {
    const url = `http://${loginInfo.serverAddress}:${loginInfo.serverPort}/api`; // TODO: Go HTTPS only

    return fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        username: loginInfo.username,
        method,
        payload
      })
    }).then((response) => {
      return response.json().then((challenge) => {
        return SignalStore.getIdentityKeyPair().then((keyPair) => {
          return libsignal.Curve.calculateSignature(
            keyPair.privKey,
            challenge.challenge
          ).then((signedChallenge) => {
            return fetch(url, {
              method: 'POST',
              body: JSON.stringify({
                id: challenge.id,
                signedChallenge
              })
            }).then((response) => {
              return response.json();
            });
          });
        });
      });
    });
  });
}

const ServerIO = {
  register(payload) {
    return SignalStore.getLoginInfo().then((loginInfo) => {
      const url = `http://${loginInfo.serverAddress}:${loginInfo.serverPort}/register`; // TODO: Go HTTPS only

      return Promise.all([
        SignalStore.getIdentityKeyPair(),
        SignalStore.getLocalRegistrationId()
      ]).then((results) => {
        return fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            username: loginInfo.username,
            name: loginInfo.name,
            publicKey: SignalStore.helpers.toString(results[0].pubKey),
            registrationId: results[1]
          })
        }).then((response) => {
          return response.json();
        });
      });
    });
  },

  checkCredentials() {
    return makeRequest('check');
  },

  deregister() {
    return makeRequest('deregister');
  },

  getMessages(payload) {
    return makeRequest('getMessages', payload);
  },

  sendMessage(payload) {
    return makeRequest('sendMessage', payload);
  },

  getRecipient(payload) {
    return makeRequest('getRecipient', payload);
  },

  pushPreKey() {
    return SignalStore.generateNextPreKey().then((preKey) => {
      return makeRequest('pushPreKey', {
        keyId: preKey.keyId,
        publicKey: SignalStore.helpers.toString(preKey.keyPair.pubKey)
      });
    });
  },

  pushSignedPreKey() {
    return SignalStore.generateNextSignedPreKey().then((preKey) => {
      return makeRequest('pushSignedPreKey', {
        keyId: preKey.keyId,
        publicKey: SignalStore.helpers.toString(preKey.keyPair.pubKey),
        signature: SignalStore.helpers.toString(preKey.signature)
      });
    });
  }
};

module.exports = ServerIO;
