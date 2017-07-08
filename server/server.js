const express = require('express');
const prompt = require('prompt');
const config = require('./config.json');
const packageJSON = require('./package.json');
const bodyParser = require('body-parser');

// TODO: Use HTTPS

const ServerAuthentication = require('./server-authentication.js');
const ServerDatabase = require('./server-database.js');
const ApiHandler = require('./api-handler.js');
const { InteropReceiver } = require('./interop.js');

const authentication = new ServerAuthentication();
const database = new ServerDatabase(authentication);

function start() {
  const app = express();
  app.use(bodyParser.json());

  console.log(`Starting WhisperMail Server v${packageJSON.version} on port ${config.port}...`);

  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
  });

  app.get('/index.html', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
  });

  app.post('/register', (req, res) => {
    if (
      req.body.username &&
      req.body.name &&
      req.body.publicKey &&
      req.body.registrationId &&
      req.body.apiPublicKey
    ) {
      const data = {
        username: req.body.username,
        name: req.body.name,
        publicKey: req.body.publicKey,
        registrationId: req.body.registrationId,
        apiPublicKey: req.body.apiPublicKey
      };

      database.getInfo(data.username).then((info) => {
        if (info) {
          // user already exists
          res.status(400).end();
        } else {
          // create user
          database.put(req.body.username, 'info', null, data, { json: true }).then(() => {
            res.json({ success: true });
          }).catch(() => res.status(503).end());
        }
      }).catch(() => res.status(503).end());
    } else {
      // no schema match
      res.status(400).end();
    }
  });

  // client-server code goes here
  app.post('/api', (req, res) => {
    new ApiHandler(req, res, database).handle().then(() => {
      console.log('api request handled');
    }).catch((e) => {
      console.log('api error', e);
    });
  });

  // server-server code goes here
  app.post('/interop', (req, res) => {
    new InteropReceiver(req, res, database).handle().then(() => {
      console.log('interop request handled');
    }).catch((e) => {
      console.log('interop error', e);
    });
  });

  app.listen(config.port);
}

prompt.message = 'WhisperMail';
prompt.start();

function handleLogin() {
  prompt.get({
    properties: {
      password: {
        description: 'Enter Password',
        message: 'you need to enter your password to continue',
        hidden: true,
        required: true
      }
    }
  }, (err, result) => {
    if (err) {
      return console.log('failed to read password');
    }

    console.log('logging in...');
    const password = result.password.trim();

    authentication.login(password).then(() => {
      start();
    }).catch(() => {
      console.log('incorrect password');
    });
  });
}

function handleCreate() {
  console.log('setting up a new user...');

  prompt.get({
    properties: {
      password: {
        description: 'Enter Password',
        message: 'you need to enter your password to continue',
        hidden: true,
        required: true
      },
      confirmation: {
        description: 'Confirm Password',
        message: 'you need to re-enter your password to continue',
        hidden: true,
        required: true
      }
    }
  }, (err, result) => {
    if (err) {
      return console.log('failed to read password');
    }

    console.log('creating login...');
    const password = result.password.trim();
    const confirmation = result.confirmation.trim();

    if (password === confirmation) {
      authentication.createLoginInfo(password).then(() => {
        start();
      }).catch(() => {
        console.log('failed to create login');
      });
    } else {
      console.log('passwords do not match. restart to try again.');
    }
  });
}

// Start the server
authentication.hasLoginInfo().then((hasLoginInfo) => {
  if (hasLoginInfo) {
    handleLogin();
  } else {
    handleCreate();
  }
}).catch(() => {
  console.log('failed to query login info');
});
