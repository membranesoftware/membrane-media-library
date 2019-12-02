/*
* Copyright 2018-2019 Membrane Software <author@membranesoftware.com> https://membranesoftware.com
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
// Class that manages a set of intents and controls their run state

"use strict";

const App = global.App || { };
const Path = require ("path");
const Fs = require ("fs");
const Log = require (App.SOURCE_DIRECTORY + "/Log");
const RepeatTask = require (App.SOURCE_DIRECTORY + "/RepeatTask");
const FsUtil = require (App.SOURCE_DIRECTORY + "/FsUtil");
const AgentControl = require (App.SOURCE_DIRECTORY + "/Intent/AgentControl");
const Intent = require (App.SOURCE_DIRECTORY + "/Intent/Intent");

class IntentGroup {
	constructor () {
		// Read-write data members
		this.writePeriod = 300; // seconds

		this.intentMap = { };

		this.agentControl = new AgentControl ();
		this.updateTask = new RepeatTask ();
		this.writeStateTask = new RepeatTask ();
	}

	// Start the intent group's operation
	start () {
		let state, intent, data, lines, cmd;

		state = App.systemAgent.runState.intentState;
		if ((typeof state == "object") && (state != null)) {
			for (let item of Object.values (state)) {
				intent = Intent.createIntent (item.name);
				if (intent == null) {
					Log.err (`Failed to read intent state record; err=Unknown type ${item.name}`);
				}
				else {
					intent.readIntentState (item);
					intent.agentControl = this.agentControl;
					this.intentMap[intent.id] = intent;
					if (intent.isActive) {
						intent.start ();
					}
				}
			}
		}

		if ((Object.values (this.intentMap).length <= 0) && FsUtil.fileExistsSync (Path.join (App.CONF_DIRECTORY, "intent.conf"))) {
			try {
				data = Fs.readFileSync (Path.join (App.CONF_DIRECTORY, "intent.conf"), { encoding: "UTF8" });
				data = data.toString ();
			}
			catch (e) {
				Log.err (`Failed to read configuration file; path=${Path.join (App.CONF_DIRECTORY, "intent.conf")} err=${e}`);
				data = null;
			}

			if (data != null) {
				lines = data.split ("\n");
				for (let line of lines) {
					line = line.trim ();
					if (line.match (/^\s*#/) || line.match (/^\s*$/)) {
						continue;
					}

					intent = Intent.createIntentFromCommand (line);
					if (intent != null) {
						intent.assignId ();
						intent.agentControl = this.agentControl;
						this.intentMap[intent.id] = intent;
						Log.debug (`Create configuration intent; ${intent.toString ()}`);
						intent.start ();
					}
				}
			}
		}

		this.updateTask.setRepeating ((callback) => {
			this.update (callback);
		}, App.HEARTBEAT_PERIOD, App.HEARTBEAT_PERIOD * 2);

		this.writeStateTask.setRepeating ((callback) => {
			this.writeState (callback);
		}, Math.floor (this.writePeriod * 1000 * 0.98), this.writePeriod * 1000);
	}

	// Stop the intent group's operation
	stop () {
		this.updateTask.stop ();
		this.writeStateTask.stop ();
		for (let intent of Object.values (this.intentMap)) {
			intent.stop ();
		}
	}

	// Update the intent group's run state and execute the provided callback when complete
	update (endCallback) {
		let cmd;

		cmd = App.systemAgent.getStatus ();
		if (cmd != null) {
			this.agentControl.updateAgentStatus (cmd);
		}

		for (let intent of Object.values (this.intentMap)) {
			intent.update ();
		}

		process.nextTick (endCallback);
	}

	// Write the intent group's run state to storage and execute the provided callback when complete
	writeState (endCallback) {
		let state, cmd;

		state = { };
		for (let intent of Object.values (this.intentMap)) {
			state[intent.id] = intent.getIntentState ();
		}

		App.systemAgent.updateRunState ({ intentState: state }, endCallback);
	}

	// Add an intent to the group
	runIntent (intent) {
		intent.agentControl = this.agentControl;
		intent.assignId ();
		this.intentMap[intent.id] = intent;
		intent.start ();
		this.updateTask.setNextRepeat (0);
		this.writeStateTask.setNextRepeat (4800);
	}

	// Halt and remove all intents matching the specified group name
	removeIntentGroup (groupName) {
		let intents;

		intents = Object.values (this.intentMap);
		for (let intent of intents) {
			if (intent.groupName == groupName) {
				intent.stop ();
				delete (this.intentMap[intent.id]);
			}
		}

		this.updateTask.setNextRepeat (0);
		this.writeStateTask.setNextRepeat (4800);
	}

	// Return an array containing all intent items. If groupName or isActive are provided, filter results by matching against those fields.
	findIntents (groupName, isActive) {
		let a;

		a = [ ];
		for (let intent of Object.values (this.intentMap)) {
			if ((typeof groupName == "string") && (intent.groupName != groupName)) {
				continue;
			}
			if ((typeof isActive == "boolean") && (intent.isActive != isActive)) {
				continue;
			}

			a.push (intent);
		}

		return (a);
	}

	// Return the number of active intents in the group
	getActiveCount () {
		let count;

		count = 0;
		for (let intent of Object.values (this.intentMap)) {
			if (intent.isActive) {
				++count;
			}
		}

		return (count);
	}
}

module.exports = IntentGroup;
