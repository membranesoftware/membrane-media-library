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
const UuidV4 = require ("uuid/v4");
const Result = require (App.SOURCE_DIRECTORY + "/Result");
const Log = require (App.SOURCE_DIRECTORY + "/Log");
const FsUtil = require (App.SOURCE_DIRECTORY + "/FsUtil");
const SystemInterface = require (App.SOURCE_DIRECTORY + "/SystemInterface");
const RepeatTask = require (App.SOURCE_DIRECTORY + "/RepeatTask");
const Task = require (App.SOURCE_DIRECTORY + "/Task/Task");
const ServerBase = require (App.SOURCE_DIRECTORY + "/Server/ServerBase");

const HLS_STREAM_PATH = "/streamserver/hls/index.m3u8";
const HLS_SEGMENT_PATH = "/streamserver/hls/segment.ts";
const HLS_HTML5_PATH = "/streamserver/hls.html";
const THUMBNAIL_PATH = "/streamserver/thumbnail.png";
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
					case SystemInterface.CommandId.CreateMediaStream: {
						return (this.createMediaStream (cmdInv));
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

			App.systemAgent.addSecondaryRequestHandler (HLS_HTML5_PATH, (cmdInv, request, response) => {
				switch (cmdInv.command) {
					case SystemInterface.CommandId.GetHlsHtml5Interface: {
						this.handleGetHlsHtml5InterfaceRequest (cmdInv, request, response);
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

			startCallback (null);
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
			hlsHtml5Path: HLS_HTML5_PATH,
			thumbnailPath: THUMBNAIL_PATH
		}));
	}

	// Execute operations to read records from the data store and replace the contents of streamMap
	readRecords () {
		App.systemAgent.openDataStore ().then ((ds) => {
			let crit;

			crit = {
				command: SystemInterface.CommandId.StreamItem
			};
			return (ds.findAllRecords (crit));
		}).then ((records) => {
			let recordmap;

			recordmap = { };
			for (let record of records) {
				recordmap[record.params.id] = record;
			}

			this.streamMap = recordmap;
			this.isReady = true;
			this.scanDataDirectory ();
		}).catch ((err) => {
			Log.err (`${this.toString ()} failed to read data store records; err=${err}`);
		});
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
			filenames.push (Path.join (datapath, App.STREAM_HLS_PATH, App.STREAM_INDEX_FILENAME));
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
				client.emit (SystemInterface.Constant.WebSocketEvent, record);
			}
		};
	}

	// Execute a CreateMediaStream command and return a command invocation result
	createMediaStream (cmdInv) {
		let mediapath, mediaserver, mediaitem, streamid, task;

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

		streamid = App.systemAgent.getUuid (SystemInterface.CommandId.StreamItem);
		task = Task.createTask ("CreateMediaStream", {
			streamId: streamid,
			streamName: cmdInv.params.name,
			mediaId: cmdInv.params.mediaId,
			mediaPath: mediapath,
			dataPath: this.configureMap.dataPath
		});
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

	// Handle a request with a GetHlsHtml5Interface command
	handleGetHlsHtml5InterfaceRequest (cmdInv, request, response) {
		let item, html, streamurl, streamcmd;

		item = this.streamMap[cmdInv.params.streamId];
		if (item == null) {
			App.systemAgent.endRequest (request, response, 404, "Not found");
			return;
		}

		streamurl = HLS_STREAM_PATH;
		streamcmd = this.createCommand ("GetHlsManifest", SystemInterface.Constant.Stream, {
			streamId: cmdInv.params.streamId,
			startPosition: 0
		});
		if (streamcmd == null) {
			App.systemAgent.endRequest (request, response, 500, "Internal server error");
			return;
		}
		streamurl += "?" + SystemInterface.Constant.UrlQueryParameter + "=" + encodeURIComponent (JSON.stringify (streamcmd));
		html = "<html><head><title>HLS - " + item.params.name + "</title></head>";
		html += "<body><h2>" + item.params.name + "</h2>";
		html += "<video src=\"" + streamurl + "\" autoplay=\"true\" autobuffer=\"true\" controls=\"true\"></video>";
		html += "</body></html>";
		response.setHeader ("Content-Type", "text/html");
		App.systemAgent.endRequest (request, response, 200, html);
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
			response.statusCode = 404;
			response.end ();
			return;
		}

		if (cmdInv.params.segmentIndex >= item.params.segmentCount) {
			response.statusCode = 404;
			response.end ();
			return;
		}

		path = Path.join (this.configureMap.dataPath, cmdInv.params.streamId, App.STREAM_HLS_PATH, item.params.segmentFilenames[cmdInv.params.segmentIndex]);
		Fs.stat (path, (err, stats) => {
			let stream, isopen;

			if (err != null) {
				Log.err (`${this.toString ()} failed to read HLS segment file; path=${path} err=${err}`);
				response.statusCode = 404;
				response.end ();
				return;
			}

			if (! stats.isFile ()) {
				Log.err (`${this.toString ()} failed to read HLS segment file; path=${path} err=Not a regular file`);
				response.statusCode = 404;
				response.end ();
				return;
			}

			isopen = false;
			stream = Fs.createReadStream (path, { });
			stream.on ("error", (err) => {
				Log.err (`${this.toString ()} failed to read HLS segment file; path=${path} err=${err}`);
				if (! isopen) {
					response.statusCode = 500;
					response.end ();
				}
			});

			stream.on ("open", () => {
				if (isopen) {
					return;
				}

				isopen = true;
				response.statusCode = 200;
				response.setHeader ("Content-Type", "video/MP2T");
				response.setHeader ("Content-Length", stats.size);
				stream.pipe (response);
				stream.on ("finish", () => {
					response.end ();
				});

				response.socket.setMaxListeners (0);
				response.socket.once ("error", (err) => {
					stream.close ();
				});
			});
		});
	}

	// Handle a request with a GetThumbnailImage command
	getThumbnailImage (cmdInv, request, response) {
		let path, item;

		item = this.streamMap[cmdInv.params.id];
		if (item == null) {
			response.statusCode = 404;
			response.end ();
			return;
		}

		if (cmdInv.params.thumbnailIndex >= item.params.segmentCount) {
			response.statusCode = 404;
			response.end ();
			return;
		}

		path = Path.join (this.configureMap.dataPath, cmdInv.params.id, App.STREAM_THUMBNAIL_PATH, item.params.segmentFilenames[cmdInv.params.thumbnailIndex] + ".jpg");
		Fs.stat (path, (err, stats) => {
			let stream, isopen;

			if (err != null) {
				Log.err (`${this.toString ()} error reading thumbnail file; path=${path} err=${err}`);
				response.statusCode = 404;
				response.end ();
				return;
			}

			if (! stats.isFile ()) {
				Log.err (`${this.toString ()} error reading thumbnail file; path=${path} err=Not a regular file`);
				response.statusCode = 404;
				response.end ();
				return;
			}

			isopen = false;
			stream = Fs.createReadStream (path, { });
			stream.on ("error", (err) => {
				Log.err (`${this.toString ()} error reading thumbnail file; path=${path} err=${err}`);
				if (! isopen) {
					response.statusCode = 500;
					response.end ();
				}
			});

			stream.on ("open", () => {
				if (isopen) {
					return;
				}

				isopen = true;
				response.statusCode = 200;
				response.setHeader ("Content-Type", "image/jpeg");
				response.setHeader ("Content-Length", stats.size);
				stream.pipe (response);
				stream.on ("finish", () => {
					response.end ();
				});

				response.socket.setMaxListeners (0);
				response.socket.once ("error", (err) => {
					stream.close ();
				});
			});
		});
	}
}
module.exports = StreamServer;
