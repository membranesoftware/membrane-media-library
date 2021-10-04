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
// Class that parses output data from an ffmpeg process and stores gathered metadata fields

"use strict";

class FfmpegOutputParser {
	constructor () {
		// Read-only data members
		this.transcodePosition = null; // milliseconds
	}

	// Parse an array of strings containing ffmpeg output lines
	parseLines (lines) {
		for (const line of lines) {
			const sections = line.split ("\r");
			for (const section of sections) {
				const m = section.match (/frame=.*\s+time=([0-9]+):([0-9]+):([0-9.]+)\s+/);
				if (m != null) {
					const hours = parseFloat (m[1]);
					const minutes = parseFloat (m[2]);
					const seconds = parseFloat (m[3]);
					if (!(isNaN (hours) || isNaN (minutes) || isNaN (seconds))) {
						this.transcodePosition = Math.floor (seconds * 1000) + Math.floor (minutes * 60 * 1000) + Math.floor (hours * 3600 * 1000);
					}
				}
			}
		}
	}
}
module.exports = FfmpegOutputParser;
