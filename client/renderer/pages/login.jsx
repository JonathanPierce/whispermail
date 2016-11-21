let React = require('react');

let Authentication = require('../../model/authentication.js');
let SignalStore = require('../../model/signal_store.js');
let AppState = require('../../model/app_state.js');

let Login = React.createClass({
  componentDidMount() {
    SignalStore.getLoginInfo().then((loginInfo) => {
      AppState.getState().loginInfo = {
        status: loginInfo ? 'enterPassword' : 'signUp',
        info: loginInfo
      };

      AppState.update();
    }).catch((err) => {
      alert(err);
    });
  },

  getInitialState() {
    return {
      serverAddress: '',
      serverPort: '1337',
      username: '',
      name: '',
      password: ''
    };
  },

  updateServerAddress(e) {
    this.setState({ serverAddress: e.target.value });
  },

  updateServerPort(e) {
    this.setState({ serverPort: e.target.value });
  },

  updateUsername(e) {
    this.setState({ username: e.target.value });
  },

  updateName(e) {
    this.setState({ name: e.target.value });
  },

  updatePassword(e) {
    this.setState({ password: e.target.value });
  },

  signUp() {
    AppState.getState().loginInfo.status = 'signingUp';
    AppState.update();

    Authentication.createLoginInfo(this.state.password, {
      serverAddress: this.state.serverAddress,
      serverPort: this.state.serverPort,
      username: this.state.username,
      name: this.state.name
    }).then((loginInfo) => {
      AppState.getState().loginInfo = {
        status: 'loggedIn',
        info: loginInfo
      };

      AppState.update();
    }).catch((err) => {
      AppState.getState().loginInfo.status = 'signUp';
      AppState.getState().loginInfo.error = err.toString();
      AppState.update();
    });
  },

  login() {
    AppState.getState().loginInfo.status = 'checkingPassword';
    AppState.update();

    Authentication.setPassword(this.state.password).then(() => {
      AppState.getState().loginInfo.status = 'loggedIn';
      AppState.update();
    }).catch((err) => {
      AppState.getState().loginInfo.status = 'enterPassword';
      AppState.getState().loginInfo.error = err.toString();
      AppState.update();
    });
  },

  render() {
    let loginInfo = AppState.get('loginInfo');

    if (loginInfo === null) {
      return (
        <p>looking for profile...</p>
      );
    }

    let errorMessage = null;

    if (loginInfo.error) {
      errorMessage = (
        <div>
          ERROR: { loginInfo.error }
        </div>
      );
    }

    if (loginInfo.status === 'signUp') {
      return (
        <div>
          <h1>Welcome to WhisperMail!</h1>
          <h2>Sign Up</h2>
          <div>
            <input
              className='serverAddress'
              placeholder='server address (eg: mywhispermail.com)'
              type='text'
              value={ this.state.serverAddress }
              onChange={ this.updateServerAddress }
            ></input><br/>

            <input
              className='serverPort'
              placeholder='server port (eg: 1337)'
              type='text'
              value={ this.state.serverPort }
              onChange={ this.updateServerPort }
            ></input><br/>

            <input
              className='username'
              placeholder='username (eg: superawesome123)'
              type='text'
              value={ this.state.username }
              onChange={ this.updateUsername }
            ></input><br/>

            <input
              className='name'
              placeholder='name (eg: Donald J. Trump)'
              type='text'
              value={ this.state.name }
              onChange={ this.updateName }
            ></input><br/>

            <input
              className='password'
              placeholder='password'
              type='text'
              value={ this.state.password }
              onChange={ this.updatePassword }
            ></input><br/>

            <button onClick={ this.signUp }>Sign Up!</button>

            { errorMessage }
          </div>
        </div>
      );
    }

    if (loginInfo.status === 'signingUp') {
      return (
        <p>Signing up...</p>
      );
    }

    if (loginInfo.status === 'enterPassword') {
      return (
        <div>
          <h1>Welcome back { loginInfo.info.name }!</h1>
          <h2>Enter Password</h2>
          <div>
            <input
              className='password'
              placeholder='password'
              type='password'
              value={ this.state.password }
              onChange={ this.updatePassword }
            ></input><br/>

            <button onClick={ this.login }>Log In!</button>

            { errorMessage }
          </div>
        </div>
      );
    }

    if (loginInfo.status === 'checkingPassword') {
      return (
        <p>Logging in...</p>
      );
    }

    if (loginInfo.status === 'loggedIn') {
      return (
        <p>Logged in sucessfully!</p>
      );
    }
  }
});

module.exports = Login;
