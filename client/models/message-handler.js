const packageJSON = require('../package.json');
const uuidV4 = require('uuid/v4');

/*

Message schema:

{
  signalVersion: <1 or 3>,
  session: <email string>,
  data: <base64 data>
}

Data schema:

{
  id: <guid>,
  parentId: <guid or null>,
  whispermailVersion: <string>,
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

class MessageHelper {
  constructor(signalStore, serverClient) {
    this.signalStore = signalStore;
    this.serverClient = serverClient;
  }

  /*

  STEPS:

  1. Find or create sessions for each recipient
  2. Encrypt the message for each recipient
  3. Have the server send the message for each recipient.
  4. Save the message to the DB

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
          whispermailVersion: packageJSON.version,
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

        this.saveMessage(json).then(() => {
          Promise.all(sentMessages).then((messages) => {
            resolve(json);
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  sendIndividualMessage(message, recipient) {
    return new Promise((resolve, reject) => {
      this.establishRecipientSession(recipient.email).then(() => {
        const address = new libsignal.SignalProtocolAddress(recipient.email, '0');
        const sessionCipher = new libsignal.SessionCipher(SignalStore, address);

        sessionCipher.encrypt(JSON.stringify(message)).then((encrypted) => {
          const data = {
            signalVersion: encrypted.type,
            session: recipient.email,
            data: encrypted.body
          };

          this.serverClient.sendMessage(data).then(() => {
            resolve(data);
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  getEmail(loginInfo) {
    return `${loginInfo.username}@${loginInfo.serverAddress}`;
  }

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
          this.serverClient.getRecipient(email).then((recipientInfo) => {
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
  }

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

      decryptor(message.data, 'binary').then((plaintext) => {
        const parsedMessage = JSON.parse(SignalStore.helpers.toString(plaintext));
        this.saveMessage(parsedMessage).then(resolve).catch(reject);
      }).catch(reject);
    });
  }

  saveMessage(message) {
    return this.signalStore.putMessage(message);
  }

  // Deletes the message tree rooted at the message
  deleteMessage() {
    // TODO
  }

  getRootMessages() {
    return this.signalStore.getMessages();
  }

  getMessageTree(message) {
    return new Promise((resolve, reject) => {
      this.signalStore.getMessages(message.id).then((replies) => {
        message.replies = replies;

        let promises = message.replies.map((message) => {
          return this.getMessageTree(message);
        });

        Promise.all(promises).then(() => resolve(message)).catch(reject);
      });
    });
  }
}

module.exports = MessageHelper;