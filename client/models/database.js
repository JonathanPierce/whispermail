const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

class Database {
  constructor(path) {
    this.path = path;
    this.database = null;
    this.cache = {};
  }

  getDatabase() {
    if (this.database) {
      return Promise.resolve(this.database);
    }

    if (this.migratePromise) {
      return this.migratePromise;
    }

    this.migratePromise = new Promise((resolve, reject) => {
      const exists = fs.existsSync(this.path);

      if (!exists) {
        fs.openSync(this.path, 'w');
      }

      const database = new sqlite3.Database(this.path);

      if (!exists) {
        return this.migrate(database).then(() => {
          this.migratePromise = null;
          this.database = database;
          resolve(database);
        }).catch(reject);
      }

      this.database = database;
      resolve(database);
    });

    return this.migratePromise;
  }

  migrate(database) {
    // implement in a sub-class
  }

  withCache(key, callback) {
    if (!this.cache[key]) {
      this.cache[key] = callback();
    }

    return this.cache[key];
  }

  close() {
    if (this.database) {
      this.database.close();
    }
  }
}

module.exports = Database;
