/*
 * Copyright (c) 2012 Samsung Electronics Co., Ltd. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*jslint devel: true*/
/*global $, Audio, window, tizen, SystemIO, document,
  navigator, clearTimeout, setTimeout, Image */
var selfCamera;
function SelfCamera() {
    'use strict';
    return;
}

(function strict() {
    'use strict';
    var DELAY_2_SECOND = 2, DELAY_5_SECOND = 5, DELAY_10_SECOND = 10;

    SelfCamera.prototype = {
        countdown: -1, // current value after clicking the camera button
        countdownTimeoutID: -1,
        countSound: new Audio('sounds/sounds_count.wav'),
        img: document.createElement('canvas'),
        filename: '',
        loadDirectory: '',
        saveDirectory: 'images/',
        IMG_PREFIX: 'SelfCamera_',
        shutterSound: new Audio('sounds/sounds_Shutter_01.wav'),
        timer: null, // value set by the buttons
        systemIO: null,
        video: null,
        src: null,
        isMediaWorking: false,
        previewLock: false
    };

    /**
     * Initializes timer buttons.
     * @param {number} value Number of countdown seconds.
     */
    SelfCamera.prototype.setTimer = function setTimer(value) {
        this.timer = value;
        // clear buttons
        $('#timer2, #timer5, #timer10').removeClass('selected');
        // mark active button
        $('#timer' + value).addClass('selected');
        // if media is working
        if (this.isMediaWorking) {
            try {
                // try to play stream
                selfCamera.video.play();
            } catch (e) {
                console.error(e);
            }
        }
    };

    /**
     * Stream object handler.
     * @param {Stream} stream
     */
    SelfCamera.prototype.onCaptureVideoSuccess =
        function onCaptureVideoSuccess(stream) {
            var urlStream;
            // create stream
            urlStream = window.webkitURL.createObjectURL(stream);
            this.isMediaWorking = true;
            // create video element with stream handler
            this.createVideoElement(urlStream);
            // initialize timer buttons options
            this.setTimer(DELAY_2_SECOND);
        };

    /**
     * Creates HTML video element and adds it to DOM.
     * @param {Stream} src
     */
    SelfCamera.prototype.createVideoElement =
        function createVideoElement(src) {
            this.video = $('<video/>', {
                autoplay: 'autoplay',
                id: 'video',
                style: 'height:' + $(window).height() + 'px',
                src: src
            }).appendTo('#camera').get(0);

            this.bindVideoEvents();
        };

    SelfCamera.prototype.onCaptureVideoError =
        function onCaptureVideoError(e) {
            console.error(e);
        };

    /**
     * Enables navigator media options to manage video stream.
     */
    SelfCamera.prototype.startPreview = function startPreview() {
        // declare what will be used by this application
        var options = {
            audio: true,
            video: true
        };

        navigator.getUserMedia = navigator.getUserMedia ||
            navigator.webkitGetUserMedia;
        try {
            if (typeof (navigator.getUserMedia) === 'function') {
                // ask user to grant permissions to use media objects
                navigator.getUserMedia(options,
                    this.onCaptureVideoSuccess.bind(this),
                    this.onCaptureVideoError.bind(this));
            }
        } catch (e) {
            alert('navigator.getUserMedia() error.');
            console.error('navigator.getUserMedia() error: ' + e.message);
        }
    };

    /**
     * Launches service to display taken photo.
     * @return {boolean} success or failure
     */
    SelfCamera.prototype.launchPreview = function launchPreview() {
        // if preview is locked
        if (this.previewLock) {
            return false;
        }
        // if filename is invalid
        if (this.filename === '') {
            return false;
        }
        // try to launch service
        this.showPhotoPreview(this.filename);
        return true;
    };

    /**
     * Runs external application service to show taken photo.
     * @param {File} file
     */
    SelfCamera.prototype.showPhotoPreview = function showPhotoPreview(file) {
        var service, onReply, self = this;

        // configure service
        service = new tizen.ApplicationControl(
            'http://tizen.org/appcontrol/operation/view',
            file
        );
        onReply = {
            onsuccess: function noop() { return; },
            onfailure: function noop() { return; }
        };

        try {
            // try to launch service
            tizen.application.launchAppControl(
                service,
                null,
                function launchPhotoSuccess() {
                    setTimeout(function unlock() {
                        self.previewLock = false;
                    }, 700);
                },
                function launchPhotoError(err) {
                    self.previewLock = false;
                    alert('There is no suitable application to view photos. ' +
                        'Please install application that handles photo view.');
                },
                onReply
            );
            self.previewLock = true;
        } catch (exc) {
            alert('Exception: ' + exc.message);
        }
    };

    /**
     * Sets dir for new images.
     * @param {string} dirName
     */
    SelfCamera.prototype.setLoadDirectory =
            function setLoadDirectory(dirName) {
            this.loadDirectory = dirName;
            if (!this.loadDirectory.match(/\/$/)) {
                this.loadDirectory += '/';
            }
        };

    /**
     * Displays failure message for 3s.
     */
    SelfCamera.prototype.showFailureMessage = function showFailureMessage() {
        $('#failure').css('display', 'block');
        setTimeout(
            function hideFailureMessage() {
                $('#failure').css('display', 'none');
            },
            3000
        );
    };

    /**
     * Saves taken screenshoot to file.
     * @param {HTMLCanvasElement} canvas
     * @param {string} fileName
     */
    SelfCamera.prototype.saveCanvas = function saveCanvas(canvas, fileName) {
        var data,
            self = this,
            onSuccess = null,
            onFailure = null;

        // successful save callback
        onSuccess = function onSuccess(fileHandle) {
            self.setLoadDirectory(self.getFileDirectoryURI(fileHandle));
            try {
                tizen.content.scanFile(
                    fileHandle.toURI(),
                    function scanSuccess() {
                        // if taken photo exists load it as thumb
                        self.loadThumbnail(true, true);
                    },
                    function scanError() {
                        console.error('scanFile: file not found');
                        self.loadThumbnail(true, false);
                    }
                );
            } catch (e) {
                console.log('saveCanvas:onSuccess error: ', e.message);
            }
        };
        // failure save callback
        onFailure = function onFailure() {
            console.log('Failed to take photo.');
            self.showFailureMessage();
            // if file wasn't saved properly
            // delete corrupted file
            self.systemIO.deleteNode(fileName,
                function deleteSuccess() {
                    console.log('Deleted corrupted file.');
                    setTimeout(
                        function loadThumbnail() {
                            // back to old thumb
                            self.loadThumbnail(true, false);
                        },
                        1000
                    );
                });
        };

        try {
            // get base64 data from canvas
            data = canvas.toDataURL().replace('data:image/png;base64,', '')
                .replace('data:,', '');
            if (data === '') { // if data is not valid
                throw {message: 'No image source'};
            }
        } catch (e) { // if can't get valid base64 info
            this.filename = '';
            console.error('canvas.toDataUrl error: ' + e.message);
            alert('Data source error: ' + e.message);
            return;
        }

        try {
            this.systemIO.deleteNode(fileName, function onDeleteNode() {
                try {
                    // try to save file data into file
                    this.systemIO.saveFileContent(fileName, data, onSuccess,
                        onFailure, 'base64');
                } catch (e) {
                    console.error('saveDataToFile error: ' + e.message);
                }
            }.bind(this));
        } catch (e2) {
            console.error('Delete old file error: ' + e2.message);
        }
    };

    /**
     * Take screenshoot from the current displaying video frame.
     * @param {Video} video
     */
    SelfCamera.prototype.captureImage = function captureImage(video) {
        var sourceWidth = window.innerWidth,
            sourceHeight = window.innerHeight,
            sourceX = (sourceWidth - $(video).width()) / 2,
            sourceY = (sourceHeight - $(video).height()) / 2;

        this.img.width = sourceWidth;
        this.img.height = sourceHeight;

        // Crop image to viewport dimension
        this.img.getContext('2d').drawImage(video, sourceX, sourceY,
            $(video).width(), $(video).height());

    };

    /**
     * Sets current file name.
     * @param {string} filename
     */
    SelfCamera.prototype.setFileName = function setFileName(filename) {
        this.filename = filename;
        this.loadThumbnail(false, false);
    };

    /**
     * Changes Date object into string timestamp.
     * @return {string} timestamp
     */
    SelfCamera.prototype.getTimestamp = function getTimestamp() {
        var d = new Date();
        return d.getUTCFullYear() +
            '-' + d.getUTCMonth() +
            '-' + d.getUTCDay() +
            '-' + d.getUTCHours() +
            '-' + d.getUTCMinutes() +
            '-' + d.getUTCSeconds() +
            '-' + d.getUTCMilliseconds();
    };

    /**
     * Creates screenshoot and save on device hard drive.
     */
    SelfCamera.prototype.takePhoto = function takePhoto() {
        this.captureImage(this.video);
        this.filename = this.IMG_PREFIX + this.getTimestamp() + '.png';
        this.savePhoto();
    };

    /**
     * Saves canvas screenshoot on device hard drive.
     */
    SelfCamera.prototype.savePhoto = function savePhoto() {
        this.saveCanvas(this.img, this.saveDirectory + this.filename);
    };

    /**
     * Finds last taken photo with specified prefix.
     * @param {Function} onFind callback
     */
    SelfCamera.prototype.findLastPhoto = function findLastPhoto(onFind) {
        // find all images in content storage with specified prefix
        var titleFilter = new tizen.AttributeFilter(
                'title',
                'STARTSWITH',
                this.IMG_PREFIX
            ),
            typeFilter = new tizen.AttributeFilter('type', 'EXACTLY', 'IMAGE');

        try {
            tizen.content.find(
                function findSuccess(files) {
                    if (files.length !== 0) {
                        // run callback with last image
                        onFind(files[0].contentURI);
                    } else {
                        onFind(null);
                    }
                },
                null,
                null,
                new tizen.CompositeFilter(
                    'INTERSECTION',
                    [titleFilter, typeFilter]
                ),
                new tizen.SortMode('modifiedDate', 'DESC')
            );
        } catch (e) {
            console.log('findLastPhoto error: ', e.message);
        }
    };

    /**
     * Count down step handler.
     */
    SelfCamera.prototype.onCountdownTimeout =
        function onCountdownTimeout() {
            // update steps to the end
            this.countdown -= 1;
            // it it is last step
            if (this.countdown < 0) {
                // remove DOM element
                this.clearCountdown();
                this.shutterSound.play();
                try {
                    // take photo
                    this.takePhoto();
                } catch (e) {
                    console.error(e);
                }
            } else { // if it isn't last step
                // update DOM element
                $('#countdown').text(this.countdown);
                this.countSound.currentTime = 0;
                this.countSound.play();
                // set new timeout
                this.countdownTimeoutID =
                    setTimeout(this.onCountdownTimeout.bind(this), 1000);
            }
        };

    /**
     * Displays count down element on the screen
     * and starts counting down to zero from startValue.
     * @param {Number} startValue
     */
    SelfCamera.prototype.startCountdown =
            function startCountdown(startValue) {
            // hide thumb
            $('#thumbnail').hide();
            // unbind timer buttons click listeners
            $('.timers div').off('click');
            // if there is running count down switch it off
            if (this.countdownTimeoutID > 0) {
                clearTimeout(this.countdownTimeoutID);
                this.countdownTimeoutID = -1;
            }
            // set number of seconds to end
            this.countdown = startValue || this.timer;
            // launch timer and remember its id
            this.countdownTimeoutID =
                setTimeout(this.onCountdownTimeout.bind(this), 1000);
            // show countdown element
            $('#countdown').show().text(this.countdown);
            this.countSound.currentTime = 0;
            this.countSound.play();
        };

    /**
     * Clears count down information.
     */
    SelfCamera.prototype.clearCountdown = function clearCountdown() {
        // hide countdown DOM element
        $('#countdown').text('').hide();
        this.countdown = -1;
        // clear current countdown id
        clearTimeout(this.countdownTimeoutID);
        this.countdownTimeoutID = -1;
        // refresh bindings to timer buttons
        this.bindTimerClicks();
    };

    /**
     * Resizes video element to full screen.
     */
    SelfCamera.prototype.resizeVideo = function resizeVideo() {
        var w = this.video.videoWidth, // video height
            h = this.video.videoHeight, // video width
            W = $(window).width(), // window width
            H = $(window).height(), // window height
            // is video stream resolution greater than window resolution
            wide = w / h >= W / H,
            margin,
            size;
        // if stream hasn't been loaded yet
        if (w <= 0 || h <= 0) {
            setTimeout(this.resizeVideo.bind(this), 100); // wait for stream
            return;
        }
        if (wide) {
            size = Math.round(w * H / h);
            margin = (W - size) / 2;
            $(this.video).css({
                'margin-left': margin + 'px',
                'margin-top': '0 px',
                'width': size + 'px',
                'height': H + 'px'
            });
        } else {
            size = Math.round(h * W / w);
            margin = (H - size) / 2;
            $(this.video).css({
                'margin-left': '0 px',
                'margin-top': margin + 'px',
                'width': W + 'px',
                'height': size + 'px'
            });
        }
        $('#camera').css({
            'width': W + 'px',
            'height': H + 'px'
        });
    };

    /**
     * Binds event handlers to video element.
     */
    SelfCamera.prototype.bindVideoEvents = function bindVideoEvents() {
        // handle video stream suspendtion
        $(this.video).on('stalled', function onStalled() {
            this.load();
        });
        // when video start playind
        $(this.video).on('playing', this.resizeVideo.bind(this));
        $(this.video).on('click', function onVideoClick() { this.play(); });
    };

    /**
     * Binds event handlers to DOM elements.
     */
    SelfCamera.prototype.bindEvents = function bindEvents() {
        var self = this;

        document.addEventListener(
            'webkitvisibilitychange',
            function onVisibilityChange() {
                self.clearCountdown();
                self.previewLock = false;
                if (document.webkitVisibilityState === 'visible') {
                    if (self.video !== null) {
                        self.video.play();
                    }
                    self.loadThumbnail(true, false);
                }
            }
        );

        $('shutter').mousedown(function onMouseDown() {
            $('shutter').addClass('active');
        }).mouseup(function onMouseUp() {
            $('shutter').removeClass('active');
        }).on('touchstart', function onTouchStart() {
            $('shutter').addClass('active');
        }).on('touchend', function onTouchEnd() {
            $('shutter').removeClass('active');
        });

        $(window).on('tizenhwkey', function onTizenHWKey(e) {
            if (e.originalEvent.keyName === 'back') {
                if (self.countdownTimeoutID !== -1) {
                    self.clearCountdown();
                    self.loadThumbnail(true, false);
                } else {
                    try {
                        tizen.application.getCurrentApplication().exit();
                    } catch (err) {
                        console.log('Error: ', err);
                    }
                }
            }
        });

        this.bindTimerClicks();

        $('#thumbnail').on('click', this.launchPreview.bind(this));
        $('#shutter').on('touchstart', this.shutterTouched.bind(this));
    };

    /**
     * Handles press shutter button.
     */
    SelfCamera.prototype.shutterTouched = function shutterTouched() {
        if (this.previewLock) {
            return;
        }
        // if media is working
        if (this.isMediaWorking) {
            // start count down
            this.startCountdown();
        } else { // if media doesn't work display information message
            alert('To be able to take pictures you have to allow application ' +
                'to use your media. Please restart app and allow ' +
                'Self Camera to access media content.');
        }
    };

    /**
     * Sets handlers for click event to timer buttons
     */
    SelfCamera.prototype.bindTimerClicks = function bindTimerClicks() {
        $('#timer2').on('click', this.setTimer.bind(this, DELAY_2_SECOND));
        $('#timer5').on('click', this.setTimer.bind(this, DELAY_5_SECOND));
        $('#timer10').on('click', this.setTimer.bind(this, DELAY_10_SECOND));
    };

    /**
     * Retrieve parent directory URI from file URI
     * @param {File} file
     * @return {string} file parent directory URI
     */
    SelfCamera.prototype.getFileDirectoryURI = function getFile(file) {
        var dirURI;
        dirURI = encodeURI(
            file.toURI()
                .split('/')
                .slice(0, -1)
                .join('/')
        );
        return dirURI;
    };

    /**
     * Loads thumb image and add it to appropriate DOM element.
     * @param {boolean} show
     * @param {boolean} animate
     */
    SelfCamera.prototype.loadThumbnail = function loadThumb(show, animate) {
        var self = this, image;
        show = show || false;
        animate = animate || false;
        // find last taken photo
        this.findLastPhoto(function onFind(file) {
            if (file) {
                self.filename = file;
                file = self.fixURI(file) + '?r=' + Math.random();
                // create new image object
                image = new Image();
                // add listener load event
                image.onload = function onload() {
                    // update DOM element css styles
                    $('#upImage').css('background-image', 'url(' + file + ')');
                    $('#thumbnail').css('background-image',
                        'url("./images/transparent.png")');
                    if (show) {
                        if (animate) {
                            $('#thumbnail').css({'opacity': 0.01}).show()
                                .animate({'opacity': 1.00});
                        } else {
                            $('#thumbnail').show();
                        }
                    }
                };
                // start downloading image
                image.src = file;
            } else { // if thera are no photos in expected catalog
                self.filename = '';
                $('#thumbnail').hide();
                $('#upImage').css('background-image', '');
            }
        });
    };

    /**
     * Fixes content URI.
     * @param {string} invaliduri
     * @return {string} valid file URI
     */
    SelfCamera.prototype.fixURI = function fixURI(invaliduri) {
        var scheme, address, k;
        invaliduri = invaliduri.split('://');
        if (invaliduri.length === 1) {
            scheme = 'file';
            address = invaliduri[0].split('/');
        } else {
            scheme = invaliduri[0];
            invaliduri.shift();
            address = invaliduri.join('://').split('/');
        }
        for (k = address.length - 1; k >= 0; k -= 1) {
            address[k] = encodeURIComponent(address[k]);
        }
        return scheme + '://' + address.join('/');
    };

    /**
     * Checks if save directory exists.
     * @param {Function} callback
     */
    SelfCamera.prototype.checkSaveDirectory =
        function checkSaveDirectory(callback) {
            var self = this;
            callback = callback || function noop() { return; };
            try {
                tizen.filesystem.resolve(this.saveDirectory,
                    function onResolveSuccess() {
                        // if Images directory exists just call callback
                        callback();
                    },
                    function onResolveError() {
                        console.error('save directory does not exist');
                    },
                    'r'
                );
            } catch (e) {
                console.error('checkSaveDirectory error: ', e.message);
            }
        };

    /**
     * Initializes self camera application.
     */
    SelfCamera.prototype.init = function init() {
        var self = this;
        this.checkSaveDirectory(function onCheckCompleted() {
            self.systemIO = new SystemIO();
            self.loadThumbnail(true, false);
            self.startPreview();
            self.bindEvents();
        });
    };

}());

selfCamera = new SelfCamera();
$(document).ready(function onReady() {
    'use strict';
    selfCamera.init();
});
