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
// Class that runs a queue of commands to be invoked on a remote agent

"use strict";

const App = global.App || { };
const Path = require ("path");
const EventEmitter = require ("events").EventEmitter;
const Http = require ("http");
const Https = require ("https");
const StringUtil = require (Path.join (App.SOURCE_DIRECTORY, "StringUtil"));
const Log = require (Path.join (App.SOURCE_DIRECTORY, "Log"));
const SystemInterface = require (Path.join (App.SOURCE_DIRECTORY, "SystemInterface"));

const UnauthorizedErrorMessage = "Unauthorized";

class CommandList {
	constructor (targetHost) {
		if (typeof targetHost == "string") {
			this.targetHost = {
				hostname: targetHost
			};
		}
		else {
			this.targetHost = targetHost;
		}

		this.name = targetHost.hostname;
		this.isInvoking = false;
		this.invokeList = [ ];
		this.lastInvokeTime = 0;

		this.nextCommandId = 0;
		this.commandResolveEventEmitter = new EventEmitter ();
		this.commandResolveEventEmitter.setMaxListeners (0);
		this.commandRejectEventEmitter = new EventEmitter ();
		this.commandRejectEventEmitter.setMaxListeners (0);
	}

	// Return a boolean value indicating if the command list is idle according to a millisecond timeout
	isIdle (timeout, referenceTime) {
		if (typeof referenceTime != "number") {
			referenceTime = Date.now ();
		}
		if (this.isInvoking || (this.invokeList.length > 0)) {
			return (false);
		}
		if ((referenceTime - this.lastInvokeTime) < timeout) {
			return (false);
		}
		return (true);
	}

	// Return a promise that invokes a command on the list's target host in queued order. If responseCommandId is provided, the response command must match that type. If the command invocation succeeds, resolve with the response command.
	invokeCommand (invokePath, cmdInv, responseCommandId) {
		if (SystemInterface.isError (cmdInv)) {
			return (Promise.reject (Error (`Invalid command: ${cmdInv}`)));
		}

		const commandid = this.nextCommandId;
		++(this.nextCommandId);
		this.lastInvokeTime = Date.now ();

		this.invokeList.push ({
			id: commandid,
			invokePath: invokePath,
			cmdInv: cmdInv,
			responseCommandId: responseCommandId
		});
		if (! this.isInvoking) {
			setTimeout (() => {
				this.invokeNextCommand ().catch ((err) => {
					Log.debug (`Failed to invoke CommandList command; name=${this.name} err=${err}`);
				});
			}, 0);
		}

		return (new Promise ((resolve, reject) => {
			this.commandResolveEventEmitter.once (`${commandid}`, (responseCommand) => {
				resolve (responseCommand);
			});
			this.commandRejectEventEmitter.once (`${commandid}`, (err) => {
				reject (err);
			});
		}));
	}

	// Execute the next item from invokeList
	async invokeNextCommand () {
		let authpath, authsecret, authtoken, iscmdauth;

		if (this.isInvoking || (this.invokeList.length <= 0)) {
			return;
		}
		this.isInvoking = true;
		const cmd = this.invokeList.shift ();
		this.lastInvokeTime = Date.now ();

		const endInvoke = () => {
			this.commandResolveEventEmitter.removeAllListeners (`${cmd.id}`);
			this.commandRejectEventEmitter.removeAllListeners (`${cmd.id}`);
			this.lastInvokeTime = Date.now ();
			this.isInvoking = false;
			if (this.invokeList.length > 0) {
				this.invokeNextCommand ().catch ((err) => {
					Log.debug (`Failed to invoke CommandList command; name=${this.name} err=${err}`);
				});
			}
		};

		authsecret = "";
		authpath = "";
		authtoken = "";
		if (typeof cmd.cmdInv.prefix[SystemInterface.Constant.AuthorizationHashPrefixField] == "string") {
			iscmdauth = true;
		}
		else {
			iscmdauth = false;
			if ((typeof this.targetHost.authorizeSecret == "string") && (this.targetHost.authorizeSecret.length > 0)) {
				authsecret = this.targetHost.authorizeSecret;
				if ((typeof this.targetHost.authorizePath == "string") && (this.targetHost.authorizePath.length > 0)) {
					authpath = this.targetHost.authorizePath;
				}
				else {
					authpath = SystemInterface.Constant.DefaultAuthorizePath;
				}
				if ((typeof this.targetHost.authorizeToken == "string") && (this.targetHost.authorizeToken.length > 0)) {
					authtoken = this.targetHost.authorizeToken;
				}
			}
		}
		if ((authsecret.length > 0) && (authtoken.length > 0)) {
			App.systemAgent.setCommandAuthorization (cmd.cmdInv, authsecret, authtoken);
		}

		try {
			const response = await this.sendInvokeCommand (cmd.invokePath, cmd.cmdInv, cmd.responseCommandId);
			this.commandResolveEventEmitter.emit (`${cmd.id}`, response);
			endInvoke ();
			return;
		}
		catch (err) {
			if (iscmdauth || (authsecret.length <= 0) || (err.message != UnauthorizedErrorMessage)) {
				this.commandRejectEventEmitter.emit (`${cmd.id}`, err);
				endInvoke ();
				return;
			}
		}

		try {
			const authcmd = App.systemAgent.createCommand ("Authorize", {
				token: App.systemAgent.getRandomString (App.AuthorizeTokenLength)
			}, authsecret, null);
			const response = await this.sendInvokeCommand ((authpath.length > 0) ? authpath : SystemInterface.Constant.DefaultAuthorizePath, authcmd, SystemInterface.CommandId.AuthorizeResult);
			authtoken = response.params.token;
			this.targetHost.authorizeToken = response.params.token;
		}
		catch (err) {
			this.commandRejectEventEmitter.emit (`${cmd.id}`, Error (UnauthorizedErrorMessage));
			endInvoke ();
			return;
		}

		try {
			App.systemAgent.setCommandAuthorization (cmd.cmdInv, authsecret, authtoken);
			const response = await this.sendInvokeCommand (cmd.invokePath, cmd.cmdInv, cmd.responseCommandId);
			this.commandResolveEventEmitter.emit (`${cmd.id}`, response);
			endInvoke ();
			return;
		}
		catch (err) {
			this.commandRejectEventEmitter.emit (`${cmd.id}`, err);
			endInvoke ();
			return;
		}
	}

	// Return a promise that invokes a command on the target host. If responseCommandId is provided, the response command must match that type. If the command invocation succeeds, resolve with the response command.
	sendInvokeCommand (invokePath, cmdInv, responseCommandId) {
		const hostname = StringUtil.parseAddressHostname (this.targetHost.hostname);
		const port = StringUtil.parseAddressPort (this.targetHost.hostname, SystemInterface.Constant.DefaultTcpPort1);

		return (new Promise ((resolve, reject) => {
			let path, body, req;

			const postdata = JSON.stringify (cmdInv);
			path = invokePath;
			if (path.indexOf ("/") != 0) {
				path = `/${path}`;
			}

			const headers = {
				"Content-Type": "application/json",
				"Content-Length": postdata.length,
				"User-Agent": App.systemAgent.userAgent
			};
			if (App.InvokeServerName != "") {
				headers["Host"] = App.InvokeServerName;
			}

			const options = {
				method: "POST",
				hostname: hostname,
				port: port,
				path: path,
				headers: headers
			};
			body = "";
			const requestStarted = (res) => {
				if (res.statusCode == 401) {
					reject (Error (UnauthorizedErrorMessage));
					return;
				}
				if (res.statusCode != 200) {
					reject (Error (`Non-success response code ${res.statusCode}`));
					return;
				}
				res.on ("error", (err) => {
					reject (err);
				});
				res.on ("data", (data) => {
					body += data.toString ();
				});
				res.on ("end", () => {
					const responsecmd = SystemInterface.parseCommand (body);
					if (SystemInterface.isError (responsecmd)) {
						reject (Error (`Invalid response data, ${responsecmd}`));
						return;
					}
					if ((typeof responseCommandId == "number") && (responsecmd.command != responseCommandId)) {
						reject (Error (`Incorrect response type ${responsecmd.command}, expected ${responseCommandId}`));
						return;
					}
					resolve (responsecmd);
				});
			};

			if (App.EnableHttps) {
				options.protocol = "https:";
				options.agent = new Https.Agent ({
					// TODO: Possibly set the "ca" option (certificate authority block) here instead of rejectUnauthorized, i.e. Fs.readFileSync ("tls-cert.pem")
					rejectUnauthorized: false
				});
				req = Https.request (options, requestStarted);
			}
			else {
				options.protocol = "http:";
				req = Http.request (options, requestStarted);
			}
			req.on ("error", (err) => {
				reject (err);
			});
			req.write (postdata);
			req.end ();
		}));
	}
}
module.exports = CommandList;
