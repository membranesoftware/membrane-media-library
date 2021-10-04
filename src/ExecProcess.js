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
// Class that runs a child process and emits events as lines of data are generated

"use strict";

const App = global.App || { };
const ChildProcess = require ("child_process");
const Path = require ("path");
const Log = require (Path.join (App.SOURCE_DIRECTORY, "Log"));

const StopSignalRepeatDelay = 4800; // milliseconds

class ExecProcess {
	// execPath: the path to the binary to run
	// execArgs: an array containing command line arguments for the child process
	// dataCallback: invoked with (lines, parseCallback) each time a set of output lines is parsed
	// endCallback: invoked with (err, isExitSuccess) when the process ends
	constructor (execPath, execArgs, dataCallback, endCallback) {
		// Read-write data members
		this.enableStdoutData = true;
		this.enableStderrData = true;
		this.env = { };
		this.workingPath = App.DATA_DIRECTORY;

		// Read-only data members
		this.isPaused = false;
		this.isEnded = false;
		this.exitCode = -1;
		this.exitSignal = "";
		this.isExitSuccess = false;

		this.execPath = execPath;
		if (this.execPath.indexOf ("/") !== 0) {
			this.execPath = Path.join (App.BIN_DIRECTORY, this.execPath);
		}

		this.execArgs = [ ];
		if (Array.isArray (execArgs)) {
			this.execArgs = execArgs;
		}

		this.dataCallback = dataCallback;
		this.endCallback = endCallback;
		this.isDrainingStdin = false;
		this.stdinWriteData = "";
		this.process = null;
		setImmediate (() => {
			this.runProcess ();
		});
	}

	// Run the configured process
	runProcess () {
		let proc, endcount;

		try {
			proc = ChildProcess.spawn (this.execPath, this.execArgs, {
				cwd: this.workingPath,
				env: this.env
			});
		}
		catch (err) {
			Log.err (`Failed to launch child process; execPath=${this.execPath} execArgs=${JSON.stringify (this.execArgs)} workingPath=${this.workingPath} env=${JSON.stringify (this.env)} err=${err}\n${err.stack}`);
			if (this.endCallback != null) {
				setTimeout (() => {
					this.endCallback (err, false);
				}, 0);
			}
			return;
		}
		this.process = proc;
		endcount = 0;
		this.isEnded = false;
		this.isDrainingStdin = false;
		this.stdinWriteData = "";
		this.exitCode = -1;
		this.exitSignal = "";
		this.isExitSuccess = false;
		this.readLineCount = 0;
		this.readByteCount = 0;
		this.stdoutBuffer = "";
		this.stderrBuffer = "";

		proc.stdout.on ("data", (data) => {
			if (this.enableStdoutData) {
				this.stdoutBuffer += data.toString ();
			}
			this.readByteCount += data.length;
			this.parseBuffer ();
		});

		proc.stdout.on ("end", () => {
			++endcount;
			if (endcount >= 3) {
				endRun ();
			}
		});

		proc.stderr.on ("data", (data) => {
			if (this.enableStderrData) {
				this.stderrBuffer += data.toString ();
			}
			this.readByteCount += data.length;
			this.parseBuffer ();
		});

		proc.stderr.on ("end", () => {
			++endcount;
			if (endcount >= 3) {
				endRun ();
			}
		});

		proc.on ("error", (err) => {
			Log.err (`[ExecProcess ${proc.pid}] process error; execPath=${this.execPath} err=${err}`);
			endRun (err);
		});

		proc.on ("close", (code, signal) => {
			this.exitCode = code;
			this.exitSignal = (typeof signal == "string") ? signal : "";
			this.isExitSuccess = (this.exitCode == 0);
			++endcount;
			if (endcount >= 3) {
				endRun ();
			}
		});

		const endRun = (err) => {
			if (this.isEnded) {
				return;
			}
			this.isEnded = true;
			if (err != null) {
				if (typeof this.endCallback == "function") {
					this.endCallback (err, this.isExitSuccess);
					this.endCallback = null;
				}
				return;
			}
			if (! this.isPaused) {
				this.parseBuffer ();
			}
		};
	}

	// Pause the process's input events
	pauseEvents () {
		if (this.process == null) {
			return;
		}
		this.isPaused = true;
		this.process.stdout.pause ();
		this.process.stderr.pause ();
	}

	// Resume the process's input events
	resumeEvents () {
		if (this.process == null) {
			return;
		}
		this.process.stdout.resume ();
		this.process.stderr.resume ();
		this.isPaused = false;
	}

	// Write the provided data to the process's stdin
	write (data) {
		const proc = this.process;
		if (proc == null) {
			return;
		}
		if (this.isDrainingStdin) {
			this.stdinWriteData += data.toString ();
			return;
		}
		if (! proc.stdin.write (data)) {
			this.isDrainingStdin = true;
			this.stdinWriteData = "";
			proc.stdin.once ("drain", () => {
				const writedata = this.stdinWriteData;
				this.isDrainingStdin = false;
				this.stdinWriteData = "";
				if (writedata.length > 0) {
					this.write (writedata);
				}
			});
		}
	}

	// Parse any data contained in process buffers
	parseBuffer () {
		const endParse = () => {
			if (this.isPaused) {
				this.resumeEvents ();
			}
			if (this.isEnded) {
				if (typeof this.endCallback == "function") {
					this.endCallback (null, this.isExitSuccess);
					this.endCallback = null;
				}
			}
		};
		const lines = [ ];

		if (this.enableStdoutData) {
			while (true) {
				const pos = this.stdoutBuffer.indexOf ("\n");
				if (pos < 0) {
					break;
				}
				const line = this.stdoutBuffer.substring (0, pos);
				this.stdoutBuffer = this.stdoutBuffer.substring (pos + 1);
				lines.push (line);
				++(this.readLineCount);
			}
		}
		if (this.enableStderrData) {
			while (true) {
				const pos = this.stderrBuffer.indexOf ("\n");
				if (pos < 0) {
					break;
				}
				const line = this.stderrBuffer.substring (0, pos);
				this.stderrBuffer = this.stderrBuffer.substring (pos + 1);
				lines.push (line);
				++(this.readLineCount);
			}
		}

		if (lines.length <= 0) {
			endParse ();
			return;
		}

		this.pauseEvents ();
		if (typeof this.dataCallback == "function") {
			this.dataCallback (lines, () => {
				endParse ();
			});
		}
		else {
			process.nextTick (endParse);
		}
	}

	// Stop the process
	stop () {
		if (this.isEnded) {
			return;
		}
		this.process.kill ("SIGTERM");
		const repeatKill = () => {
			if (this.isEnded) {
				return;
			}
			this.process.kill ("SIGKILL");
		};
		setTimeout (repeatKill, StopSignalRepeatDelay);
	}
}
module.exports = ExecProcess;
