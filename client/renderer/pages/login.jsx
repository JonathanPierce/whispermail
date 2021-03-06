const React = require('react');

const AppState = require('../../models/app-state.js');
const WhisperMail = require('../../models/whispermail.js');
const packageInfo = require('../../package.json');

class Login extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      serverAddress: '',
      username: '',
      name: '',
      password: ''
    };
  }

  componentDidMount() {
    WhisperMail.authentication.getLoginInfo().then((loginInfo) => {
      AppState.update((state) => {
        state.loginInfo = {
          status: loginInfo ? 'enterPassword' : 'signUp',
          info: loginInfo
        };
      });
    }).catch((err) => {
      console.log(err);
    });
  }

  updateServerAddress(e) {
    this.setState({ serverAddress: e.target.value.replace(/\s/g, '') });
  }

  updateUsername(e) {
    this.setState({ username: e.target.value.replace(/[^0-9a-zA-Z_]/g, '') });
  }

  updateName(e) {
    this.setState({ name: e.target.value });
  }

  updatePassword(e) {
    this.setState({ password: e.target.value });
  }

  signUp() {
    AppState.update((state) => {
      state.loginInfo.status = 'signingUp';
    });

    WhisperMail.createUser(this.state.password, {
      serverAddress: this.state.serverAddress,
      username: this.state.username,
      name: this.state.name
    }).then((loginInfo) => {
      AppState.update((state) => {
        state.loginInfo = {
          status: 'loggedIn',
          info: loginInfo
        };

        state.page = 'mail';
      });
    }).catch((err) => {
      AppState.update((state) => {
        state.loginInfo.status = 'signUp';
        state.loginInfo.error = 'could not sign up';
      });
    });
  }

  login() {
    AppState.update((state) => {
      state.loginInfo.status = 'checkingPassword';
    });

    WhisperMail.login(this.state.password).then(() => {
      AppState.update((state) => {
        state.loginInfo.status = 'loggedIn';
        state.page = 'mail';
      });
    }).catch((err) => {
      AppState.update((state) => {
        state.loginInfo.status = 'enterPassword';
        state.loginInfo.error = 'that password was incorrect';
        this.setState({ password: '' });
      });
    });
  }

  formComplete() {
    return (
      this.state.serverAddress.length &&
      this.state.username.length &&
      this.state.name.length &&
      this.state.password.length
    );
  }

  render() {
    let loginInfo = AppState.get('loginInfo');

    if (loginInfo === null) {
      return (
        <p>looking for profile...</p>
      );
    }

    let errorMessage = null;
    let content = null;

    if (loginInfo.error) {
      errorMessage = (
        <div className='error'>
          <b>error:</b> { loginInfo.error }
        </div>
      );
    }

    if (loginInfo.status === 'signUp') {
      content = (
        <div>
          <h2>welcome to whispermail!</h2>
          <h3>create an account:</h3>
          <div>
            <input
              className='serverAddress'
              placeholder='server address (eg: mywhispermail.com)'
              type='text'
              value={ this.state.serverAddress }
              onChange={ (e) => this.updateServerAddress(e) }
              maxLength={ 256 }
            ></input><br/>

            <input
              className='username'
              placeholder='username (eg: superawesome123)'
              type='text'
              value={ this.state.username }
              onChange={ (e) => this.updateUsername(e) }
              maxLength={ 50 }
            ></input><br/>

            <input
              className='name'
              placeholder='name (eg: Donald J. Trump)'
              type='text'
              value={ this.state.name }
              onChange={ (e) => this.updateName(e) }
              maxLength={ 100 }
            ></input><br/>

            <input
              className='password'
              placeholder='password'
              type='password'
              value={ this.state.password }
              onChange={ (e) => this.updatePassword(e) }
            ></input><br/>

          <button onClick={ () => this.signUp() } disabled={ !this.formComplete() }>sign up</button>
          </div>
          {
            (this.state.serverAddress && this.state.username) ? (
              <p>your email will be { this.state.username }@{ this.state.serverAddress }</p>
            ) : null
          }
          { errorMessage }
        </div>
      );
    }

    if (loginInfo.status === 'signingUp') {
      content = (
        <p>signing up...</p>
      );
    }

    if (loginInfo.status === 'enterPassword') {
      content = (
        <div>
          <h2>welcome back { loginInfo.info.name.toLowerCase() }!</h2>
          <h3>enter password:</h3>
          <div>
            <input
              className='password'
              placeholder='password'
              type='password'
              value={ this.state.password }
              onChange={ (e) => this.updatePassword(e) }
            ></input><br/>

          <button onClick={ () => this.login() } disabled={ !this.state.password.length }>log in</button>
          </div>
          { errorMessage }
        </div>
      );
    }

    if (loginInfo.status === 'checkingPassword') {
      content = (
        <p>logging in...</p>
      );
    }

    return (
      <div className='login'>
        <div className='header'>
          <h1 className='logo'>WhisperMail<sup>v{ packageInfo.version }</sup></h1>
        </div>
        <div className='content'>
          { content }
        </div>
        <div className='footer'>
        </div>
      </div>
    );
  }
}

module.exports = Login;
