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
var SystemInterface = require (App.SOURCE_DIRECTORY + "/SystemInterface");
var FsUtil = require (App.SOURCE_DIRECTORY + "/FsUtil");
var TranscodeOutputParser = require (App.SOURCE_DIRECTORY + "/Common/TranscodeOutputParser");
var HlsIndexParser = require (App.SOURCE_DIRECTORY + "/Common/HlsIndexParser");
var TaskBase = require (App.SOURCE_DIRECTORY + "/Task/TaskBase");

class CreateMediaStream extends TaskBase {
	constructor () {
		super ();
		this.name = "Create stream";
		this.description = "Generate data required to prepare a media file for streaming playback";
		this.resultObjectType = "StreamItem";
		this.recordCommandType = SystemInterface.Constant.Stream;

		this.configureParams = [
			{
				name: "streamId",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty | SystemInterface.ParamFlag.Uuid,
				description: "The ID to use for the created stream"
			},
			{
				name: "streamName",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty,
				description: "The name to use for the created stream"
			},
			{
				name: "mediaId",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty | SystemInterface.ParamFlag.Uuid,
				description: "The ID of the source media"
			},
			{
				name: "mediaPath",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty,
				description: "The path to the source media file, provided as a filesystem path or a URL that should be fetched"
			},
			{
				name: "dataPath",
				type: "string",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.NotEmpty,
				description: "The path to use for storage of media data"
			},
			{
				name: "audioCodec",
				type: "string",
				flags: SystemInterface.ParamFlag.Required,
				description: "The audio codec to use for the transcode operation, or an empty value to choose a default codec",
				defaultValue: ""
			},
			{
				name: "videoCodec",
				type: "string",
				flags: SystemInterface.ParamFlag.Required,
				description: "The video codec to use for the transcode operation, or an empty value to choose a default codec",
				defaultValue: ""
			}
		];

		this.streamDataPath = "";
		this.sourcePath = "";
		this.sourceMetadata = { };
		this.destMetadata = { };
		this.hlsMetadata = { };
	}

	// Subclass method. Implementations should execute actions appropriate when the task has been successfully configured
	doConfigure () {
		this.subtitle = this.configureMap.streamName;
		this.statusMap.streamName = this.configureMap.streamName;
		this.streamDataPath = Path.join (this.configureMap.dataPath, this.configureMap.streamId);
	}

	// Subclass method. Implementations should execute task actions and call end when complete.
	doRun () {
		// TODO: Fetch media data from a remote host if mediaPath holds a URL value
		this.sourcePath = this.configureMap.mediaPath;

		// TODO: Check isCancelled at each step
		// TODO: Increment percentComplete as the task runs

		FsUtil.fileExists (this.sourcePath).then ((exists) => {
			if (! exists) {
				return (Promise.reject (Error ("Source media file not found")));
			}

			return (FsUtil.createDirectory (this.streamDataPath));
		}).then (() => {
			return (FsUtil.createDirectory (Path.join (this.streamDataPath, "hls")));
		}).then (() => {
			return (this.readSourceMetadata ());
		}).then (() => {
			this.addPercentComplete (1);
			return (this.transcodeMedia ());
		}).then (() => {
			return (this.createThumbnails ());
		}).then (() => {
			return (this.readHlsMetadata ());
		}).then (() => {
			let params, streamitem;

			params = {
				id: this.configureMap.streamId,
				name: this.configureMap.streamName,
				sourceId: this.configureMap.mediaId,
				duration: this.destMetadata.duration,
				width: this.destMetadata.width,
				height: this.destMetadata.height,
				bitrate: this.destMetadata.bitrate,
				frameRate: this.destMetadata.frameRate,
				hlsTargetDuration: this.hlsMetadata.hlsTargetDuration,
				segmentCount: this.hlsMetadata.segmentCount,
				segmentFilenames: this.hlsMetadata.segmentFilenames,
				segmentLengths: this.hlsMetadata.segmentLengths,
				segmentPositions: this.hlsMetadata.segmentPositions
			};
			streamitem = SystemInterface.parseTypeObject ("StreamItem", params);
			if (SystemInterface.isError (streamitem)) {
				return (Promise.reject (Error ("Failed to store stream metadata, " + streamitem)));
			}
			this.setPercentComplete (100);
			this.resultObject = streamitem;
			this.isSuccess = true;
		}).catch ((err) => {
			Log.debug (`${this.toString ()} failed; err=${err}`);
		}).then (() => {
			this.end ();
		});
	}

	// Return a promise that reads metadata from the source media file and stores the resulting object in this.sourceMetadata
	readSourceMetadata () {
		return (new Promise ((resolve, reject) => {
			let parser, proc, processData, processEnded;

			setTimeout (() => {
				parser = new TranscodeOutputParser (this.sourcePath);
				proc = App.systemAgent.createFfmpegProcess ([ "-i", this.sourcePath ], this.streamDataPath, processData, processEnded);
			}, 0);

			processData = (lines, dataParseCallback) => {
				parser.parseLines (lines);
				process.nextTick (dataParseCallback);
			};

			processEnded = () => {
				let metadata;

				if (proc.hasError) {
					reject (Error ("Metadata read process ended with error"));
					return;
				}

				metadata = parser.getMetadata ();
				if (metadata.audioStreamId == "") {
					reject (Error ("Media parse failed, audio stream ID not found"));
					return;
				}

				if (metadata.videoStreamId == "") {
					reject (Error ("Media parse failed, video stream ID not found"));
					return;
				}

				if ((metadata.width <= 0) || (metadata.height <= 0) || (metadata.bitrate <= 0) || (metadata.frameRate <= 0)) {
					reject (Error ("Media parse failed, stream details not available"));
					return;
				}

				this.sourceMetadata = metadata;
				resolve ();
			};
		}));
	}

	// Return a promise that executes the media transcode
	transcodeMedia () {
		return (new Promise ((resolve, reject) => {
			let metadata, runargs, vcodec, proc, processData, processEnded;

			metadata = { };
			for (let i in this.sourceMetadata) {
				metadata[i] = this.sourceMetadata[i];
			}

			runargs = [ ];
			runargs.push ("-i"); runargs.push (this.sourcePath);

			runargs.push ("-vcodec");
			if (this.configureMap.videoCodec != "") {
				vcodec = this.configureMap.videoCodec;
			}
			else {
				vcodec = "libx264";
			}
			runargs.push (vcodec);

			if (vcodec == "libx264") {
				// TODO: Possibly use a preset other than ultrafast
				runargs.push ("-preset"); runargs.push ("ultrafast");
			}
			if (metadata.frameRate > 29.97) {
				metadata.frameRate = 29.97;
				runargs.push ("-r"); runargs.push ("29.97");
			}

			runargs.push ("-acodec");
			if (this.configureMap.audioCodec != "") {
				runargs.push (this.configureMap.audioCodec);
			}
			else {
				runargs.push ("aac");
			}

			runargs.push ("-map"); runargs.push (metadata.videoStreamId);
			runargs.push ("-map"); runargs.push (metadata.audioStreamId);

			runargs.push ("-f"); runargs.push ("ssegment");
			runargs.push ("-segment_list"); runargs.push ("index.m3u8");
			runargs.push ("-segment_list_flags"); runargs.push ("live");
			runargs.push ("-segment_time"); runargs.push ("2");
			runargs.push ("%05d.ts");

			this.destMetadata = metadata;

			setTimeout (() => {
				proc = App.systemAgent.createFfmpegProcess (runargs, Path.join (this.streamDataPath, "hls"), processData, processEnded);
			}, 0);

			processData = (lines, dataParseCallback) => {

				if (this.getPercentComplete () < 50) {
					this.addPercentComplete (1);
				}
				process.nextTick (dataParseCallback);
			};

			processEnded = () => {
				if (proc.hasError) {
					reject (Error ("HLS transcode process ended with error"));
					return;
				}
				if (this.getPercentComplete () < 50) {
					this.setPercentComplete (50);
				}
				resolve ();
			}
		}));
	}

	// Return a promise that generates thumbnail images from HLS transcode output
	createThumbnails () {
		return (new Promise ((resolve, reject) => {
			let segmentfiles, segmentindex, proc, createNextThumbnail, processEnded;

			FsUtil.readDirectory (Path.join (this.streamDataPath, "hls")).then ((files) => {
				segmentfiles = [ ];
				for (let file of files) {
					if (file.match (/^[0-9]+\.ts$/)) {
						segmentfiles.push (file);
					}
				}
				segmentfiles.sort ();

				return (FsUtil.createDirectory (Path.join (this.streamDataPath, "thumbnail")));
			}).then (() => {
				segmentindex = -1;
				createNextThumbnail ();
			}).catch ((err) => {
				reject (err);
			});

			createNextThumbnail = () => {
				++segmentindex;
				if (segmentindex >= segmentfiles.length) {
					resolve ();
					return;
				}

				proc = App.systemAgent.createFfmpegProcess ([
					"-i", Path.join (this.streamDataPath, "hls", segmentfiles[segmentindex]),
					"-vcodec", "mjpeg",
					"-vframes", "1",
					"-an",
					"-y",
					Path.join (this.streamDataPath, "thumbnail", segmentfiles[segmentindex] + ".jpg"),
				], Path.join (this.streamDataPath, "hls"), null, processEnded);
			};

			processEnded = () => {
				if (proc.hasError) {
					reject (Error ("Thumbnail process ended with error"));
					return;
				}

				if (this.getPercentComplete () < 90) {
					this.addPercentComplete (1);
				}
				createNextThumbnail ();
			};
		}));
	}

	// Return a promise that reads metadata from the HLS transcode output and stores the resulting object in this.hlsMetadata
	readHlsMetadata () {
		return (new Promise ((resolve, reject) => {
			Fs.readFile (Path.join (this.streamDataPath, "hls", "index.m3u8"), (err, data) => {
				let metadata;

				if (err != null) {
					reject (Error (err));
					return;
				}

				metadata = HlsIndexParser.parse (data.toString ());
				if (metadata == null) {
					reject (Error ("Failed to parse HLS index file"));
					return;
				}

				this.hlsMetadata = metadata;
				resolve ();
			});
		}));
	}

	// Subclass method. Implementations should execute task actions and call end when complete.
	doEnd () {
		if (this.isSuccess && (! this.isCancelled)) {
			return;
		}
		FsUtil.removeDirectory (this.streamDataPath, (err) => {
		});
	}
}

module.exports = CreateMediaStream;
