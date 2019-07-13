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
const Fs = require ("fs");
const Path = require ("path");
const Log = require (App.SOURCE_DIRECTORY + "/Log");
const SystemInterface = require (App.SOURCE_DIRECTORY + "/SystemInterface");
const FsUtil = require (App.SOURCE_DIRECTORY + "/FsUtil");
const FfprobeJsonParser = require (App.SOURCE_DIRECTORY + "/FfprobeJsonParser");
const HlsIndexParser = require (App.SOURCE_DIRECTORY + "/HlsIndexParser");
const TaskBase = require (App.SOURCE_DIRECTORY + "/Task/TaskBase");

const DEFAULT_VIDEO_CODEC = "libx264";
const DEFAULT_AUDIO_CODEC = "aac";

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
				name: "mediaWidth",
				type: "number",
				flags: SystemInterface.ParamFlag.GreaterThanZero,
				description: "The frame width of the source video"
			},
			{
				name: "mediaHeight",
				type: "number",
				flags: SystemInterface.ParamFlag.GreaterThanZero,
				description: "The frame height of the source video"
			},
			{
				name: "profile",
				type: "number",
				flags: SystemInterface.ParamFlag.Required | SystemInterface.ParamFlag.ZeroOrGreater,
				description: "The profile type to use for encoding the stream",
				defaultValue: 0
			}
		];

		this.streamDataPath = "";
		this.sourcePath = "";
		this.sourceParser = { };
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
			return (FsUtil.createDirectory (Path.join (this.streamDataPath, App.STREAM_HLS_PATH)));
		}).then (() => {
			return (FsUtil.createDirectory (Path.join (this.streamDataPath, App.STREAM_DASH_PATH)));
		}).then (() => {
			return (this.readSourceMetadata ());
		}).then (() => {
			let w, h, vb;

			this.destMetadata = {
				duration: this.sourceParser.duration
			};

			this.destMetadata.frameRate = this.sourceParser.frameRate;
			if (this.destMetadata.frameRate > 29.97) {
				this.destMetadata.frameRate = 29.97;
			}

			w = this.configureMap.mediaWidth;
			h = this.configureMap.mediaHeight;
			vb = this.sourceParser.videoBitrate;
			switch (this.configureMap.profile) {
				case SystemInterface.Constant.CompressedStreamProfile: {
					vb = Math.floor (vb / 2);
					if (vb < 1024) {
						vb = 1024;
					}
					break;
				}
				case SystemInterface.Constant.LowQualityStreamProfile: {
					w = Math.floor (w / 2);
					h = Math.floor (h / 2);
					w -= (w % 16);
					h -= (h % 16);
					if (w < 1) {
						w = 1;
					}
					if (h < 1) {
						h = 1;
					}

					vb = Math.floor (vb / 2);
					if (vb < 1024) {
						vb = 1024;
					}
					break;
				}
				case SystemInterface.Constant.LowestQualityStreamProfile: {
					w = Math.floor (w / 4);
					h = Math.floor (h / 4);
					w -= (w % 16);
					h -= (h % 16);
					if (w < 1) {
						w = 1;
					}
					if (h < 1) {
						h = 1;
					}

					vb = Math.floor (vb / 4);
					if (vb < 1024) {
						vb = 1024;
					}
					break;
				}
				default: {
					break;
				}
			}
			this.destMetadata.width = w;
			this.destMetadata.height = h;
			this.destMetadata.videoBitrate = vb;

			this.destMetadata.bitrate = this.sourceParser.bitrate;
			this.destMetadata.bitrate -= (this.sourceParser.videoBitrate - vb);
			if (this.destMetadata.bitrate < 1024) {
				this.destMetadata.bitrate = 1024;
			}

			this.addPercentComplete (1);
			return (this.transcodeHlsStream ());
		}).then (() => {
			return (this.transcodeDashStream ());
		}).then (() => {
			return (this.createThumbnails ());
		}).then (() => {
			return (this.readHlsMetadata ());
		}).then (() => {
			return (this.computeStreamSize ());
		}).then ((streamSize) => {
			let params, streamitem;

			params = {
				id: this.configureMap.streamId,
				name: this.configureMap.streamName,
				sourceId: this.configureMap.mediaId,
				duration: this.destMetadata.duration,
				width: this.destMetadata.width,
				height: this.destMetadata.height,
				size: streamSize,
				bitrate: this.destMetadata.bitrate,
				frameRate: this.destMetadata.frameRate,
				profile: this.configureMap.profile,
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

	// Return a promise that reads metadata from the source media file and stores the resulting parser object in this.sourceParser
	readSourceMetadata () {
		return (new Promise ((resolve, reject) => {
			let parser, proc, processData, processEnded;

			setTimeout (() => {
				parser = new FfprobeJsonParser (this.sourcePath);
				proc = App.systemAgent.createFfprobeProcess ([
					"-hide_banner",
					"-loglevel", "quiet",
					"-i", this.sourcePath,
					"-print_format", "json",
					"-show_format",
					"-show_streams"
				], this.streamDataPath, processData, processEnded);
			}, 0);

			processData = (lines, dataParseCallback) => {
				parser.parseLines (lines);
				process.nextTick (dataParseCallback);
			};

			processEnded = (err) => {
				if (err != null) {
					reject (err);
					return;
				}

				parser.close ();
				if (! parser.isParseSuccess) {
					reject (Error ("Media parse failed, metadata not found"));
					return;
				}

				this.sourceParser = parser;
				resolve ();
			};
		}));
	}

	// Return a promise that executes the HLS transcode operation
	transcodeHlsStream () {
		return (new Promise ((resolve, reject) => {
			let args, vcodec, proc, processData, processEnded;

			// TODO: Possibly assign a different video codec (defaulting to libx264)
			vcodec = DEFAULT_VIDEO_CODEC;

			args = [ ];
			args.push ("-i", this.sourcePath);

			this.addVideoProfileArguments (vcodec, args);

			if (this.sourceParser.audioStreamIndex !== null) {
				// TODO: Possibly assign a different audio codec (defaulting to aac)
				args.push ("-acodec", DEFAULT_AUDIO_CODEC);
			}

			args.push ("-map", `0:${this.sourceParser.videoStreamIndex}`);
			if (this.sourceParser.audioStreamIndex !== null) {
				args.push ("-map", `0:${this.sourceParser.audioStreamIndex}`);
			}

			args.push ("-f", "ssegment");
			args.push ("-segment_list", App.STREAM_HLS_INDEX_FILENAME);
			args.push ("-segment_list_flags", "live");
			args.push ("-segment_time", "2");
			args.push ("%05d.ts");

			setTimeout (() => {
				proc = App.systemAgent.createFfmpegProcess (args, Path.join (this.streamDataPath, App.STREAM_HLS_PATH), processData, processEnded);
			}, 0);

			processData = (lines, dataParseCallback) => {

				if (this.getPercentComplete () < 50) {
					this.addPercentComplete (1);
				}
				process.nextTick (dataParseCallback);
			};

			processEnded = (err, isExitSuccess) => {
				if (err != null) {
					reject (err);
					return;
				}

				if (! isExitSuccess) {
					reject (Error ("HLS transcode process failed"));
					return;
				}
				if (this.getPercentComplete () < 50) {
					this.setPercentComplete (50);
				}
				resolve ();
			}
		}));
	}

	transcodeDashStream () {
		return (new Promise ((resolve, reject) => {
			let args, vcodec, proc, processData, processEnded;

			// TODO: Possibly assign a different video codec (defaulting to libx264)
			vcodec = DEFAULT_VIDEO_CODEC;

			args = [ ];
			args.push ("-i", this.sourcePath);

			this.addVideoProfileArguments (vcodec, args);

			if (this.sourceParser.audioStreamIndex !== null) {
				args.push ("-acodec");

				// TODO: Possibly assign a different audio codec (defaulting to aac)
				args.push (DEFAULT_AUDIO_CODEC);
			}

			args.push ("-map", `0:${this.sourceParser.videoStreamIndex}`);
			if (this.sourceParser.audioStreamIndex !== null) {
				args.push ("-map", `0:${this.sourceParser.audioStreamIndex}`);
			}

			args.push ("-f", "dash");
			args.push ("-adaptation_sets", "id=0,streams=v id=1,streams=a");
			args.push ("-use_template", "1");
			args.push (App.STREAM_DASH_DESCRIPTION_FILENAME);

			setTimeout (() => {
				proc = App.systemAgent.createFfmpegProcess (args, Path.join (this.streamDataPath, App.STREAM_DASH_PATH), processData, processEnded);
			}, 0);

			processData = (lines, dataParseCallback) => {

				if (this.getPercentComplete () < 50) {
					this.addPercentComplete (1);
				}
				process.nextTick (dataParseCallback);
			};

			processEnded = (err, isExitSuccess) => {
				if (err != null) {
					reject (err);
					return;
				}

				if (! isExitSuccess) {
					reject (Error ("DASH transcode process failed"));
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
			let segmentfiles, segmentindex, proc, createNextThumbnail, processEnded, copyComplete, curthumbfile, lastthumbfile;

			lastthumbfile = "";
			FsUtil.readDirectory (Path.join (this.streamDataPath, App.STREAM_HLS_PATH)).then ((files) => {
				segmentfiles = [ ];
				for (let file of files) {
					if (file.match (/^[0-9]+\.ts$/)) {
						segmentfiles.push (file);
					}
				}
				segmentfiles.sort ();

				return (FsUtil.createDirectory (Path.join (this.streamDataPath, App.STREAM_THUMBNAIL_PATH)));
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

				curthumbfile = Path.join (this.streamDataPath, App.STREAM_THUMBNAIL_PATH, segmentfiles[segmentindex] + ".jpg");
				proc = App.systemAgent.createFfmpegProcess ([
					"-i", Path.join (this.streamDataPath, App.STREAM_HLS_PATH, segmentfiles[segmentindex]),
					"-vcodec", "mjpeg",
					"-vframes", "1",
					"-an",
					"-y",
					curthumbfile
				], Path.join (this.streamDataPath, App.STREAM_HLS_PATH), null, processEnded);
			};

			processEnded = (err, isExitSuccess) => {
				if (err != null) {
					reject (err);
					return;
				}

				if (! isExitSuccess) {
					if (lastthumbfile == "") {
						reject (Error ("Failed to generate thumbnail image"));
						return;
					}

					Fs.copyFile (lastthumbfile, curthumbfile, 0, copyComplete);
					return;
				}

				lastthumbfile = curthumbfile;
				copyComplete ();
			};

			copyComplete = (err) => {
				if (err != null) {
					reject (err);
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
			Fs.readFile (Path.join (this.streamDataPath, App.STREAM_HLS_PATH, App.STREAM_HLS_INDEX_FILENAME), (err, data) => {
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

	// Return a promise that determines the total size of all generated stream files and resolves with the result in bytes
	computeStreamSize () {
		return (new Promise ((resolve, reject) => {
			let streamsize, files, fileindex, statNextFile, statFileComplete;

			FsUtil.findAllFiles (this.streamDataPath).then ((directoryFiles) => {
				streamsize = 0;
				files = directoryFiles;
				fileindex = -1;
				statNextFile ();
			}).catch ((err) => {
				reject (err);
			});

			statNextFile = () => {
				++fileindex;
				if (fileindex >= files.length) {
					resolve (streamsize);
					return;
				}
				FsUtil.statFile (files[fileindex], statFileComplete);
			};

			statFileComplete = (err, stats) => {
				if (err != null) {
					reject (Error (err));
					return;
				}
				streamsize += stats.size;
				statNextFile ();
			};
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

	// Add items to an ffmpeg args array, as appropriate for the specified codec and the configured video profile
	addVideoProfileArguments (codec, args) {
		args.push ("-vcodec", codec);
		if (codec == "libx264") {
			switch (this.configureMap.profile) {
				case SystemInterface.Constant.CompressedStreamProfile: {
					args.push ("-preset", "veryslow");
					break;
				}
				case SystemInterface.Constant.LowQualityStreamProfile: {
					args.push ("-preset", "slower");
					break;
				}
				case SystemInterface.Constant.LowestQualityStreamProfile: {
					args.push ("-preset", "slower");
					break;
				}
				default: {
					args.push ("-preset", "medium");
					break;
				}
			}

			args.push ("-profile:v", "high");
			args.push ("-level", "4.2");
			args.push ("-pix_fmt", "yuv420p");
		}

		args.push ("-b:v", this.destMetadata.videoBitrate);
		args.push ("-s", `${this.destMetadata.width}x${this.destMetadata.height}`);
		args.push ("-r", this.destMetadata.frameRate);
	}
}

module.exports = CreateMediaStream;
