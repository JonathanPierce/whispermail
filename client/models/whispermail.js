const Authentication = require('./authentication.js');
const SignalStore = require('./signal-store.js');
const ServerClient = require('./server-client.js');
const MessageHandler = require('./message-handler.js');

class WhisperMail {
  constructor() {
    this.authentication = new Authentication();
    this.signalStore = new SignalStore(this.authentication);
    this.serverClient = new ServerClient(this.signalStore);
    this.messageHandler = new MessageHandler(this.signalStore, this.serverClient);
  }

  hasUser() {
    return this.authentication.hasLoginInfo();
  }

  authenticated() {
    return this.authentication.authenticated();
  }

  login(password) {
    // TODO: Check server authentication / connection
    return this.authentication.login(password).then(() => {
      return this.serverClient.checkCredentials();
    });
  }

  createUser(password, loginInfo) {
    return new Promise((resolve, reject) => {
      const destroyLoginInfo = (err) => {
        this.authentication.destroyLoginInfo().then(() => {
          reject(err);
        }).catch(reject);
      };

      this.hasUser().then((hasUser) => {
        if (hasUser) {
          return reject('user already exists');
        }

        this.authentication.createLoginInfo(password, loginInfo).then(() => {
          this.signalStore.createNewSignalKeys().then(() => {
            this.serverClient.register().then(() => {
              // TODO: Generate prekeys
              resolve();
            }).catch(destroyLoginInfo);
          }).catch(destroyLoginInfo);
        }).catch(reject);
      });
    });
  }
}

module.exports = new WhisperMail();
