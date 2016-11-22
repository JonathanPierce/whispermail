'use strict';

let crypto = require('crypto');
let SignalStore = require('./signal_store.js');

const canaryValue = "MakeAmericaGreatAgain";
let derivedPassword;

function validatePassword(attemptedPassword) {
  return new Promise((resolve, reject) => {
    SignalStore.getLoginInfo().then((loginInfo) => {
      if (loginInfo) {
        derivePassword(attemptedPassword, loginInfo.salt).then((derived) => {
          Authentication.decrypt(loginInfo.canaryCheck, derived).then((decrypted) => {
            if (decrypted === canaryValue) {
              derivedPassword = derived;
              resolve();
            } else {
              reject("decrypted does not match canary");
            }
          }).catch(reject);
        }).catch(reject);
      } else {
        reject("no login information found");
      }
    }).catch(reject);
  });
}

function derivePassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 250000, 512, 'sha512', (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    })
  });
}

let Authentication = {
  hasAuthentication() {
    return derivedPassword != null;
  },

  hasLoginInfo() {
    return new Promise((resolve) => {
      SignalStore.getLoginInfo().then((loginInfo) => {
        resolve(loginInfo != null);
      }).catch(() => resolve(false));
    });
  },

  createLoginInfo(password, options) {
    return new Promise((resolve, reject) => {
      Authentication.hasLoginInfo().then((hasLoginInfo) => {
        if (hasLoginInfo) {
          reject();
        } else {
          crypto.randomBytes(32, (err, salt) => {
            if (err) {
              reject(err);
            } else {
              salt = salt.toString('base64');

              derivePassword(password, salt).then((derived) => {
                Authentication.encrypt(canaryValue, derived).then((canaryCheck) => {
                  SignalStore.setLoginInfo(
                    options.serverAddress,
                    options.serverPort,
                    options.username,
                    options.name,
                    salt,
                    canaryCheck
                  );

                  derivedPassword = derived;
                  SignalStore.getLoginInfo().then(resolve).catch(reject);
                }).catch(reject);
              });
            }
          });
        }
      });
    });
  },

  setPassword(password) {
    return new Promise((resolve, reject) => {
      validatePassword(password).then(resolve).catch(reject);
    });
  },

  encrypt(plaintext, alternativeDerived = null) {
    let key = alternativeDerived || derivedPassword;
    let cipher = crypto.createCipher('aes-256-cbc', key);

    return new Promise((resolve, reject) => {
      let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
      ciphertext += cipher.final('base64');
      resolve(ciphertext);
    });
  },

  decrypt(ciphertext, alternativeDerived = null) {
    let key = alternativeDerived || derivedPassword;
    let decipher = crypto.createDecipher('aes-256-cbc', key);

    return new Promise((resolve, reject) => {
      let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
      plaintext += decipher.final('utf8');
      resolve(plaintext);
    });
  }
};

module.exports = Authentication;
