'use strict';

let Database = require('./database.js');

let SignalStore = {
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
		return Database.get('identityKey');
	},

  saveIdentityKeyPair(keyPair) {
    return SignalStore.removeIdentityKeyPair().then(() => {
      return Promise.resolve(Database.put('identityKey', null, keyPair));
    });
  },

  removeIdentityKeyPair() {
    return Database.remove('identityKey');
  },

	getLocalRegistrationId() {
		return Database.get('registrationId');
	},

  saveLocalRegistrationId(registrationId) {
    return SignalStore.removeLocalRegistrationId().then(() => {
      return Promise.resolve(Database.put('registrationId', null, registrationId));
    });
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

		return Database.get('identityKey', identifier).then((trusted) => {
      if (trusted == null) {
        return Promise.resolve(true);
      }

      return Promise.resolve(util.toString(identityKey) === util.toString(trusted));
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
    return Database.get('25519KeypreKey', keyId).then((res) => {
      if (res) {
        return Promise.resolve({ pubKey: res.pubKey, privKey: res.privKey });
      } else {
        return Promise.resolve(undefined);
      }
    });
	},

	storePreKey(keyId, keyPair) {
		return Database.put('25519KeypreKey', keyId, keyPair);
	},

	removePreKey(keyId) {
		return Database.remove('25519KeypreKey', keyId);
	},

	/* Returns a signed keypair object or undefined */
	loadSignedPreKey(keyId) {
    return Database.get('25519KeysignedKey', keyId).then((res) => {
      if (res) {
        return Promise.resolve({ pubKey: res.pubKey, privKey: res.privKey });
      } else {
        return Promise.resolve(undefined);
      }
    });
	},

	storeSignedPreKey(keyId, keyPair) {
		return Database.put('25519KeysignedKey', keyId, keyPair);
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
