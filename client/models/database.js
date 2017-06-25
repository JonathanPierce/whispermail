const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

class Database {
  constructor(path) {
    this.path = path;
    this.database = null;
  }

  getDatabase() {
    if (this.database) {
      return Promise.resolve(this.database);
    }

    return new Promise((resolve, reject) => {
      const exists = fs.existsSync(this.path);

      if (!exists) {
        fs.openSync(this.path, 'w');
      }

      this.database = new sqlite3.Database(this.path);

      if (!exists) {
        return this.migrate(this.database).then(() => resolve(this.database)).catch(reject);
      }

      resolve(this.database);
    });
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
