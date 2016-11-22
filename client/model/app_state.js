let _ = require('lodash');

let state = {
  page: 'login'
};

let subscribers = [];

module.exports = {
  getState() {
    return state;
  },

  get(key, missing = null) {
    return _.get(state, key, missing);
  },

  subscribe(callback) {
    subscribers.push(callback);
  },

  update(callback) {
    callback(state);
    subscribers.forEach((subscriber) => subscriber(state));
  }
};
