// Post a command to the host agent and invoke callback (err, responseCommand) when complete
function postCommand (cmdInv, callback) {
	window.superagent.post ("/")
		.set ("Content-Type", "application/json")
		.set ("Accept", "application/json")
		.send (cmdInv)
		.end ((err, res) => {
			let cmd;

			if (err != null) {
				callback (err, null);
				return;
			}

			try {
				cmd = JSON.parse (res.text);
			}
			catch (e) {
				callback ("Failed to parse response command");
				return;
			}
			callback (null, cmd);
		});
}

// Set a property in the document element with the specified ID, if it exists
function setElementProperty (id, propertyName, propertyValue) {
	let e;

	e = document.getElementById (id);
	if (e != null) {
		e[propertyName] = propertyValue;
	}
}

// Set a style property in the document element with the specified ID, if it exists
function setElementStyle (id, propertyName, propertyValue) {
	let e;

	e = document.getElementById (id);
	if (e != null) {
		e.style[propertyName] = propertyValue;
	}
}
class IndexDiv extends React.Component {
	constructor (props) {
		super (props);

		this.state = {
			searchKey: "",
			streams: [ ],
			setSize: 0,
			moreCount: 0
		};

		this.searchKey = "";
		this.resultOffset = 0;
		this.pageSize = 64;

		this.streamServerStatus = { };

		for (const key of [
			"searchKeyChanged",
			"searchKeyKeyPressed",
			"searchButtonClicked",
			"loadButtonClicked"
		]) {
			this[key] = this[key].bind (this);
		}

		window.superagent.post ("/media-data")
			.set ("Content-Type", "application/json")
			.set ("Accept", "application/json")
			.send (SystemInterface.createCommand ({ }, "GetStatus"))
			.end ((err, res) => {
				let cmd;

				if (err != null) {
					console.log (`Failed to get media server status: ${err}`);
					return;
				}

				try {
					cmd = JSON.parse (res.text);
					if (cmd.command != SystemInterface.CommandId.StreamServerStatus) {
						throw Error ("Invalid server response");
					}
				}
				catch (e) {
					console.log (`Failed to get media server status: ${e}`);
					return;
				}

				this.streamServerStatus = cmd.params;
				this.load ();
			});
	}

	render () {
		let streams, headerdiv, loaddiv, text;

		streams = this.state.streams.map ((item) => {
			let img, cmd, src;

			img = "";
			if (item.segmentCount > 0) {
				cmd = SystemInterface.createCommand ({ }, "GetThumbnailImage", {
					id: item.id,
					thumbnailIndex: Math.floor (item.segmentCount / 4)
				});
				src = `${this.streamServerStatus.thumbnailPath}?${SystemInterface.Constant.UrlQueryParameter}=${encodeURIComponent (JSON.stringify (cmd))}`;
				img = <img className="card-image" src={src}></img>;
			}

			return (<div className="card" onClick={this.cardClicked.bind (this, item)}>
				<div className="no-padding center-text">
					{img}
				</div>
				<div className="card-label">
					{item.name}
				</div>
			</div>);
		});

		if (this.state.setSize <= 0) {
			if (this.searchKey != "") {
				text = `No streams found matching "${this.searchKey}"`;
			}
			else {
				text = "No streams available for playback";
			}
		}
		else {
			if (this.searchKey != "") {
				text = `Streams matching "${this.searchKey}" (${this.state.setSize})`;
			}
			else {
				text = `Streams (${this.state.setSize})`;
			}
		}
		headerdiv = <div className="top-margin small-text no-padding">
			{text}
		</div>;

		loaddiv = "";
		if (this.state.moreCount > 0) {
			loaddiv = <div>
				<button className="text-button" onClick={this.loadButtonClicked}>LOAD MORE ({this.state.moreCount})</button>
			</div>;
		}

		return (<div>
			<div>
				<input type="text" size="40" value={this.state.searchKey} onChange={this.searchKeyChanged} onKeyPress={this.searchKeyKeyPressed} />
				<span className="left-padding">&nbsp;</span>
				<button className="icon-button left-margin" onClick={this.searchButtonClicked}><i className="material-icons center-vertical-align">&#xE8B6;</i></button>
				{headerdiv}
			</div>
			<div className="cardview">
				{streams}
			</div>
			{loaddiv}
		</div>);
	}

	searchKeyChanged (event) {
		this.setState ({ searchKey: event.target.value });
	}

	searchKeyKeyPressed (event) {
		if (event.key === "Enter") {
			this.searchKey = this.state.searchKey;
			this.resultOffset = 0;
			this.load ();
		}
	}

	searchButtonClicked (event) {
		this.searchKey = this.state.searchKey;
		this.resultOffset = 0;
		this.load ();
	}

	loadButtonClicked (event) {
		this.resultOffset += this.pageSize;
		this.load ();
	}

	cardClicked (stream) {
		window.open (`/play?${stream.id}`, "_self");
	}

	load () {
		window.superagent.post ("/media-data")
			.set ("Content-Type", "application/json")
			.set ("Accept", "application/json")
			.send (SystemInterface.createCommand ({ }, "FindStreamItems", {
				searchKey: (this.searchKey != "") ? this.searchKey : "*",
				resultOffset: this.resultOffset,
				maxResults: this.pageSize
			}))
			.end ((err, res) => {
				let cmd, streams, morecount;

				if (err != null) {
					console.log (`Failed to get stream data: ${err}`);
					return;
				}
				try {
					cmd = JSON.parse (res.text);
					if ((cmd.command != SystemInterface.CommandId.FindStreamItemsResult) || (cmd.params.streams == null)) {
						throw Error ("Invalid server response");
					}
				}
				catch (e) {
					console.log (`Failed to get stream data: ${e}`);
					return;
				}

				if (cmd.params.resultOffset <= 0) {
					streams = cmd.params.streams;
				}
				else {
					streams = this.state.streams;
					streams.push.apply (streams, cmd.params.streams);
				}
				morecount = cmd.params.setSize - streams.length;
				if (morecount < 0) {
					morecount = 0;
				}
				this.setState ({
					streams: streams,
					setSize: cmd.params.setSize,
					moreCount: morecount
				});
			});
	}
}

function main () {
	ReactDOM.render (<IndexDiv />, document.getElementById ("index-div"));
}
