'use strict';

let sqlite3 = require('sqlite3').verbose();
let fs = require('fs');
let Authentication;

let database;
let location = './client.db';

function processPutValue(value, options) {
  return new Promise((resolve, reject) => {
    if (options.plaintext) {
      resolve(value);
    } else {
      // handle circular dependency
      Authentication = Authentication || require('./authentication.js');

      if (Authentication.hasAuthentication()) {
        Authentication.encrypt(value).then((encrypted) => {
          resolve(encrypted);
        }).catch(reject);
      } else {
        reject('no authentication');
      }
    }
  });
}

function processGetValue(value, options) {
  return new Promise((resolve, reject) => {
    function resolveValue(valueToResolve) {
      if (options.json) {
        resolve(JSON.parse(valueToResolve));
      } else {
        resolve(valueToResolve);
      }
    }

    if (options.plaintext) {
      resolveValue(value);
    } else {
      // handle circular dependency
      Authentication = Authentication || require('./authentication.js');

      if (Authentication.hasAuthentication()) {
        Authentication.decrypt(value).then((decrypted) => {
          resolveValue(decrypted);
        }).catch(reject);
      } else {
        reject('no authentication');
      }
    }
  });
};

let Database = {
  init() {
    if (!database) {
      return new Promise((resolve, reject) => {
        let exists = fs.existsSync(location);

        if (!exists) {
          fs.openSync(location, 'w');
        }

        database = new sqlite3.Database(location);

        if (!exists) {
          database.run(
            'CREATE TABLE Signal (kind TEXT, identifier TEXT, value BLOB)',
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve(database);
              }
            }
          );
        } else {
          resolve(database);
        }
      });
    } else {
      return Promise.resolve(database);
    }
  },

  put(kind, identifier, value, options = {}) {
    return Database.init().then((database) => {
      return new Promise((resolve, reject) => {
        setImmediate(() => {
          // Don't duplicate entries
          Database.remove(kind, identifier, options).then(() => {
            processPutValue(value, options).then((processedValue) => {
              database.run(
                'INSERT INTO Signal (kind, identifier, value) VALUES (?, ?, ?)',
                [ kind, identifier, processedValue ],
                (err) => {
                  if (err) {
                    reject({ error: err });
                  } else {
                    resolve();
                  }
                }
              );
            }).catch(reject);
          }).catch(reject);
        });
      });
    });
  },

  remove(kind, identifier = null, options = {}) {
    return Database.init().then((database) => {
      return new Promise((resolve, reject) => {
        setImmediate(() => {
          database.run(
            `DELETE FROM Signal WHERE kind = ? AND identifier ${ identifier ? '= ?' : 'IS NULL'}`,
            identifier ? [ kind, identifier ] : [ kind ],
            (err) => {
              if (err) {
                reject({ error: err });
              } else {
                resolve();
              }
            }
          );
        });
      });
    });
  },

  get(kind, identifier = null, options = {}) {
    return Database.init().then((database) => {
      return new Promise((resolve, reject) => {
        setImmediate(() => {
          database.get(
            `Select kind, identifier, value from Signal WHERE kind = ? AND identifier ${ identifier ? '= ?' : 'IS NULL'}`,
            identifier ? [ kind, identifier ] : [ kind ],
            (err, row) => {
              if (err) {
                reject({ error: err });
              } else if (!row) {
                resolve(null);
              } else {
                processGetValue(row.value, options).then((processedValue) => {
                  resolve(processedValue);
                }).catch(reject);
              }
            }
          );
        });
      });
    });
  },

  close() {
    if (database) {
      database.close();
    }
  }
}

module.exports = Database;
