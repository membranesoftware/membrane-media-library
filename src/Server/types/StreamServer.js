/*
* Copyright 2018-2019 Membrane Software <author@membranesoftware.com> https://membranesoftware.com
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
const Url = require ("url");
const QueryString = require ("querystring");
const Result = require (App.SOURCE_DIRECTORY + "/Result");
const Log = require (App.SOURCE_DIRECTORY + "/Log");
const FsUtil = require (App.SOURCE_DIRECTORY + "/FsUtil");
const SystemInterface = require (App.SOURCE_DIRECTORY + "/SystemInterface");
const RepeatTask = require (App.SOURCE_DIRECTORY + "/RepeatTask");
const Task = require (App.SOURCE_DIRECTORY + "/Task/Task");
const ServerBase = require (App.SOURCE_DIRECTORY + "/Server/ServerBase");

const STREAM_WEBROOT_PATH = "/str";
const THUMBNAIL_PATH = "/str/a.png";
const HLS_STREAM_PATH = "/str/b.m3u8";
const HLS_SEGMENT_PATH = "/str/c.ts";
const DASH_MPD_PATH = "/str/e.mpd";
const DASH_SEGMENT_PATH = "/str/f.m4s";

const CATALOG_WEBROOT_PATH = "/media";
const CATALOG_DATA_PATH = "/media-data";
const PLAYER_WEBROOT_PATH = "/play";

const GET_DISK_SPACE_PERIOD = 7 * 60 * 1000; // milliseconds

class StreamServer extends ServerBase {
	constructor () {
		super ();
		this.name = "StreamServer";
		this.description = "Transcode media files into stream data for consumption by clients requesting playback";

		this.configureParams = [
			{
				name: "dataPath",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty,
				description: "The directory path in which the server should write data files"
			}
		];

		this.isReady = false;
		this.totalStorage = 0; // bytes
		this.freeStorage = 0; // bytes
		this.usedStorage = 0; // bytes
		this.getDiskSpaceTask = new RepeatTask ();

		// A map of stream ID values to StreamItem commands
		this.streamMap = { };
	}

	// Start the server's operation and invoke the provided callback when complete, with an "err" parameter (non-null if an error occurred)
	doStart (startCallback) {
		FsUtil.createDirectory (this.configureMap.dataPath).then (() => {
			return (Task.executeTask ("GetDiskSpace", { targetPath: this.configureMap.dataPath }));
		}).then ((resultObject) => {
			this.totalStorage = resultObject.total;
			this.usedStorage = resultObject.used;
			this.freeStorage = resultObject.free;
		}).then (() => {
			App.systemAgent.addInvokeRequestHandler ("/", SystemInterface.Constant.Stream, (cmdInv) => {
				switch (cmdInv.command) {
					case SystemInterface.CommandId.GetStatus: {
						return (this.getStatus ());
					}
					case SystemInterface.CommandId.ConfigureMediaStream: {
						return (this.configureMediaStream (cmdInv));
					}
					case SystemInterface.CommandId.RemoveStream: {
						return (this.removeStream (cmdInv));
					}
				}

				return (null);
			});

			App.systemAgent.addLinkCommandHandler (SystemInterface.Constant.Stream, (client, cmdInv) => {
				switch (cmdInv.command) {
					case SystemInterface.CommandId.FindItems: {
						this.findItems (client, cmdInv);
						break;
					}
					case SystemInterface.CommandId.FindMediaStreams: {
						this.findMediaStreams (client, cmdInv);
						break;
					}
				}
			});

			App.systemAgent.addSecondaryRequestHandler (THUMBNAIL_PATH, (cmdInv, request, response) => {
				switch (cmdInv.command) {
					case SystemInterface.CommandId.GetThumbnailImage: {
						this.getThumbnailImage (cmdInv, request, response);
						break;
					}
					default: {
						App.systemAgent.endRequest (request, response, 400, "Bad request");
						break;
					}
				}
			});

			App.systemAgent.addSecondaryRequestHandler (HLS_STREAM_PATH, (cmdInv, request, response) => {
				switch (cmdInv.command) {
					case SystemInterface.CommandId.GetHlsManifest: {
						this.handleGetHlsManifestRequest (cmdInv, request, response);
						break;
					}
					default: {
						App.systemAgent.endRequest (request, response, 400, "Bad request");
						break;
					}
				}
			});

			App.systemAgent.addSecondaryRequestHandler (HLS_SEGMENT_PATH, (cmdInv, request, response) => {
				switch (cmdInv.command) {
					case SystemInterface.CommandId.GetHlsSegment: {
						this.handleGetHlsSegmentRequest (cmdInv, request, response);
						break;
					}
					default: {
						App.systemAgent.endRequest (request, response, 400, "Bad request");
						break;
					}
				}
			});

			App.systemAgent.addSecondaryRequestHandler (DASH_MPD_PATH, (cmdInv, request, response) => {
				switch (cmdInv.command) {
					case SystemInterface.CommandId.GetDashMpd: {
						this.handleGetDashMpdRequest (cmdInv, request, response);
						break;
					}
					default: {
						App.systemAgent.endRequest (request, response, 400, "Bad request");
						break;
					}
				}
			});

			App.systemAgent.addSecondaryRequestHandler (DASH_SEGMENT_PATH, (cmdInv, request, response) => {
				this.handleGetDashSegmentRequest (request, response);
			});

			App.systemAgent.addSecondaryWebroot (STREAM_WEBROOT_PATH, STREAM_WEBROOT_PATH);
			App.systemAgent.addSecondaryWebroot (PLAYER_WEBROOT_PATH, PLAYER_WEBROOT_PATH);
			App.systemAgent.addSecondaryWebroot (CATALOG_WEBROOT_PATH, CATALOG_WEBROOT_PATH);
			App.systemAgent.addSecondaryRequestHandler (CATALOG_DATA_PATH, (cmdInv, request, response) => {
				switch (cmdInv.command) {
					case SystemInterface.CommandId.FindItems: {
						this.handleFindItemsRequest (cmdInv, request, response);
						break;
					}
					case SystemInterface.CommandId.GetStreamItem: {
						this.handleGetStreamItemRequest (cmdInv, request, response);
						break;
					}
					case SystemInterface.CommandId.GetStatus: {
						App.systemAgent.endRequest (request, response, 200, JSON.stringify (this.getStatus ()));
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

			this.getDiskSpaceTask.setRepeating ((callback) => {
				Task.executeTask ("GetDiskSpace", { targetPath: this.configureMap.dataPath }).then ((resultObject) => {
					this.totalStorage = resultObject.total;
					this.usedStorage = resultObject.used;
					this.freeStorage = resultObject.free;
					callback ();
				}).catch ((err) => {
					callback ();
				});
			}, GET_DISK_SPACE_PERIOD);

			App.systemAgent.getApplicationNews ();
			startCallback ();
		}).catch ((err) => {
			startCallback (err);
		});
	}

	// Execute subclass-specific stop operations and invoke the provided callback when complete
	doStop (stopCallback) {
		this.getDiskSpaceTask.stop ();
		App.systemAgent.stopDataStore ();
		process.nextTick (stopCallback);
	}

	// Return a command invocation containing the server's status
	doGetStatus () {
		return (this.createCommand ("StreamServerStatus", SystemInterface.Constant.Stream, {
			isReady: this.isReady,
			streamCount: Object.keys (this.streamMap).length,
			freeStorage: this.freeStorage,
			totalStorage: this.totalStorage,
			hlsStreamPath: HLS_STREAM_PATH,
			thumbnailPath: THUMBNAIL_PATH,
			htmlPlayerPath: PLAYER_WEBROOT_PATH,
			htmlCatalogPath: CATALOG_WEBROOT_PATH
		}));
	}

	// Execute operations to read records from the data store and replace the contents of streamMap
	readRecords () {
		let ds;

		App.systemAgent.openDataStore ().then ((dataStore) => {
			ds = dataStore;
			return (this.createIndexes (ds));
		}).then (() => {
			let crit;

			crit = {
				command: SystemInterface.CommandId.StreamItem
			};
			return (ds.findAllRecords (crit));
		}).then ((records) => {
			let recordmap;

			recordmap = { };
			for (let record of records) {
				SystemInterface.populateDefaultFields (record.params, SystemInterface.Type[record.commandName]);
				recordmap[record.params.id] = record;
			}

			this.streamMap = recordmap;
			this.isReady = true;
			this.scanDataDirectory ();
		}).catch ((err) => {
			Log.err (`${this.toString ()} failed to read data store records; err=${err}`);
		});
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
			obj["params.sourceId"] = 1;
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

	// Execute operations to verify the presence of files required for each item in the stream map
	scanDataDirectory () {
		let items, itemindex, removelist, scanNextItem;
		setTimeout (() => {
			removelist = [ ];
			items = Object.values (this.streamMap);
			itemindex = -1;
			scanNextItem ();
		}, 0);
		scanNextItem = () => {
			let item, datapath, filenames, statFilesComplete;

			++itemindex;
			if (itemindex >= items.length) {
				this.pruneStreamItems (removelist);
				return;
			}

			item = items[itemindex];
			datapath = Path.join (this.configureMap.dataPath, item.params.id);
			filenames = [ ];
			filenames.push (Path.join (datapath, App.STREAM_HLS_PATH, App.STREAM_HLS_INDEX_FILENAME));
			for (let i = 0; i < item.params.segmentFilenames.length; ++i) {
				filenames.push (Path.join (datapath, App.STREAM_HLS_PATH, item.params.segmentFilenames[i]));
				filenames.push (Path.join (datapath, App.STREAM_THUMBNAIL_PATH, item.params.segmentFilenames[i] + ".jpg"));
			}

			setTimeout (() => {
				FsUtil.statFiles (filenames, (filename, stats) => {
					return (stats.isFile () && (stats.size > 0));
				}, statFilesComplete);
			}, 0);
			statFilesComplete = (err) => {
				if (err != null) {
					removelist.push (item);
				}
				scanNextItem ();
			};
		};
	}

	// Remove a set of StreamItem records from the stream map and delete them from the data store
	pruneStreamItems (removeList) {
		let ds, doRemove, endSeries;

		ds = App.systemAgent.dataStore;
		if (ds == null) {
			Log.err (`${this.toString ()} failed to update stream items; err="DataStore not available"`);
			return;
		}

		ds.open ((err) => {
			if (err != null) {
				Log.err (`${this.toString ()} failed to update stream items; err=${err}`);
				return;
			}
			Async.eachSeries (removeList, doRemove, endSeries);
		});

		doRemove = (streamItem, callback) => {
			let crit, removeRecordsComplete, removeDirectoryComplete;
			delete (this.streamMap[streamItem.params.id]);
			crit = {
				"params.id": streamItem.params.id
			};
			setTimeout (() => {
				ds.removeRecords (crit, removeRecordsComplete);
			}, 0);
			removeRecordsComplete = (err) => {
				if (err != null) {
					callback (err);
					return;
				}

				FsUtil.removeDirectory (Path.join (this.configureMap.dataPath, streamItem.params.id), removeDirectoryComplete);
			};
			removeDirectoryComplete = (err) => {
				callback (err);
			};
		};

		endSeries = (err) => {
			if (err != null) {
				Log.warn (`${this.toString ()} failed to update stream items; err=${err}`);
			}
		};
	}

	// Execute a FindItems command and write result commands to the provided client
	findItems (client, cmdInv) {
		let ds, crit, sort, findresult, findCallback;

		App.systemAgent.openDataStore ().then ((dataStore) => {
			ds = dataStore;
			crit = {
				command: SystemInterface.CommandId.StreamItem
			};
			if ((cmdInv.params.searchKey != "") && (cmdInv.params.searchKey != "*")) {
				crit["params.name"] = {
					"$regex": ds.getSearchKeyRegex (cmdInv.params.searchKey),
					"$options": "i"
				};
			}
			sort = {
				"params.name": 1
			};
			findresult = {
				searchKey: cmdInv.params.searchKey,
				resultOffset: cmdInv.params.resultOffset
			};
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
				client.emit (SystemInterface.Constant.WebSocketEvent, this.createCommand ("FindMediaResult", SystemInterface.Constant.Stream, findresult));
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
				findresult = this.createCommand ("FindStreamsResult", SystemInterface.Constant.Stream, findresult);
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

	// Execute a FindMediaStreams command and write result commands to the provided client
	findMediaStreams (client, cmdInv) {
		let ds;

		if (cmdInv.params.sourceIds.length <= 0) {
			return;
		}

		App.systemAgent.openDataStore ().then ((dataStore) => {
			ds = dataStore;
			return (new Promise ((resolve, reject) => {
				let crit, sort, doFind, endSeries, findCallback, streams;

				streams = [ ];
				doFind = (sourceId, callback) => {
					crit = {
						command: SystemInterface.CommandId.StreamItem,
						"params.sourceId": sourceId
					};
					sort = {
						"params.id": 1
					};

					findCallback = (err, record) => {
						if (err != null) {
							callback (err);
							return;
						}
						if (record == null) {
							client.emit (SystemInterface.Constant.WebSocketEvent, this.createCommand ("FindMediaStreamsResult", SystemInterface.Constant.Stream, {
								mediaId: sourceId,
								streams: streams
							}));

							callback ();
							return;
						}

						SystemInterface.populateDefaultFields (record.params, SystemInterface.Type[record.commandName]);
						streams.push (record);
					};

					ds.findRecords (findCallback, crit, sort);
				};

				endSeries = (err) => {
					if (err != null) {
						reject (err);
						return;
					}

					resolve ();
				};

				Async.eachSeries (cmdInv.params.sourceIds, doFind, endSeries);
			}));
		}).catch ((err) => {
			Log.err (`${this.toString ()} FindMediaStreams command failed to execute; err=${err}`);
		});
	}

	// Execute a ConfigureMediaStream command and return a command invocation result
	configureMediaStream (cmdInv) {
		let mediapath, mediaserver, mediaitem, streamid, removelist, match, params, task;
		mediapath = "";
		if (cmdInv.params.mediaServerAgentId == App.systemAgent.agentId) {
			mediaserver = App.systemAgent.getServer ("MediaServer");
			if (mediaserver != null) {
				mediaitem = mediaserver.mediaMap[cmdInv.params.mediaId];
				if (mediaitem != null) {
					mediapath = mediaitem.params.mediaPath;
				}
			}
		}
		if (mediapath == "") {
			mediapath = cmdInv.params.mediaUrl;
		}
		if (mediapath == "") {
			return (this.createCommand ("CommandResult", SystemInterface.Constant.Stream, {
				success: false,
				error: "Media item not found"
			}));
		}

		removelist = [ ];
		match = false;
		for (let item of Object.values (this.streamMap)) {
			if (item.params.sourceId == cmdInv.params.mediaId) {
				if (item.params.profile == cmdInv.params.profile) {
					match = true;
					break;
				}

				removelist.push (item);
			}
		}
		if (match) {
			return (this.createCommand ("CommandResult", SystemInterface.Constant.Stream, {
				success: true
			}));
		}
		this.pruneStreamItems (removelist);

		streamid = App.systemAgent.getUuid (SystemInterface.CommandId.StreamItem);
		params = {
			streamId: streamid,
			streamName: cmdInv.params.streamName,
			mediaId: cmdInv.params.mediaId,
			mediaPath: mediapath,
			dataPath: this.configureMap.dataPath,
			mediaWidth: cmdInv.params.mediaWidth,
			mediaHeight: cmdInv.params.mediaHeight,
			profile: cmdInv.params.profile
		};
		task = Task.createTask ("CreateMediaStream", params);
		if (task == null) {
			return (this.createCommand ("CommandResult", SystemInterface.Constant.Stream, {
				success: false,
				error: "Internal server error"
			}));
		}

		App.systemAgent.runTask (task, (task) => {
			let record;
			if (task.isSuccess) {
				App.systemAgent.openDataStore ().then ((ds) => {
					record = this.createCommand ("StreamItem", SystemInterface.Constant.Stream, task.resultObject);
					if (record == null) {
						return (Promise.reject (Error ("Invalid record data")));
					}

					return (ds.storeRecord (record));
				}).then (() => {
					this.streamMap[record.params.id] = record;
				}).catch ((err) => {
					Log.err (`${this.toString ()} failed to store stream item record; err=${err}`);
				});
			}
		});

		return (this.createCommand ("CommandResult", SystemInterface.Constant.Stream, {
			success: true,
			taskId: task.id
		}));
	}

	// Execute a RemoveStream command and return a command invocation result
	removeStream (cmdInv) {
		let item;

		item = this.streamMap[cmdInv.params.id];
		if (item == null) {
			return (server.createCommand ("CommandResult", SystemInterface.Constant.Stream, {
				success: false
			}));
		}

		this.pruneStreamItems ([ item ]);
		return (this.createCommand ("CommandResult", SystemInterface.Constant.Stream, {
			success: true
		}));
	}

	// Handle a request with a FindItems command
	handleFindItemsRequest (cmdInv, request, response) {
		let ds, crit, sort, findresult;

		App.systemAgent.openDataStore ().then ((dataStore) => {
			ds = dataStore;
			crit = {
				command: SystemInterface.CommandId.StreamItem
			};
			if ((cmdInv.params.searchKey != "") && (cmdInv.params.searchKey != "*")) {
				crit["params.name"] = {
					"$regex": ds.getSearchKeyRegex (cmdInv.params.searchKey),
					"$options": "i"
				};
			}
			sort = {
				"params.name": 1
			};
			findresult = {
				searchKey: cmdInv.params.searchKey,
				resultOffset: cmdInv.params.resultOffset,
				streams: [ ]
			};
			return (ds.countRecords (crit));
		}).then ((recordCount) => {
			let max, skip, cmd;

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
				cmd = this.createCommand ("FindStreamsResult", SystemInterface.Constant.Stream, findresult);
				if (cmd == null) {
					App.systemAgent.endRequest (request, response, 500, "Internal server error");
				}
				else {
					response.setHeader ("Content-Type", "application/json");
					App.systemAgent.endRequest (request, response, 200, JSON.stringify (cmd));
				}
				return;
			}

			ds.findRecords ((err, record) => {
				let summary;

				if (err != null) {
					Log.err (`${this.toString ()} FindItems command failed to execute; err=${err}`);
					App.systemAgent.endRequest (request, response, 500, "Internal server error");
					return;
				}

				if (record == null) {
					cmd = this.createCommand ("FindStreamsResult", SystemInterface.Constant.Stream, findresult);
					if (cmd == null) {
						App.systemAgent.endRequest (request, response, 500, "Internal server error");
					}
					else {
						response.setHeader ("Content-Type", "application/json");
						App.systemAgent.endRequest (request, response, 200, JSON.stringify (cmd));
					}
					return;
				}

				SystemInterface.populateDefaultFields (record.params, SystemInterface.Type[record.commandName]);
				summary = { };
				for (let i of [ "id", "name", "duration", "width", "height", "size", "bitrate", "frameRate", "profile", "segmentCount" ]) {
					summary[i] = record.params[i];
				}
				findresult.streams.push (summary);
			}, crit, sort, max, skip);
		}).catch ((err) => {
			Log.err (`${this.toString ()} FindItems command failed to execute; err=${err}`);
			App.systemAgent.endRequest (request, response, 500, "Internal server error");
		});
	}

	// Handle a request with a GetStreamItem command
	handleGetStreamItemRequest (cmdInv, request, response) {
		let item;

		item = this.streamMap[cmdInv.params.streamId];
		if (item == null) {
			App.systemAgent.endRequest (request, response, 404, "Not found");
			return;
		}

		response.setHeader ("Content-Type", "application/json");
		App.systemAgent.endRequest (request, response, 200, JSON.stringify (item));
	}

	// Handle a request with a GetDashMpd command
	handleGetDashMpdRequest (cmdInv, request, response) {
		let item;

		item = this.streamMap[cmdInv.params.streamId];
		if (item == null) {
			App.systemAgent.endRequest (request, response, 404, "Not found");
			return;
		}

		Fs.readFile (Path.join (this.configureMap.dataPath, item.params.id, App.STREAM_DASH_PATH, App.STREAM_DASH_DESCRIPTION_FILENAME), (err, data) => {
			if (err != null) {
				App.systemAgent.endRequest (request, response, 500, "Internal server error");
				return;
			}

			data = data.toString ();
			data = data.replace (/init-stream\$RepresentationID\$.m4s/g, DASH_SEGMENT_PATH + "?streamId=" + cmdInv.params.streamId + "&amp;representationIndex=$$RepresentationID$$&amp;segmentIndex=0");
			data = data.replace (/chunk-stream\$RepresentationID\$-\$Number%05d\$.m4s/g, DASH_SEGMENT_PATH + "?streamId=" + cmdInv.params.streamId + "&amp;representationIndex=$$RepresentationID$$&amp;segmentIndex=$$Number%05d$$");

			response.setHeader ("Content-Type", "dash/xml");
			App.systemAgent.endRequest (request, response, 200, data);
		});
	}

	// Handle a request for a DASH segment
	handleGetDashSegmentRequest (request, response) {
		let url, q, streamid, ri, si, item, filename, path;

		url = Url.parse (request.url);
		if (url == null) {
			App.systemAgent.endRequest (request, response, 400, "Bad request");
			return;
		}

		q = QueryString.parse (url.query);
		streamid = (typeof q.streamId == "string") ? q.streamId : null;
		ri = (typeof q.representationIndex == "string") ? q.representationIndex : null;
		si = (typeof q.segmentIndex == "string") ? q.segmentIndex : null;
		if ((streamid === null) || (ri === null) || (si === null)) {
			App.systemAgent.endRequest (request, response, 400, "Bad request");
			return;
		}
		if (streamid.search (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/) != 0) {
			App.systemAgent.endRequest (request, response, 400, "Bad request");
			return;
		}
		if ((! ri.match (/^[0-9]+$/)) || (! si.match (/^[0-9]+$/))) {
			App.systemAgent.endRequest (request, response, 400, "Bad request");
			return;
		}

		item = this.streamMap[streamid];
		if (item == null) {
			App.systemAgent.endRequest (request, response, 404, "Not found");
			return;
		}
		if (si == "0") {
			filename = `init-stream${ri}.m4s`;
		}
		else {
			filename = `chunk-stream${ri}-${si}.m4s`;
		}

		path = Path.join (this.configureMap.dataPath, item.params.id, App.STREAM_DASH_PATH, filename);
		App.systemAgent.writeFileResponse (request, response, path, "video/mp4");
	}

	// Handle a request with a GetHlsManifest command
	handleGetHlsManifestRequest (cmdInv, request, response) {
		let indexdata, item, i, segmenturl, segmentcmd, firstsegment, pct, delta;

		item = this.streamMap[cmdInv.params.streamId];
		if (item == null) {
			App.systemAgent.endRequest (request, response, 404, "Not found");
			return;
		}

		segmenturl = HLS_SEGMENT_PATH;
		indexdata = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ALLOW-CACHE:NO\n";
		if (item.params.hlsTargetDuration > 0) {
			indexdata += "#EXT-X-TARGETDURATION:" + item.params.hlsTargetDuration + "\n";
		}
		else {
			indexdata += "#EXT-X-TARGETDURATION:5\n";
		}

		firstsegment = 0;
		for (i = 0; i < item.params.segmentCount; ++i) {
			if (item.params.segmentPositions[i] >= cmdInv.params.startPosition) {
				firstsegment = i;
				break;
			}
		}

		if ((typeof cmdInv.params.minStartPositionDelta == "number") && (typeof cmdInv.params.maxStartPositionDelta == "number")) {
			if (((cmdInv.params.minStartPositionDelta > 0) || (cmdInv.params.maxStartPositionDelta > 0)) && (cmdInv.params.minStartPositionDelta <= cmdInv.params.maxStartPositionDelta)) {
				pct = App.systemAgent.getRandomInteger (cmdInv.params.minStartPositionDelta, cmdInv.params.maxStartPositionDelta);
				if (pct < 0) {
					pct = 0;
				}
				if (pct > 99) {
					pct = 99;
				}
				delta = Math.floor ((pct / 100) * (item.params.segmentCount - firstsegment + 1));
				firstsegment += delta;
				if (firstsegment >= (item.params.segmentCount - 2)) {
					firstsegment = item.params.segmentCount - 2;
				}
			}
		}

		for (i = firstsegment; i < item.params.segmentCount; ++i) {
			indexdata += "#EXTINF:" + item.params.segmentLengths[i] + ",\n";

			segmentcmd = this.createCommand ("GetHlsSegment", SystemInterface.Constant.Stream, {
				streamId: cmdInv.params.streamId,
				segmentIndex: i
			});
			if (segmentcmd == null) {
				continue;
			}
			indexdata += segmenturl + "?" + SystemInterface.Constant.UrlQueryParameter + "=" + encodeURIComponent (JSON.stringify (segmentcmd)) + "\n";
		}
		indexdata += "#EXT-X-ENDLIST\n";

		response.setHeader ("Content-Type", "application/x-mpegURL");
		App.systemAgent.endRequest (request, response, 200, indexdata);
	}

	// Handle a request with a GetHlsSegment command
	handleGetHlsSegmentRequest (cmdInv, request, response) {
		let path, item;

		item = this.streamMap[cmdInv.params.streamId];
		if (item == null) {
			App.systemAgent.endRequest (request, response, 404, "Not found");
			return;
		}

		if (cmdInv.params.segmentIndex >= item.params.segmentCount) {
			App.systemAgent.endRequest (request, response, 404, "Not found");
			return;
		}

		path = Path.join (this.configureMap.dataPath, cmdInv.params.streamId, App.STREAM_HLS_PATH, item.params.segmentFilenames[cmdInv.params.segmentIndex]);
		App.systemAgent.writeFileResponse (request, response, path, "video/MP2T");
	}

	// Handle a request with a GetThumbnailImage command
	getThumbnailImage (cmdInv, request, response) {
		let path, item;

		item = this.streamMap[cmdInv.params.id];
		if (item == null) {
			App.systemAgent.endRequest (request, response, 404, "Not found");
			return;
		}

		if (cmdInv.params.thumbnailIndex >= item.params.segmentCount) {
			App.systemAgent.endRequest (request, response, 404, "Not found");
			return;
		}

		path = Path.join (this.configureMap.dataPath, cmdInv.params.id, App.STREAM_THUMBNAIL_PATH, item.params.segmentFilenames[cmdInv.params.thumbnailIndex] + ".jpg");
		App.systemAgent.writeFileResponse (request, response, path, "image/jpeg");
	}
}
module.exports = StreamServer;
