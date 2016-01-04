// Here is the starting point for your application code.
// All stuff below is just to show you how it works. You can delete all of it.

// Use new ES6 modules syntax for everything.
import os from 'os'; // native node.js module
import { remote, ipcRenderer } from 'electron'; // native electron module
import { loadSettings, saveSettings } from './configuration.js';
import jetpack from 'fs-jetpack'; // module loaded from npm
import env from './env';

var app = remote.app;
var appDir = jetpack.cwd(app.getAppPath());

var camImporter = angular.module('camImporter', []);

camImporter.factory('updateStatus', function($rootScope) {
    return {
        send: function(msg, data) {
            $rootScope.$broadcast(msg, data);
        }
    };
});

camImporter.directive('ngRightClick', function($parse) {
    return function(scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        element.bind('contextmenu', function(event) {
            scope.$apply(function() {
                event.preventDefault();
                fn(scope, {$event:event});
            });
        });
    };
});

camImporter.controller('StatusCtrl', function($scope) {
    $scope.message = 'Keine Kamera angeschlossen!';
    $scope.type = 'warning';

    $scope.$on('statusUpdate', function(event, args) {
        updateStatus(args);
    });

    $scope.$on('progressUpdate', function(event, args) {
        updateProgress(args);
    });

    ipcRenderer.on('statusUpdate', function(event, args) {
        updateStatus(args);
    });

    ipcRenderer.on('progressUpdate', function(event, args) {
        updateProgress(args);
    });

    function updateStatus(args) {
        if (!$scope.$$phase) {
            $scope.$apply(function() {
                $scope.message = args.msg;

                switch (args.type) {
                    case 'warning':
                        $scope.type = 'warning';
                        break;

                    case 'error':
                        $scope.type = 'error';
                        break;

                    default:
                        $scope.type = 'normal';
                        break;
                }
            });
        } else {
            $scope.message = args.msg;

            switch (args.type) {
                case 'warning':
                    $scope.type = 'warning';
                    break;

                case 'error':
                    $scope.type = 'error';
                    break;

                default:
                    $scope.type = 'normal';
                    break;
            }
        }
    }

    function updateProgress(args) {
        if(!$scope.$$phase) {
            $scope.$apply(function() {
                $scope.progress = {width: args.progress + '%'};
            });
        } else {
            $scope.progress = {width: args.progress + '%'};
        }
    }
});

camImporter.controller('ImageListCtrl', function ($scope, updateStatus, filterFilter) {
    $scope.images = [];

    $scope.selectItem = function(index) {
        var that = $scope.images[index];

        if(that.isLoaded && !$scope.loading) {
            if(that.isSelected) {
                that.isSelected = false;
            } else {
                that.isSelected = true;
            }
        }

        if(that.shouldDelete) {
            that.shouldDelete = false;
            that.isSelected = true;
        }

        if(filterFilter($scope.images, {isSelected: true}).length > 0) {
            updateStatus.send('importValidationUpdate', {canImport: true});
        } else {
            updateStatus.send('importValidationUpdate', {canImport: false});
        }
    };

    $scope.selectForDeletion = function(index) {
        var that = $scope.images[index];

        if(that.isLoaded && !$scope.loading) {
            if(that.shouldDelete) {
                that.shouldDelete = false;
                that.isSelected = false;
            } else {
                that.shouldDelete = true;
                that.isSelected = true;
            }
        }

        if(filterFilter($scope.images, {isSelected: true}).length > 0) {
            updateStatus.send('importValidationUpdate', {canImport: true});
        } else {
            updateStatus.send('importValidationUpdate', {canImport: false});
        }
    };

    ipcRenderer.send('check-for-device');

    $scope.$on('importImages', function() {
        ipcRenderer.send('importImages', filterFilter($scope.images, {isSelected: true}));
    });

    $scope.$on('refreshImages', function() {

    });

    ipcRenderer.on('device-added', function(event, arg) {
        if(!$scope.$$phase) {
            $scope.$apply(function() {
                $scope.loading = true;
            });
        } else {
            $scope.loading = true;
        }

        updateStatus.send('statusUpdate', {type: 'normal', msg: 'Kamera gefunden! Lade Dateiliste...'});
        updateStatus.send('set-refresh', {canRefresh: false});

        var found = false;
        var waitProgress = 0;
        var path;

        if (process.platform === 'win32') {
            path = arg.driveLetter + ':\\';
        } else {
            path = '/Volumes/' + arg.partName + '/';
        }

        function waitForDevice() {
            if (!jetpack.exists(path)) {
                updateStatus.send('progressUpdate', {progress: waitProgress});
                console.log('Warte auf Kamera: ' + waitProgress + '%');
                waitProgress += 3.33;
                setTimeout(waitForDevice, 1000);
            } else {
                if (!found) {
                    found = true;
                    updateStatus.send('progressUpdate', {progress: waitProgress});
                    setTimeout(waitForDevice, 1000);
                } else {
                    updateStatus.send('progressUpdate', {progress: 100});
                    console.log('Kamera fertig: ' + 100 + '%');
                    prepareImageList(path);
                }
            }
        }

        waitForDevice();
    });

    ipcRenderer.on('load-from-device', function(event, arg) {
        var path;

        if (process.platform === 'win32') {
            path = arg.driveLetter + ':\\';
        } else {
            path = '/Volumes/' + arg.partName + '/';
        }

        console.log('load from device   ' + path);

        updateStatus.send('importValidationUpdate', {canImport: false});

        prepareImageList(path);
    });

    ipcRenderer.on('clear-image-list', function(event, arg) {
        if(!$scope.$$phase) {
            $scope.$apply(function() {
                $scope.images = [];
            });
        } else {
            $scope.images = [];
        }
    });

    function prepareImageList(path) {
        var imgPaths;

        try {
            if(!$scope.$$phase) {
                $scope.$apply(function() {
                    $scope.loading = true;
                    $scope.images = [];
                });
            } else {
                $scope.loading = true;
                $scope.images = [];
            }

            imgPaths = jetpack.find(path, {matching: ['*.JPG', '*.jpg', '*.jpeg']});

            var loadProgress = 0;
            var progInc = 100 / imgPaths.length;

            updateStatus.send('set-refresh', {canRefresh: false});
            updateStatus.send('statusUpdate', {type: 'normal', msg: 'Lade Dateien...'});
            updateStatus.send('progressUpdate', {progress: loadProgress});

            for (let i = 0; i < imgPaths.length; i++) {
                $scope.$apply(function() {
                    $scope.images[i] = {src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', isLoaded: false, isSelected: false};
                });
            }

            loadImages(imgPaths, 0);
        } catch (e) {
            console.log(e);

            updateStatus.send('set-refresh', {canRefresh: true});
            updateStatus.send('statusUpdate', {type: 'error', msg: 'Dateipfad zum Gerät existiert nicht!'});
            updateStatus.send('progressUpdate', {progress: 0});
        }

        function loadImages(images, pos) {
            if (pos < images.length) {
                let imgsrc = images[pos];
                $('<img />').attr('src', imgsrc).on('load', function() {
                    $scope.$apply(function() {
                        $scope.images[pos] = {src: imgsrc, isLoaded: true, isSelected: false};
                    });
                    loadProgress += progInc;
                    updateStatus.send('progressUpdate', {progress: loadProgress});
                    loadImages(images, pos + 1);
                });
            } else {
                if (images.length === 0) {
                    updateStatus.send('statusUpdate', {type: 'warning', msg: 'Keine Dateien auf dem Gerät gefunden!'});
                } else {
                    updateStatus.send('statusUpdate', {type: 'normal', msg: 'Alle Dateien erfolgreich geladen!'});
                }
                updateStatus.send('progressUpdate', {progress: 0});
                updateStatus.send('set-refresh', {canRefresh: true});
                if(!$scope.$$phase) {
                    $scope.$apply(function() {
                        $scope.loading = false;
                    });
                } else {
                    $scope.loading = false;
                }
            }
        }
    }
});

camImporter.controller('SettingsCtrl', function($scope, filterFilter) {
    $scope.visible = false;

    $scope.$on('toggle-settings-container', function() {
        if(!$scope.$$phase) {
            $scope.$apply(function() {
                if ($scope.visible) {
                    $scope.visible = false
                } else {
                    $scope.visible = true
                }
            });
        } else {
            if ($scope.visible) {
                $scope.visible = false
            } else {
                $scope.visible = true
            }
        }
    });

    var savedSettings = loadSettings();
    $scope.settings = loadSettings();

    $scope.devices = [];

    $scope.selectedDevice = '';

    $scope.loadDeviceInformation = function() {
        var dev = filterFilter($scope.devices, {locationId: $scope.selectedDevice})[0];
        if(!$scope.$$phase) {
            $scope.$apply(function() {
                $scope.settings.vid = dev.vendorId;
                $scope.settings.pid = dev.productId;

                if (dev.manufacturer !== '') {
                    $scope.settings.deviceName = dev.manufacturer + ' - ' + dev.deviceName;
                } else {
                    $scope.settings.deviceName = dev.deviceName;
                }
            });
        } else {
            $scope.settings.vid = dev.vendorId;
            $scope.settings.pid = dev.productId;

            if (dev.manufacturer !== '') {
                $scope.settings.deviceName = dev.manufacturer + ' - ' + dev.deviceName;
            } else {
                $scope.settings.deviceName = dev.deviceName;
            }
        }

        $scope.save();
    };

    $scope.fullName = function(device) {
        var name;

        if (device.manufacturer !== '') {
            name = device.manufacturer + ' - ' + device.deviceName;
        } else {
            name = device.deviceName;
        }

        return name;
    };

    $scope.save = function() {
        if (JSON.stringify(savedSettings) !== JSON.stringify($scope.settings)) {
            saveSettings($scope.settings);
            savedSettings = loadSettings();
        }
    };

    $scope.openDialog = function() {
        console.log('open');

        try {
            var importPath = remote.dialog.showOpenDialog({properties: ['openDirectory', 'createDirectory']});
            if(!$scope.$$phase) {
                $scope.$apply(function() {
                    $scope.settings.destPath = importPath[0];
                });
            } else {
                $scope.settings.destPath = importPath[0];
            }

            $scope.save();
        } catch (e) {
            console.error(e);
        }
    };

    $scope.refreshDevices = function() {
        ipcRenderer.send('find-devices');
    };

    ipcRenderer.send('find-devices');

    ipcRenderer.on('list-devices', function(event, args) {
        console.log('list-devices');
        if(!$scope.$$phase) {
            $scope.$apply(function() {
                $scope.devices = args;
            });
        } else {
            $scope.devices = args;
        }
    });
});

camImporter.controller('MenuCtrl', function($scope, updateStatus) {
    $scope.toggleSettings = function() {
        updateStatus.send('toggle-settings-container');
    };
});

camImporter.controller('ImportCtrl', function($scope, updateStatus) {
    $scope.btntext = 'Dateien importieren';
    $scope.canimport = false;
    $scope.canrefresh = true;

    $scope.import = function() {
        if($scope.canimport) {
            updateStatus.send('importImages');
            $scope.btntext = 'Importiere...';
            $scope.canimport = false;
        }
    };

    $scope.refresh = function() {
        if($scope.canrefresh) {
            ipcRenderer.send('check-for-device');
        }
    };

    $scope.$on('importValidationUpdate', function(event, args) {
        if(!$scope.$$phase) {
            $scope.$apply(function() {
                if(args.canImport) {
                    $scope.canimport = true;
                } else {
                    $scope.canimport = false;
                }
            });
        } else {
            if(args.canImport) {
                $scope.canimport = true;
            } else {
                $scope.canimport = false;
            }
        }
    });

    $scope.$on('set-refresh', function(event, args) {
        if(!$scope.$$phase) {
            $scope.$apply(function() {
                if(args.canRefresh) {
                    $scope.canrefresh = true;
                } else {
                    $scope.canrefresh = false;
                }
            });
        } else {
            if(args.canRefresh) {
                $scope.canrefresh = true;
            } else {
                $scope.canrefresh = false;
            }
        }
    });

    ipcRenderer.on('set-import-button-text', function(event, args) {
        if(!$scope.$$phase) {
            $scope.btntext = args.text;
            if (args.canImport) {
                $scope.canimport = true;
            } else {
                $scope.canimport = false;
            }
        } else {
            $scope.$apply(function() {
                $scope.btntext = args.text;
                if (args.canImport) {
                    $scope.canimport = true;
                } else {
                    $scope.canimport = false;
                }
            });
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {

    $('#btnClose').on('click', function() {
        let window = remote.getCurrentWindow();
        window.close();
    });

    $('#btnMinimize').on('click', function() {
        let window = remote.getCurrentWindow();
        window.minimize();
    });

    $('#btnMaximize').on('click', function() {
        let window = remote.getCurrentWindow();
        window.maximize();
    });
});
