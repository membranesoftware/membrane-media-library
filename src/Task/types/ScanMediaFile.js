/*
* Copyright 2018-2021 Membrane Software <author@membranesoftware.com> https://membranesoftware.com
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
const FfmpegUtil = require (Path.join (App.SOURCE_DIRECTORY, "FfmpegUtil"));
const SystemInterface = require (Path.join (App.SOURCE_DIRECTORY, "SystemInterface"));
const RepeatTask = require (Path.join (App.SOURCE_DIRECTORY, "RepeatTask"));
const FfprobeJsonParser = require (Path.join (App.SOURCE_DIRECTORY, "FfprobeJsonParser"));
const TaskBase = require (Path.join (App.SOURCE_DIRECTORY, "Task", "TaskBase"));

const CountThumbnailFilesPeriod = 3000; // ms

class ScanMediaFile extends TaskBase {
	constructor () {
		super ();
		this.name = App.uiText.getText ("ScanMediaFileTaskName");
		this.resultObjectType = "MediaItem";

		this.configureParams = [
			{
				name: "mediaId",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty | SystemInterface.ParamFlag.Uuid,
				description: "The ID to use for the created MediaItem record"
			},
			{
				name: "mediaPath",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty,
				description: "The path to the target media file for the operation"
			},
			{
				name: "dataPath",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty,
				description: "The directory path in which the task should generate data files"
			},
			{
				name: "mediaThumbnailCount",
				type: "number",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.ZeroOrGreater,
				description: "The maximum number of thumbnail images that should be stored for the media item",
				defaultValue: 8
			}
		];

		this.progressPercentDelta = 1;
		this.sourceParser = { };
		this.progressTask = new RepeatTask ();
		this.thumbnailPath = "";
		this.thumbnailCount = 0;
	}

	// Subclass method. Implementations should execute actions appropriate when the task has been successfully configured.
	doConfigure () {
		this.subtitle = Path.basename (this.configureMap.mediaPath);
		this.statusMap.mediaPath = this.configureMap.mediaPath;
		this.progressPercentDelta = 100 / (this.configureMap.mediaThumbnailCount + 2);
		if (this.progressPercentDelta < 1) {
			this.progressPercentDelta = 1;
		}
	}

	// Subclass method. Implementations should execute actions appropriate when the task has ended.
	doEnd () {
		this.progressTask.stop ();
	}

	// Subclass method. Implementations should execute task actions and call end when complete.
	doRun () {
		this.processFile ().catch ((err) => {
			Log.err (`Failed to scan media file; filename="${this.configureMap.mediaPath}" err=${err}`);
		}).then (() => {
			this.end ();
		});
	}

	async processFile () {
		const stats = await FsUtil.statFile (this.configureMap.mediaPath);
		const record = {
			id: this.configureMap.mediaId,
			name: Path.basename (this.configureMap.mediaPath),
			mediaPath: this.configureMap.mediaPath,
			mtime: stats.mtime.getTime (),
			duration: 0,
			frameRate: 0,
			width: 0,
			height: 0,
			size: stats.size,
			bitrate: 0,
			isCreateStreamAvailable: true
		};
		const parser = new FfprobeJsonParser (this.configureMap.mediaPath);
		const processData = (lines, dataParseCallback) => {
			parser.parseLines (lines);
			process.nextTick (dataParseCallback);
		};

		await FfmpegUtil.runFfprobe ([
			"-hide_banner",
			"-loglevel", "quiet",
			"-i", this.configureMap.mediaPath,
			"-print_format", "json",
			"-show_format",
			"-show_streams"
		], null, processData);

		parser.close ();
		if (! parser.isParseSuccess) {
			throw Error ("Media metadata not found");
		}

		record.duration = parser.duration;
		record.frameRate = parser.frameRate;
		record.width = parser.width;
		record.height = parser.height;
		record.bitrate = parser.bitrate;
		this.sourceParser = parser;
		this.addPercentComplete (this.progressPercentDelta);

		const cmd = App.systemAgent.createCommand ("MediaItem", record);
		if (cmd == null) {
			throw Error ("Failed to create MediaItem record");
		}
		await this.createThumbnails (record);
		await App.systemAgent.recordStore.upsertRecord ({
			command: SystemInterface.CommandId.MediaItem,
			"params.mediaPath": this.configureMap.mediaPath
		}, cmd);
		this.isSuccess = true;
		this.setPercentComplete (100);
		this.resultObject = record;
	}

	// Prepare thumbnail images for the provided MediaItem object
	async createThumbnails (mediaItem) {
		let fps;

		if ((this.configureMap.mediaThumbnailCount <= 0) || (mediaItem.duration <= 0)) {
			return;
		}
		const datapath = Path.join (this.configureMap.dataPath, mediaItem.id);
		await FsUtil.createDirectory (this.configureMap.dataPath);
		await FsUtil.createDirectory (datapath);
		this.thumbnailPath = Path.join (datapath, App.StreamThumbnailPath);
		await FsUtil.createDirectory (this.thumbnailPath);

		this.thumbnailCount = 0;
		this.progressTask.setRepeating ((callback) => {
			this.countThumbnailFiles (callback);
		}, CountThumbnailFilesPeriod);

		fps = this.sourceParser.duration / 1000;
		fps /= this.configureMap.mediaThumbnailCount;
		fps = 1 / fps;
		await FfmpegUtil.runFfmpeg ([
			"-hide_banner",
			"-i", mediaItem.mediaPath,
			"-vcodec", "mjpeg",
			"-vf", `fps=${fps}`,
			"-vframes", this.configureMap.mediaThumbnailCount,
			"-an",
			"-y",
			"-start_number", "0",
			Path.join (this.thumbnailPath, "%d.jpg")
		], this.thumbnailPath);
	}

	// Find thumbnail files created by the scan process and update task progress
	countThumbnailFiles (endCallback) {
		const filepath = Path.join (this.thumbnailPath, `${this.thumbnailCount}.jpg`);
		FsUtil.fileExists (filepath, (err, exists) => {
			if (err != null) {
				this.progressTask.stop ();
			}
			else {
				if (exists) {
					++(this.thumbnailCount);
					this.addPercentComplete (this.progressPercentDelta);
					if (this.thumbnailCount >= this.configureMap.mediaThumbnailCount) {
						this.progressTask.stop ();
					}
					else {
						this.progressTask.setNextRepeat (1);
					}
				}
			}
			endCallback ();
		});
	}
}
module.exports = ScanMediaFile;
