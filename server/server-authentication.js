const Authentication = require('../client/models/authentication.js');

const CANARY = 'MakeAmericaGreatAgain';

class ServerAuthentication extends Authentication {
  migrate(database) {
    return new Promise((resolve, reject) => {
      database.run(
        'CREATE TABLE LoginInfo (salt TEXT, canaryCheck BLOB)',
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  createLoginInfo(password) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        return this.generateSalt().then((salt) => {
          return this.derivePassword(password, salt).then((privateKey) => {
            return this.encrypt(CANARY, privateKey).then((canaryCheck) => {
              database.run(
                'INSERT INTO LoginInfo (salt, canaryCheck) VALUES (?, ?)',
                [salt, canaryCheck],
                (err) => {
                  if (err) {
                    reject(err);
                  } else {
                    this.login(password).then(resolve).catch(reject);
                  }
                }
              );
            });
          });
        });
      }).catch(reject);
    });
  }
}

module.exports = ServerAuthentication;
