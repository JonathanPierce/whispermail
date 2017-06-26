const CryptoDatabase = require('./crypto-database.js');
const KeyHelper = libsignal.KeyHelper;

// From libsignal's helper.js
// Not publically exposed there, so copypasta here.
const SignalHelpers = {
  toString(thing, format) {
    if (typeof thing == 'string') {
      return thing;
    }

    return new dcodeIO.ByteBuffer.wrap(thing).toString(format || 'binary');
  },

  toArrayBuffer(thing, format) {
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

    return new dcodeIO.ByteBuffer.wrap(thing, format || 'binary').toArrayBuffer();
  }
};

class SignalStore extends CryptoDatabase {
  constructor(authentication) {
    super(authentication);
  }

  getIdentityKeyPair() {
		return new Promise((resolve, reject) => {
			this.get('identityKey', null, { json: true }).then((keyPair) => {
				resolve({
					pubKey: SignalHelpers.toArrayBuffer(keyPair.pubKey),
					privKey: SignalHelpers.toArrayBuffer(keyPair.privKey)
				});
			}).catch(reject);
		});
	}

  saveIdentityKeyPair(keyPair) {
    return this.put('identityKey', null, {
			pubKey: SignalHelpers.toString(keyPair.pubKey),
			privKey: SignalHelpers.toString(keyPair.privKey)
		}, { json: true });
  }

	generateIdentityKeyPair() {
		return new Promise((resolve, reject) => {
			KeyHelper.generateIdentityKeyPair().then((identityKeyPair) => {
        this.saveIdentityKeyPair(identityKeyPair).then(resolve).catch(reject);
			}).catch(reject);
		});
	}

  removeIdentityKeyPair() {
    return this.remove('identityKey');
  }

	getLocalRegistrationId() {
		return new Promise((resolve, reject) => {
			this.get('registrationId').then((id) => {
				resolve(parseInt(id, 10))
			}).catch(reject);
		});
	}

  saveLocalRegistrationId(registrationId) {
    return this.put('registrationId', null, registrationId.toString());
  }

	generateLocalRegistrationId() {
		let registrationId = KeyHelper.generateRegistrationId();
		return this.saveLocalRegistrationId(registrationId);
	}

  removeLocalRegistrationId() {
    return this.remove('registrationId');
  }

  createNewSignalKeys() {
    return new Promise((resolve, reject) => {
      this.generateLocalRegistrationId().then(() => {
        this.generateIdentityKeyPair().then(resolve).catch(reject);
      }).catch(reject);
    });
  }

	isTrustedIdentity(identifier, identityKey) {
		if (identifier == null) {
			return Promise.reject("tried to check identity key for undefined/null key");
    }

		if (!(identityKey instanceof ArrayBuffer)) {
			return Promise.reject("Expected identityKey to be an ArrayBuffer");
    }

		return new Promise((resolve, reject) => {
			this.loadIdentityKey(identifier).then((trusted) => {
	      if (trusted == null) {
	        return resolve(true);
	      }

	      return resolve(SignalHelpers.toString(identityKey) === SignalHelpers.toString(trusted));
	    }).catch(reject);
		});
	}

	loadIdentityKey(identifier) {
		if (identifier == null) {
			return Promise.reject("Tried to get identity key for undefined/null key");
    }

		return new Promise((resolve, reject) => {
			this.get('identityKey', identifier).then((key) => {
				if (key) {
					resolve(SignalHelpers.toArrayBuffer(key))
				} else {
					resolve(undefined);
				}
			}).catch();
		});
	}

	saveIdentity(identifier, identityKey) {
		if (identifier == null) {
      return Promise.reject("Tried to put identity key for undefined/null key");
    }

		return this.put('identityKey', identifier, SignalHelpers.toString(identityKey));
	}

	/* Returns a prekeypair object or undefined */
	loadPreKey(keyId) {
    return new Promise((resolve, reject) => {
			this.get('25519KeypreKey', keyId, { json: true }).then((res) => {
	      if (res) {
	        return resolve({
						pubKey: SignalHelpers.toArrayBuffer(res.pubKey),
						privKey: SignalHelpers.toArrayBuffer(res.privKey)
					});
	      } else {
	        return resolve(undefined);
	      }
	    }).catch(reject);
		});
	}

	storePreKey(keyId, keyPair) {
		return this.put('25519KeypreKey', keyId, {
			pubKey: SignalHelpers.toString(keyPair.pubKey),
			privKey: SignalHelpers.toString(keyPair.privKey)
		}, { json: true });
	}

	generateNextPreKey() {
		return new Promise((resolve, reject) => {
			this.incrementPreKeyIndex().then((index) => {
				KeyHelper.generatePreKey(index).then((preKey) => {
		      this.storePreKey(preKey.keyId, preKey.keyPair).then(() => {
						resolve(preKey);
					}).catch(reject);
				}).catch(reject);
			}).catch(reject);
		});
	}

	incrementPreKeyIndex() {
		return new Promise((resolve, reject) => {
			this.get('preKeyIndex').then((index) => {
				index = index || 0;
				index = parseInt(index, 10);
				this.put('preKeyIndex', null, (index + 1).toString()).then(() => {
					resolve(index);
				}).catch(reject);
			}).catch(reject);
		});
	}

	removePreKey(keyId) {
		return this.remove('25519KeypreKey', keyId);
	}

	/* Returns a signed keypair object or undefined */
	loadSignedPreKey(keyId) {
		return new Promise((resolve, reject) => {
			this.get('25519KeysignedKey', keyId, { json: true }).then((res) => {
	      if (res) {
	        resolve({
						pubKey: SignalHelpers.toArrayBuffer(res.pubKey),
						privKey: SignalHelpers.toArrayBuffer(res.privKey)
					});
	      } else {
	        resolve(undefined);
	      }
	    }).catch(reject);
		});
	}

	storeSignedPreKey(keyId, keyPair) {
		return this.put('25519KeysignedKey', keyId, {
			pubKey: SignalHelpers.toString(keyPair.pubKey),
			privKey: SignalHelpers.toString(keyPair.privKey)
		}, { json: true });
	}

	generateNextSignedPreKey() {
		return new Promise((resolve, reject) => {
			this.getIdentityKeyPair().then((identityKeyPair) => {
				this.incrementSignedPreKeyIndex().then((index) => {
					KeyHelper.generateSignedPreKey(identityKeyPair, index).then((signedPreKey) => {
			      this.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair).then(() => {
							resolve(signedPreKey);
						}).catch(reject);
					}).catch(reject);
				}).catch(reject);
			}).catch(reject);
		});
	}

	incrementSignedPreKeyIndex() {
		return new Promise((resolve, reject) => {
			this.get('preKeyIndex').then((index) => {
				index = index || 0;
				index = parseInt(index, 10);
				this.put('preKeyIndex', null, (index + 1).toString()).then(() => {
					resolve(index);
				}).catch(reject);
			}).catch(reject);
		});
	}

	removeSignedPreKey(keyId) {
		return this.remove('25519KeysignedKey', keyId);
	}

	loadSession(identifier) {
		return new Promise((resolve, reject) => {
			this.get('session', identifier).then((session) => {
				if (session) {
					resolve(session);
				} else {
					resolve(undefined);
				}
			}).catch(reject);
		});
	}

	storeSession(identifier, record) {
		return this.put('session', identifier, record);
	}

  removeSession(identifier) {
  	return this.remove('session', identifier);
  }
}

SignalStore.Helpers = SignalHelpers;
module.exports = SignalStore;
