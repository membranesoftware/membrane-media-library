/*
* Copyright 2018-2022 Membrane Software <author@membranesoftware.com> https://membranesoftware.com
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
const Fs = require ("fs");
const Path = require ("path");
const Log = require (Path.join (App.SOURCE_DIRECTORY, "Log"));
const FsUtil = require (Path.join (App.SOURCE_DIRECTORY, "FsUtil"));
const StringUtil = require (Path.join (App.SOURCE_DIRECTORY, "StringUtil"));
const SystemInterface = require (Path.join (App.SOURCE_DIRECTORY, "SystemInterface"));
const RepeatTask = require (Path.join (App.SOURCE_DIRECTORY, "RepeatTask"));
const GetDiskSpaceTask = require (Path.join (App.SOURCE_DIRECTORY, "Task", "GetDiskSpaceTask"));
const CreateMediaStreamTask = require (Path.join (App.SOURCE_DIRECTORY, "Task", "CreateMediaStreamTask"));
const ServerBase = require (Path.join (App.SOURCE_DIRECTORY, "Server", "ServerBase"));

const StreamWebrootPath = "/str";
const ThumbnailPath = "/str/a.png";
const HlsStreamPath = "/str/b.m3u8";
const HlsSegmentPath = "/str/c.ts";
const DashMpdPath = "/str/e.mpd";
const DashSegmentPath = "/str/f.m4s";
const CatalogWebrootPath = "/media";
const CatalogDataPath = "/media-data";
const PlayerWebrootPath = "/play";
const GetDiskSpacePeriod = 7 * 60 * 1000; // milliseconds

class StreamServer extends ServerBase {
	constructor () {
		super ();
		this.setName ("StreamServer");
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
		this.getDiskSpaceTask.setAsync ((err) => {
			Log.debug (`${this.name} failed to get free disk space; err=${err}`);
		});
		this.streamCount = 0;
	}

	// Execute subclass-specific start operations
	async doStart () {
		await FsUtil.createDirectory (this.configureMap.dataPath);
		await this.getDiskSpace ();

		this.addInvokeRequestHandler (SystemInterface.Constant.DefaultInvokePath, SystemInterface.CommandId.ConfigureMediaStream);
		this.addInvokeRequestHandler (SystemInterface.Constant.DefaultInvokePath, SystemInterface.CommandId.RemoveStream);
		this.addLinkCommandHandler (SystemInterface.CommandId.FindStreamItems);
		this.addLinkCommandHandler (SystemInterface.CommandId.FindMediaStreams);
		this.addSecondaryInvokeRequestHandler (ThumbnailPath, SystemInterface.CommandId.GetThumbnailImage);
		this.addSecondaryInvokeRequestHandler (HlsStreamPath, SystemInterface.CommandId.GetHlsManifest);
		this.addSecondaryInvokeRequestHandler (HlsSegmentPath, SystemInterface.CommandId.GetHlsSegment);
		this.addSecondaryInvokeRequestHandler (DashMpdPath, SystemInterface.CommandId.GetDashMpd);
		App.systemAgent.addSecondaryRequestHandler (DashSegmentPath, (request, response) => {
			this.getDashSegment (request, response).catch ((err) => {
				Log.err (`${this.name} GetDashSegment failed; err=${err}`);
				App.systemAgent.writeResponse (request, response, 500);
			});
		});

		App.systemAgent.addSecondaryWebroot (StreamWebrootPath, StreamWebrootPath);
		App.systemAgent.addSecondaryWebroot (PlayerWebrootPath, PlayerWebrootPath);
		App.systemAgent.addSecondaryWebroot (CatalogWebrootPath, CatalogWebrootPath);
		this.addSecondaryInvokeRequestHandler (CatalogDataPath, SystemInterface.CommandId.GetStreamItem);
		App.systemAgent.addSecondaryInvokeRequestHandler (CatalogDataPath, SystemInterface.CommandId.FindStreamItems, (cmdInv, request, response) => {
			this.handleFindStreamItemsRequest (cmdInv, request, response).catch ((err) => {
				Log.err (`${this.name} FindStreamItems command failed; err=${err}`);
				App.systemAgent.writeResponse (request, response, 500);
			});
		});
		App.systemAgent.addSecondaryInvokeRequestHandler (CatalogDataPath, SystemInterface.CommandId.GetStatus, (cmdInv, request, response) => {
			response.setHeader ("Content-Type", "application/json");
			App.systemAgent.writeResponse (request, response, 200, JSON.stringify (this.getStatus ()));
		});

		App.systemAgent.recordStore.onReady (() => {
			const init = async () => {
				await this.createIndexes ();
				await this.verifyStreamItems ();
				await this.readRecords ();
				this.isReady = true;
			};
			init ().catch ((err) => {
				Log.err (`Failed to read stored stream records; err=${err}`);
			});
		});

		this.getDiskSpaceTask.setRepeating (this.getDiskSpace.bind (this), GetDiskSpacePeriod);

		App.systemAgent.getApplicationNews ();
	}

	// Execute subclass-specific stop operations
	async doStop () {
		this.getDiskSpaceTask.stop ();
	}

	// Return a command invocation containing the server's status
	doGetStatus () {
		return (App.systemAgent.createCommand (SystemInterface.CommandId.StreamServerStatus, {
			isReady: this.isReady,
			streamCount: this.streamCount,
			freeStorage: this.freeStorage,
			totalStorage: this.totalStorage,
			hlsStreamPath: HlsStreamPath,
			thumbnailPath: ThumbnailPath,
			htmlPlayerPath: PlayerWebrootPath,
			htmlCatalogPath: CatalogWebrootPath
		}));
	}

	// Create RecordStore indexes for use in manipulating records
	async createIndexes () {
		const indexes = [
			{ command: 1 },
			{ "params.id": 1 },
			{ "params.name": 1 },
			{ "params.sourceId": 1 }
		];
		const obj = { };
		obj[`prefix.${SystemInterface.Constant.AgentIdPrefixField}`] = 1;
		indexes.push (obj);

		for (const index of indexes) {
			await App.systemAgent.recordStore.createIndex (index);
		}
	}

	// Update free disk space values
	async getDiskSpace () {
		const task = await App.systemAgent.runBackgroundTask (new GetDiskSpaceTask ({
			targetPath: this.configureMap.dataPath
		}));
		if (task.isSuccess) {
			this.totalStorage = task.resultObject.total;
			this.usedStorage = task.resultObject.used;
			this.freeStorage = task.resultObject.free;
		}
	}

	// Read records from the store and update status metadata
	async readRecords () {
		const count = await App.systemAgent.recordStore.countRecords ({
			command: SystemInterface.CommandId.StreamItem
		});
		this.streamCount = count;
	}

	// Verify the presence of files required for each stored stream item
	async verifyStreamItems () {
		await App.systemAgent.recordStore.findRecords ((record, callback) => {
			this.pruneStreamItem (record).catch ((err) => {
				Log.debug (`${this.name} failed to verify stream item; err=${err}`);
			}).then (() => {
				callback ();
			});
		}, {
			command: SystemInterface.CommandId.StreamItem
		});
	}

	async pruneStreamItem (streamItem) {
		let success;

		const datapath = Path.join (this.configureMap.dataPath, streamItem.params.id);
		const filenames = [ ];
		filenames.push (Path.join (datapath, App.StreamHlsPath, App.StreamHlsIndexFilename));
		for (let i = 0; i < streamItem.params.segmentFilenames.length; ++i) {
			filenames.push (Path.join (datapath, App.StreamHlsPath, streamItem.params.segmentFilenames[i]));
			filenames.push (Path.join (datapath, App.StreamThumbnailPath, `${streamItem.params.segmentFilenames[i]}.jpg`));
		}

		// TODO: Verify DASH files as well as HLS files

		success = true;
		try {
			await FsUtil.statFiles (filenames, (filename, stats) => {
				return (stats.isFile () && (stats.size > 0));
			});
		}
		catch (err) {
			success = false;
		}

		if (! success) {
			await this.removeStreamItem (streamItem);
		}
	}

	async removeStreamItem (streamItem) {
		await App.systemAgent.recordStore.removeCommandRecord (SystemInterface.CommandId.StreamItem, streamItem.params.id);
		await FsUtil.removeDirectory (Path.join (this.configureMap.dataPath, streamItem.params.id));
		await this.readRecords ();
	}

	// Change StreamItem params fields in record, as appropriate for items to be returned as find results
	transformStreamItemResult (record) {
		record.params.segmentFilenames = [ ];
		record.params.segmentLengths = [ ];
	}

	// Execute a FindStreamItems command and write result commands to the provided client
	async findStreamItems (cmdInv, client) {
		const crit = {
			command: SystemInterface.CommandId.StreamItem
		};
		this.addFindCrits (crit, cmdInv.params.searchKey);

		const sort = {
			"params.name": 1
		};
		const max = (cmdInv.params.maxResults > 0) ? cmdInv.params.maxResults : null;
		const skip = (cmdInv.params.resultOffset > 0) ? cmdInv.params.resultOffset : null;

		const findresult = {
			searchKey: cmdInv.params.searchKey,
			resultOffset: cmdInv.params.resultOffset
		};
		findresult.setSize = await App.systemAgent.recordStore.countRecords (crit);
		client.emit (SystemInterface.Constant.WebSocketEvent, App.systemAgent.createCommand (SystemInterface.CommandId.FindStreamItemsResult, findresult));
		if (findresult.setSize <= 0) {
			await App.systemAgent.recordStore.findRecords ((record, callback) => {
				SystemInterface.populateDefaultFields (record.params, SystemInterface.Type[record.commandName]);
				this.transformStreamItemResult (record);
				client.emit (SystemInterface.Constant.WebSocketEvent, record);
				process.nextTick (callback);
			}, crit, sort, max, skip);
		}
	}

	// Execute a FindMediaStreams command and write result commands to the provided client
	async findMediaStreams (cmdInv, client) {
		for (const id of cmdInv.params.sourceIds) {
			const streams = [ ];
			const crit = {
				command: SystemInterface.CommandId.StreamItem,
				"params.sourceId": id
			};
			const sort = {
				"params.id": 1
			};
			await App.systemAgent.recordStore.findRecords ((record, callback) => {
				SystemInterface.populateDefaultFields (record.params, SystemInterface.Type[record.commandName]);
				this.transformStreamItemResult (record);
				streams.push (record);
				process.nextTick (callback);
			}, crit, sort);
			client.emit (SystemInterface.Constant.WebSocketEvent, App.systemAgent.createCommand (SystemInterface.CommandId.FindMediaStreamsResult, {
				mediaId: id,
				streams: streams
			}));
		}
	}

	// Execute a ConfigureMediaStream command
	async configureMediaStream (cmdInv, request, response) {
		let mediapath, tags;

		if (await App.systemAgent.recordStore.recordExists ({
			command: SystemInterface.CommandId.StreamItem,
			"params.sourceId": cmdInv.params.mediaId,
			"params.profile": cmdInv.params.profile
		})) {
			App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.CommandResult, {
				success: true
			}));
			return;
		}

		mediapath = "";
		tags = [ ];
		if (cmdInv.params.mediaServerAgentId == App.systemAgent.agentId) {
			const mediaitem = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.MediaItem, cmdInv.params.mediaId);
			if (mediaitem != null) {
				mediapath = mediaitem.params.mediaPath;
				if (Array.isArray (mediaitem.params.tags)) {
					tags = mediaitem.params.tags;
				}
			}
		}
		if (mediapath == "") {
			mediapath = cmdInv.params.mediaUrl;
		}
		if (mediapath == "") {
			App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.CommandResult, {
				success: false,
				error: "Media item not found"
			}));
			return;
		}

		App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.CommandResult, {
			success: true
		}));
		const oldstreams = await App.systemAgent.recordStore.findAllRecords ({
			command: SystemInterface.CommandId.StreamItem,
			"params.sourceId": cmdInv.params.mediaId
		});
		for (const stream of oldstreams) {
			try {
				await this.removeStreamItem (stream);
			}
			catch (err) {
				Log.debug (`${this.name} failed to remove stream item; err=${err}`);
			}
		}

		try {
			await App.systemAgent.runTask (new CreateMediaStreamTask ({
				streamId: App.systemAgent.getUuid (SystemInterface.CommandId.StreamItem),
				streamName: cmdInv.params.streamName,
				mediaId: cmdInv.params.mediaId,
				mediaPath: mediapath,
				dataPath: this.configureMap.dataPath,
				mediaWidth: cmdInv.params.mediaWidth,
				mediaHeight: cmdInv.params.mediaHeight,
				profile: cmdInv.params.profile,
				tags: tags
			}));
			await this.readRecords ();
		}
		catch (err) {
			Log.err (`${this.name} failed to create media stream; err=${err}`);
		}
	}

	// Execute a RemoveStream command
	async removeStream (cmdInv, request, response) {
		App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.CommandResult, {
			success: true
		}));
		const item = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.StreamItem, cmdInv.params.id);
		if (item != null) {
			await this.removeStreamItem (item);
		}
	}

	// Handle a request with a FindStreamItems command
	async handleFindStreamItemsRequest (cmdInv, request, response) {
		const crit = {
			command: SystemInterface.CommandId.StreamItem
		};
		this.addFindCrits (crit, cmdInv.params.searchKey);

		const sort = {
			"params.name": 1
		};
		const max = (cmdInv.params.maxResults > 0) ? cmdInv.params.maxResults : null;
		const skip = (cmdInv.params.resultOffset > 0) ? cmdInv.params.resultOffset : null;
		const findresult = {
			searchKey: cmdInv.params.searchKey,
			resultOffset: cmdInv.params.resultOffset,
			streams: [ ]
		};
		findresult.setSize = await App.systemAgent.recordStore.countRecords (crit);
		if (findresult.setSize > 0) {
			await App.systemAgent.recordStore.findRecords ((record, callback) => {
				SystemInterface.populateDefaultFields (record.params, SystemInterface.Type[record.commandName]);
				const summary = { };
				for (const i of [ "id", "name", "duration", "width", "height", "size", "bitrate", "frameRate", "profile", "segmentCount" ]) {
					summary[i] = record.params[i];
				}
				findresult.streams.push (summary);
				process.nextTick (callback);
			}, crit, sort, max, skip);
		}
		App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.FindStreamItemsResult, findresult));
	}

	// Execute a GetStreamItem command
	async getStreamItem (cmdInv, request, response) {
		const item = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.StreamItem, cmdInv.params.streamId);
		if (item == null) {
			App.systemAgent.writeResponse (request, response, 404);
			return;
		}
		App.systemAgent.writeCommandResponse (request, response, item);
	}

	// Execute a GetDashMpd command
	async getDashMpd (cmdInv, request, response) {
		const item = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.StreamItem, cmdInv.params.streamId);
		if (item == null) {
			App.systemAgent.writeResponse (request, response, 404);
			return;
		}

		Fs.readFile (Path.join (this.configureMap.dataPath, item.params.id, App.StreamDashPath, App.StreamDashDescriptionFilename), (err, data) => {
			if (err != null) {
				App.systemAgent.writeResponse (request, response, 500);
				return;
			}
			data = data.toString ();
			data = data.replace (/init-stream\$RepresentationID\$.m4s/g, `${DashSegmentPath}?streamId=${cmdInv.params.streamId}&amp;representationIndex=$$RepresentationID$$&amp;segmentIndex=0`);
			data = data.replace (/chunk-stream\$RepresentationID\$-\$Number%05d\$.m4s/g, `${DashSegmentPath}?streamId=${cmdInv.params.streamId}&amp;representationIndex=$$RepresentationID$$&amp;segmentIndex=$$Number%05d$$`);

			response.setHeader ("Content-Type", "dash/xml");
			App.systemAgent.writeResponse (request, response, 200, data);
		});
	}

	// Handle a request for a DASH segment
	async getDashSegment (request, response) {
		let filename;

		const url = StringUtil.parseUrl (request.url);
		if (url == null) {
			App.systemAgent.writeResponse (request, response, 400);
			return;
		}
		const streamid = url.searchParams.get ("streamId");
		const ri = url.searchParams.get ("representationIndex");
		const si = url.searchParams.get ("segmentIndex");
		if ((streamid === null) || (ri === null) || (si === null)) {
			App.systemAgent.writeResponse (request, response, 400);
			return;
		}
		if (streamid.search (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/) != 0) {
			App.systemAgent.writeResponse (request, response, 400);
			return;
		}
		if ((! ri.match (/^[0-9]+$/)) || (! si.match (/^[0-9]+$/))) {
			App.systemAgent.writeResponse (request, response, 400);
			return;
		}

		const item = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.StreamItem, streamid);
		if (item == null) {
			App.systemAgent.writeResponse (request, response, 404);
			return;
		}
		if (si == "0") {
			filename = `init-stream${ri}.m4s`;
		}
		else {
			filename = `chunk-stream${ri}-${si}.m4s`;
		}

		const path = Path.join (this.configureMap.dataPath, item.params.id, App.StreamDashPath, filename);
		App.systemAgent.writeFileResponse (request, response, path, "video/mp4");
	}

	// Execute a GetHlsManifest command
	async getHlsManifest (cmdInv, request, response) {
		let indexdata, segmentcmd, firstsegment, pct, delta;

		const item = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.StreamItem, cmdInv.params.streamId);
		if (item == null) {
			App.systemAgent.writeResponse (request, response, 404);
			return;
		}
		indexdata = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ALLOW-CACHE:NO\n";
		if (item.params.hlsTargetDuration > 0) {
			indexdata += `#EXT-X-TARGETDURATION:${item.params.hlsTargetDuration}\n`;
		}
		else {
			indexdata += "#EXT-X-TARGETDURATION:5\n";
		}

		firstsegment = 0;
		for (let i = 0; i < item.params.segmentCount; ++i) {
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

		for (let i = firstsegment; i < item.params.segmentCount; ++i) {
			indexdata += `#EXTINF:${item.params.segmentLengths[i]},\n`;
			segmentcmd = App.systemAgent.createCommand (SystemInterface.CommandId.GetHlsSegment, {
				streamId: cmdInv.params.streamId,
				segmentIndex: i
			});
			if (segmentcmd == null) {
				continue;
			}
			indexdata += `${HlsSegmentPath}?${SystemInterface.Constant.UrlQueryParameter}=${encodeURIComponent (JSON.stringify (segmentcmd))}\n`;
		}
		indexdata += "#EXT-X-ENDLIST\n";

		response.setHeader ("Content-Type", "application/x-mpegURL");
		App.systemAgent.writeResponse (request, response, 200, indexdata);
	}

	// Execute a GetHlsSegment command
	async getHlsSegment (cmdInv, request, response) {
		const item = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.StreamItem, cmdInv.params.streamId);
		if (item == null) {
			App.systemAgent.writeResponse (request, response, 404);
			return;
		}
		if (cmdInv.params.segmentIndex >= item.params.segmentCount) {
			App.systemAgent.writeResponse (request, response, 404);
			return;
		}
		const path = Path.join (this.configureMap.dataPath, cmdInv.params.streamId, App.StreamHlsPath, item.params.segmentFilenames[cmdInv.params.segmentIndex]);
		App.systemAgent.writeFileResponse (request, response, path, "video/MP2T");
	}

	// Execute a GetThumbnailImage command
	async getThumbnailImage (cmdInv, request, response) {
		const item = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.StreamItem, cmdInv.params.id);
		if (item == null) {
			App.systemAgent.writeResponse (request, response, 404);
			return;
		}
		if (cmdInv.params.thumbnailIndex >= item.params.segmentCount) {
			App.systemAgent.writeResponse (request, response, 404);
			return;
		}
		const path = Path.join (this.configureMap.dataPath, cmdInv.params.id, App.StreamThumbnailPath, `${item.params.segmentFilenames[cmdInv.params.thumbnailIndex]}.jpg`);
		App.systemAgent.writeFileResponse (request, response, path, "image/jpeg");
	}
}
module.exports = StreamServer;
