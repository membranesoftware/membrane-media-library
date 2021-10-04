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
// Base class for tasks

"use strict";

const App = global.App || { };
const Path = require ("path");
const Log = require (Path.join (App.SOURCE_DIRECTORY, "Log"));
const SystemInterface = require (Path.join (App.SOURCE_DIRECTORY, "SystemInterface"));

class TaskBase {
	constructor () {
		// Read-only data members
		this.name = "Task";
		this.subtitle = "";
		this.configureParams = [ ];
		this.configureMap = { };
		this.createTime = Date.now ();
		this.isRunning = false;
		this.isSuccess = false;
		this.isCancelled = false;
		this.resultObjectType = "";
		this.resultObject = { };
		this.startTime = 0;
		this.endTime = 0;

		this.id = "00000000-0000-0000-0000-000000000000";
		this.endCallback = null;
		this.statusMap = { };
	}

	// Return a string representation of the task
	toString () {
		let s;

		s = `<Task id=${this.id} name="${this.name}"`;
		if (Object.keys (this.statusMap).length > 0) {
			s += ` ${JSON.stringify (this.statusMap)}`;
		}
		if (this.isRunning) {
			s += " isRunning";
		}
		if (this.isCancelled) {
			s += " isCancelled";
		}
		if (this.isSuccess) {
			s += " isSuccess";
		}
		s += ">";

		return (s);
	}

	// Configure the task using values in the provided params object
	configure (configParams) {
		const fields = SystemInterface.parseFields (this.configureParams, configParams);
		if (SystemInterface.isError (fields)) {
			throw Error (`${this.toString ()} configuration parse error; configParams=${JSON.stringify (configParams)} err=${fields}`);
		}
		this.configureMap = fields;
		this.doConfigure ();
	}

	// Return a SystemInterface TaskItem object with fields populated from the task
	getTaskItem () {
		return ({
			id: this.id,
			name: this.name,
			subtitle: this.subtitle,
			isRunning: this.isRunning,
			percentComplete: this.getPercentComplete (),
			createTime: this.createTime,
			endTime: this.endTime
		});
	}

	// Execute the task's operations and invoke the end method when complete
	run () {
		if (this.isRunning) {
			return;
		}
		this.isRunning = true;
		this.statusMap.isRunning = true;
		this.startTime = Date.now ();
		this.setPercentComplete (0);

		this.doRun ();
	}

	// Execute operations to end a task run
	end () {
		let result;

		this.isRunning = false;
		delete (this.statusMap["isRunning"]);
		this.endTime = Date.now ();

		if (this.isSuccess && (this.resultObjectType != "")) {
			result = SystemInterface.parseTypeObject (this.resultObjectType, this.resultObject);
			if (SystemInterface.isError (result)) {
				this.isSuccess = false;
				Log.err (`${this.toString ()} result object failed validation; resultObjectType=${this.resultObjectType} err=${result}`);
			}
		}

		this.doEnd ();
		if (typeof this.endCallback == "function") {
			this.endCallback (this);
		}
	}

	// Cancel the task run
	cancel () {
		if (this.isCancelled) {
			return;
		}
		this.isCancelled = true;
		this.doCancel ();
	}

	// Subclass method. Implementations should execute actions appropriate when the task has been successfully configured.
	doConfigure () {
		// Default implementation does nothing
	}

	// Subclass method. Implementations should execute task actions and call end when complete.
	doRun (cmdInv) {
		// Default implementation does nothing
		setImmediate (() => {
			this.isSuccess = true;
			this.end ();
		});
	}

	// Subclass method. Implementations should execute actions appropriate when the task has been cancelled.
	doCancel () {
		// Default implementation does nothing
	}

	// Subclass method. Implementations should execute actions appropriate when the task has ended.
	doEnd () {
		// Default implementation does nothing
	}

	// Return the percent complete value for the task
	getPercentComplete () {
		return (typeof this.statusMap.percentComplete == "number" ? Math.floor (this.statusMap.percentComplete) : 0);
	}

	// Set the percent complete value for the task
	setPercentComplete (value) {
		if (value < 0) {
			value = 0;
		}
		if (value > 100) {
			value = 100;
		}
		this.statusMap.percentComplete = value;
	}

	// Add the specified delta to the percent complete value for the task
	addPercentComplete (value) {
		this.setPercentComplete (this.statusMap.percentComplete + value);
	}
}
module.exports = TaskBase;
