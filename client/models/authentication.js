const Database = require('./database.js');
const crypto = require('crypto');

const CANARY = 'MakeAmericaGreatAgain';

class Authentication extends Database {
  constructor() {
    super('./login-info.db');
    this.privateKey = null;
  }

  migrate(database) {
    return new Promise((resolve, reject) => {
      database.run(
        'CREATE TABLE LoginInfo (serverAddress TEXT, username TEXT, name TEXT, salt TEXT, canaryCheck BLOB)',
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

  authenticated() {
    return this.privateKey !== null;
  }

  logout() {
    this.privateKey = null;
  }

  getLoginInfo() {
    return this.withCache('getLoginInfo', () => {
      return new Promise((resolve, reject) => {
        this.getDatabase().then((database) => {
          database.get('SELECT * FROM LoginInfo', (err, loginInfo) => {
            if (err) {
              reject(err);
            } else if (!loginInfo) {
              resolve(null);
            } else {
              resolve(loginInfo);
            }
          });
        }).catch(reject);
      });
    });
  }

  destroyLoginInfo() {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        database.run('DELETE FROM LoginInfo', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }).catch(reject);
    });
  }

  createLoginInfo(password, newLoginInfo) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        return this.generateSalt().then((salt) => {
          return this.derivePassword(password, salt).then((privateKey) => {
            return this.encrypt(CANARY, privateKey).then((canaryCheck) => {
              database.run(
                'INSERT INTO LoginInfo (serverAddress, username, name, salt, canaryCheck) VALUES (?, ?, ?, ?, ?)',
                [newLoginInfo.serverAddress, newLoginInfo.username, newLoginInfo.name, salt, canaryCheck],
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

  hasLoginInfo() {
    return new Promise((resolve, reject) => {
      this.getLoginInfo().then((loginInfo) => {
        resolve(loginInfo !== null);
      }).catch(() => resolve(false));
    });
  }

  generateSalt() {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(32, (err, salt) => {
        if (err) {
          reject(err);
        } else {
          resolve(salt.toString('base64'));
        }
      });
    });
  }

  derivePassword(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 250000, 512, 'sha512', (err, derived) => {
        if (err) {
          reject(err);
        } else {
          resolve(derived);
        }
      })
    });
  }

  login(password) {
    if (this.authenticated()) {
      return Promise.reject('already logged in');
    }

    return new Promise((resolve, reject) => {
      this.getLoginInfo().then((loginInfo) => {
        if (loginInfo) {
          this.derivePassword(password, loginInfo.salt).then((privateKey) => {
            this.decrypt(loginInfo.canaryCheck, privateKey).then((decrypted) => {
              if (decrypted === CANARY) {
                this.privateKey = privateKey;
                resolve();
              } else {
                reject('incorrect password');
              }
            }).catch(reject);
          }).catch(reject);
        } else {
          reject('no login info');
        }
      }).catch(reject);
    });
  }

  encrypt(plaintext, alternativeKey = null) {
    let key = alternativeKey || this.privateKey;
    let cipher = crypto.createCipher('aes-256-cbc', key);

    return new Promise((resolve, reject) => {
      if (!key) {
        reject('no key provided');
      }

      let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
      ciphertext += cipher.final('base64');
      resolve(ciphertext);
    });
  }

  decrypt(ciphertext, alternativeKey = null) {
    let key = alternativeKey || this.privateKey;
    let decipher = crypto.createDecipher('aes-256-cbc', key);

    return new Promise((resolve, reject) => {
      if (!key) {
        reject('no key provided');
      }

      let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
      plaintext += decipher.final('utf8');
      resolve(plaintext);
    });
  }
}

module.exports = Authentication;
