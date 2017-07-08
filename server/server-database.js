const _ = require('lodash');

const Database = require('../client/models/database.js');

class ServerDatabase extends Database {
  constructor(authentication) {
    super('./server-data.db')
    this.authentication = authentication;
  }

  migrate(database) {
    return new Promise((resolve, reject) => {
      database.run(
        'CREATE TABLE WhisperServer (username TEXT, kind TEXT, identifier TEXT, value BLOB)',
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

  processPutValue(value, options) {
    return new Promise((resolve, reject) => {
      if (options.json) {
        value = JSON.stringify(value);
      }

      if (this.authentication.authenticated()) {
        this.authentication.encrypt(value).then((encrypted) => {
          resolve(encrypted);
        }).catch(reject);
      } else {
        reject('no authentication');
      }
    });
  }

  processGetValue(value, options) {
    return new Promise((resolve, reject) => {
      if (this.authentication.authenticated()) {
        this.authentication.decrypt(value).then((decrypted) => {
          if (options.json) {
            resolve(JSON.parse(decrypted));
          } else {
            resolve(decrypted);
          }
        }).catch(reject);
      } else {
        reject('no authentication');
      }
    });
  }

  get(username, kind, identifier = null, options = {}) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        database.get(
          `SELECT * FROM WhisperServer WHERE username = ? AND kind = ? AND identifier ${ identifier ? '= ?' : 'IS NULL'}`,
          identifier ? [ username, kind, identifier ] : [username, kind ],
          (err, row) => {
            if (err) {
              reject(err);
            } else if (!row) {
              resolve(null);
            } else {
              this.processGetValue(row.value, options).then((processedValue) => {
                resolve(processedValue);
              }).catch(reject);
            }
          }
        );
      }).catch(reject);
    });
  }

  getInfo(username) {
    return this.get(username, 'info', null, { json: true });
  }

  getPreKey(username) {
    return new Promise((resolve, reject) => {
      this.getAll(username, 'preKey', { json: true }).then((preKeys) => {
        if (preKeys.length) {
          const preKey = _.first(preKeys);

          // preKeys are only used once
          this.remove(username, 'preKey', preKey.keyId).then(() => {
            resolve(preKey);
          }).catch(reject);
        } else {
          // the one-time preKey is optional
          resolve(null);
        }
      }).catch(reject);
    });
  }

  getSignedPreKey(username) {
    return new Promise((resolve, reject) => {
      this.getAll(username, 'signedPreKey', { json: true }).then((signedPreKeys) => {
        if (signedPreKeys.length) {
          resolve(_.last(signedPreKeys));
        } else {
          reject('no signed preKey found');
        }
      }).catch(reject);
    });
  }

  getAll(username, kind, options = {}) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        database.all(
          `SELECT * FROM WhisperServer WHERE username = ? AND kind = ?`,
          [ username, kind ],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              const processedResults = rows.map((row) => {
                return this.processGetValue(row.value, options);
              });

              Promise.all(processedResults).then((processed) => {
                resolve(processed);
              }).catch(reject);
            }
          }
        );
      }).catch(reject);
    });
  }

  put(username, kind, identifier, value, options = {}) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        // Don't duplicate entries
        this.remove(username, kind, identifier, options).then(() => {
          this.processPutValue(value, options).then((processedValue) => {
            database.run(
              'INSERT INTO WhisperServer (username, kind, identifier, value) VALUES (?, ?, ?, ?)',
              [ username, kind, identifier, processedValue ],
              (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  remove(username, kind, identifier = null, options = {}) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        database.run(
          `DELETE FROM WhisperServer WHERE username = ? AND kind = ? AND identifier ${ identifier ? '= ?' : 'IS NULL'}`,
          identifier ? [ username, kind, identifier ] : [ username, kind ],
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      }).catch(reject);
    });
  }
}

module.exports = ServerDatabase;
