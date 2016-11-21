let React = require('react');

let AppState = require('../model/app_state.js');

let MailPage = require('./pages/mail.js');
let LoginPage = require('./pages/login.js');
let SettingsPage = require('./pages/settings.js');

let Application = React.createClass({
  componentWillMount() {
    AppState.subscribe(this.rerender);
  },

  rerender() {
    this.forceUpdate();
  },

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
});

module.exports = Application;
