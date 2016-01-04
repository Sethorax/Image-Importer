// This is main process of Electron, started as first thing when your
// app starts. This script is running through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import { app, BrowserWindow, ipcMain } from 'electron';
import devHelper from './vendor/electron_boilerplate/dev_helper';
import windowStateKeeper from './vendor/electron_boilerplate/window_state';
import jetpack from 'fs-jetpack'; // module loaded from npm
import monitor from 'usb-detection';

import { loadSettings, saveSettings } from './configuration.js';

// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from './env';

var mainWindow;

// Preserver of the window size and position between app launches.
var mainWindowState = windowStateKeeper('main', {
    width: 1000,
    height: 600
});

app.on('ready', function () {
    showMainWindow();
});

function showMainWindow() {
    mainWindow = new BrowserWindow({
        frame: false,
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        'min-width': 1024,
        'min-height': 768,
        title: 'Image-Importer'
    });

    if (mainWindowState.isMaximized) {
        mainWindow.maximize();
    }

    if (env.name === 'test') {
        mainWindow.loadURL('file://' + __dirname + '/spec.html');
    } else {
        mainWindow.loadURL('file://' + __dirname + '/app.html');
    }

    if (env.name !== 'production') {
        devHelper.setDevMenu();
        mainWindow.openDevTools();
    }

    mainWindow.on('close', function () {
        mainWindowState.saveState(mainWindow);
    });
}

monitor.on('add', function(device) {
    checkDevices('add', device);
});

monitor.on('remove', function(device) {
    checkDevices('remove', device);
});

function checkDevices(type) {
    var device = (arguments[1] !== void 0 ? arguments[1] : 0);
    var targetDevice = loadSettings();
    console.log(targetDevice);

    switch (type) {
        case 'find':
            monitor.find(targetDevice.vid, targetDevice.pid, function(err, devices) {
                console.log(devices.length);
                if (devices.length > 0) {
                    console.log(targetDevice.deviceName + ' already connected!');
                    mainWindow.webContents.send('load-from-device', targetDevice);
                } else {
                    mainWindow.webContents.send('clear-image-list');
                    mainWindow.webContents.send('statusUpdate', {type: 'error', msg: 'Kein Gerät gefunden!'});
                }
            });
            break;

        case 'add':
            console.log('Device added.');
            if (device.vendorId === targetDevice.vid && device.productId === targetDevice.pid) {
                console.log(targetDevice.deviceName + ' connected!');
                mainWindow.webContents.send('device-added', targetDevice);
            }
            break;

        case 'remove':
            console.log('Device disconnected.');
            if (device.vendorId === targetDevice.vid && device.productId === targetDevice.pid) {
                mainWindow.webContents.send('load-from-device', targetDevice);
            }
            break;
    }
}

function notifyRender(device) {
    mainWindow.webContents.send('device-added', device);
}

ipcMain.on('check-for-device', function() {
    checkDevices('find');
});

ipcMain.on('find-devices', function() {
    console.log('find devices');
    monitor.find(function(err, devices) {
        mainWindow.webContents.send('list-devices', devices);
    });
});

ipcMain.on('importImages', function(event, args) {
    var imgsToImportCount = args.length;
    var progInc = 100 / args.length;
    var progress = 0;
    var destination = loadSettings().destPath;

    mainWindow.webContents.send('statusUpdate', {type: 'normal', msg: 'Importiere Fotos! ' + imgsToImportCount + ' verbleibend...'});
    mainWindow.webContents.send('progressUpdate', {progress: progress});

    jetpack.dir(destination);

    copyImage(args, 0);

    function copyImage(images, pos) {
        if (pos < images.length) {
            let filename;
            if(images[pos].shouldDelete) {
                deleteOnly(images, pos);
            } else {
                if (process.platform === 'win32') {
                    filename  = images[pos].src.substring(images[pos].src.lastIndexOf('\\') + 1);

                    if (!jetpack.exists(destination + '\\' + filename)) {
                        jetpack.copyAsync(images[pos].src, destination + '\\' + filename).then(function() {
                            checkFiles(images, pos, filename);
                        });
                    } else {
                        checkFiles(images, pos, filename);
                    }
                } else {
                     filename = images[pos].src.substring(images[pos].src.lastIndexOf('/') + 1);

                     if (!jetpack.exists(destination + '/' + filename)) {
                         jetpack.copyAsync(images[pos].src, destination + '/' + filename).then(function() {
                             checkFiles(images, pos, filename);
                         });
                     } else {
                         checkFiles(images, pos, filename);
                     }
                }
            }
            console.log(filename);
        } else {
            //mainWindow.webContents.send('statusUpdate', {type: 'normal', msg: 'Alle Fotos erfolgreich importiert!'});
            //mainWindow.webContents.send('progressUpdate', {progress: 0});
            console.log('Alles importiert!');

            mainWindow.webContents.send('set-import-button-text', {text: 'Dateien importieren', canImport: true});
            mainWindow.webContents.send('load-from-device', loadSettings());
        }
    }

    function checkFiles(images, pos, filename) {
        var origData;
        var newData;
        var firstDone = false;
        var secDone = false;

        console.log('Überprüfe Dateien...');

        //mainWindow.webContents.send('statusUpdate', {type: 'normal', msg: 'Überprüfe Dateien...'});

        jetpack.inspectAsync(images[pos].src, {checksum: 'md5'}).then(function(data) {
            firstDone = true;
            origData = data;
            if (secDone) {
                progressCopying(images, pos, filename, origData, newData);
            }
        });

        if (process.platform === 'win32') {
            jetpack.inspectAsync(destination + '\\' + filename, {checksum: 'md5'}).then(function(data) {
                secDone = true;
                newData = data;
                if (firstDone) {
                    progressCopying(images, pos, filename, origData, newData);
                }
            });
        } else {
            jetpack.inspectAsync(destination + '/' + filename, {checksum: 'md5'}).then(function(data) {
                secDone = true;
                newData = data;
                if (firstDone) {
                    progressCopying(images, pos, filename, origData, newData);
                }
            });
        }
    }

    function progressCopying(images, pos, filename, origData, newData) {
        if (origData.md5 === newData.md5) {
            //mainWindow.webContents.send('statusUpdate', {type: 'normal', msg: 'Lösche bereits kopierte Datei auf dem Gerät...'})
            console.log('Dateien sind gleich!');
            jetpack.removeAsync(images[pos].src).then(function() {
                progress += progInc;
                imgsToImportCount--;

                console.log('Original-Datei gelöscht!');

                mainWindow.webContents.send('statusUpdate', {type: 'normal', msg: 'Importiere Fotos! ' + imgsToImportCount + ' verbleibend...'});
                mainWindow.webContents.send('progressUpdate', {progress: progress});

                copyImage(images, pos + 1);
            });
        } else {
            console.log('Dateien sind nicht identisch!');
            console.log('Original: ' + origData.md5);
            console.log('Neue Datei: ' + newData.md5);

            mainWindow.webContents.send('statusUpdate', {type: 'error', msg: 'Dateien nicht identisch! Importiere erneut...'});

            var now = new Date();

            var oldName = filename.substring(0, filename.indexOf('.'));
            var fileExt = filename.substring(filename.lastIndexOf('.') + 1);
            var newName = oldName + '-' + now.getDate() + now.getMonth()+1 + now.getFullYear() + now.getHours() + now.getMinutes() + now.getSeconds() + '.' + fileExt;

            if (process.platform === 'win32') {
                jetpack.renameAsync(destination + '\\' + filename, newName).then(function() {
                    copyImage(images, pos);
                });
            } else {
                jetpack.renameAsync(destination + '/' + filename, newName).then(function() {
                    copyImage(images, pos);
                });
            }
        }
    }

    function deleteOnly(images, pos) {
        console.log('Delete only...');

        jetpack.removeAsync(images[pos].src).then(function() {
            copyImage(images, pos + 1);
        });
    }
});

app.on('window-all-closed', function () {
    monitor.stopMonitoring();
    app.quit();
});

app.on('before-quit', function() {
    monitor.stopMonitoring();
});
