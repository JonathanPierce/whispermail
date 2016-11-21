'use strict';

// LibSignal
window.dcodeIO = {};
window.dcodeIO.ProtoBuf = require('protobufjs');
window.dcodeIO.ByteBuffer = require('bytebuffer');
window.dcodeIO.Long = require('long');

require('../libsignal/dist/libsignal-protocol.js');
require('../libsignal/dist/libsignal-protocol-worker.js');

// React
let React = require('react');
let ReactDOM = require('react-dom');

// Our stuff
let Application = require('./application.js');

window.addEventListener('load', () => {
  ReactDOM.render(
    <Application/>,
    document.querySelector('.whispermail')
  );
});
