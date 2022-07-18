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
const Path = require ("path");
const Log = require (Path.join (App.SOURCE_DIRECTORY, "Log"));
const FsUtil = require (Path.join (App.SOURCE_DIRECTORY, "FsUtil"));
const StringUtil = require (Path.join (App.SOURCE_DIRECTORY, "StringUtil"));
const SystemInterface = require (Path.join (App.SOURCE_DIRECTORY, "SystemInterface"));
const RepeatTask = require (Path.join (App.SOURCE_DIRECTORY, "RepeatTask"));
const ScanMediaFileTask = require (Path.join (App.SOURCE_DIRECTORY, "Task", "ScanMediaFileTask"));
const ServerBase = require (Path.join (App.SOURCE_DIRECTORY, "Server", "ServerBase"));

const MediaPath = "/med/a";
const ThumbnailPath = "/med/b.jpg";
const MediaFileExtensions = [
	".avi",
	".mp4",
	".wmv",
	".mkv",
	".vob",
	".mpeg4",
	".mov",
	".flv",
	".ogg",
	".webm",
	".divx"
];
const ScanMediaIdleTimeThreshold = 30000; // ms

class MediaServer extends ServerBase {
	constructor () {
		super ();
		this.setName ("MediaServer");
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
				defaultValue: 0
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
		this.mediaCount = 0;
		this.scanTask = new RepeatTask ();
		this.scanTask.setAsync ((err) => {
			Log.err (`Failed to scan media directory; err=${err}`);
		});
	}

	// Execute subclass-specific start operations
	async doStart () {
		await FsUtil.createDirectory (this.configureMap.dataPath);

		for (const cmdid of [
			SystemInterface.CommandId.ScanMediaItems,
			SystemInterface.CommandId.RemoveMedia,
			SystemInterface.CommandId.AddMediaTag,
			SystemInterface.CommandId.RemoveMediaTag
		]) {
			this.addInvokeRequestHandler (SystemInterface.Constant.DefaultInvokePath, cmdid);
		}

		this.addLinkCommandHandler (SystemInterface.CommandId.FindMediaItems);
		this.addSecondaryInvokeRequestHandler (ThumbnailPath, SystemInterface.CommandId.GetThumbnailImage);
		this.addSecondaryInvokeRequestHandler (MediaPath, SystemInterface.CommandId.GetMedia);

		App.systemAgent.recordStore.onReady (() => {
			const init = async () => {
				await this.createIndexes ();
				await this.addSortKeys ();
				await this.readRecords ();
				if (this.configureMap.scanPeriod > 0) {
					this.scanTask.setRepeating (this.scan.bind (this, ScanMediaIdleTimeThreshold), this.configureMap.scanPeriod * 1000);
				}
				this.isReady = true;
			};
			init ().catch ((err) => {
				Log.err (`Failed to read stored media records; err=${err}`);
			});
		});
	}

	// Execute subclass-specific stop operations
	async doStop () {
		this.scanTask.stop ();
	}

	// Execute actions appropriate when the server has been successfully configured
	doConfigure () {
		if (this.isRunning) {
			if (this.configureMap.scanPeriod > 0) {
				this.scanTask.setRepeating (this.scan.bind (this, ScanMediaIdleTimeThreshold), this.configureMap.scanPeriod * 1000);
			}
			else {
				this.scanTask.stop ();
			}
		}
	}

	// Add subclass-specific fields to the provided server configuration object, covering default values not present in the delta configuration
	doGetConfiguration (fields) {
		if (typeof fields.scanPeriod != "number") {
			fields.scanPeriod = 0;
		}
	}

	// Return a command invocation containing the server's status
	doGetStatus () {
		return (App.systemAgent.createCommand (SystemInterface.CommandId.MediaServerStatus, {
			isReady: this.isReady,
			mediaCount: this.mediaCount,
			mediaPath: MediaPath,
			thumbnailPath: (this.configureMap.mediaThumbnailCount > 0) ? ThumbnailPath : "",
			thumbnailCount: this.configureMap.mediaThumbnailCount
		}));
	}

	// Create RecordStore indexes
	async createIndexes () {
		const indexes = [
			{ command: 1 },
			{ "params.id": 1 },
			{ "params.name": 1 },
			{ "params.mtime": 1 },
			{ "params.mediaPath": 1 },
			{ "params.tags": 1 },
			{ "params.sortKey": 1 }
		];
		const obj = { };
		obj[`prefix.${SystemInterface.Constant.AgentIdPrefixField}`] = 1;
		indexes.push (obj);

		for (const index of indexes) {
			await App.systemAgent.recordStore.createIndex (index);
		}
	}

	// Add the sortKey field to MediaItem records that don't have one
	async addSortKeys () {
		// TODO: Remove this method (when updates to legacy MediaItem records are no longer required)
		try {
			const crit = {
				command: SystemInterface.CommandId.MediaItem,
				"params.sortKey": {
					"$exists": false
				}
			};
			const count = await App.systemAgent.recordStore.countRecords (crit);
			if (count <= 0) {
				return;
			}

			const keymap = { };
			await App.systemAgent.recordStore.findRecords ((record, callback) => {
				keymap[record.params.id] = StringUtil.getMediaItemSortKey (record.params.name);
				process.nextTick (callback);
			}, crit);
			for (const id in keymap) {
				await App.systemAgent.recordStore.updateRecords ({
					"params.id": id
				}, {
					"$set": {
						"params.sortKey": keymap[id]
					}
				});
			}
		}
		catch (err) {
			Log.err (`Failed to update media sort keys; err=${err}`);
		}
	}

	// Read records from the store and update status metadata
	async readRecords () {
		const count = await App.systemAgent.recordStore.countRecords ({
			command: SystemInterface.CommandId.MediaItem,
			"params.isCreateStreamAvailable": true
		});
		this.mediaCount = count;
	}

	// Execute a FindMediaItems command and write result commands to the provided client
	async findMediaItems (cmdInv, client) {
		const crit = {
			command: SystemInterface.CommandId.MediaItem
		};
		this.addFindCrits (crit, cmdInv.params.searchKey);

		const sort = { };
		switch (cmdInv.params.sortOrder) {
			case SystemInterface.Constant.NewestSort: {
				sort["params.mtime"] = -1;
				break;
			}
			default: {
				sort["params.sortKey"] = 1;
				break;
			}
		}
		const max = (cmdInv.params.maxResults > 0) ? cmdInv.params.maxResults : null;
		const skip = (cmdInv.params.resultOffset > 0) ? cmdInv.params.resultOffset : null;

		const findresult = {
			searchKey: cmdInv.params.searchKey,
			resultOffset: cmdInv.params.resultOffset
		};
		findresult.setSize = await App.systemAgent.recordStore.countRecords (crit);
		client.emit (SystemInterface.Constant.WebSocketEvent, App.systemAgent.createCommand (SystemInterface.CommandId.FindMediaItemsResult, findresult));
		if (findresult.setSize > 0) {
			await App.systemAgent.recordStore.findRecords ((record, callback) => {
				SystemInterface.populateDefaultFields (record.params, SystemInterface.Type[record.commandName]);
				client.emit (SystemInterface.Constant.WebSocketEvent, record);
				process.nextTick (callback);
			}, crit, sort, max, skip);
		}
	}

	// Execute a ScanMediaItems command
	async scanMediaItems (cmdInv, request, response) {
		App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.CommandResult, {
			success: true
		}));

		this.scanTask.stop ();
		this.scan ().catch ((err) => {
			Log.err (`${this.name} scanMediaItems command failed; err=${err}`);
		}).then (() => {
			if (this.configureMap.scanPeriod > 0) {
				this.scanTask.setRepeating (this.scan.bind (this, ScanMediaIdleTimeThreshold), this.configureMap.scanPeriod * 1000);
				this.scanTask.setNextRepeat (this.configureMap.scanPeriod * 1000);
			}
		});
	}

	// Scan the server's media path to find new media files and execute tasks as needed to gather metadata. If mtimeIdleThreshold is provided, skip files with mtime values that are recent by that many milliseconds.
	async scan (mtimeIdleThreshold) {
		await App.systemAgent.recordStore.findRecords ((record, callback) => {
			this.pruneMediaItem (record).catch ((err) => {
				Log.debug (`${this.name} failed to verify media item; err=${err}`);
			}).then (() => {
				callback ();
			});
		}, {
			command: SystemInterface.CommandId.MediaItem
		});

		const scanfiles = (await FsUtil.findAllFiles (this.configureMap.mediaPath)).filter ((item) => {
			return (MediaFileExtensions.includes (Path.extname (item).toLowerCase ()));
		});
		const taskconfigs = [ ];
		for (const file of scanfiles) {
			try {
				const stats = await FsUtil.statFile (file);
				if ((typeof mtimeIdleThreshold == "number") && ((stats.mtime.getTime () + mtimeIdleThreshold) > Date.now ())) {
					continue;
				}

				const record = await App.systemAgent.recordStore.findRecord ({
					command: SystemInterface.CommandId.MediaItem,
					"params.mediaPath": file,
					"params.mtime": stats.mtime.getTime (),
					"params.size": stats.size
				});
				if (record == null) {
					taskconfigs.push ({
						mediaId: App.systemAgent.getUuid (SystemInterface.CommandId.MediaItem),
						mediaPath: file,
						dataPath: this.configureMap.dataPath,
						mediaThumbnailCount: this.configureMap.mediaThumbnailCount
					});
				}
			}
			catch (err) {
				Log.debug (`${this.name} failed to scan media file; file=${file} err=${err}`);
			}
		}
		if (taskconfigs.length > 0) {
			const promises = [ ];
			for (const config of taskconfigs) {
				promises.push (App.systemAgent.runTask (new ScanMediaFileTask (config)));
			}
			await Promise.all (promises);
		}
		await this.readRecords ();
	}

	// Check if a MediaItem record's stored files and metadata are valid and change or remove the record as needed
	async pruneMediaItem (mediaItem) {
		let stats;

		if (! await this.verifyMediaThumbnailFiles (mediaItem)) {
			await this.removeMediaItem (mediaItem);
			return;
		}

		try {
			stats = await FsUtil.statFile (mediaItem.params.mediaPath);
		}
		catch (err) {
			stats = null;
		}
		if (stats == null) {
			if (mediaItem.params.isCreateStreamAvailable) {
				await App.systemAgent.recordStore.updateRecords ({
					"params.id": mediaItem.params.id
				}, {
					"$set": {
						"params.isCreateStreamAvailable": false
					}
				});
				App.systemAgent.recordStore.expireCacheRecord (mediaItem.params.id);
			}
			return;
		}
		if (! mediaItem.params.isCreateStreamAvailable) {
			await this.removeMediaItem (mediaItem);
			return;
		}
		if ((stats.mtime.getTime () != mediaItem.params.mtime) || (stats.size != mediaItem.params.size)) {
			await this.removeMediaItem (mediaItem);
		}
	}

	// Return a boolean value indicating whether a MediaItem record's media thumbnail files are present
	async verifyMediaThumbnailFiles (mediaItem) {
		if (mediaItem == null) {
			return (false);
		}
		if (this.configureMap.mediaThumbnailCount <= 0) {
			return (true);
		}
		for (let i = 0; i < this.configureMap.mediaThumbnailCount; ++i) {
			const path = Path.join (this.configureMap.dataPath, mediaItem.params.id, App.StreamThumbnailPath, `${i}.jpg`);
			if (! await FsUtil.fileExists (path)) {
				return (false);
			}
		}
		return (true);
	}

	// Delete a MediaItem record and all associated data files
	async removeMediaItem (mediaItem) {
		await App.systemAgent.recordStore.removeCommandRecord (SystemInterface.CommandId.MediaItem, mediaItem.params.id);
		await FsUtil.removeDirectory (Path.join (this.configureMap.dataPath, mediaItem.params.id));
		await this.readRecords ();
	}

	// Execute a RemoveMedia command
	async removeMedia (cmdInv, request, response) {
		App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.CommandResult, {
			success: true
		}));
		const item = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.MediaItem, cmdInv.params.id);
		if (item == null) {
			return;
		}
		try {
			await this.removeMediaItem (item);
		}
		catch (err) {
			Log.debug (`${this.name} failed to remove MediaItem record; err=${err}`);
		}
	}

	// Execute a GetThumbnailImage command
	async getThumbnailImage (cmdInv, request, response) {
		const item = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.MediaItem, cmdInv.params.id);
		if (item == null) {
			App.systemAgent.writeResponse (request, response, 404);
			return;
		}
		const filepath = Path.join (this.configureMap.dataPath, item.params.id, App.StreamThumbnailPath, `${Math.floor (cmdInv.params.thumbnailIndex)}.jpg`);
		App.systemAgent.writeFileResponse (request, response, filepath, "image/jpeg");
	}

	// Execute a GetMedia command
	async getMedia (cmdInv, request, response) {
		const item = await App.systemAgent.recordStore.findCommandRecord (SystemInterface.CommandId.MediaItem, cmdInv.params.id);
		if (item == null) {
			App.systemAgent.writeResponse (request, response, 404);
			return;
		}
		const filepath = Path.join (this.configureMap.mediaPath, item.params.name);
		App.systemAgent.writeFileResponse (request, response, filepath);
	}

	// Execute an AddMediaTag command
	async addMediaTag (cmdInv, request, response) {
		await App.systemAgent.recordStore.updateRecords ({
			"params.id": cmdInv.params.mediaId
		}, {
			"$addToSet": {
				"params.tags": cmdInv.params.tag
			}
		});
		App.systemAgent.recordStore.expireCacheRecord (cmdInv.params.mediaId);
		const record = await App.systemAgent.recordStore.findRecord ({
			command: SystemInterface.CommandId.MediaItem,
			"params.id": cmdInv.params.mediaId
		});
		if (record == null) {
			App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.CommandResult, {
				success: false,
				error: "Media record not found"
			}));
			return;
		}
		if (Array.isArray (record.params.tags)) {
			await App.systemAgent.recordStore.updateRecords ({
				command: SystemInterface.CommandId.StreamItem,
				"params.sourceId": cmdInv.params.mediaId
			}, {
				"$set": {
					"params.tags": record.params.tags
				}
			});
		}
		App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.CommandResult, {
			success: true,
			item: record
		}));
	}

	// Execute a RemoveMediaTag command
	async removeMediaTag (cmdInv, request, response) {
		const record = await App.systemAgent.recordStore.findRecord ({
			command: SystemInterface.CommandId.MediaItem,
			"params.id": cmdInv.params.mediaId
		});
		if (record == null) {
			App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.CommandResult, {
				success: false,
				error: "Media record not found"
			}));
			return;
		}
		if (Array.isArray (record.params.tags)) {
			const key = cmdInv.params.tag.toLowerCase ();
			const tags = record.params.tags.filter ((item) => {
				return (item.toLowerCase () != key);
			});
			if (tags.length != record.params.tags.length) {
				await App.systemAgent.recordStore.updateRecords ({
					"params.id": cmdInv.params.mediaId
				}, {
					"$set": {
						"params.tags": tags
					}
				});
				record.params.tags = tags;
				App.systemAgent.recordStore.expireCacheRecord (cmdInv.params.mediaId);

				await App.systemAgent.recordStore.updateRecords ({
					command: SystemInterface.CommandId.StreamItem,
					"params.sourceId": cmdInv.params.mediaId
				}, {
					"$set": {
						"params.tags": record.params.tags
					}
				});
			}
		}
		App.systemAgent.writeCommandResponse (request, response, App.systemAgent.createCommand (SystemInterface.CommandId.CommandResult, {
			success: true,
			item: record
		}));
	}
}
module.exports = MediaServer;
