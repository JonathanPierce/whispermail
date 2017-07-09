const Authentication = require('../models/authentication.js');
const SignalStore = require('../models/signal-store.js');
const ServerClient = require('../models/server-client.js');
const MessageHandler = require('../models/message-handler.js');

const fs = require('fs');

module.exports = {
  test() {
    const authentication = new Authentication();
    fs.unlinkSync('test/store-one.db');
    fs.unlinkSync('test/store-two.db');

    return authentication.login('password').then(() => {
      const storeOne = new SignalStore(authentication, 'test/store-one.db');
      const storeTwo = new SignalStore(authentication, 'test/store-two.db');

      const setupUser = (store) => {
        return store.createNewSignalKeys();
      };

      return Promise.all([
        setupUser(storeOne),
        setupUser(storeTwo)
      ]).then(() => {
        const message = JSON.stringify({
          some: "json",
          testing: "data",
          whee: 123
        });

        const fromUser = 'from@test.com';
        const toUser = 'to@test.com';

        const address = new libsignal.SignalProtocolAddress(toUser, '0');
        const sessionCipher = new libsignal.SessionCipher(storeOne, address);
        const sessionBuilder = new libsignal.SessionBuilder(storeOne, address);

        return Promise.all([
          storeTwo.getIdentityKeyPair(),
          storeTwo.generateNextPreKey(),
          storeTwo.generateNextSignedPreKey(),
          storeTwo.getLocalRegistrationId()
        ]).then((results) => {
          return sessionBuilder.processPreKey({
            registrationId: results[3],
            identityKey: results[0].pubKey,
            signedPreKey: {
              keyId: results[2].keyId,
              publicKey: results[2].keyPair.pubKey,
              signature: results[2].signature
            },
            preKey: {
              keyId: results[1].keyId,
              publicKey: results[1].keyPair.pubKey
            }
          }).then(() => {
            return sessionCipher.encrypt(message).then((encrypted) => {
              const cipherData = {
                signalVersion: encrypted.type,
                from: fromUser,
                recipient: toUser,
                data: SignalStore.Helpers.toString(
                  SignalStore.Helpers.toArrayBuffer(encrypted.body),
                  'base64'
                ),
                id: message.id
              };

              const fromAddress = new libsignal.SignalProtocolAddress(fromUser, '0');
              const decryptSession = new libsignal.SessionCipher(storeTwo, fromAddress);

              return decryptSession.decryptPreKeyWhisperMessage(
                SignalStore.Helpers.toArrayBuffer(cipherData.data, 'base64'),
                'binary'
              ).then((decrypted) => {
                const parsedMessage = JSON.parse(SignalStore.Helpers.toString(decrypted));
                console.log('WE DID IT!');
                console.log(parsedMessage);
                return parsedMessage;
              });
            });
          });
        });
      })
    });
  }
};
