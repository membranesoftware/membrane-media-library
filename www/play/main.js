function main () {
	let playerWidth, id;

	playerWidth = 640;
	id = `${document.location.search}`;
	id = id.substring (1);
	window.superagent.post ("/media-data")
		.set ("Content-Type", "application/json")
		.set ("Accept", "application/json")
		.send (SystemInterface.createCommand ({ }, "GetStreamItem", SystemInterface.Constant.Stream, {
			streamId: id
		}))
		.end ((err, res) => {
			let stream, cmd, srcurl, player, w, h, text, video;

			if (err != null) {
				console.log (`Failed to get media data: ${err}`);
				return;
			}

			try {
				stream = JSON.parse (res.text);
				if (stream.command != SystemInterface.CommandId.StreamItem) {
					throw Error ();
				}
			}
			catch (e) {
				console.log (`Failed to get media data: received non-parsing response`);
				return;
			}

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

			video = document.createElement ("video");
			if ((typeof video.canPlayType == "function") && video.canPlayType ("application/x-mpegURL")) {
				cmd = SystemInterface.createCommand ({ }, "GetHlsManifest", SystemInterface.Constant.Stream, {
					streamId: stream.params.id
				});
				srcurl = `/str/b.m3u8?${SystemInterface.Constant.UrlQueryParameter}=${encodeURIComponent (JSON.stringify (cmd))}`;
				setElementProperty ("video-player", "src", srcurl);
			}
			else {
				cmd = SystemInterface.createCommand ({ }, "GetDashMpd", SystemInterface.Constant.Stream, {
					streamId: stream.params.id
				});
				srcurl = `/str/e.mpd?${SystemInterface.Constant.UrlQueryParameter}=${encodeURIComponent (JSON.stringify (cmd))}`;
				player = dashjs.MediaPlayer ().create ();
				player.initialize (document.querySelector ("#video-player"), srcurl, true);
			}
		});
}
