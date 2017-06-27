const SignalStore = require('./signal-store.js');
const nacl = require('tweetnacl');

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
        }),
        headers: { 'content-type': 'application/json' }
      }).then((response) => {
        return response.json().then((challenge) => {
          return this.signalStore.getApiKeyPair().then((keyPair) => {
            const signedChallenge = nacl.sign.detached(
              new Uint8Array(
                SignalStore.Helpers.toArrayBuffer(challenge.challenge, 'base64')
              ),
              new Uint8Array(keyPair.privKey)
            );

            return fetch(url, {
              method: 'POST',
              body: JSON.stringify({
                username: loginInfo.username,
                method: 'challengeResponse',
                payload: {
                  challengeId: challenge.challengeId,
                  signedChallenge: SignalStore.Helpers.toString(signedChallenge, 'base64')
                }
              }),
              headers: { 'content-type': 'application/json' }
            }).then((response) => {
              return response.json();
            });
          });
        });
      });
    });
  }

  register(payload) {
    return this.signalStore.authentication.getLoginInfo().then((loginInfo) => {
      const url = `http://${loginInfo.serverAddress}/register`; // TODO: Go HTTPS only

      return Promise.all([
        this.signalStore.getIdentityKeyPair(),
        this.signalStore.getApiKeyPair(),
        this.signalStore.getLocalRegistrationId()
      ]).then((results) => {
        return fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            username: loginInfo.username,
            name: loginInfo.name,
            publicKey: SignalStore.Helpers.toString(results[0].pubKey, 'base64'),
            registrationId: results[2],
            apiPublicKey: SignalStore.Helpers.toString(results[1].pubKey, 'base64')
          }),
          headers: { 'content-type': 'application/json' }
        }).then((response) => {
          return response.json();
        });
      });
    });
  }

  checkCredentials() {
    return this.makeRequest('check');
  }

  deregister() {
    return this.makeRequest('deregister');
  }

  getMessages(payload) {
    return this.makeRequest('getMessages', payload);
  }

  sendMessage(payload) {
    return this.makeRequest('sendMessage', payload);
  }

  getRecipient(payload) {
    return this.makeRequest('getRecipient', payload);
  }

  pushPreKey() {
    return this.signalStore.generateNextPreKey().then((preKey) => {
      return this.makeRequest('pushPreKey', {
        keyId: preKey.keyId,
        publicKey: SignalStore.Helpers.toString(preKey.keyPair.pubKey, 'base64')
      });
    });
  }

  pushSignedPreKey() {
    return this.signalStore.generateNextSignedPreKey().then((preKey) => {
      return this.makeRequest('pushSignedPreKey', {
        keyId: preKey.keyId,
        publicKey: SignalStore.Helpers.toString(preKey.keyPair.pubKey, 'base64'),
        signature: SignalStore.Helpers.toString(preKey.signature, 'base64')
      });
    });
  }
}

module.exports = ServerClient;
