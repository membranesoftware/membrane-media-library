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
// Class that handles storage of data records using MongoDB

"use strict";

const App = global.App || { };
const Path = require ("path");
const EventEmitter = require ("events").EventEmitter;
const Mongo = require ("mongodb").MongoClient;
const Log = require (Path.join (App.SOURCE_DIRECTORY, "Log"));
const FsUtil = require (Path.join (App.SOURCE_DIRECTORY, "FsUtil"));
const ExecProcess = require (Path.join (App.SOURCE_DIRECTORY, "ExecProcess"));

const DataDirectoryName = "records";
const ReadyEvent = "ready";
const ProcessEndedEvent = "processEnded";
const MaxCacheRecordAge = 600000; // ms

class RecordStore {
	constructor () {
		// Read-only data members
		this.dataPath = "";
		this.dbUrl = "";

		this.storeProcess = null;
		this.mongo = null;
		this.eventEmitter = new EventEmitter ();
		this.isStarted = false;
		this.isRunning = false;
		this.runTimeout = null;
		this.cache = { };
		this.expireCacheTimeout = null;
	}

	// Start the record store process
	async start () {
		if ((! App.EnableRecordStore) || this.isStarted) {
			return;
		}
		this.isStarted = true;
		this.dataPath = Path.join (App.DATA_DIRECTORY, DataDirectoryName);
		this.dbUrl = `mongodb:${App.DoubleSlash}${App.StoreHost}:${App.StorePort}/${App.StoreDatabase}`;
		await this.run ();
	}

	// End the record store process
	async stop () {
		if (! App.EnableRecordStore) {
			return;
		}
		this.isStarted = false;
		this.isRunning = false;
		if (this.mongo !== null) {
			this.mongo.close ();
			this.mongo = null;
		}
		if (this.runTimeout !== null) {
			clearTimeout (this.runTimeout);
			this.runTimeout = null;
		}
		this.cache = { };
		if (this.expireCacheTimeout !== null) {
			clearTimeout (this.expireCacheTimeout);
			this.expireCacheTimeout = null;
		}

		await new Promise ((resolve, reject) => {
			if (this.storeProcess == null) {
				resolve ();
				return;
			}
			this.eventEmitter.once (ProcessEndedEvent, () => {
				resolve ();
			});
			this.storeProcess.stop ();
		});
	}

	// Execute the provided callback on the next store ready event, or immediately if the store is already running
	onReady (callback) {
		if (this.isRunning) {
			setImmediate (callback);
			return;
		}
		this.eventEmitter.once (ReadyEvent, callback);
	}

	// Store a record and invoke endCallback (err) when complete. If endCallback is not provided, instead return a promise that executes the operation.
	storeRecord (record, endCallback) {
		const execute = (executeCallback) => {
			if ((typeof record != "object") || (record == null)) {
				executeCallback (Error ("Invalid data for storeRecord operation"));
				return;
			}
			if (! this.isRunning) {
				executeCallback (Error ("Records not available"));
				return;
			}
			const db = this.mongo.db (App.StoreDatabase);
			const collection = db.collection (App.StoreCollection);
			collection.insertOne (record, (err, result) => {
				executeCallback (err);
			});
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve ();
				});
			}));
		}
	}

	// Upsert a record and invoke endCallback (err) when complete. If endCallback is not provided, instead return a promise that executes the operation.
	upsertRecord (criteria, record, endCallback) {
		const execute = (executeCallback) => {
			if (! this.isRunning) {
				executeCallback (Error ("Records not available"));
				return;
			}
			const db = this.mongo.db (App.StoreDatabase);
			const collection = db.collection (App.StoreCollection);
			collection.replaceOne (criteria, record, { upsert: true }, executeCallback);
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err, result) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve (result);
				});
			}));
		}
	}

	// Update records and invoke endCallback (err) when complete. If endCallback is not provided, instead return a promise that executes the operation.
	updateRecords (criteria, update, options, endCallback) {
		const execute = (executeCallback) => {
			if (! this.isRunning) {
				executeCallback (Error ("Records not available"));
				return;
			}
			if ((typeof options != "object") || (options == null)) {
				options = { };
			}
			const db = this.mongo.db (App.StoreDatabase);
			const collection = db.collection (App.StoreCollection);
			collection.updateMany (criteria, update, options, executeCallback);
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err, result) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve (result);
				});
			}));
		}
	}

	// Count records matching the specified MongoDB criteria and invoke endCallback (err, recordCount) when complete. If endCallback is not provided, instead return a promise that executes the operation.
	countRecords (criteria, endCallback) {
		const execute = (executeCallback) => {
			if (! this.isRunning) {
				executeCallback (Error ("Records not available"), null);
				return;
			}
			const db = this.mongo.db (App.StoreDatabase);
			const collection = db.collection (App.StoreCollection);
			const cursor = collection.find (criteria);
			cursor.count (true, { }, (err, count) => {
				if (err != null) {
					executeCallback (err, null);
					return;
				}
				executeCallback (null, count);
			});
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err, recordCount) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve (recordCount);
				});
			}));
		}
	}

	// Check if a record matching the specified MongoDB criteria exists and invoke endCallback (err, exists) when complete. If endCallback is not provided, instead return a promise that executes the operation.
	recordExists (criteria, endCallback) {
		const execute = (executeCallback) => {
			if (! this.isRunning) {
				executeCallback (Error ("Records not available"), null);
				return;
			}
			const db = this.mongo.db (App.StoreDatabase);
			const collection = db.collection (App.StoreCollection);
			const cursor = collection.find (criteria);
			cursor.count (true, { limit: 1 }, (err, count) => {
				if (err != null) {
					executeCallback (err, null);
					return;
				}
				executeCallback (null, (count > 0));
			});
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err, exists) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve (exists);
				});
			}));
		}
	}

	// Search the record store for records using the provided MongoDB criteria, sort specification, and options. Invokes findCallback (record, callback) for each record found and endCallback (err) when complete. sort, maxResults, and skipCount can be null if not needed. If endCallback is not provided, instead return a promise that executes the operation.
	findRecords (findCallback, criteria, sort, maxResults, skipCount, endCallback) {
		const execute = (executeCallback) => {
			if (! this.isRunning) {
				executeCallback (Error ("Records not available"));
				return;
			}

			const db = this.mongo.db (App.StoreDatabase);
			const collection = db.collection (App.StoreCollection);
			const options = { };
			if ((typeof sort == "object") && (sort != null)) {
				options.sort = sort;
			}
			if (typeof maxResults == "number") {
				options.limit = maxResults;
			}
			if (typeof skipCount == "number") {
				options.skip = skipCount;
			}

			const cursor = collection.find (criteria, options);
			const hasNextComplete = (err, result) => {
				if (err != null) {
					executeCallback (err);
					return;
				}
				if (result !== true) {
					executeCallback (null);
					return;
				}
				process.nextTick (() => {
					cursor.next (nextComplete);
				});
			};
			const nextComplete = (err, record) => {
				if (err != null) {
					executeCallback (err);
					return;
				}

				// Records are stripped of the MongoDB _id field before being returned
				delete (record["_id"]);
				findCallback (record, () => {
					cursor.hasNext (hasNextComplete);
				});
			};
			cursor.hasNext (hasNextComplete);
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve ();
				});
			}));
		}
	}

	// Search the record store for the first record matching the provided MongoDB criteria and sort specification. Invokes endCallback (err, record) when complete, with a null record value if no records were found. If endCallback is not provided, instead return a promise that executes the operation.
	findRecord (criteria, sort, endCallback) {
		const execute = (executeCallback) => {
			let result;

			result = null;
			this.findRecords ((record, callback) => {
				if (result == null) {
					result = record;
				}
				process.nextTick (callback);
			}, criteria, sort, 1, null, (err) => {
				if (err != null) {
					executeCallback (err, null);
					return;
				}
				executeCallback (null, result);
			});
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err, record) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve (record);
				});
			}));
		}
	}

	// Search the record store for records using the provided MongoDB criteria, sort specification, and options. Invokes endCallback (err, records) when complete, with records as an array of result objects. If endCallback is not provided, instead return a promise that executes the operation.
	findAllRecords (criteria, sort, maxResults, skipCount, endCallback) {
		const execute = (executeCallback) => {
			const records = [ ];
			this.findRecords ((record, callback) => {
				records.push (record);
				process.nextTick (callback);
			}, criteria, sort, maxResults, skipCount, (err) => {
				if (err != null) {
					executeCallback (err, null);
					return;
				}
				executeCallback (null, records);
			});
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err, records) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve (records);
				});
			}));
		}
	}

	// Search the record store for the first record matching the provided commandId and recordId. Returns the record object, or null if no record was found.
	async findCommandRecord (commandId, recordId) {
		let entry;

		entry = this.cache[recordId];
		if (entry === undefined) {
			const record = await this.findRecord ({
				command: commandId,
				"params.id": recordId
			});
			if (record == null) {
				return (null);
			}

			this.cache[recordId] = {
				record: record
			};
			entry = this.cache[recordId];
		}

		entry.expireTime = Date.now () + MaxCacheRecordAge;
		if (this.expireCacheTimeout === null) {
			this.expireCacheTimeout = setTimeout (() => {
				this.expireCache ();
			}, App.HeartbeatPeriod * 128);
		}
		return (entry.record);
	}

	// Remove records matching the provided commandId and recordId
	async removeCommandRecord (commandId, recordId) {
		await this.removeRecords ({
			command: commandId,
			"params.id": recordId
		});
		delete (this.cache[recordId]);
	}

	// Remove any cache entry matching the provided recordId
	expireCacheRecord (recordId) {
		delete (this.cache[recordId]);
	}

	// Remove expired entries from the cache record map and schedule a timeout to repeat the operation if needed
	expireCache () {
		const now = Date.now ();
		const ids = Object.keys (this.cache);
		for (const id of ids) {
			const entry = this.cache[id];
			if (now >= entry.expireTime) {
				delete (this.cache[id]);
			}
		}

		if (this.expireCacheTimeout !== null) {
			clearTimeout (this.expireCacheTimeout);
			this.expireCacheTimeout = null;
		}
		if (Object.keys (this.cache).length > 0) {
			this.expireCacheTimeout = setTimeout (() => {
				this.expireCache ();
			}, App.HeartbeatPeriod * 128);
		}
	}

	// Count distinct values for the named key in the record store, using an optional query as filter criteria. Invokes endCallback (err, values) when complete. If endCallback is not provided, instead return a promise that executes the operation.
	findDistinctValues (key, query, endCallback) {
		const execute = (executeCallback) => {
			if (! this.isRunning) {
				executeCallback (Error ("Records not available"), null);
				return;
			}
			if ((typeof query != "object") || (query == null)) {
				query = { };
			}
			const db = this.mongo.db (App.StoreDatabase);
			const collection = db.collection (App.StoreCollection);
			collection.distinct (key, query, { }, (err, result) => {
				if (err != null) {
					executeCallback (err, null);
					return;
				}
				executeCallback (null, result);
			});
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err, result) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve (result);
				});
			}));
		}
	}

	// Remove records matching the provided MongoDB criteria and invoke endCallback (err) when complete. If endCallback is not provided, instead return a promise that executes the operation.
	removeRecords (criteria, endCallback) {
		const execute = (executeCallback) => {
			if (! this.isRunning) {
				executeCallback (Error ("Records not available"), null);
				return;
			}
			const db = this.mongo.db (App.StoreDatabase);
			const collection = db.collection (App.StoreCollection);
			collection.deleteMany (criteria, executeCallback);
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve ();
				});
			}));
		}
	}

	// Create an index for the collection and invoke endCallback (err) when complete. If endCallback is not provided, instead return a promise that executes the operation.
	createIndex (keys, options, endCallback) {
		const execute = (executeCallback) => {
			if (! this.isRunning) {
				executeCallback (Error ("Records not available"));
				return;
			}

			const db = this.mongo.db (App.StoreDatabase);
			const collection = db.collection (App.StoreCollection);
			collection.createIndex (keys, options, (err) => {
				executeCallback (err);
			});
		};

		if (typeof endCallback == "function") {
			execute (endCallback);
		}
		else {
			return (new Promise ((resolve, reject) => {
				execute ((err) => {
					if (err != null) {
						reject (err);
						return;
					}
					resolve ();
				});
			}));
		}
	}

	// Launch the record store process if it isn't already running
	async run () {
		let conf, proc;

		if (this.isRunning) {
			return;
		}
		if ((App.StoreRunPeriod > 0) && (this.storeProcess == null)) {
			await FsUtil.createDirectory (this.dataPath);

			conf = `dbpath=${this.dataPath}\n`;
			conf += "bind_ip=127.0.0.1\n";
			conf += "journal=false\n";
			conf += "auth=false\n";
			conf += `port=${App.StorePort}\n`;
			await FsUtil.writeFile (Path.join (this.dataPath, "mongod.conf"), conf, { mode: 0o600 });

			await new Promise ((resolve, reject) => {
				let started;

				started = false;
				const processData = (lines, dataParseCallback) => {
					if (! started) {
						for (const line of lines) {
							if (line.indexOf (`waiting for connections on port ${App.StorePort}`) >= 0) {
								started = true;
								break;
							}
						}
						if (started) {
							this.storeProcess = proc;
							resolve ();
						}
					}
					process.nextTick (dataParseCallback);
				};
				const processEnded = (err, isExitSuccess) => {
					this.isRunning = false;
					if (this.storeProcess == proc) {
						this.storeProcess = null;
						if (this.mongo !== null) {
							this.mongo.close ();
							this.mongo = null;
						}
					}
					this.eventEmitter.emit (ProcessEndedEvent);
					if (! started) {
						reject (Error ("Store process ended unexpectedly"));
					}

					if (this.isStarted) {
						if (this.runTimeout !== null) {
							clearTimeout (this.runTimeout);
						}
						this.runTimeout = setTimeout (() => {
							this.run ().catch ((err) => {
								Log.error (`Failed to restart record store process; err=${err}`);
							});
						}, App.StoreRunPeriod * 1000);
					}
				};
				proc = new ExecProcess (App.MongodPath, [ "-f", Path.join (this.dataPath, "mongod.conf") ]);
				proc.onReadLines (processData);
				proc.onEnd (processEnded);
				proc.workingPath = this.dataPath;
			});
		}

		if (this.mongo == null) {
			await new Promise ((resolve, reject) => {
				Mongo.connect (this.dbUrl, {
					useNewUrlParser: true,
					useUnifiedTopology: true
				}, (err, mongo) => {
					if (err != null) {
						reject (err);
						return;
					}

					const username = App.StoreUsername;
					const password = App.StorePassword;
					if ((typeof username != "string") || (typeof password != "string") || (username == "")) {
						this.mongo = mongo;
						resolve ();
						return;
					}

					mongo.authenticate (username, password, (err, res) => {
						if (err != null) {
							mongo.close ();
							reject (err);
							return;
						}
						this.mongo = mongo;
						resolve ();
					});
				});
			});
		}

		this.isRunning = true;
		this.eventEmitter.emit (ReadyEvent);
	}
}
module.exports = RecordStore;
