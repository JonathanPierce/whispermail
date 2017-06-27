const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

class Database {
  constructor(path) {
    this.path = path;
    this.database = null;
  }

  getDatabase() {
    if (this.database) {
      console.log('returning cached db');
      return Promise.resolve(this.database);
    }

    if (this.migratePromise) {
      console.log('returning cached promise');
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

  close() {
    if (this.database) {
      this.database.close();
    }
  }
}

module.exports = Database;
