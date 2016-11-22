'use strict';

let Database = require('./database.js');
let KeyHelper = libsignal.KeyHelper;

let SignalStore = {
	helpers: {
		// From libsignal's helper.js
		// Not publically exposed there, so copypasta here.
		toString(thing) {
			if (typeof thing == 'string') {
				return thing;
			}

			return new dcodeIO.ByteBuffer.wrap(thing).toString('binary');
		},

		toArrayBuffer(thing) {
			if (thing === undefined) {
				return undefined;
			}

			let StaticArrayBufferProto = new ArrayBuffer().__proto__;

			if (thing === Object(thing)) {
				if (thing.__proto__ == StaticArrayBufferProto) {
					return thing;
				}
			}

			let str;
			if (typeof thing == "string") {
				str = thing;
			} else {
				throw new Error("Tried to convert a non-string of type " + typeof thing + " to an array buffer");
			}

			return new dcodeIO.ByteBuffer.wrap(thing, 'binary').toArrayBuffer();
		}
	},

	getLoginInfo() {
		return Database.get('loginInfo', null, { plaintext: true, json: true });
	},

	setLoginInfo(serverAddress, serverPort, username, name, salt, canaryCheck) {
		return Database.put(
			'loginInfo',
			null,
			JSON.stringify({
				serverAddress,
				serverPort,
				username,
				name,
				salt,
				canaryCheck
			}),
			{ plaintext: true }
		);
	},

	getIdentityKeyPair() {
		return new Promise((resolve, reject) => {
			Database.get('identityKey', null, { json: true }).then((keyPair) => {
				resolve({
					pubKey: SignalStore.helpers.toArrayBuffer(keyPair.pubKey),
					privKey: SignalStore.helpers.toArrayBuffer(keyPair.privKey)
				});
			}).catch(reject);
		});
	},

  saveIdentityKeyPair(keyPair) {
    return Database.put('identityKey', null, JSON.stringify({
			pubKey: SignalStore.helpers.toString(keyPair.pubKey),
			privKey: SignalStore.helpers.toString(keyPair.privKey)
		}));
  },

	generateIdentityKeyPair() {
		return new Promise((resolve, reject) => {
			KeyHelper.generateIdentityKeyPair().then(function(identityKeyPair) {
        SignalStore.saveIdentityKeyPair(identityKeyPair).then(resolve).catch(reject);
			}).catch(reject);
		});
	},

  removeIdentityKeyPair() {
    return Database.remove('identityKey');
  },

	getLocalRegistrationId() {
		return Database.get('registrationId');
	},

  saveLocalRegistrationId(registrationId) {
    return Database.put('registrationId', null, registrationId);
  },

	generateLocalRegistrationId() {
		let registrationId = KeyHelper.generateRegistrationId();
		return SignalStore.saveLocalRegistrationId(registrationId);
	},

  removeLocalRegistrationId() {
    return Database.remove('registrationId');
  },

	isTrustedIdentity(identifier, identityKey) {
		if (identifier == null) {
			return Promise.reject("tried to check identity key for undefined/null key");
    }

		if (!(identityKey instanceof ArrayBuffer)) {
			return Promise.reject("Expected identityKey to be an ArrayBuffer");
    }

		return new Promise((resolve, reject) => {
			SignalStore.loadIdentityKey(identifier).then((trusted) => {
	      if (trusted == null) {
	        return resolve(true);
	      }

	      return resolve(SignalStore.helpers.toString(identityKey) === SignalStore.helpers.toString(trusted));
	    }).catch(reject);
		});
	},

	loadIdentityKey(identifier) {
		if (identifier == null) {
			return Promise.reject("Tried to get identity key for undefined/null key");
    }

		return Database.get('identityKey', identifier);
	},

	saveIdentity(identifier, identityKey) {
		if (identifier == null) {
      return Promise.reject("Tried to put identity key for undefined/null key");
    }

		return Database.put('identityKey', identifier, identityKey);
	},

	/* Returns a prekeypair object or undefined */
	loadPreKey(keyId) {
    return new Promise((resolve, reject) => {
			Database.get('25519KeypreKey', keyId).then((res) => {
	      if (res) {
	        return resolve({ pubKey: res.pubKey, privKey: res.privKey });
	      } else {
	        return resolve(undefined);
	      }
	    }).catch(reject);
		});
	},

	storePreKey(keyId, keyPair) {
		return Database.put('25519KeypreKey', keyId, keyPair);
	},

	generateNextPreKey() {
		return new Promise((resolve, reject) => {
			SignalStore.incrementPreKeyIndex((index) => {
				KeyHelper.generatePreKey(index).then(function(preKey) {
		      SignalStore.storePreKey(preKey.keyId, preKey.keyPair).then(() => {
						resolve(preKey);
					}).catch(reject);
				}).catch(reject);
			}).catch(reject);
		});
	},

	incrementPreKeyIndex() {
		return new Promise((resolve, reject) => {
			Database.get('preKeyIndex').then((index) => {
				index = index || 0;
				index = parseInt(index, 10);
				Database.put('preKeyIndex', null, index + 1).then(() => {
					resolve(index);
				}).catch(reject);
			}).catch(reject);
		})
	},

	removePreKey(keyId) {
		return Database.remove('25519KeypreKey', keyId);
	},

	/* Returns a signed keypair object or undefined */
	loadSignedPreKey(keyId) {
		return new Promise((resolve, reject) => {
			Database.get('25519KeysignedKey', keyId).then((res) => {
	      if (res) {
	        resolve({ pubKey: res.pubKey, privKey: res.privKey });
	      } else {
	        resolve(undefined);
	      }
	    }).catch(reject);
		});
	},

	storeSignedPreKey(keyId, keyPair) {
		return Database.put('25519KeysignedKey', keyId, keyPair);
	},

	generateNextSignedPreKey() {
		return new Promise((resolve, reject) => {
			SignalStore.getIdentityKeyPair().then((identityKeyPair) => {
				SignalStore.incrementSignedPreKeyIndex((index) => {
					KeyHelper.generateSignedPreKey(identityKeyPair, index).then(function(signedPreKey) {
			      SignalStore.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair).then(() => {
							resolve(signedPreKey);
						}).catch(reject);
					}).catch(reject);
				}).catch(reject);
			}).catch(reject);
		});
	},

	incrementSignedPreKeyIndex() {
		return new Promise((resolve, reject) => {
			Database.get('preKeyIndex').then((index) => {
				index = index || 0;
				index = parseInt(index, 10);
				Database.put('preKeyIndex', null, index + 1).then(() => {
					resolve(index);
				}).catch(reject);
			}).catch(reject);
		})
	},

	removeSignedPreKey(keyId) {
		return Database.remove('25519KeysignedKey', keyId);
	},

	loadSession(identifier) {
		return Database.get('session', identifier);
	},

	storeSession(identifier, record) {
		return Database.put('session', identifier, record);
	},

  removeSession(identifier) {
  	return Database.remove('session', identifier);
  }
};

module.exports = SignalStore;
