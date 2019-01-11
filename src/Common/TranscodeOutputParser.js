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
// Class that parses output data from an ffmpeg process and stores gathered metadata fields

"use strict";

const App = global.App || { };
const Log = require (App.SOURCE_DIRECTORY + "/Log");

class TranscodeOutputParser {
	constructor (sourceName) {
		this.sourceName = sourceName;
		if (typeof this.sourceName != "string") {
			this.sourceName = "";
		}

		// Read-only data members; null values indicate that the value isn't known
		this.videoStreamData = null;
		this.videoStreamId = null;
		this.audioStreamData = null;
		this.audioStreamId = null;
		this.duration = null; // milliseconds
		this.videoCodec = null;
		this.pixelFormat = null;
		this.frameSize = null;
		this.width = null;
		this.height = null;
		this.bitrate = null; // bits per second
		this.videoBitrate = null;
		this.frameRate = null; // frames per second
	}

	// Return a boolean value indicating if a complete set of metadata fields have been parsed from transcode output
	hasMetadata () {
		if ((typeof this.videoStreamId != "string") || (this.videoStreamId == "")) {
			return (false);
		}
		if ((typeof this.audioStreamId != "string") || (this.audioStreamId == "")) {
			return (false);
		}
		if ((typeof this.duration != "number") || (this.duration <= 0)) {
			return (false);
		}
		if ((typeof this.videoCodec != "string") || (this.videoCodec == "")) {
			return (false);
		}
		if ((typeof this.pixelFormat != "string") || (this.pixelFormat == "")) {
			return (false);
		}
		if ((typeof this.width != "number") || (this.width <= 0)) {
			return (false);
		}
		if ((typeof this.height != "number") || (this.height <= 0)) {
			return (false);
		}
		if ((typeof this.bitrate != "number") || (this.bitrate <= 0)) {
			return (false);
		}
		if ((typeof this.videoBitrate != "string") || (this.videoBitrate == "")) {
			return (false);
		}
		if ((typeof this.frameRate != "number") || (this.frameRate <= 0)) {
			return (false);
		}

		return (true);
	}

	// Parse an array of strings containing transcode output lines
	parseLines (lines) {
		for (let line of lines) {
			this.parseLine (line);
		}
	}

	// Parse a line of transcode output
	parseLine (line) {
		let m, hours, minutes, seconds;
		if (this.videoStreamId === null) {
			m = line.match (/Stream #([0-9]+:[0-9]+).*?:.*?Video: .*/);
			if (m != null) {
				this.videoStreamData = m[0].replace ("\n", "");
				this.videoStreamId = m[1];
				Log.debug (`<Transcode ${this.sourceName}> video metadata "${this.videoStreamData}"; video stream ID="${this.videoStreamId}"`);
			}
		}

		if (this.audioStreamId === null) {
			m = line.match (/Stream #([0-9]+:[0-9]+).*?:.*?Audio: .*/);
			if (m != null) {
				this.audioStreamData = m[0].replace ("\n", "");
				this.audioStreamId = m[1];
				Log.debug (`<Transcode ${this.sourceName}> audio metadata "${this.audioStreamData}"; audio stream ID="${this.audioStreamId}"`);
			}
		}

		if (this.duration === null) {
			m = line.match (/Duration:\s+([0-9]+):([0-9]+):([0-9]+\.[0-9]+),\s*start:.*?/);
			if (m != null) {
				hours = parseInt (m[1], 10);
				minutes = parseInt (m[2], 10);
				seconds = parseFloat (m[3]);
				if ((! isNaN (hours)) && (! isNaN (minutes)) && (! isNaN (seconds))) {
					this.duration = (hours * 3600) + (minutes * 60) + seconds;
					this.duration *= 1000;
				}
				Log.debug (`<Transcode ${this.sourceName}> duration metadata ${m[0].replace ("\n", "")}; duration=${hours}:${minutes}:${seconds} ms=${this.duration}`);
			}
		}

		if (this.videoCodec === null) {
			m = line.match (/Stream #[0-9]+:[0-9]+(?:\(.*?\)){0,1}:\s+Video:\s+(.*?),\s*(.*?),\s*(.*?)\s+.*?,\s*(.*?),/);
			if (m != null) {
				this.videoCodec = m[1];
				this.pixelFormat = m[2];
				this.frameSize = m[3];
				this.videoBitrate = m[4];
			}

			if ((this.pixelFormat != null) && (this.pixelFormat.indexOf ("(") >= 0)) {
				m = line.match (/Stream #[0-9]+:[0-9]+(?:\(.*?\)){0,1}:\s+Video:\s+(.*?),\s*(.*?\)),\s*(.*?)\s+.*?,\s*(.*?),/);
				if (m != null) {
					this.videoCodec = m[1];
					this.pixelFormat = m[2];
					this.frameSize = m[3];
					this.videoBitrate = m[4];
				}
			}

			if (this.frameSize !== null) {
				m = this.frameSize.match (/([0-9]+)x([0-9]+)/);
				if (m != null) {
					this.width = parseInt (m[1]);
					this.height = parseInt (m[2]);
				}
			}

			if ((this.frameRate === null) || (this.frameRate == "")) {
				m = line.match (/Stream #[0-9]+:[0-9]+(?:\(.*?\)){0,1}:\s+Video:\s+.*?, ([0-9\.]+)\s*fps,/);
				if (m != null) {
					this.frameRate = parseFloat (m[1]);
				}
			}
		}

		if (this.bitrate === null) {
			m = line.match (/\s*Duration:\s+[0-9]+:[0-9]+:[0-9]+\.[0-9]+,\s*start:.*?,\s*bitrate:\s*([0-9]+)\s*kb\/s/);
			if (m != null) {
				this.bitrate = parseInt (m[1]);
				if (isNaN (this.bitrate)) {
					this.bitrate = null;
				}
				else {
					this.bitrate *= 1024;
				}
			}
		}
	}

	// Return an object containing metadata fields gathered from parsing transcode output
	getMetadata () {
		let data;

		data = {
			videoStreamId: (this.videoStreamId !== null ? this.videoStreamId : ""),
			audioStreamId: (this.audioStreamId !== null ? this.audioStreamId : ""),
			duration: (this.duration !== null ? this.duration : 0),
			videoCodec: (this.videoCodec !== null ? this.videoCodec : ""),
			pixelFormat: (this.pixelFormat !== null ? this.pixelFormat : ""),
			width: (this.width !== null ? this.width : 0),
			height: (this.height !== null ? this.height : 0),
			videoBitrate: (this.videoBitrate !== null ? this.videoBitrate : ""),
			bitrate: (this.bitrate !== null ? this.bitrate : 0),
			frameRate: (this.frameRate !== null ? this.frameRate : "")
		};

		return (data);
	}

	// Add parser metadata fields to the provided object
	addMetadataFields (destObject) {
		let data;

		data = this.getMetadata ();
		for (let i in data) {
			destObject[i] = data[i];
		}
	}
}
module.exports = TranscodeOutputParser;
