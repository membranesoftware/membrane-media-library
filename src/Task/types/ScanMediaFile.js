/*
* Copyright 2018 Membrane Software <author@membranesoftware.com>
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

var App = global.App || { };
var Fs = require ("fs");
var Path = require ("path");
var Log = require (App.SOURCE_DIRECTORY + "/Log");
var FsUtil = require (App.SOURCE_DIRECTORY + "/FsUtil");
var SystemInterface = require (App.SOURCE_DIRECTORY + "/SystemInterface");
var TranscodeOutputParser = require (App.SOURCE_DIRECTORY + "/Common/TranscodeOutputParser");
var TaskBase = require (App.SOURCE_DIRECTORY + "/Task/TaskBase");

class ScanMediaFile extends TaskBase {
	constructor () {
		super ();
		this.name = "Scan media file";
		this.description = "Gather metadata from a media file and generate its thumbnail images. Return a result object containing a MediaItem command.";
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
	}

	// Subclass method. Implementations should execute actions appropriate when the task has been successfully configured
	doConfigure () {
		this.subtitle = Path.basename (this.configureMap.mediaPath);
		this.statusMap.mediaPath = this.configureMap.mediaPath;
		this.progressPercentDelta = 100 / (this.configureMap.mediaThumbnailCount + 2);
		if (this.progressPercentDelta < 1) {
			this.progressPercentDelta = 1;
		}
	}

	// Subclass method. Implementations should execute task actions and call end when complete.
	doRun () {
		let record, parser, proc, statComplete, processData, processEnded, createThumbnailsComplete;

		setTimeout (() => {
			Fs.stat (this.configureMap.mediaPath, statComplete);
		}, 0);

		statComplete = (err, stats) => {
			if (err != null) {
				Log.warn (`Failed to read media file; filename="${this.configureMap.mediaPath}" err=${err}`);
				this.end ();
				return;
			}

			record = {
				id: this.configureMap.mediaId,
				name: Path.basename (this.configureMap.mediaPath),
				mediaPath: this.configureMap.mediaPath,
				mtime: stats.mtime.getTime (),
				duration: 0,
				frameRate: 0,
				width: 0,
				height: 0,
				size: stats.size,
				bitrate: 0
			};

			parser = new TranscodeOutputParser (this.configureMap.mediaPath);
			proc = App.systemAgent.createFfmpegProcess ([ "-i", this.configureMap.mediaPath ], null, processData, processEnded);
		};

		processData = (lines, dataParseCallback) => {
			parser.parseLines (lines);
			process.nextTick (dataParseCallback);
		};
		processEnded = () => {
			let metadata;

			if (proc.hasError) {
				Log.warn (`Failed to scan media file; filename="${this.configureMap.mediaPath}" err="Scan process ended with error"`);
				this.end ();
				return;
			}

			metadata = parser.getMetadata ();
			Log.debug (`Media file scan complete; filename=${this.configureMap.mediaPath} metadata=${JSON.stringify (metadata)}`);
			if (! parser.hasMetadata ()) {
				Log.warn (`Failed to scan media file; filename="${this.configureMap.mediaPath}" err="Media metadata not found"`);
				this.end ();
				return;
			}

			record.duration = metadata.duration;
			record.frameRate = metadata.frameRate;
			record.width = metadata.width;
			record.height = metadata.height;
			record.bitrate = metadata.bitrate;
			this.addPercentComplete (this.progressPercentDelta);
			this.createThumbnails (record, createThumbnailsComplete);
		};

		createThumbnailsComplete = (err) => {
			if (err != null) {
				this.end ();
				return;
			}

			this.isSuccess = true;
			this.setPercentComplete (100);
			this.resultObject = record;
			this.end ();
		};
	}

	// Execute operations as needed to prepare thumbnail images for the provided MediaItem object, and invoke the provided callback when complete, with an "err" parameter (non-null if an error occurred)
	createThumbnails (mediaItem, endCallback) {
		let filename, datapath, imageindex, frametime, framedelta, proc, processEnded, createNextThumbnail;

		if ((this.configureMap.mediaThumbnailCount <= 0) || (mediaItem.duration <= 0)) {
			process.nextTick (endCallback);
			return;
		}

		datapath = Path.join (this.configureMap.dataPath, mediaItem.id);
		FsUtil.createDirectory (this.configureMap.dataPath).then (() => {
			return (FsUtil.createDirectory (datapath));
		}).then (() => {
			datapath = Path.join (datapath, "thumbnail");
			return (FsUtil.createDirectory (datapath));
		}).then (() => {
			imageindex = -1;
			framedelta = (mediaItem.duration / (this.configureMap.mediaThumbnailCount + 1));
			frametime = -(framedelta);
			createNextThumbnail ();
		}).catch ((err) => {
			endCallback (err);
		});

		createNextThumbnail = () => {
			++imageindex;
			if (imageindex >= this.configureMap.mediaThumbnailCount) {
				endCallback ();
				return;
			}

			this.addPercentComplete (this.progressPercentDelta);
			frametime += framedelta;
			filename = Path.join (datapath, `${imageindex}.jpg`);
			proc = App.systemAgent.createFfmpegProcess ([
				"-i", mediaItem.mediaPath,
				"-vcodec", "mjpeg",
				"-vframes", "1",
				"-an",
				"-ss", Log.getDurationString (frametime),
				"-y",
				filename
			], datapath, null, processEnded);
		};

		processEnded = () => {
			if (proc.hasError) {
				endCallback ("thumbnail creation process ended with error");
				return;
			}

			createNextThumbnail ();
		};
	}
}
module.exports = ScanMediaFile;
