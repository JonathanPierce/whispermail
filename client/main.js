'use strict';

const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow; // Module to create native browser window.

// Need global window references to prevent garbage collection
var runningWindows = [];

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

var createWindow = function() {
    var newWindow = new BrowserWindow({width: 1024, height: 768}),
        index;

    // and load the index.html of the app.
    newWindow.loadURL('file://' + __dirname + '/renderer/index.html');

    // Open the DevTools.
    process.env["DEV"] == "true" && newWindow.webContents.openDevTools();

    // Push onto the runningWindow global object
    runningWindows.push(newWindow);

    // Remove the window from the global array to allow garbage collection
    newWindow.on('closed', function() {
      index = runningWindows.indexOf(newWindow);
      runningWindows.splice(index, 1);
    });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  // Create the browser window.
  createWindow();
});
