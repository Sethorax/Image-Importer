import jetpack from 'fs-jetpack';
import { app, remote } from 'electron';

var settingsPath;
var dest;

if (typeof app !== 'undefined') {
    settingsPath = app.getPath('appData') + '/Camera Importer/settings.json';
    dest = app.getPath('home') + '/Camera Imports/';
} else {
    settingsPath = remote.app.getPath('appData') + '/Camera Importer/settings.json';
    dest = remote.app.getPath('home') + '/Camera Imports/';
}

export function saveSingleSetting(settingKey, settingValue) {
    checkSettingsFile();

    var objSettings = jetpack.read(settingsPath, 'json');
    objSettings[settingKey] = settingValue;
    jetpack.write(settingsPath, objSettings);
}

export function saveSettings(obj) {
    checkSettingsFile();

    jetpack.write(settingsPath, obj);
}

export function loadSettings(settingKey) {
    checkSettingsFile();

    var settings = jetpack.read(settingsPath, 'json');

    console.log('load');

    return settings;
}

function checkSettingsFile() {
    if(!jetpack.exists(settingsPath)) {
        createDummySettings();
    } else if (jetpack.read(settingsPath, 'json').length === 0) {
        createDummySettings();
    }
}

function createDummySettings() {
    var dummydata = {
        vid: 1356,
        pid: 2227,
        deviceName: 'Sony DSC-W830',
        driveLetter: 'S',
        partName: 'CAMSTORAGE',
        destPath: dest
    };
    jetpack.write(settingsPath, dummydata);
}
