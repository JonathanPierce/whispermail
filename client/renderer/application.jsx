const React = require('react');

const AppState = require('../models/app-state.js');

const MailPage = require('./pages/mail.js');
const LoginPage = require('./pages/login.js');
const SettingsPage = require('./pages/settings.js');

class Application extends React.Component {
  componentWillMount() {
    AppState.subscribe(this.rerender);
  }

  rerender() {
    this.forceUpdate();
  }

  render() {
    let page = AppState.get('page');

    if (page === 'mail') {
      return <MailPage/>;
    } else if (page === 'login') {
      return <LoginPage/>;
    } else if (page === 'settings') {
      return <SettingsPage/>;
    } else {
      return (
        <h1>something went wrong...</h1>
      );
    }
  }
}

module.exports = Application;
