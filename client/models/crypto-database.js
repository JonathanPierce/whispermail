const Database = require('./database.js');

class CryptoDatabase extends Database {
  constructor(authentication, alternativePath = null) {
    super(alternativePath || './crypto-data.db');
    this.authentication = authentication;
  }

  migrate(database) {
    return new Promise((resolve, reject) => {
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
                  resolve();
                }
              }
            );
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

  put(kind, identifier, value, options = {}) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        // Don't duplicate entries
        this.remove(kind, identifier, options).then(() => {
          this.processPutValue(value, options).then((processedValue) => {
            database.run(
              'INSERT INTO Signal (kind, identifier, value) VALUES (?, ?, ?)',
              [ kind, identifier, processedValue ],
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

  remove(kind, identifier = null, options = {}) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        database.run(
          `DELETE FROM Signal WHERE kind = ? AND identifier ${ identifier ? '= ?' : 'IS NULL'}`,
          identifier ? [ kind, identifier ] : [ kind ],
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

  get(kind, identifier = null, options = {}) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        database.get(
          `SELECT kind, identifier, value FROM Signal WHERE kind = ? AND identifier ${ identifier ? '= ?' : 'IS NULL'}`,
          identifier ? [ kind, identifier ] : [ kind ],
          (err, row) => {
            if (err) {
              reject(err);
            } else if (!row) {
              resolve(null);
            } else {
              this.processGetValue(row.value, options).then(resolve).catch(reject);
            }
          }
        );
      }).catch(reject);
    });
  }

  getAll(kind, options = {}) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        database.all(
          `SELECT kind, identifier, value FROM Signal WHERE kind = ?`,
          [ kind ],
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

  getMessages(id) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        database.get(
          `SELECT data FROM Messages WHERE id = ?`,
          [id],
          (err, result) => {
            if (err) {
              reject(err);
            else if (!result) {
              resolve(null);
            } else {
              this.processGetValue(result.data, { json: true }).then(resolve).catch(reject);
            }
          }
        );
      }).catch(reject);
    });
  }

  getMessages(parentId = null) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        database.all(
          `SELECT data FROM Messages WHERE parentId ${parentId ? ' = ?' : 'IS NULL'}`,
          parentId ? [ parentId ] : [],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              const processedResults = rows.map((row) => {
                return this.processGetValue(row.data, { json: true });
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

  putMessage(message) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        this.processPutValue(message, { json: true }).then((processedValue) => {
          database.run(
            'INSERT INTO Messages (id, parentId, data) VALUES (?, ?, ?)',
            [ message.id, message.parentId || null, processedValue ],
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
    });
  }

  removeMessage(message) {
    return new Promise((resolve, reject) => {
      this.getDatabase().then((database) => {
        database.run(
          `DELETE FROM Messages WHERE id = ?`,
          [message.id],
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

module.exports = CryptoDatabase;
