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
// Class that tracks and commands remote system agents

"use strict";

const App = global.App || { };
const Path = require ("path");
const SysUtil = require (Path.join (App.SOURCE_DIRECTORY, "SysUtil"));
const SystemInterface = require (Path.join (App.SOURCE_DIRECTORY, "SystemInterface"));
const RepeatTask = require (Path.join (App.SOURCE_DIRECTORY, "RepeatTask"));
const CommandList = require (Path.join (App.SOURCE_DIRECTORY, "CommandList"));

const AgentExpireTimeout = 900 * 1000; // ms
const CommandListExpireTimeout = 1800 * 1000; // ms
const ExpirePeriod = 120 * 1000; // ms

class AgentControl {
	constructor () {
		this.agentMap = { };
		this.expireTask = new RepeatTask ();
		this.getLocalStatusTask = new RepeatTask ();
		this.commandListMap = { };
	}

	// Start the agent control's operation
	async start () {
		this.expireTask.setRepeating ((callback) => {
			this.expire (callback);
		}, ExpirePeriod);
		this.getLocalStatusTask.setRepeating ((callback) => {
			const cmd = App.systemAgent.getStatus ();
			if (cmd != null) {
				this.updateAgentStatus (cmd);
			}
			process.nextTick (callback);
		}, App.HeartbeatPeriod * 5, App.HeartbeatPeriod * 6);
	}

	// Stop the agent control's operation
	async stop () {
		this.expireTask.stop ();
		this.getLocalStatusTask.stop ();
	}

	// Store data received with an AgentStatus command, with an optional targetHost value indicating the address used to get the status data
	updateAgentStatus (statusCommand, targetHost) {
		const agent = SysUtil.getMapItem (this.agentMap, statusCommand.params.id, () => {
			return (new Agent ());
		});
		agent.updateStatus (statusCommand, targetHost);
	}

	// Expunge expired map records and invoke callback when complete
	expire (callback) {
		let keys;

		const now = Date.now ();
		keys = Object.keys (this.agentMap);
		for (const key of keys) {
			const agent = this.agentMap[key];
			if (agent.isIdle (AgentExpireTimeout, now)) {
				delete this.agentMap[key];
			}
		}

		keys = Object.keys (this.commandListMap);
		for (const key of keys) {
			const commandlist = this.commandListMap[key];
			if (commandlist.isIdle (CommandListExpireTimeout, now)) {
				delete this.commandListMap[key];
			}
		}
		process.nextTick (callback);
	}

	// Invoke a command on a target agent. If responseCommandId is provided, the response command must match that type. If the command invocation succeeds, return the response command.
	async invokeCommand (agentId, invokePath, cmdInv, responseCommandId) {
		if ((cmdInv === null) || (cmdInv === undefined)) {
			throw Error (`Invalid command: ${cmdInv}`);
		}
		if (SystemInterface.isError (cmdInv)) {
			throw Error (`Invalid command: ${cmdInv}`);
		}
		if (agentId == App.systemAgent.agentId) {
			await App.systemAgent.invokeCommand (invokePath, cmdInv, responseCommandId);
			return;
		}
		const agent = this.agentMap[agentId];
		if (agent == null) {
			throw Error (`Unknown agent ID ${agentId}`);
		}
		if (agent.targetHostname == "") {
			throw Error (`Unknown target host for agent ID ${agentId}`);
		}
		const commandlist = this.getCommandList (agent.targetHostname);
		const result = await commandlist.invokeCommand (invokePath, cmdInv, responseCommandId);
		return (result);
	}

	// Invoke a command on the host specified in a SystemInterface AgentHost object. If responseCommandId is provided, the response command must match that type. If the command invocation succeeds, return the response command.
	async invokeHostCommand (targetHost, invokePath, cmdInv, responseCommandId) {
		if ((cmdInv === null) || (cmdInv === undefined)) {
			throw Error (`Invalid command: ${cmdInv}`);
		}
		if (SystemInterface.isError (cmdInv)) {
			throw Error (`Invalid command: ${cmdInv}`);
		}
		const commandlist = this.getCommandList (targetHost);
		const result = await commandlist.invokeCommand (invokePath, cmdInv, responseCommandId);
		return (result);
	}

	// Return an array containing contacted agents that cause the provided predicate function to generate a true value
	findAgents (matchFunction) {
		const m = [ ];
		for (const agent of Object.values (this.agentMap)) {
			if (matchFunction (agent)) {
				m.push (agent);
			}
		}
		return (m);
	}

	// Return the first agent matching the provided predicate function, or null if no agent was found
	findAgent (matchFunction) {
		const agents = this.findAgents (matchFunction);
		if (agents.length > 0) {
			return (agents[0]);
		}
		return (null);
	}

	// Return the first agent matching the provided string hostname or SystemInterface AgentHost object, or null if no agent was found
	findHostAgent (targetHost) {
		const hostname = (typeof targetHost == "string") ? targetHost : targetHost.hostname;
		return (this.findAgent ((agent) => {
			return (agent.targetHostname == hostname);
		}));
	}

	// Return the Agent object associated with the local system agent
	getLocalAgent () {
		return (SysUtil.getMapItem (this.agentMap, App.systemAgent.agentId, () => {
			return (new Agent ());
		}));
	}

	// Return the CommandList object for a string hostname or SystemInterface AgentHost object, creating it if needed
	getCommandList (targetHost) {
		let host;

		if (typeof targetHost == "string") {
			host = {
				hostname: targetHost
			};
		}
		else {
			host = targetHost;
		}

		return (SysUtil.getMapItem (this.commandListMap, host.hostname, () => {
			return (new CommandList (host));
		}));
	}

	// Return a TargetHost object containing any stored authorization fields for a string hostname or SystemInterface AgentHost object
	getHostAuthorization (targetHost) {
		const hostname = (typeof targetHost == "string") ? targetHost : targetHost.hostname;
		const commandlist = this.commandListMap[hostname];
		if (commandlist != null) {
			return (commandlist.targetHost);
		}
		return ({
			hostname: hostname,
			authorizeSecret: "",
			authorizePath: "",
			authorizeToken: ""
		});
	}
}
module.exports = AgentControl;

class Agent {
	constructor () {
		// Read-only data members
		this.createTime = Date.now ();
		this.targetHostname = "";
		this.agentId = "";
		this.version = "";
		this.uptime = "";
		this.displayName = "";
		this.applicationName = "";
		this.urlHostname = "";
		this.udpPort = 0;
		this.tcpPort1 = 0;
		this.tcpPort2 = 0;
		this.runCount = 0;
		this.maxRunCount = 0;
		this.isEnabled = false;
		this.linkPath = "";
		this.lastStatus = { };
		this.lastStatusTime = 0;
		this.lastInvokeTime = 0;
	}

	// Return a string representation of the agent
	toString () {
		return (`<Agent id=${this.agentId} targetHostname=${this.targetHostname} displayName=${this.displayName} urlHostname=${this.urlHostname} version=${this.version} linkPath=${this.linkPath} runCount=${this.runCount}/${this.maxRunCount} lastStatusTime=${this.lastStatusTime} lastInvokeTime=${this.lastInvokeTime}>`);
	}

	// Update status with fields from an AgentStatus command, with an optional targetHost value indicating the address used to get the status data
	updateStatus (statusCommand, targetHost) {
		this.lastStatus = statusCommand.params;
		this.lastStatusTime = Date.now ();

		this.agentId = statusCommand.params.id;
		this.version = statusCommand.params.version;
		this.uptime = statusCommand.params.uptime;
		this.displayName = statusCommand.params.displayName;
		this.applicationName = statusCommand.params.applicationName;
		this.urlHostname = statusCommand.params.urlHostname;
		this.udpPort = statusCommand.params.udpPort;
		this.tcpPort1 = statusCommand.params.tcpPort1;
		this.tcpPort2 = statusCommand.params.tcpPort2;
		this.linkPath = statusCommand.params.linkPath;
		this.runCount = statusCommand.params.runCount;
		this.maxRunCount = statusCommand.params.maxRunCount;
		this.isEnabled = statusCommand.params.isEnabled;

		if ((typeof targetHost == "object") && (targetHost != null)) {
			this.targetHostname = targetHost.hostname;
		}
	}

	// Return a boolean value indicating if the agent is idle according to a millisecond timeout
	isIdle (timeout, referenceTime) {
		if (typeof referenceTime != "number") {
			referenceTime = Date.now ();
		}

		if ((referenceTime - this.lastStatusTime) < timeout) {
			return (false);
		}
		if ((referenceTime - this.lastInvokeTime) < timeout) {
			return (false);
		}
		return (true);
	}
}
