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
function main () {
	let playerWidth, id;

	playerWidth = 640;
	id = `${document.location.search}`;
	id = id.substring (1);
	window.superagent.post ("/media-data")
		.set ("Content-Type", "application/json")
		.set ("Accept", "application/json")
		.send (SystemInterface.createCommand ({ }, "GetStreamItem", {
			streamId: id
		}))
		.end ((err, res) => {
			let stream, cmd, srcurl, player, w, h, text, video;

			if (err != null) {
				console.log (`Failed to get stream data: ${err}`);
				return;
			}
			try {
				stream = JSON.parse (res.text);
				if (stream.command != SystemInterface.CommandId.StreamItem) {
					throw Error ("Invalid server response");
				}
			}
			catch (e) {
				console.log (`Failed to get stream data: ${e}`);
				return;
			}

			document.title = `Membrane Media Library - ${stream.params.name}`;
			setElementProperty ("title-header", "innerHTML", stream.params.name);

			text = "";
			w = stream.params.width;
			h = stream.params.height;
			if ((w > 0) && (h > 0)) {
				text += ` ${w}x${h}`;
				h *= playerWidth;
				h /= w;
				h = Math.floor (h);
				w = playerWidth;
				setElementStyle ("video-player", "width", `${w}px`);
				setElementStyle ("video-player", "height", `${h}px`);
			}
			if (stream.params.bitrate > 0) {
				text += ` ${Math.floor (stream.params.bitrate / 1024)}kbps`;
			}
			if (stream.params.frameRate > 0) {
				text += ` ${stream.params.frameRate}fps`;
			}
			setElementProperty ("detail-div", "innerHTML", text);

			if ((stream.params.tags != null) && (stream.params.tags.length > 0)) {
				setElementProperty ("tags-div", "innerHTML", stream.params.tags.join (", "));
			}
			else {
				setElementProperty ("tags-div", "innerHTML", "(none)");
			}

			video = document.createElement ("video");
			if ((typeof video.canPlayType == "function") && video.canPlayType ("application/x-mpegURL")) {
				cmd = SystemInterface.createCommand ({ }, "GetHlsManifest", {
					streamId: stream.params.id
				});
				srcurl = `/str/b.m3u8?${SystemInterface.Constant.UrlQueryParameter}=${encodeURIComponent (JSON.stringify (cmd))}`;
				setElementProperty ("video-player", "src", srcurl);
			}
			else {
				cmd = SystemInterface.createCommand ({ }, "GetDashMpd", {
					streamId: stream.params.id
				});
				srcurl = `/str/e.mpd?${SystemInterface.Constant.UrlQueryParameter}=${encodeURIComponent (JSON.stringify (cmd))}`;
				player = dashjs.MediaPlayer ().create ();
				player.initialize (document.querySelector ("#video-player"), srcurl, true);
			}
		});
}
