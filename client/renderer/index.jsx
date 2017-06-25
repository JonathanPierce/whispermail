'use strict';

// LibSignal
window.dcodeIO = {};
window.dcodeIO.ProtoBuf = require('protobufjs');
window.dcodeIO.ByteBuffer = require('bytebuffer');
window.dcodeIO.Long = require('long');

require('../libsignal/dist/libsignal-protocol.js');
require('../libsignal/dist/libsignal-protocol-worker.js');

// React
const React = require('react');
const ReactDOM = require('react-dom');

// Our stuff
const Application = require('./application.js');

window.addEventListener('load', () => {
  ReactDOM.render(
    <Application/>,
    document.querySelector('.whispermail')
  );
});
