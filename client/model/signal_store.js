'use strict';

const Database = require('./database.js');
const KeyHelper = libsignal.KeyHelper;

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
			{
				serverAddress,
				serverPort,
				username,
				name,
				salt,
				canaryCheck
			},
			{ plaintext: true, json: true }
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
    return Database.put('identityKey', null, {
			pubKey: SignalStore.helpers.toString(keyPair.pubKey),
			privKey: SignalStore.helpers.toString(keyPair.privKey)
		}, { json: true });
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
		return new Promise((resolve, reject) => {
			Database.get('registrationId').then((id) => {
				resolve(parseInt(id, 10))
			}).catch(reject);
		});
	},

  saveLocalRegistrationId(registrationId) {
    return Database.put('registrationId', null, registrationId.toString());
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

		return new Promise((resolve, reject) => {
			Database.get('identityKey', identifier).then((key) => {
				if (key) {
					resolve(SignalStore.helpers.toArrayBuffer(key))
				} else {
					resolve(undefined);
				}
			}).catch();
		});
	},

	saveIdentity(identifier, identityKey) {
		if (identifier == null) {
      return Promise.reject("Tried to put identity key for undefined/null key");
    }

		return Database.put('identityKey', identifier, SignalStore.helpers.toString(identityKey));
	},

	/* Returns a prekeypair object or undefined */
	loadPreKey(keyId) {
    return new Promise((resolve, reject) => {
			Database.get('25519KeypreKey', keyId, { json: true }).then((res) => {
	      if (res) {
	        return resolve({
						pubKey: SignalStore.helpers.toArrayBuffer(res.pubKey),
						privKey: SignalStore.helpers.toArrayBuffer(res.privKey)
					});
	      } else {
	        return resolve(undefined);
	      }
	    }).catch(reject);
		});
	},

	storePreKey(keyId, keyPair) {
		return Database.put('25519KeypreKey', keyId, {
			pubKey: SignalStore.helpers.toString(keyPair.pubKey),
			privKey: SignalStore.helpers.toString(keyPair.privKey)
		}, { json: true });
	},

	generateNextPreKey() {
		return new Promise((resolve, reject) => {
			SignalStore.incrementPreKeyIndex().then((index) => {
				KeyHelper.generatePreKey(index).then((preKey) => {
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
				Database.put('preKeyIndex', null, (index + 1).toString()).then(() => {
					resolve(index);
				}).catch(reject);
			}).catch(reject);
		});
	},

	removePreKey(keyId) {
		return Database.remove('25519KeypreKey', keyId);
	},

	/* Returns a signed keypair object or undefined */
	loadSignedPreKey(keyId) {
		return new Promise((resolve, reject) => {
			Database.get('25519KeysignedKey', keyId, { json: true }).then((res) => {
	      if (res) {
	        resolve({
						pubKey: SignalStore.helpers.toArrayBuffer(res.pubKey),
						privKey: SignalStore.helpers.toArrayBuffer(res.privKey)
					});
	      } else {
	        resolve(undefined);
	      }
	    }).catch(reject);
		});
	},

	storeSignedPreKey(keyId, keyPair) {
		return Database.put('25519KeysignedKey', keyId, {
			pubKey: SignalStore.helpers.toString(keyPair.pubKey),
			privKey: SignalStore.helpers.toString(keyPair.privKey)
		}, { json: true });
	},

	generateNextSignedPreKey() {
		return new Promise((resolve, reject) => {
			SignalStore.getIdentityKeyPair().then((identityKeyPair) => {
				SignalStore.incrementSignedPreKeyIndex().then((index) => {
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
				Database.put('preKeyIndex', null, (index + 1).toString()).then(() => {
					resolve(index);
				}).catch(reject);
			}).catch(reject);
		});
	},

	removeSignedPreKey(keyId) {
		return Database.remove('25519KeysignedKey', keyId);
	},

	loadSession(identifier) {
		return new Promise((resolve, reject) => {
			Database.get('session', identifier).then((session) => {
				if (session) {
					resolve(session);
				} else {
					resolve(undefined);
				}
			}).catch(reject);
		});
	},

	storeSession(identifier, record) {
		return Database.put('session', identifier, record);
	},

  removeSession(identifier) {
  	return Database.remove('session', identifier);
  }
};

module.exports = SignalStore;
