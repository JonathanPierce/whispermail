const packageJSON = require('../package.json');
const uuidV4 = require('uuid/v4');
const _ = require('lodash');

const SignalStore = require('./signal-store.js');

/*

Message schema:

{
  signalVersion: <1 or 3>,
  from: <email string>,
  recipient: <email string>,
  id: <guid string>,
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
      this.signalStore.authentication.getLoginInfo().then((loginInfo) => {
        const id = uuidV4();
        const from = {
          name: loginInfo.name,
          email: this.getEmail(loginInfo)
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
          return this.sendIndividualMessage(json, recipient, loginInfo);
        });

        this.saveMessage(json).then(() => {
          Promise.all(sentMessages).then((messages) => {
            resolve(json);
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  sendIndividualMessage(message, recipient, loginInfo) {
    return new Promise((resolve, reject) => {
      this.establishRecipientSession(recipient.email).then(() => {
        const address = new libsignal.SignalProtocolAddress(recipient.email, '0');
        const sessionCipher = new libsignal.SessionCipher(this.signalStore, address);

        sessionCipher.encrypt(JSON.stringify(message)).then((encrypted) => {
          const data = {
            signalVersion: encrypted.type,
            from: `${loginInfo.username}@${loginInfo.serverAddress}`,
            recipient: recipient.email,
            data: SignalStore.Helpers.toString(
              SignalStore.Helpers.toArrayBuffer(encrypted.body),
              'base64'
            ),
            id: message.id
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
    const sessionCipher = new libsignal.SessionCipher(this.signalStore, address);
    const sessionBuilder = new libsignal.SessionBuilder(this.signalStore, address);

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
              preKey: {} // keyId and publicKey are undefined
            };

            if (recipientInfo.preKey) {
              input.preKey = {
                keyId: recipientInfo.preKey.keyId,
                publicKey: recipientInfo.preKey.publicKey
              }
            }

            sessionBuilder.processPreKey(input).then(() => {
              this.signalStore.saveRecipientInfo(email, {
                name: recipientInfo.name,
                verifiedFingerprint: false
              }).then(resolve).catch(reject);
            }).catch(reject);
          }).catch(reject);
        }
      }).catch(reject);
    });
  }

  getNewMessages() {
    return this.serverClient.getMessages().then((messages) => {
      return Promise.all(
        _.map(messages, (message) => this.handleMessage(message))
      );
    });
  }

  // Decrypt a message from the server
  handleMessage(message) {
    return new Promise((resolve, reject) => {
      const address = new libsignal.SignalProtocolAddress(message.from, '0');
      const sessionCipher = new libsignal.SessionCipher(this.signalStore, address);

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

  check() {
    return this.serverClient.check().then((check) => {
      const promises = [];

      if (check.sendPreKeys) {
        promises.push(this.pushPreKeys(25));
      }

      if (check.sendSignedPreKey) {
        promises.push(this.pushSignedPreKey());
      }

      return Promise.all(promises);
    });
  }

  pushPreKeys(count) {
    const promises = _.times(count, () => this.serverClient.pushPreKey());
    return Promise.all(promises);
  }

  pushSignedPreKey() {
    return this.serverClient.pushSignedPreKey();
  }
}

module.exports = MessageHelper;
