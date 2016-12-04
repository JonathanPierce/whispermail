const SignalStore = require('./signal_store.js');

const ServerIO = {
  register() {

  },

  deregister() {

  },

  // STUBBED FOR TESTING PURPOSES
  sendMessage(message) {
    return Promise.resolve();
  },

  getMessages() {

  },

  getMessageTree() {

  },

  remove() {

  },

  // STUBBED FOR TESTING PURPOSES
  getRecipient(email) {
    return new Promise((resolve, reject) => {
      Promise.all([
        SignalStore.getLocalRegistrationId(),
        SignalStore.getIdentityKeyPair(),
        SignalStore.generateNextSignedPreKey(),
        SignalStore.generateNextPreKey()
      ]).then((results) => {
        resolve({
          name: 'name goes here',
          email: email,
          registrationId: results[0],
          identityKey: results[1].pubKey,
          signedPreKey: {
            keyId: results[2].keyId,
            publicKey: results[2].keyPair.pubKey,
            signature: results[2].signature
          },
          preKey: {
            keyId: results[3].keyId,
            publicKey: results[3].keyPair.pubKey
          }
        });
      }).catch(reject);
    });
  },

  pushPreKey() {

  },

  pushSignedPreKey() {

  }
};

module.exports = ServerIO;
