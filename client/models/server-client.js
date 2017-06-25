const SignalStore = require('./signal-store.js');
const fetch = require('node-fetch');

class ServerClient {
  constructor(signalStore) {
    this.signalStore = signalStore;
  }

  makeRequest(method, payload = null) {
    return this.signalStore.authentication.getLoginInfo().then((loginInfo) => {
      const url = `http://${loginInfo.serverAddress}/api`; // TODO: Go HTTPS only

      return fetch(url, {
        method: 'POST',
        body: JSON.stringify({
          username: loginInfo.username,
          method,
          payload
        })
      }).then((response) => {
        return response.json().then((challenge) => {
          return this.signalStore.getIdentityKeyPair().then((keyPair) => {
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

  register(payload) {
    return this.signalStore.getLoginInfo().then((loginInfo) => {
      const url = `http://${loginInfo.serverAddress}:${loginInfo.serverPort}/register`; // TODO: Go HTTPS only

      return Promise.all([
        this.signalStore.getIdentityKeyPair(),
        this.signalStore.getLocalRegistrationId()
      ]).then((results) => {
        return fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            username: loginInfo.username,
            name: loginInfo.name,
            publicKey: SignalStore.Helpers.toString(results[0].pubKey),
            registrationId: results[1]
          })
        }).then((response) => {
          return response.json();
        });
      });
    });
  }

  checkCredentials() {
    return makeRequest('check');
  }

  deregister() {
    return makeRequest('deregister');
  }

  getMessages(payload) {
    return makeRequest('getMessages', payload);
  }

  sendMessage(payload) {
    return makeRequest('sendMessage', payload);
  }

  getRecipient(payload) {
    return makeRequest('getRecipient', payload);
  }

  pushPreKey() {
    return this.signalStore.generateNextPreKey().then((preKey) => {
      return makeRequest('pushPreKey', {
        keyId: preKey.keyId,
        publicKey: SignalStore.Helpers.toString(preKey.keyPair.pubKey)
      });
    });
  }

  pushSignedPreKey() {
    return this.signalStore.generateNextSignedPreKey().then((preKey) => {
      return makeRequest('pushSignedPreKey', {
        keyId: preKey.keyId,
        publicKey: SignalStore.Helpers.toString(preKey.keyPair.pubKey),
        signature: SignalStore.Helpers.toString(preKey.signature)
      });
    });
  }
}

module.exports = ServerClient;
