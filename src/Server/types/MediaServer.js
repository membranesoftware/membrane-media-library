/*
* Copyright 2019 Membrane Software <author@membranesoftware.com>
*                 https://membranesoftware.com
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice,
* this list of conditions and the following disclaimer.
*
* 2. Redistributions in binary form must reproduce the above copyright notice,
* this list of conditions and the following disclaimer in the documentation
* and/or other materials provided with the distribution.
*
* 3. Neither the name of the copyright holder nor the names of its contributors
* may be used to endorse or promote products derived from this software without
* specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
* AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
* IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
* ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
* LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
* CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
* SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
* INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
* CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
* ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
* POSSIBILITY OF SUCH DAMAGE.
*/
"use strict";

const App = global.App || { };
const Util = require ("util");
const Fs = require ("fs");
const Path = require ("path");
const Async = require ("async");
const Crypto = require ("crypto");
const UuidV4 = require ("uuid/v4");
const Result = require (App.SOURCE_DIRECTORY + "/Result");
const Log = require (App.SOURCE_DIRECTORY + "/Log");
const FsUtil = require (App.SOURCE_DIRECTORY + "/FsUtil");
const RepeatTask = require (App.SOURCE_DIRECTORY + "/RepeatTask");
const SystemInterface = require (App.SOURCE_DIRECTORY + "/SystemInterface");
const Task = require (App.SOURCE_DIRECTORY + "/Task/Task");
const ServerBase = require (App.SOURCE_DIRECTORY + "/Server/ServerBase");

const GET_FILE_PATH = "/mediaserver/getfile";
const THUMBNAIL_PATH = "/mediaserver/thumbnail.jpg";
const MEDIA_FILE_EXTENSIONS = [ ".avi", ".mp4", ".wmv", ".mkv", ".vob", ".mpeg4", ".mov", ".flv", ".ogg", ".webm", ".divx" ];

class MediaServer extends ServerBase {
	constructor () {
		super ();
		this.name = "MediaServer";
		this.description = "Accept and execute commands to enable management of media files found in a local filesystem path";

		this.configureParams = [
			{
				name: "mediaPath",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty,
				description: "The directory path in which the media files can be found"
			},
			{
				name: "dataPath",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty,
				description: "The directory path in which the server should write data files"
			},
			{
				name: "scanPeriod",
				type: "number",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.ZeroOrGreater,
				description: "The interval to use for periodic scans of the media path, in seconds, or zero to disable periodic scans",
				defaultValue: 900
			},
			{
				name: "mediaThumbnailCount",
				type: "number",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.ZeroOrGreater,
				description: "The maximum number of thumbnail images that should be stored for each media item",
				defaultValue: 8
			}
		];

		this.isReady = false;
		this.isReadingRecords = false;

		// A map of ID values to MediaItem commands
		this.mediaMap = { };

		// A map of media path values to MediaItem commands
		this.mediaPathMap = { };

		// A map of media path values to media ID values, indicating media files that have been successfully processed during a scan operation
		this.scanPathMap = { };

		this.scanMediaDirectoryTask = new RepeatTask ();
		this.isScanningMediaDirectory = false;
		this.taskWaitCount = 0;
	}

	// Start the server's operation and invoke the provided callback when complete, with an "err" parameter (non-null if an error occurred)
	doStart (startCallback) {
		App.systemAgent.addInvokeRequestHandler ("/", SystemInterface.Constant.Media, (cmdInv) => {
			switch (cmdInv.command) {
				case SystemInterface.CommandId.GetStatus: {
					return (this.getStatus ());
				}
				case SystemInterface.CommandId.ScanMediaItems: {
					return (this.scanMediaItems ());
				}
				case SystemInterface.CommandId.RemoveMedia: {
					return (this.removeMedia (cmdInv));
				}
			}

			return (null);
		});

		App.systemAgent.addLinkCommandHandler (SystemInterface.Constant.Media, (client, cmdInv) => {
			switch (cmdInv.command) {
				case SystemInterface.CommandId.FindItems: {
					this.findItems (client, cmdInv);
					break;
				}
			}
		});

		App.systemAgent.addSecondaryRequestHandler (THUMBNAIL_PATH, (cmdInv, request, response) => {
			switch (cmdInv.command) {
				case SystemInterface.CommandId.GetThumbnailImage: {
					this.handleGetThumbnailImageRequest (cmdInv, request, response);
					break;
				}
				default: {
					App.systemAgent.endRequest (request, response, 400, "Bad request");
					break;
				}
			}
		});

		App.systemAgent.addSecondaryRequestHandler (GET_FILE_PATH, (cmdInv, request, response) => {
			switch (cmdInv.command) {
				case SystemInterface.CommandId.GetMedia: {
					this.handleGetMediaRequest (cmdInv, request, response);
					break;
				}
				default: {
					App.systemAgent.endRequest (request, response, 400, "Bad request");
					break;
				}
			}
		});

		App.systemAgent.runDataStore (() => {
			this.readRecords ();
		});

		if (this.configureMap.scanPeriod > 0) {
			this.scanMediaDirectoryTask.setRepeating ((callback) => {
				this.scanMediaDirectory (callback);
			}, this.configureMap.scanPeriod * 1000);
		}

		process.nextTick (startCallback);
	}

	// Execute subclass-specific stop operations and invoke the provided callback when complete
	doStop (stopCallback) {
		this.scanMediaDirectoryTask.stop ();
		App.systemAgent.stopDataStore ();
		process.nextTick (stopCallback);
	}

	// Execute actions appropriate when the server has been successfully configured
	doConfigure () {
		if (this.isRunning) {
			if (this.configureMap.scanPeriod > 0) {
				this.scanMediaDirectoryTask.setRepeating ((callback) => {
					this.scanMediaDirectory (callback);
				}, this.configureMap.scanPeriod * 1000);
			}
			else {
				this.scanMediaDirectoryTask.stop ();
			}
		}
	}

	// Add subclass-specific fields to the provided server configuration object, covering default values not present in the delta configuration
	doGetConfiguration (fields) {
		if (typeof fields.scanPeriod != "number") {
			fields.scanPeriod = 900;
		}
	}

	// Return a command invocation containing the server's status
	doGetStatus () {
		let params;

		params = {
			isReady: this.isReady,
			mediaCount: Object.keys (this.mediaMap).length,
			mediaPath: GET_FILE_PATH,
			thumbnailPath: "",
			thumbnailCount: this.configureMap.mediaThumbnailCount
		};
		if (this.configureMap.mediaThumbnailCount > 0) {
			params.thumbnailPath = THUMBNAIL_PATH;
		}

		return (this.createCommand ("MediaServerStatus", SystemInterface.Constant.Media, params));
	}

	// Return a promise that creates DataStore indexes for use in manipulating records
	createIndexes (ds) {
		return (new Promise ((resolve, reject) => {
			let indexes, obj, doCreate, endSeries;
			indexes = [
				{ command: 1 },
				{ command: 1, commandType: 1 }
			];
			obj = { };
			obj["prefix." + SystemInterface.Constant.AgentIdPrefixField] = 1;
			indexes.push (obj);

			obj = { };
			obj["params.id"] = 1;
			indexes.push (obj);

			obj = { };
			obj["params.name"] = 1;
			indexes.push (obj);

			obj = { };
			obj["params.mtime"] = 1;
			indexes.push (obj);

			setTimeout (() => {
				Async.eachSeries (indexes, doCreate, endSeries);
			}, 0);
			doCreate = (index, callback) => {
				ds.createIndex (index, { }, callback);
			};

			endSeries = (err) => {
				if (err != null) {
					reject (Error (err));
					return;
				}
				resolve ();
			};
		}));
	}

	// Execute operations to read records from the data store and replace the contents of mediaMap.
	readRecords () {
		let ds, findCallback, recordmap;

		if (this.isReadingRecords) {
			return;
		}

		this.isReadingRecords = true;
		this.isReady = false;
		recordmap = { };
		App.systemAgent.openDataStore ().then ((dataStore) => {
			ds = dataStore;
			return (this.createIndexes (ds));
		}).then (() => {
			let crit, sort;

			crit = {
				command: SystemInterface.CommandId.MediaItem
			};
			sort = {
				"prefix.recordTime": -1
			};
			ds.findRecords (findCallback, crit, sort);
		}).catch ((err) => {
			Log.err (`${this.toString ()} failed to read data store records; err=${err}`);
			this.isReadingRecords = false;
		});

		findCallback = (err, record) => {
			if (err != null) {
				Log.err (`${this.toString ()} failed to read data store records; err=${err}`);
				this.isReadingRecords = false;
				return;
			}

			if (record == null) {
				this.mediaMap = recordmap;
				this.resetMediaPathMap ();
				this.isReadingRecords = false;
				this.isReady = true;
				this.scanMediaDirectoryTask.setNextRepeat (0);
				return;
			}

			SystemInterface.populateDefaultFields (record.params, SystemInterface.Type[record.commandName]);
			recordmap[record.params.id] = record;
		};
	}

	// Reset the contents of mediaPathMap, as generated from the contents of mediaMap
	resetMediaPathMap () {
		let map;

		map = { };
		for (let i in this.mediaMap) {
			map[this.mediaMap[i].params.mediaPath] = this.mediaMap[i];
		}

		this.mediaPathMap = map;
	}

	// Execute a FindItems command and write result commands to the provided client
	findItems (client, cmdInv) {
		let ds, crit, sort, findresult, findCallback;

		ds = App.systemAgent.dataStore;
		if (ds == null) {
			return;
		}

		crit = {
			command: SystemInterface.CommandId.MediaItem
		};
		if ((cmdInv.params.searchKey != "") && (cmdInv.params.searchKey != "*")) {
			crit["params.name"] = {
				"$regex": ds.getSearchKeyRegex (cmdInv.params.searchKey),
				"$options": "i"
			};
		}

		sort = { };
		switch (cmdInv.params.sortOrder) {
			case SystemInterface.Constant.NewestSort: {
				sort["params.mtime"] = -1;
				break;
			}
			default: {
				sort["params.name"] = 1;
				break;
			}
		}
		findresult = {
			searchKey: cmdInv.params.searchKey,
			resultOffset: cmdInv.params.resultOffset
		};

		ds.open ().then (() => {
			return (ds.countRecords (crit));
		}).then ((recordCount) => {
			let max, skip;

			max = null;
			skip = null;
			if (cmdInv.params.maxResults > 0) {
				max = cmdInv.params.maxResults;
			}
			if (cmdInv.params.resultOffset > 0) {
				skip = cmdInv.params.resultOffset;
			}

			findresult.setSize = recordCount;
			if (recordCount <= 0) {
				client.emit (SystemInterface.Constant.WebSocketEvent, this.createCommand ("FindMediaResult", SystemInterface.Constant.Media, findresult));
				return;
			}

			ds.findRecords (findCallback, crit, sort, max, skip);
		}).catch ((err) => {
			Log.err (`${this.toString ()} FindItems command failed to execute; err=${err}`);
		});

		findCallback = (err, record) => {
			if (err != null) {
				Log.err (`${this.toString ()} FindItems command failed to execute; err=${err}`);
				return;
			}

			if (findresult != null) {
				findresult = this.createCommand ("FindMediaResult", SystemInterface.Constant.Media, findresult);
				if (findresult != null) {
					client.emit (SystemInterface.Constant.WebSocketEvent, findresult);
				}
				findresult = null;
			}

			if (record != null) {
				SystemInterface.populateDefaultFields (record.params, SystemInterface.Type[record.commandName]);
				client.emit (SystemInterface.Constant.WebSocketEvent, record);
			}
		};
	}

	// Execute a ScanMediaItems command and write result commands to the provided client
	scanMediaItems () {
		if (this.configureMap.scanPeriod > 0) {
			this.scanMediaDirectoryTask.setNextRepeat (0);
		}
		else {
			if (! this.isScanningMediaDirectory) {
				this.scanMediaDirectory (() => { });
			}
		}
		return (this.createCommand ("CommandResult", SystemInterface.Constant.Media, {
			success: true
		}));
	}

	// Scan the server's media path to find new media files and create tasks as needed to gather metadata, and invoke the provided callback when complete
	scanMediaDirectory (endCallback) {
		if ((! this.isReady) || (this.taskWaitCount > 0) || (Object.keys (this.scanPathMap).length > 0)) {
			process.nextTick (endCallback);
			return;
		}

		this.isScanningMediaDirectory = true;
		FsUtil.findAllFiles (this.configureMap.mediaPath).then ((fileList) => {
			let targetfiles;

			targetfiles = [ ];
			for (let filename of fileList) {
				if (MEDIA_FILE_EXTENSIONS.includes (Path.extname (filename).toLowerCase ())) {
					targetfiles.push (filename);
				}
			}

			return (this.scanMediaFiles (targetfiles));
		}).then (() => {
			endCallback ();
		}).catch ((err) => {
			Log.err (`${this.toString ()} failed to update media data; err=${err}`);
			endCallback (err);
		}).then (() => {
			this.isScanningMediaDirectory = false;
		});
	}

	// Return a promise that checks attributes of the media files named in the provided list, while creating tasks as needed to gather metadata and populate thumbnail images from newly discovered items.
	scanMediaFiles (fileList) {
		return (new Promise ((resolve, reject) => {
			let doScan, taskComplete, endSeries;

			this.scanPathMap = { };
			setTimeout (() => {
				Async.eachSeries (fileList, doScan, endSeries);
			}, 0);

			doScan = (filename, callback) => {
				this.scanMediaFile (filename, (err, recordId, isReady) => {
					let task;

					if (err != null) {
						callback (err);
						return;
					}

					if (isReady) {
						this.scanPathMap[filename] = recordId;
					}
					else {
						if (recordId == null) {
							recordId = App.systemAgent.getUuid (SystemInterface.CommandId.MediaItem);
						}
						task = Task.createTask ("ScanMediaFile", {
							mediaId: recordId,
							mediaPath: filename,
							dataPath: this.configureMap.dataPath,
							mediaThumbnailCount: this.configureMap.mediaThumbnailCount
						});
						if (task == null) {
							Log.warn (`${this.toString ()} failed to create ScanMediaFile task`);
						}
						else {
							++(this.taskWaitCount);
							App.systemAgent.runTask (task, taskComplete);
						}
					}
					callback ();
				});
			};

			taskComplete = (task) => {
				let ds, record;

				--(this.taskWaitCount);
				if (this.taskWaitCount <= 0) {
					setTimeout (() => {
						this.pruneMediaItems ();
					}, 0);
				}

				if (task.isSuccess) {
					record = this.createCommand ("MediaItem", SystemInterface.Constant.Media, task.resultObject);
					if (record == null) {
						Log.err (`${this.toString ()} failed to store record for media file; err="Invalid record data"`);
						return;
					}

					this.scanPathMap[record.params.mediaPath] = record.params.id;
					if (this.mediaMap[record.params.id] != null) {
						return;
					}

					ds = App.systemAgent.dataStore;
					if (ds == null) {
						Log.err (`${this.toString ()} failed to store record for media file; err="DataStore not available"`);
						return;
					}

					ds.open ().then (() => {
						return (ds.storeRecord (record));
					}).then (() => {
						this.mediaMap[record.params.id] = record;
						this.mediaPathMap[record.params.mediaPath] = record;
					}).catch ((err) => {
						Log.err (`${this.toString ()} failed to store record for media file; err=${err}`);
					});
				}
			};

			endSeries = (err) => {
				if (err != null) {
					reject (Error (err));
					return;
				}

				if (this.taskWaitCount <= 0) {
					this.pruneMediaItems ();
				}
				resolve ();
			};
		}));
	}

	// Verify stored metadata and attributes of the named media file and invoke the provided callback when complete, with "err" (non-null if an error occurred), "recordId" (the ID of the existing record for the file, or null if no such ID exists) and "isReady" (true if the file already holds stored metadata) parameters.
	scanMediaFile (filename, endCallback) {
		let record, statComplete, scanThumbnailFilesComplete;
		setTimeout (() => {
			Fs.stat (filename, statComplete);
		}, 0);
		statComplete = (err, stats) => {
			if (err != null) {
				Log.debug (`${this.toString ()} failed to scan media file; filename="${filename}" err=${err}`);
				endCallback (err, null, false);
				return;
			}

			record = this.mediaPathMap[filename];
			if ((record == null) || (record.params.mtime != stats.mtime.getTime ())) {
				endCallback (null, null, false);
				return;
			}

			this.scanThumbnailFiles (Path.join (this.configureMap.dataPath, record.params.id, "thumbnail"), scanThumbnailFilesComplete);
		};

		scanThumbnailFilesComplete = (err, isReady) => {
			if (err != null) {
				endCallback (err, null, false);
				return;
			}

			if (! isReady) {
				endCallback (null, record.params.id, false);
				return;
			}

			endCallback (null, record.params.id, true);
		};
	}

	// Verify the presence of thumbnail files in the specified directory and invoke the provided callback when complete, with "err" (non-null if an error occurred) and "isReady" (true if the directory holds the expected number of thumbnail files) parameters.
	scanThumbnailFiles (thumbnailPath, endCallback) {
		let fileindex, filename, scanNextFile, fileExistsComplete;

		if (this.configureMap.mediaThumbnailCount <= 0) {
			process.nextTick (() => {
				endCallback (null, true);
			});
			return;
		}
		setTimeout (() => {
			fileindex = -1;
			scanNextFile ();
		}, 0);

		scanNextFile = () => {
			++fileindex;
			if (fileindex >= this.configureMap.mediaThumbnailCount) {
				endCallback (null, true);
				return;
			}

			filename = Path.join (thumbnailPath, `${fileindex}.jpg`);
			FsUtil.fileExists (filename, fileExistsComplete);
		};

		fileExistsComplete = (err, exists) => {
			if (err != null) {
				endCallback (err, false);
				return;
			}

			if (! exists) {
				endCallback (null, false);
				return;
			}

			scanNextFile ();
		};
	}

	// Update MediaItem records as appropriate for the contents of scanPathMap and clear the map when complete
	pruneMediaItems () {
		let ds, idlist;

		idlist = [ ];
		for (let i in this.mediaPathMap) {
			if (this.scanPathMap[i] == null) {
				idlist.push (this.mediaPathMap[i].params.id);
			}
		}

		if (idlist.length <= 0) {
			this.scanPathMap = { };
			return;
		}

		App.systemAgent.openDataStore ().then ((dataStore) => {
			ds = dataStore;
			return (new Promise ((resolve, reject) => {
				let doUpdate, endSeries;

				doUpdate = (recordId, callback) => {
					let crit, update, options;

					crit = {
						"params.id": recordId
					};
					update = {
						"$set": {
							"params.isCreateStreamAvailable": false
						}
					};
					options = { };
					ds.updateRecords (crit, update, options, callback);
				};

				endSeries = (err) => {
					if (err != null) {
						reject (Error (err));
						return;
					}
					resolve ();
				};

				Async.eachSeries (idlist, doUpdate, endSeries);
			}));
		}).catch ((err) => {
			Log.err (`${this.toString ()} failed to prune media items; err=${err}`);
		}).then (() => {
			this.scanPathMap = { };
		});
	}

	// Execute a RemoveMedia command and return a command invocation result
	removeMedia (cmdInv) {
		let ds, record, crit;

		record = this.mediaMap[cmdInv.params.id];
		if (record == null) {
			return (this.createCommand ("CommandResult", SystemInterface.Constant.Media, {
				success: true
			}));
		}

		delete (this.mediaPathMap[record.params.mediaPath]);
		delete (this.mediaMap[cmdInv.params.id]);
		App.systemAgent.openDataStore ().then ((dataStore) => {
			ds = dataStore;
			return (new Promise ((resolve, reject) => {
				let crit;

				crit = {
					"params.id": cmdInv.params.id
				};
				ds.removeRecords (crit, (err) => {
					if (err != null) {
						reject (Error (err));
						return;
					}
					resolve ();
				});
			}));
		}).then (() => {
			return (new Promise ((resolve, reject) => {
				FsUtil.removeDirectory (Path.join (this.configureMap.dataPath, cmdInv.params.id), (err) => {
					if (err != null) {
						reject (Error (err));
						return;
					}
					resolve ();
				});
			}));
		}).catch ((err) => {
			Log.err (`${this.toString ()} failed to remove MediaItem record; err=${err}`);
		});

		return (this.createCommand ("CommandResult", SystemInterface.Constant.Media, {
			success: true
		}));
	}

	// Handle a get thumbnail image request
	handleGetThumbnailImageRequest (cmdInv, request, response) {
		let item, imagepath, statComplete;

		item = this.mediaMap[cmdInv.params.id];
		if (item == null) {
			response.statusCode = 404;
			response.end ();
			return;
		}

		imagepath = Path.join (this.configureMap.dataPath, item.params.id, "thumbnail", `${Math.floor (cmdInv.params.thumbnailIndex)}.jpg`);

		statComplete = (err, stats) => {
			let stream, isopen;

			if (err != null) {
				Log.err (`${this.toString ()} error reading thumbnail file; path=${imagepath} err=${err}`);
				response.statusCode = 404;
				response.end ();
				return;
			}

			if (! stats.isFile ()) {
				Log.err (`${this.toString ()} error reading thumbnail file; path=${imagepath} err=Not a regular file`);
				response.statusCode = 404;
				response.end ();
				return;
			}

			isopen = false;
			stream = Fs.createReadStream (imagepath, { });
			stream.on ("error", function (err) {
				Log.err (`${this.toString ()} error reading thumbnail file; path=${imagepath} err=${err}`);
				if (! isopen) {
					response.statusCode = 500;
					response.end ();
				}
			});

			stream.on ("open", function () {
				if (isopen) {
					return;
				}

				isopen = true;
				response.statusCode = 200;
				response.setHeader ("Content-Type", "image/jpeg");
				response.setHeader ("Content-Length", stats.size);
				stream.pipe (response);
				stream.on ("finish", function () {
					response.end ();
				});

				response.socket.setMaxListeners (0);
				response.socket.once ("error", function (err) {
					stream.close ();
				});
			});
		};
		Fs.stat (imagepath, statComplete);
	}

	// Handle a GetMedia request by reading filesystem data for the specified item
	handleGetMediaRequest (cmdInv, request, response) {
		let path, item, statComplete;

		item = this.mediaMap[cmdInv.params.id];
		if (item == null) {
			response.statusCode = 404;
			response.end ();
			return;
		}
		path = Path.join (this.configureMap.mediaPath, item.params.name);

		statComplete = (err, stats) => {
			let stream, isopen;

			if (err != null) {
				Log.err (`${this.toString ()} error reading media file; path=${path} err=${err}`);
				response.statusCode = 404;
				response.end ();
				return;
			}

			if (! stats.isFile ()) {
				Log.err (`${this.toString ()} error reading media file; path=${imagepath} err=Not a regular file`);
				response.statusCode = 404;
				response.end ();
				return;
			}

			isopen = false;
			stream = Fs.createReadStream (path, { });
			stream.on ("error", function (err) {
				Log.err (`${this.toString ()} error reading media file; path=${path} err=${err}`);
				if (! isopen) {
					response.statusCode = 500;
					response.end ();
				}
			});

			stream.on ("open", function () {
				if (isopen) {
					return;
				}

				isopen = true;
				response.statusCode = 200;
				response.setHeader ("Content-Length", stats.size);
				stream.pipe (response);
				stream.on ("finish", function () {
					response.end ();
				});

				response.socket.setMaxListeners (0);
				response.socket.once ("error", function (err) {
					stream.close ();
				});
			});
		};
		Fs.stat (path, statComplete);
	}
}

module.exports = MediaServer;
