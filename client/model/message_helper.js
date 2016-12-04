const SignalStore = require('./signal_store.js');
const ServerIO = require('./server_io.js');

const uuidV4 = require('uuid/v4');

/*

Message schema:

{
  id: <guid>,
  signalVersion: <1 or 3>,
  whispermailVersion: <string>,
  session: <email string>,
  data: <base64 data>
}

Data schema:

{
  id: <guid>,
  parentId: <guid or null>,
  subject: <string>, // only if parentId is null
  sent: <current time>
  from: {
    name: <string>,
    email: <string>
  },
  recipients: [
    {
      name: <string>,
      email: <string>
    }
  ],
  message: <string>
}

*/

function sendIndividualMessage(message, recipient) {
  return new Promise((resolve, reject) => {
    MessageHelper.establishRecipientSession(recipient.email).then(() => {
      const address = new libsignal.SignalProtocolAddress(recipient.email, '0');
      const sessionCipher = new libsignal.SessionCipher(SignalStore, address);

      sessionCipher.encrypt(JSON.stringify(message)).then((encrypted) => {
        const data = {
          id: message.id,
          signalVersion: encrypted.type,
          whispermailVersion: '1.0', // TODO: Pull from package JSON
          session: recipient.email,
          data: btoa(encrypted.body)
        };

        ServerIO.sendMessage(data).then(() => {
          resolve(data);
        }).catch(reject);
      }).catch(reject);
    }).catch(reject);
  });
}

function getEmail(loginInfo) {
  return `${loginInfo.username}@${loginInfo.serverAddress}:${loginInfo.serverPort}`;
}

let MessageHelper = {
  /*

  STEPS:

  1. Find or create sessions for each recipient
  2. Encrypt the message for each recipient
  3. Have the server send the message for each recipient
  4. Save the message send to the first recipient to the server. This will be our copy.
  5. Update application state with our copy of the message.

  */

  sendMessage(parentId, message, recipients, subject = '') {
    return new Promise((resolve, reject) => {
      SignalStore.getLoginInfo().then((loginInfo) => {
        const id = uuidV4();
        const from = {
          name: loginInfo.name,
          email: getEmail(loginInfo)
        };

        const json = {
          id,
          from,
          sent: Date.now(),
          recipients,
          message
        };

        if (parentId) {
          json.parentId = parentId;
        } else {
          json.subject = subject;
        }

        const sentMessages = recipients.map((recipient) => {
          return sendIndividualMessage(json, recipient);
        });

        Promise.all(sentMessages).then((messages) => {
          const ourCopy = messages[0];

          // DEBUG
          window.data = ourCopy;

          resolve(ourCopy);
        }).catch(reject);
      }).catch(reject);
    });
  },

  // Reuse existing or fetch info from server to establish new
  establishRecipientSession(email) {
    const address = new libsignal.SignalProtocolAddress(email, '0');
    const sessionCipher = new libsignal.SessionCipher(SignalStore, address);
    const sessionBuilder = new libsignal.SessionBuilder(SignalStore, address);

    return new Promise((resolve, reject) => {
      sessionCipher.hasOpenSession().then((hasOpenSession) => {
        if (hasOpenSession) {
          resolve();
        } else {
          ServerIO.getRecipient(email).then((recipientInfo) => {
            const input = {
              registrationId: recipientInfo.registrationId,
              identityKey: recipientInfo.identityKey,
              signedPreKey: {
                keyId: recipientInfo.signedPreKey.keyId,
                publicKey: recipientInfo.signedPreKey.publicKey,
                signature: recipientInfo.signedPreKey.signature
              },
              preKey: {
                keyId: recipientInfo.preKey.keyId,
                publicKey: recipientInfo.preKey.publicKey
              }
            };

            sessionBuilder.processPreKey(input).then(resolve).catch(reject);
          }).catch(reject);
        }
      }).catch(reject);
    });
  },

  // Decrypt a message from the server
  handleMessage(message) {
    return new Promise((resolve, reject) => {
      const address = new libsignal.SignalProtocolAddress(message.session, '0');
      const sessionCipher = new libsignal.SessionCipher(SignalStore, address);

      let decryptor;
      if (message.signalVersion === 3) {
        decryptor = sessionCipher.decryptPreKeyWhisperMessage;
      } else {
        decryptor = sessionCipher.decryptWhisperMessage;
      }

      decryptor(atob(message.data), 'binary').then((plaintext) => {
        resolve(JSON.parse(SignalStore.helpers.toString(message)));
      }).catch(reject);
    });
  }
};

module.exports = MessageHelper;
