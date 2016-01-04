Image-Importer
--------
A simple application to select and import images from a USB-Device.

### How to use
When first starting the application, nothing will be happening, because a valid USB-Device must be set in the settings. 

To do that, just click on the cog-icon in the top right corner and choose your USB-Device from the list. The Vendor- and Product-ID and the name of the device will be set automatically.

Currently the application only listens for add- and remove-events of USB-Devices and compares against the specified device and it automatically updates the image-list if the device is added or removed.  
The name of the partition (linux and OS X) or the drive-letter (windows) must be set, so that the application can access the images on the device.

If a valid path is found, all images found at that path (including subdirectories) will get loaded into the image-list.  
After the loading is complete, you can select the images you wish to import to your computer by simply left-clicking on the image.  
If you want to just delete images from your device, you can do that by right-clicking on the image.

Pressing the blue button on the bottom right all selected images are either deleted or imported to your computer. The destination path can be set in the settings.
