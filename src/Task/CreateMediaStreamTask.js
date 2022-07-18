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
const SystemInterface = require (Path.join (App.SOURCE_DIRECTORY, "SystemInterface"));
const FsUtil = require (Path.join (App.SOURCE_DIRECTORY, "FsUtil"));
const FfmpegUtil = require (Path.join (App.SOURCE_DIRECTORY, "FfmpegUtil"));
const FfprobeJsonParser = require (Path.join (App.SOURCE_DIRECTORY, "FfprobeJsonParser"));
const FfmpegOutputParser = require (Path.join (App.SOURCE_DIRECTORY, "FfmpegOutputParser"));
const HlsIndexParser = require (Path.join (App.SOURCE_DIRECTORY, "HlsIndexParser"));
const Task = require (Path.join (App.SOURCE_DIRECTORY, "Task", "Task"));
const Log = require (Path.join (App.SOURCE_DIRECTORY, "Log"));

const DefaultVideoCodec = "libx264";
const DefaultAudioCodec = "aac";

const CodecMap = { };
CodecMap.libx264 = {
	options: [
		"-profile:v", "high",
		"-level", "4.2",
		"-pix_fmt", "yuv420p"
	]
};

const ProfileMap = { };
ProfileMap[SystemInterface.Constant.SourceMatchStreamProfile] = {
	videoCodecOptions: {
		libx264: [ "-preset", "medium" ]
	}
};
ProfileMap[SystemInterface.Constant.HighBitrateStreamProfile] = {
	videoBitrate: 4096 * 1024,
	maxFrameHeight: 1080,
	videoCodecOptions: {
		libx264: [ "-preset", "slow" ]
	}
};
ProfileMap[SystemInterface.Constant.MediumBitrateStreamProfile] = {
	videoBitrate: 2048 * 1024,
	maxFrameHeight: 1080,
	videoCodecOptions: {
		libx264: [ "-preset", "medium" ]
	}
};
ProfileMap[SystemInterface.Constant.LowBitrateStreamProfile] = {
	videoBitrate: 1024 * 1024,
	maxFrameHeight: 720,
	videoCodecOptions: {
		libx264: [ "-preset", "slow" ]
	}
};
ProfileMap[SystemInterface.Constant.LowestBitrateStreamProfile] = {
	videoBitrate: 512 * 1024,
	maxFrameHeight: 480,
	videoCodecOptions: {
		libx264: [ "-preset", "slower" ]
	}
};
ProfileMap[SystemInterface.Constant.PreviewStreamProfile] = {
	videoBitrate: 512 * 1024,
	maxFrameHeight: 480,
	videoCodecOptions: {
		libx264: [ "-preset", "faster" ]
	}
};
ProfileMap[SystemInterface.Constant.FastPreviewStreamProfile] = {
	videoBitrate: 512 * 1024,
	maxFrameHeight: 480,
	videoCodecOptions: {
		libx264: [ "-preset", "ultrafast" ]
	}
};

class CreateMediaStreamTask extends Task {
	constructor (configureMap) {
		super (configureMap);
		this.name = App.uiText.getText ("CreateMediaStreamTaskName");

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
			},
			{
				name: "tags",
				type: "array",
				containerType: "string",
				flags: SystemInterface.ParamFlag.NotEmpty,
				description: "An array of strings containing keyword search matches"
			}
		];

		this.minProgressPercent = 0;
		this.maxProgressPercent = 0;
		this.streamDataPath = "";
		this.sourcePath = "";
		this.sourceParser = { };
		this.destMetadata = { };
		this.hlsMetadata = { };
	}

	async run () {
		let w, h, vb;

		const fields = SystemInterface.parseFields (this.configureParams, this.configureMap);
		if (SystemInterface.isError (fields)) {
			throw Error (`${this.toString ()} configuration parse failed; err=${fields}`);
		}
		this.configureMap = fields;
		this.subtitle = this.configureMap.streamName;
		this.statusMap.streamName = this.configureMap.streamName;
		this.streamDataPath = Path.join (this.configureMap.dataPath, this.configureMap.streamId);
		if (ProfileMap[this.configureMap.profile] === undefined) {
			this.configureMap.profile = SystemInterface.Constant.SourceMatchStreamProfile;
		}

		// TODO: Fetch media data from a remote host if mediaPath holds a URL value
		this.sourcePath = this.configureMap.mediaPath;

		const exists = await FsUtil.fileExists (this.sourcePath);
		if (! exists) {
			throw Error ("Source media file not found");
		}

		await FsUtil.createDirectory (this.streamDataPath);
		await FsUtil.createDirectory (Path.join (this.streamDataPath, App.StreamHlsPath));
		await FsUtil.createDirectory (Path.join (this.streamDataPath, App.StreamDashPath));
		await this.readSourceMetadata ();
		this.cancelBreak ();

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

		const profile = ProfileMap[this.configureMap.profile];
		if (typeof profile.videoBitrate === "number") {
			if (vb > profile.videoBitrate) {
				vb = profile.videoBitrate;
			}
		}

		if (typeof profile.maxFrameHeight === "number") {
			if (h > profile.maxFrameHeight) {
				const ratio = w / h;
				h = profile.maxFrameHeight;
				w = Math.floor (h * ratio);
				w -= (w % 16);
				h -= (h % 16);
				if (w < 1) {
					w = 1;
				}
				if (h < 1) {
					h = 1;
				}
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

		this.setPercentComplete (1);
		this.minProgressPercent = 1;
		this.maxProgressPercent = 46;
		await this.transcodeHlsStream ();

		this.minProgressPercent = 47;
		this.maxProgressPercent = 94;
		await this.transcodeDashStream ();

		this.minProgressPercent = 95;
		this.maxProgressPercent = 99;
		await this.createThumbnails ();
		await this.readHlsMetadata ();
		const params = {
			id: this.configureMap.streamId,
			name: this.configureMap.streamName,
			sourceId: this.configureMap.mediaId,
			duration: this.destMetadata.duration,
			width: this.destMetadata.width,
			height: this.destMetadata.height,
			size: await this.computeStreamSize (),
			bitrate: this.destMetadata.bitrate,
			frameRate: this.destMetadata.frameRate,
			profile: this.configureMap.profile,
			hlsTargetDuration: this.hlsMetadata.hlsTargetDuration,
			segmentCount: this.hlsMetadata.segmentCount,
			segmentFilenames: this.hlsMetadata.segmentFilenames,
			segmentLengths: this.hlsMetadata.segmentLengths,
			segmentPositions: this.hlsMetadata.segmentPositions,
			tags: this.configureMap.tags
		};
		const streamitem = App.systemAgent.createCommand (SystemInterface.CommandId.StreamItem, params);
		if (streamitem == null) {
			throw Error ("Failed to create StreamItem command");
		}
		await App.systemAgent.recordStore.storeRecord (streamitem);
		this.setPercentComplete (100);
		this.isSuccess = true;
	}

	async end () {
		if (this.isSuccess && (! this.isCancelled)) {
			return;
		}
		FsUtil.removeDirectory (this.streamDataPath, (err) => {
			if (err != null) {
				Log.debug (`${this.toString ()} failed to remove data directory; streamDataPath=${this.streamDataPath} err=${err}`);
			}
		});
	}

	// Read metadata from the source media file and store the resulting parser object in this.sourceParser
	async readSourceMetadata () {
		const parser = new FfprobeJsonParser (this.sourcePath);
		await FfmpegUtil.runFfprobe ([
			"-hide_banner",
			"-loglevel", "quiet",
			"-i", this.sourcePath,
			"-print_format", "json",
			"-show_format",
			"-show_streams"
		], this.streamDataPath, (lines, dataParseCallback) => {
			parser.parseLines (lines);
			process.nextTick (dataParseCallback);
		});

		parser.close ();
		if (! parser.isParseSuccess) {
			throw Error ("Media parse failed, metadata not found");
		}
		this.sourceParser = parser;
	}

	// Execute the HLS transcode operation
	async transcodeHlsStream () {
		// TODO: Possibly assign a different video codec (defaulting to libx264)
		const vcodec = DefaultVideoCodec;

		const args = [ ];
		args.push ("-i", this.sourcePath);

		this.addVideoProfileArguments (vcodec, args);

		if (this.sourceParser.audioStreamIndex !== null) {
			// TODO: Possibly assign a different audio codec (defaulting to aac)
			args.push ("-acodec", DefaultAudioCodec);
		}

		args.push ("-map", `0:${this.sourceParser.videoStreamIndex}`);
		if (this.sourceParser.audioStreamIndex !== null) {
			args.push ("-map", `0:${this.sourceParser.audioStreamIndex}`);
		}

		args.push ("-f", "ssegment");
		args.push ("-segment_list", App.StreamHlsIndexFilename);
		args.push ("-segment_list_flags", "live");
		args.push ("-segment_time", "2");
		args.push ("%05d.ts");

		const parser = new FfmpegOutputParser ();
		const isExitSuccess = await FfmpegUtil.runFfmpeg (args, Path.join (this.streamDataPath, App.StreamHlsPath), (lines, dataParseCallback) => {
			parser.parseLines (lines);
			if ((typeof this.sourceParser.duration == "number") && (typeof parser.transcodePosition == "number") && (this.sourceParser.duration > 0)) {
				this.setPercentComplete (this.minProgressPercent + ((this.maxProgressPercent - this.minProgressPercent) * parser.transcodePosition / this.sourceParser.duration));
			}
			process.nextTick (dataParseCallback);
		});
		if (! isExitSuccess) {
			throw Error ("HLS transcode process failed");
		}
		this.setPercentComplete (this.maxProgressPercent);
	}

	// Execute the DASH transcode operation
	async transcodeDashStream () {
		// TODO: Possibly assign a different video codec (defaulting to libx264)
		const vcodec = DefaultVideoCodec;

		const args = [ ];
		args.push ("-i", this.sourcePath);

		this.addVideoProfileArguments (vcodec, args);

		if (this.sourceParser.audioStreamIndex !== null) {
			args.push ("-acodec");

			// TODO: Possibly assign a different audio codec (defaulting to aac)
			args.push (DefaultAudioCodec);
		}

		args.push ("-map", `0:${this.sourceParser.videoStreamIndex}`);
		if (this.sourceParser.audioStreamIndex !== null) {
			args.push ("-map", `0:${this.sourceParser.audioStreamIndex}`);
		}

		args.push ("-f", "dash");
		args.push ("-adaptation_sets", "id=0,streams=v id=1,streams=a");
		args.push ("-use_template", "1");
		args.push (App.StreamDashDescriptionFilename);

		const parser = new FfmpegOutputParser ();

		const isExitSuccess = await FfmpegUtil.runFfmpeg (args, Path.join (this.streamDataPath, App.StreamDashPath), (lines, dataParseCallback) => {
			parser.parseLines (lines);
			if ((typeof this.sourceParser.duration == "number") && (typeof parser.transcodePosition == "number") && (this.sourceParser.duration > 0)) {
				this.setPercentComplete (this.minProgressPercent + ((this.maxProgressPercent - this.minProgressPercent) * parser.transcodePosition / this.sourceParser.duration));
			}
			process.nextTick (dataParseCallback);
		});
		if (! isExitSuccess) {
			throw Error ("DASH transcode process failed");
		}
		this.setPercentComplete (this.maxProgressPercent);
	}

	// Generate thumbnail images from HLS transcode output
	async createThumbnails () {
		let lastthumbfile, count;

		const files = await FsUtil.readDirectory (Path.join (this.streamDataPath, App.StreamHlsPath));
		const segmentfiles = files.filter ((file) => {
			return (file.match (/^[0-9]+\.ts$/) != null);
		});
		if (segmentfiles.length <= 0) {
			return;
		}
		segmentfiles.sort ();

		await FsUtil.createDirectory (Path.join (this.streamDataPath, App.StreamThumbnailPath));
		lastthumbfile = "";
		count = 0;
		for (const file of segmentfiles) {
			const curthumbfile = Path.join (this.streamDataPath, App.StreamThumbnailPath, `${file}.jpg`);
			const isExitSuccess = await FfmpegUtil.runFfmpeg ([
				"-i", Path.join (this.streamDataPath, App.StreamHlsPath, file),
				"-vcodec", "mjpeg",
				"-vframes", "1",
				"-an",
				"-y", curthumbfile
			], Path.join (this.streamDataPath, App.StreamHlsPath));
			if (! isExitSuccess) {
				if (lastthumbfile == "") {
					throw Error ("Failed to generate thumbnail image");
				}
				await FsUtil.copyFile (lastthumbfile, curthumbfile);
			}
			this.setPercentComplete (this.minProgressPercent + ((this.maxProgressPercent - this.minProgressPercent) * count / segmentfiles.length));
			lastthumbfile = curthumbfile;
			++count;
		}
	}

	// Read metadata from the HLS transcode output and store the resulting object in this.hlsMetadata
	async readHlsMetadata () {
		const data = await FsUtil.readFile (Path.join (this.streamDataPath, App.StreamHlsPath, App.StreamHlsIndexFilename));
		const metadata = HlsIndexParser.parse (data);
		if (metadata == null) {
			throw Error ("Failed to parse HLS index file");
		}
		this.hlsMetadata = metadata;
	}

	// Determine the total size of all generated stream files and return the result in bytes
	async computeStreamSize () {
		let streamsize;

		streamsize = 0;
		const files = await FsUtil.findAllFiles (this.streamDataPath);
		for (const file of files) {
			const stats = await FsUtil.statFile (file);
			streamsize += stats.size;
		}
		return (streamsize);
	}

	// Add items to an ffmpeg args array, as appropriate for the specified codec and the configured video profile
	addVideoProfileArguments (codecName, args) {
		args.push ("-vcodec", codecName);

		const profile = ProfileMap[this.configureMap.profile];
		if (Array.isArray (profile.videoCodecOptions[codecName])) {
			for (const arg of profile.videoCodecOptions[codecName]) {
				args.push (arg);
			}
		}

		const codec = CodecMap[codecName];
		if ((codec !== undefined) && Array.isArray (codec.options)) {
			for (const arg of codec.options) {
				args.push (arg);
			}
		}

		args.push ("-b:v", this.destMetadata.videoBitrate);
		args.push ("-s", `${this.destMetadata.width}x${this.destMetadata.height}`);
		args.push ("-r", this.destMetadata.frameRate);
	}
}
module.exports = CreateMediaStreamTask;
