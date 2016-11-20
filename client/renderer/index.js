'use strict';

// LibSignal
window.dcodeIO = {};
window.dcodeIO.ProtoBuf = require('protobufjs');
window.dcodeIO.ByteBuffer = require('bytebuffer');
window.dcodeIO.Long = require('long');

require('../libsignal/dist/libsignal-protocol.js');
require('../libsignal/dist/libsignal-protocol-worker.js');

let Authentication = require('../model/authentication.js');
let SignalStore = require('../model/signal_store.js');
let Database = require('../model/database.js');
