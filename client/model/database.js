'use strict';

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
let Authentication;

let database;
const location = './client.db';

function processPutValue(value, options) {
  return new Promise((resolve, reject) => {
    if (options.json) {
      value = JSON.stringify(value);
    }

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
          // TODO: Cleanup code, add indexes

          database.run(
            'CREATE TABLE Signal (kind TEXT, identifier TEXT, value BLOB)',
            (err) => {
              if (err) {
                reject(err);
              } else {
                database.run(
                  'CREATE TABLE Messages (id TEXT, parentId TEXT, data BLOB)',
                  (err) => {
                    if (err) {
                      reject(err);
                    } else {
                      resolve(database);
                    }
                  }
                );
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
    return new Promise((resolve, reject) => {
      Database.init().then((database) => {
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
      }).catch(reject);
    });
  },

  remove(kind, identifier = null, options = {}) {
    return new Promise((resolve, reject) => {
      Database.init().then((database) => {
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
      }).catch(reject);
    });
  },

  get(kind, identifier = null, options = {}) {
    return new Promise((resolve, reject) => {
      Database.init().then((database) => {
        database.get(
          `SELECT kind, identifier, value FROM Signal WHERE kind = ? AND identifier ${ identifier ? '= ?' : 'IS NULL'}`,
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
      }).catch(reject);
    });
  },

  getAll(kind, identifier = null, options = {}) {
    return new Promise((resolve, reject) => {
      Database.init().then((database) => {
        database.all(
          `SELECT kind, identifier, value FROM Signal WHERE kind = ?`,
          [ kind ],
          (err, rows) => {
            if (err) {
              reject({ error: err });
            } else {
              const processedResults = rows.map((row) => {
                return processGetValue(row.value, options);
              });

              Promise.all(processedResults).then((processed) => {
                resolve(processed);
              }).catch(reject);
            }
          }
        );
      }).catch(reject);
    });
  },

  getMessages(parentId = null) {
    return new Promise((resolve, reject) => {
      Database.init().then((database) => {
        database.all(
          `SELECT data FROM Messages WHERE parentId ${parentId ? ' = ?' : 'IS NULL'}`,
          parentId ? [ parentId ] : [],
          (err, rows) => {
            if (err) {
              reject({ error: err });
            } else {
              const processedResults = rows.map((row) => {
                return processGetValue(row.data, { json: true });
              });

              Promise.all(processedResults).then((processed) => {
                resolve(processed);
              }).catch(reject);
            }
          }
        );
      }).catch(reject);
    });
  },

  putMessage(message) {
    return new Promise((resolve, reject) => {
      Database.init().then((database) => {
        processPutValue(message, { json: true }).then((processedValue) => {
          database.run(
            'INSERT INTO Messages (id, parentId, data) VALUES (?, ?, ?)',
            [ message.id, message.parentId || null, processedValue ],
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
  },

  close() {
    if (database) {
      database.close();
    }
  }
}

module.exports = Database;
