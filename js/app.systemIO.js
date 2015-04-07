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
/*global tizen*/

/**
 * @class SystemIO
 */
function SystemIO() {
    'use strict';
    return;
}

(function strict () { // strict mode wrapper
    'use strict';
    SystemIO.prototype = {
        /**
         * Creates new empty file in specified location
         * @param {File} directoryHandle
         * @param {string} fileName
         */
        createFile: function SystemIO_createFile(directoryHandle, fileName) {
            try {
                return directoryHandle.createFile(fileName);
            } catch (e) {
                console.error('SystemIO_createFile error: ' + e.message);
                return false;
            }
        },

        /**
         * Writes content to file stream.
         * @param {File} fileHandle File handle.
         * @param {string} fileContent File content.
         * @param {function} onSuccess Success callback taking one {File}
         * argument
         * @param {function} onError Error callback
         * @param {string} contentEncoding Content encoding.
         */
        writeFile: function SystemIO_writeFile(fileHandle, fileContent,
            onSuccess, onError, contentEncoding) {
            onError = onError || function noop() { return; };
            fileHandle.openStream('w', function onStreamOpen (fileStream) {
                try {
                    if (contentEncoding === 'base64') {
                        fileStream.writeBase64(fileContent);
                    } else {
                        fileStream.write(fileContent);
                    }
                    fileStream.close();
                } catch (e) {
                    fileStream.close();
                    onError(fileHandle);
                    return;
                }
                if (typeof onSuccess === 'function') {
                    onSuccess(fileHandle);
                }
            }, onError, 'UTF-8');
        },

        /**
         * Opens specified location
         * @param {string} directoryPath Directory path.
         * @param {function} onSuccess Success callback.
         * @param {function} onError Error callback.
         * @param {string} openMode Mode.
         */
        openDir: function SystemIO_openDir(directoryPath, onSuccess, onError,
            openMode) {
            openMode = openMode || 'rw';
            onSuccess = onSuccess || function noop() { return; };
            onError = onError || function noop() { return; };

            try {
                tizen.filesystem.resolve(directoryPath, onSuccess, onError,
                    openMode);
            } catch (e) {
                console.error('SystemIO_openDir error:' + e.message);
            }
        },

        /**
         * Get list of files
         * @param {string} directoryPath directory path
         * @param {function} onSuccess on success callback
         * @param {function} onError on error callback
         * @param {string} fileMask
         */
        dir:
            function SystemIO_dir(directoryPath, onSuccess, onError, fileMask) {
                fileMask = fileMask || '';
                onSuccess = onSuccess || function noop() { return; };

                function onOpenDir(dir) {
                    var filter = null;
                    if (dir === undefined) {
                        throw {message: 'dir is not object'};
                    }
                    if (!dir.toString().match('File')) {
                        throw {message: 'dir is not instance of File'};
                    }
                    fileMask = (typeof fileMask === 'string') ?
                            {name: fileMask} : fileMask;
                    filter = fileMask || null;
                    dir.listFiles(onSuccess, onError, filter);
                }

                function onOpenDirError(e) {
                    console.error('onOpenDirError: ' + e.message);
                }

                try {
                    this.openDir(directoryPath, onOpenDir, onOpenDirError, 'r');
                } catch (e) {
                    console.error('SystemIO_dir error:' + e.message);
                }
            },

        /**
         * Parse specified filepath and returns data parts
         * @param {string} filePath
         * @returnss {array}
         */
        getPathData: function SystemIO_getPathData(filePath) {
            var path = {
                originalPath: filePath,
                fileName: '',
                dirName: ''
            },
                splittedPath = filePath.split('/');

            path.fileName = splittedPath.pop();
            path.dirName = splittedPath.join('/') || '/';

            return path;
        },

        /**
         * Save specified content to file
         * @param {string} filePath File path.
         * @param {string} fileContent File content.
         * @param {function} onSaveSuccess Save success callback.
         * @param {function} onSaveFailure Save error callback.
         * @param {string} fileEncoding File encoding.
         */
        saveFileContent: function SystemIO_saveFileContent(filePath,
            fileContent, onSaveSuccess, onSaveFailure, fileEncoding) {
            var pathData = this.getPathData(filePath),
                self = this,
                fileHandle;

            function onOpenDirSuccess(dir) {
                // create new file
                fileHandle = self.createFile(dir, pathData.fileName);
                if (fileHandle !== false) {
                    // save data into this file
                    self.writeFile(fileHandle, fileContent, onSaveSuccess,
                        onSaveFailure, fileEncoding);
                } else {
                    onSaveFailure();
                }
            }

            // open directory
            this.openDir(pathData.dirName, onOpenDirSuccess, onSaveFailure);
        },

        /**
         * Deletes node with specified path
         * @param {string} nodePath Node path.
         * @param {function} onSuccess Success callback.
         */
        deleteNode: function SystemIO_deleteNode(nodePath, onSuccess) {
            var pathData = this.getPathData(nodePath),
                self = this;

            function onDeleteSuccess() {
                try {
                    tizen.content.scanFile(nodePath, function noop() { 
                        return; 
                    });
                } catch (e) {
                    console.error('SysIO_deleteNode:_onDeleteSuccess error: ' +
                        e.message);
                }
                onSuccess();
            }

            function onDeleteError(e) {
                console.error('SysIO_deleteNode:_onDeleteError', e);
            }

            function onOpenDirSuccess(dir) {
                var onListFiles = function onListFilesSuccess (files) {
                    if (files.length > 0) {
                        // file exists;
                        if (files[0].isDirectory) {
                            self.deleteDir(dir, files[0].fullPath,
                                onDeleteSuccess, onDeleteError);
                        } else {
                            self.deleteFile(dir, files[0].fullPath,
                                onDeleteSuccess, onDeleteError);
                        }
                    } else {
                        onDeleteSuccess();
                    }
                };

                // check file exists;
                dir.listFiles(onListFiles, function onError (e) {
                    console.error(e);
                }, {
                    name: pathData.fileName
                });
            }

            this.openDir(pathData.dirName, onOpenDirSuccess,
                function onOpenDirError (e) {
                console.error('openDir error:' + e.message);
                alert('Cannot save photo\n' + e.message);
            });
        },

        /**
         * Deletes specified file
         * @param {File} dir
         * @param {string} filePath file path
         * @param {function} onDeleteSuccess delete success callback
         * @param {function} onDeleteError delete error callback
         */
        deleteFile: function SystemIO_deleteFile(dir, filePath, onDeleteSuccess,
            onDeleteError) {
            try {
                dir.deleteFile(filePath, onDeleteSuccess, onDeleteError);
            } catch (e) {
                console.error('SystemIO_deleteFile error:' + e.message);
                return false;
            }
        },

        /**
         * Deletes specified directory
         * @param {File} dir
         * @param {string} dirPath Directory path.
         * @param {function} onDeleteSuccess Delete success callback.
         * @param {function} onDeleteError Delete error callback.
         * @return {boolean}
         */
        deleteDir: function SystemIO_deleteDir(dir, dirPath, onDeleteSuccess,
            onDeleteError) {
            try {
                dir.deleteDirectory(dirPath, false, onDeleteSuccess,
                    onDeleteError);
            } catch (e) {
                console.error('SystemIO_deleteDir error:' + e.message);
                return false;
            }

            return true;
        },

        /**
         * The method check the file exists;
         * @param {string} filePath
         * @param {function} onCheck success callback
         * @returns {undefined}
         */
        fileExists: function SystemIO_fileExists(filePath, onCheck) {
            var pathData = this.getPathData(filePath);

            function onOpenDirSuccess(dir) {
                try {
                    dir.resolve(pathData.fileName);
                    onCheck(true);
                } catch (error) {
                    onCheck(false);
                }
            }

            // if directory not exists, the file also not exists;
            function onOpenDirError() {
                onCheck(false);
            }

            // open directory
            this.openDir(pathData.dirName, onOpenDirSuccess, onOpenDirError);
        }
    };
}());
