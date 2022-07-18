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
// Functions for use in sending or receiving remote commands

var SystemInterface = exports;
SystemInterface.Version = "25-stable-71094b9f";
SystemInterface.Command = { };
SystemInterface.Command.AddMediaTag = {"id":233,"name":"AddMediaTag","paramType":"AddMediaTag"};
SystemInterface.Command.AgentConfiguration = {"id":45,"name":"AgentConfiguration","paramType":"AgentConfiguration"};
SystemInterface.Command.AgentContact = {"id":33,"name":"AgentContact","paramType":"AgentContact"};
SystemInterface.Command.AgentStatus = {"id":1,"name":"AgentStatus","paramType":"AgentStatus"};
SystemInterface.Command.ApplicationNews = {"id":64,"name":"ApplicationNews","paramType":"ApplicationNews"};
SystemInterface.Command.AuthorizationRequired = {"id":62,"name":"AuthorizationRequired","paramType":"EmptyObject"};
SystemInterface.Command.Authorize = {"id":19,"name":"Authorize","paramType":"Authorize"};
SystemInterface.Command.AuthorizeResult = {"id":13,"name":"AuthorizeResult","paramType":"AuthorizeResult"};
SystemInterface.Command.CancelTask = {"id":28,"name":"CancelTask","paramType":"CancelTask"};
SystemInterface.Command.ClearCache = {"id":59,"name":"ClearCache","paramType":"EmptyObject"};
SystemInterface.Command.CommandResult = {"id":0,"name":"CommandResult","paramType":"CommandResult"};
SystemInterface.Command.ConfigureMediaStream = {"id":65,"name":"ConfigureMediaStream","paramType":"ConfigureMediaStream"};
SystemInterface.Command.CreateMediaStream = {"id":14,"name":"CreateMediaStream","paramType":"CreateMediaStream"};
SystemInterface.Command.EndSet = {"id":21,"name":"EndSet","paramType":"EmptyObject"};
SystemInterface.Command.FindMediaItems = {"id":3,"name":"FindMediaItems","paramType":"FindMediaItems"};
SystemInterface.Command.FindMediaItemsResult = {"id":48,"name":"FindMediaItemsResult","paramType":"FindMediaItemsResult"};
SystemInterface.Command.FindMediaStreams = {"id":78,"name":"FindMediaStreams","paramType":"FindMediaStreams"};
SystemInterface.Command.FindMediaStreamsResult = {"id":79,"name":"FindMediaStreamsResult","paramType":"FindMediaStreamsResult"};
SystemInterface.Command.FindStreamItems = {"id":211,"name":"FindStreamItems","paramType":"FindStreamItems"};
SystemInterface.Command.FindStreamItemsResult = {"id":4,"name":"FindStreamItemsResult","paramType":"FindStreamItemsResult"};
SystemInterface.Command.GetAgentConfiguration = {"id":44,"name":"GetAgentConfiguration","paramType":"EmptyObject"};
SystemInterface.Command.GetDashMpd = {"id":67,"name":"GetDashMpd","paramType":"GetDashMpd"};
SystemInterface.Command.GetDashSegment = {"id":68,"name":"GetDashSegment","paramType":"GetDashSegment"};
SystemInterface.Command.GetHlsManifest = {"id":23,"name":"GetHlsManifest","paramType":"GetHlsManifest"};
SystemInterface.Command.GetHlsSegment = {"id":24,"name":"GetHlsSegment","paramType":"GetHlsSegment"};
SystemInterface.Command.GetMedia = {"id":15,"name":"GetMedia","paramType":"GetMedia"};
SystemInterface.Command.GetStatus = {"id":8,"name":"GetStatus","paramType":"EmptyObject"};
SystemInterface.Command.GetStreamItem = {"id":25,"name":"GetStreamItem","paramType":"GetStreamItem"};
SystemInterface.Command.GetThumbnailImage = {"id":5,"name":"GetThumbnailImage","paramType":"GetThumbnailImage"};
SystemInterface.Command.IntentState = {"id":36,"name":"IntentState","paramType":"IntentState"};
SystemInterface.Command.LinkSuccess = {"id":63,"name":"LinkSuccess","paramType":"EmptyObject"};
SystemInterface.Command.MediaItem = {"id":16,"name":"MediaItem","paramType":"MediaItem"};
SystemInterface.Command.MediaServerStatus = {"id":9,"name":"MediaServerStatus","paramType":"MediaServerStatus"};
SystemInterface.Command.ReadTasks = {"id":6,"name":"ReadTasks","paramType":"EmptyObject"};
SystemInterface.Command.RemoveIntent = {"id":37,"name":"RemoveIntent","paramType":"RemoveIntent"};
SystemInterface.Command.RemoveMedia = {"id":77,"name":"RemoveMedia","paramType":"RemoveMedia"};
SystemInterface.Command.RemoveMediaTag = {"id":234,"name":"RemoveMediaTag","paramType":"RemoveMediaTag"};
SystemInterface.Command.RemoveStream = {"id":29,"name":"RemoveStream","paramType":"RemoveStream"};
SystemInterface.Command.ReportContact = {"id":32,"name":"ReportContact","paramType":"ReportContact"};
SystemInterface.Command.ReportStatus = {"id":2,"name":"ReportStatus","paramType":"ReportStatus"};
SystemInterface.Command.ScanMediaItems = {"id":58,"name":"ScanMediaItems","paramType":"EmptyObject"};
SystemInterface.Command.ServerError = {"id":20,"name":"ServerError","paramType":"ServerError"};
SystemInterface.Command.SetAdminSecret = {"id":61,"name":"SetAdminSecret","paramType":"SetAdminSecret"};
SystemInterface.Command.SetIntentActive = {"id":38,"name":"SetIntentActive","paramType":"SetIntentActive"};
SystemInterface.Command.ShutdownAgent = {"id":43,"name":"ShutdownAgent","paramType":"EmptyObject"};
SystemInterface.Command.StartServers = {"id":47,"name":"StartServers","paramType":"EmptyObject"};
SystemInterface.Command.StopServers = {"id":46,"name":"StopServers","paramType":"EmptyObject"};
SystemInterface.Command.StreamItem = {"id":22,"name":"StreamItem","paramType":"StreamItem"};
SystemInterface.Command.StreamServerStatus = {"id":10,"name":"StreamServerStatus","paramType":"StreamServerStatus"};
SystemInterface.Command.TaskItem = {"id":26,"name":"TaskItem","paramType":"TaskItem"};
SystemInterface.Command.UpdateAgentConfiguration = {"id":42,"name":"UpdateAgentConfiguration","paramType":"UpdateAgentConfiguration"};
SystemInterface.Command.UpdateIntentState = {"id":39,"name":"UpdateIntentState","paramType":"UpdateIntentState"};
SystemInterface.Command.WatchStatus = {"id":82,"name":"WatchStatus","paramType":"EmptyObject"};
SystemInterface.Command.WatchTasks = {"id":7,"name":"WatchTasks","paramType":"WatchTasks"};
SystemInterface.CommandId = { };
SystemInterface.CommandId.AddMediaTag = 233;
SystemInterface.CommandId.AgentConfiguration = 45;
SystemInterface.CommandId.AgentContact = 33;
SystemInterface.CommandId.AgentStatus = 1;
SystemInterface.CommandId.ApplicationNews = 64;
SystemInterface.CommandId.AuthorizationRequired = 62;
SystemInterface.CommandId.Authorize = 19;
SystemInterface.CommandId.AuthorizeResult = 13;
SystemInterface.CommandId.CancelTask = 28;
SystemInterface.CommandId.ClearCache = 59;
SystemInterface.CommandId.CommandResult = 0;
SystemInterface.CommandId.ConfigureMediaStream = 65;
SystemInterface.CommandId.CreateMediaStream = 14;
SystemInterface.CommandId.EndSet = 21;
SystemInterface.CommandId.FindMediaItems = 3;
SystemInterface.CommandId.FindMediaItemsResult = 48;
SystemInterface.CommandId.FindMediaStreams = 78;
SystemInterface.CommandId.FindMediaStreamsResult = 79;
SystemInterface.CommandId.FindStreamItems = 211;
SystemInterface.CommandId.FindStreamItemsResult = 4;
SystemInterface.CommandId.GetAgentConfiguration = 44;
SystemInterface.CommandId.GetDashMpd = 67;
SystemInterface.CommandId.GetDashSegment = 68;
SystemInterface.CommandId.GetHlsManifest = 23;
SystemInterface.CommandId.GetHlsSegment = 24;
SystemInterface.CommandId.GetMedia = 15;
SystemInterface.CommandId.GetStatus = 8;
SystemInterface.CommandId.GetStreamItem = 25;
SystemInterface.CommandId.GetThumbnailImage = 5;
SystemInterface.CommandId.IntentState = 36;
SystemInterface.CommandId.LinkSuccess = 63;
SystemInterface.CommandId.MediaItem = 16;
SystemInterface.CommandId.MediaServerStatus = 9;
SystemInterface.CommandId.ReadTasks = 6;
SystemInterface.CommandId.RemoveIntent = 37;
SystemInterface.CommandId.RemoveMedia = 77;
SystemInterface.CommandId.RemoveMediaTag = 234;
SystemInterface.CommandId.RemoveStream = 29;
SystemInterface.CommandId.ReportContact = 32;
SystemInterface.CommandId.ReportStatus = 2;
SystemInterface.CommandId.ScanMediaItems = 58;
SystemInterface.CommandId.ServerError = 20;
SystemInterface.CommandId.SetAdminSecret = 61;
SystemInterface.CommandId.SetIntentActive = 38;
SystemInterface.CommandId.ShutdownAgent = 43;
SystemInterface.CommandId.StartServers = 47;
SystemInterface.CommandId.StopServers = 46;
SystemInterface.CommandId.StreamItem = 22;
SystemInterface.CommandId.StreamServerStatus = 10;
SystemInterface.CommandId.TaskItem = 26;
SystemInterface.CommandId.UpdateAgentConfiguration = 42;
SystemInterface.CommandId.UpdateIntentState = 39;
SystemInterface.CommandId.WatchStatus = 82;
SystemInterface.CommandId.WatchTasks = 7;
SystemInterface.CommandIdMap = { };
SystemInterface.CommandIdMap["233"] = SystemInterface.Command.AddMediaTag;
SystemInterface.CommandIdMap["45"] = SystemInterface.Command.AgentConfiguration;
SystemInterface.CommandIdMap["33"] = SystemInterface.Command.AgentContact;
SystemInterface.CommandIdMap["1"] = SystemInterface.Command.AgentStatus;
SystemInterface.CommandIdMap["64"] = SystemInterface.Command.ApplicationNews;
SystemInterface.CommandIdMap["62"] = SystemInterface.Command.AuthorizationRequired;
SystemInterface.CommandIdMap["19"] = SystemInterface.Command.Authorize;
SystemInterface.CommandIdMap["13"] = SystemInterface.Command.AuthorizeResult;
SystemInterface.CommandIdMap["28"] = SystemInterface.Command.CancelTask;
SystemInterface.CommandIdMap["59"] = SystemInterface.Command.ClearCache;
SystemInterface.CommandIdMap["0"] = SystemInterface.Command.CommandResult;
SystemInterface.CommandIdMap["65"] = SystemInterface.Command.ConfigureMediaStream;
SystemInterface.CommandIdMap["14"] = SystemInterface.Command.CreateMediaStream;
SystemInterface.CommandIdMap["21"] = SystemInterface.Command.EndSet;
SystemInterface.CommandIdMap["3"] = SystemInterface.Command.FindMediaItems;
SystemInterface.CommandIdMap["48"] = SystemInterface.Command.FindMediaItemsResult;
SystemInterface.CommandIdMap["78"] = SystemInterface.Command.FindMediaStreams;
SystemInterface.CommandIdMap["79"] = SystemInterface.Command.FindMediaStreamsResult;
SystemInterface.CommandIdMap["211"] = SystemInterface.Command.FindStreamItems;
SystemInterface.CommandIdMap["4"] = SystemInterface.Command.FindStreamItemsResult;
SystemInterface.CommandIdMap["44"] = SystemInterface.Command.GetAgentConfiguration;
SystemInterface.CommandIdMap["67"] = SystemInterface.Command.GetDashMpd;
SystemInterface.CommandIdMap["68"] = SystemInterface.Command.GetDashSegment;
SystemInterface.CommandIdMap["23"] = SystemInterface.Command.GetHlsManifest;
SystemInterface.CommandIdMap["24"] = SystemInterface.Command.GetHlsSegment;
SystemInterface.CommandIdMap["15"] = SystemInterface.Command.GetMedia;
SystemInterface.CommandIdMap["8"] = SystemInterface.Command.GetStatus;
SystemInterface.CommandIdMap["25"] = SystemInterface.Command.GetStreamItem;
SystemInterface.CommandIdMap["5"] = SystemInterface.Command.GetThumbnailImage;
SystemInterface.CommandIdMap["36"] = SystemInterface.Command.IntentState;
SystemInterface.CommandIdMap["63"] = SystemInterface.Command.LinkSuccess;
SystemInterface.CommandIdMap["16"] = SystemInterface.Command.MediaItem;
SystemInterface.CommandIdMap["9"] = SystemInterface.Command.MediaServerStatus;
SystemInterface.CommandIdMap["6"] = SystemInterface.Command.ReadTasks;
SystemInterface.CommandIdMap["37"] = SystemInterface.Command.RemoveIntent;
SystemInterface.CommandIdMap["77"] = SystemInterface.Command.RemoveMedia;
SystemInterface.CommandIdMap["234"] = SystemInterface.Command.RemoveMediaTag;
SystemInterface.CommandIdMap["29"] = SystemInterface.Command.RemoveStream;
SystemInterface.CommandIdMap["32"] = SystemInterface.Command.ReportContact;
SystemInterface.CommandIdMap["2"] = SystemInterface.Command.ReportStatus;
SystemInterface.CommandIdMap["58"] = SystemInterface.Command.ScanMediaItems;
SystemInterface.CommandIdMap["20"] = SystemInterface.Command.ServerError;
SystemInterface.CommandIdMap["61"] = SystemInterface.Command.SetAdminSecret;
SystemInterface.CommandIdMap["38"] = SystemInterface.Command.SetIntentActive;
SystemInterface.CommandIdMap["43"] = SystemInterface.Command.ShutdownAgent;
SystemInterface.CommandIdMap["47"] = SystemInterface.Command.StartServers;
SystemInterface.CommandIdMap["46"] = SystemInterface.Command.StopServers;
SystemInterface.CommandIdMap["22"] = SystemInterface.Command.StreamItem;
SystemInterface.CommandIdMap["10"] = SystemInterface.Command.StreamServerStatus;
SystemInterface.CommandIdMap["26"] = SystemInterface.Command.TaskItem;
SystemInterface.CommandIdMap["42"] = SystemInterface.Command.UpdateAgentConfiguration;
SystemInterface.CommandIdMap["39"] = SystemInterface.Command.UpdateIntentState;
SystemInterface.CommandIdMap["82"] = SystemInterface.Command.WatchStatus;
SystemInterface.CommandIdMap["7"] = SystemInterface.Command.WatchTasks;
SystemInterface.Type = { };
SystemInterface.Type.AddMediaTag = [{"name":"mediaId","type":"string","flags":35},{"name":"tag","type":"string","flags":3}];
SystemInterface.Type.AgentConfiguration = [{"name":"isEnabled","type":"boolean","flags":0},{"name":"displayName","type":"string","flags":3},{"name":"mediaServerConfiguration","type":"MediaServerConfiguration","flags":0},{"name":"streamServerConfiguration","type":"StreamServerConfiguration","flags":0}];
SystemInterface.Type.AgentContact = [{"name":"id","type":"string","flags":35},{"name":"urlHostname","type":"string","flags":5},{"name":"tcpPort1","type":"number","flags":129,"rangeMin":0,"rangeMax":65535},{"name":"tcpPort2","type":"number","flags":129,"rangeMin":0,"rangeMax":65535},{"name":"udpPort","type":"number","flags":129,"rangeMin":0,"rangeMax":65535},{"name":"version","type":"string","flags":3},{"name":"nodeVersion","type":"string","flags":0,"defaultValue":""}];
SystemInterface.Type.AgentStatus = [{"name":"id","type":"string","flags":35},{"name":"displayName","type":"string","flags":3},{"name":"applicationName","type":"string","flags":3},{"name":"urlHostname","type":"string","flags":5},{"name":"tcpPort1","type":"number","flags":129,"rangeMin":0,"rangeMax":65535},{"name":"tcpPort2","type":"number","flags":129,"rangeMin":0,"rangeMax":65535},{"name":"udpPort","type":"number","flags":129,"rangeMin":0,"rangeMax":65535},{"name":"linkPath","type":"string","flags":1,"defaultValue":""},{"name":"uptime","type":"string","flags":1,"defaultValue":""},{"name":"startTime","type":"number","flags":16},{"name":"runDuration","type":"number","flags":16},{"name":"version","type":"string","flags":3},{"name":"nodeVersion","type":"string","flags":0,"defaultValue":""},{"name":"platform","type":"string","flags":0,"defaultValue":""},{"name":"isEnabled","type":"boolean","flags":1},{"name":"taskCount","type":"number","flags":17},{"name":"runTaskName","type":"string","flags":0},{"name":"runTaskSubtitle","type":"string","flags":0},{"name":"runTaskPercentComplete","type":"number","flags":128,"rangeMin":0,"rangeMax":100},{"name":"runCount","type":"number","flags":17},{"name":"maxRunCount","type":"number","flags":17},{"name":"mediaServerStatus","type":"MediaServerStatus","flags":0},{"name":"streamServerStatus","type":"StreamServerStatus","flags":0}];
SystemInterface.Type.ApplicationNews = [{"name":"items","type":"array","containerType":"ApplicationNewsItem","flags":1}];
SystemInterface.Type.ApplicationNewsItem = [{"name":"message","type":"string","flags":3},{"name":"iconType","type":"string","flags":0},{"name":"actionText","type":"string","flags":0},{"name":"actionType","type":"string","flags":0},{"name":"actionTarget","type":"string","flags":0}];
SystemInterface.Type.Authorize = [{"name":"token","type":"string","flags":3}];
SystemInterface.Type.AuthorizeResult = [{"name":"token","type":"string","flags":3}];
SystemInterface.Type.CancelTask = [{"name":"taskId","type":"string","flags":35}];
SystemInterface.Type.CommandResult = [{"name":"success","type":"boolean","flags":1},{"name":"error","type":"string","flags":0},{"name":"itemId","type":"string","flags":32},{"name":"item","type":"object","flags":256},{"name":"taskId","type":"string","flags":32},{"name":"stringResult","type":"string","flags":0}];
SystemInterface.Type.ConfigureMediaStream = [{"name":"mediaId","type":"string","flags":35},{"name":"mediaServerAgentId","type":"string","flags":34},{"name":"mediaUrl","type":"string","flags":65,"defaultValue":""},{"name":"streamName","type":"string","flags":1},{"name":"mediaWidth","type":"number","flags":8},{"name":"mediaHeight","type":"number","flags":8},{"name":"profile","type":"number","flags":17,"defaultValue":0}];
SystemInterface.Type.CreateMediaStream = [{"name":"name","type":"string","flags":1},{"name":"mediaServerAgentId","type":"string","flags":34},{"name":"mediaId","type":"string","flags":35},{"name":"mediaUrl","type":"string","flags":65,"defaultValue":""},{"name":"width","type":"number","flags":8},{"name":"height","type":"number","flags":8},{"name":"profile","type":"number","flags":17,"defaultValue":0}];
SystemInterface.Type.EmptyObject = [];
SystemInterface.Type.FindMediaItems = [{"name":"searchKey","type":"string","flags":1,"defaultValue":"*"},{"name":"resultOffset","type":"number","flags":17,"defaultValue":0},{"name":"maxResults","type":"number","flags":17,"defaultValue":0},{"name":"sortOrder","type":"number","flags":17,"defaultValue":0}];
SystemInterface.Type.FindMediaItemsResult = [{"name":"searchKey","type":"string","flags":1},{"name":"setSize","type":"number","flags":17,"defaultValue":0},{"name":"resultOffset","type":"number","flags":17,"defaultValue":0}];
SystemInterface.Type.FindMediaStreams = [{"name":"sourceIds","type":"array","containerType":"string","flags":35}];
SystemInterface.Type.FindMediaStreamsResult = [{"name":"mediaId","type":"string","flags":35},{"name":"streams","type":"array","containerType":"object","flags":257}];
SystemInterface.Type.FindStreamItems = [{"name":"searchKey","type":"string","flags":1,"defaultValue":"*"},{"name":"resultOffset","type":"number","flags":17,"defaultValue":0},{"name":"maxResults","type":"number","flags":17,"defaultValue":0},{"name":"sortOrder","type":"number","flags":17,"defaultValue":0}];
SystemInterface.Type.FindStreamItemsResult = [{"name":"searchKey","type":"string","flags":1},{"name":"setSize","type":"number","flags":17,"defaultValue":0},{"name":"resultOffset","type":"number","flags":17,"defaultValue":0},{"name":"streams","type":"array","containerType":"StreamSummary","flags":0}];
SystemInterface.Type.GetDashMpd = [{"name":"streamId","type":"string","flags":35}];
SystemInterface.Type.GetDashSegment = [{"name":"streamId","type":"string","flags":35},{"name":"representationIndex","type":"number","flags":17},{"name":"segmentIndex","type":"number","flags":17}];
SystemInterface.Type.GetHlsManifest = [{"name":"streamId","type":"string","flags":35},{"name":"startPosition","type":"number","flags":17,"defaultValue":0},{"name":"minStartPositionDelta","type":"number","flags":128,"rangeMin":0,"rangeMax":100},{"name":"maxStartPositionDelta","type":"number","flags":128,"rangeMin":0,"rangeMax":100}];
SystemInterface.Type.GetHlsSegment = [{"name":"streamId","type":"string","flags":35},{"name":"segmentIndex","type":"number","flags":17,"defaultValue":0}];
SystemInterface.Type.GetMedia = [{"name":"id","type":"string","flags":35}];
SystemInterface.Type.GetStreamItem = [{"name":"streamId","type":"string","flags":35}];
SystemInterface.Type.GetThumbnailImage = [{"name":"id","type":"string","flags":35},{"name":"thumbnailIndex","type":"number","flags":17,"defaultValue":0}];
SystemInterface.Type.IntentState = [{"name":"id","type":"string","flags":35},{"name":"name","type":"string","flags":3},{"name":"groupName","type":"string","flags":1,"defaultValue":""},{"name":"displayName","type":"string","flags":1,"defaultValue":""},{"name":"isActive","type":"boolean","flags":1},{"name":"conditions","type":"array","containerType":"object","flags":0},{"name":"state","type":"object","flags":1}];
SystemInterface.Type.MediaItem = [{"name":"id","type":"string","flags":35},{"name":"name","type":"string","flags":3},{"name":"mediaPath","type":"string","flags":1},{"name":"mtime","type":"number","flags":17,"defaultValue":0},{"name":"duration","type":"number","flags":17},{"name":"frameRate","type":"number","flags":17},{"name":"width","type":"number","flags":17},{"name":"height","type":"number","flags":17},{"name":"size","type":"number","flags":17},{"name":"bitrate","type":"number","flags":17},{"name":"isCreateStreamAvailable","type":"boolean","flags":1,"defaultValue":true},{"name":"tags","type":"array","containerType":"string","flags":2},{"name":"sortKey","type":"string","flags":0}];
SystemInterface.Type.MediaServerConfiguration = [{"name":"mediaPath","type":"string","flags":2},{"name":"dataPath","type":"string","flags":2},{"name":"scanPeriod","type":"number","flags":16}];
SystemInterface.Type.MediaServerStatus = [{"name":"isReady","type":"boolean","flags":1},{"name":"mediaCount","type":"number","flags":17},{"name":"mediaPath","type":"string","flags":65},{"name":"thumbnailPath","type":"string","flags":65,"defaultValue":""},{"name":"thumbnailCount","type":"number","flags":17,"defaultValue":0}];
SystemInterface.Type.RemoveIntent = [{"name":"id","type":"string","flags":35}];
SystemInterface.Type.RemoveMedia = [{"name":"id","type":"string","flags":35}];
SystemInterface.Type.RemoveMediaTag = [{"name":"mediaId","type":"string","flags":35},{"name":"tag","type":"string","flags":3}];
SystemInterface.Type.RemoveStream = [{"name":"id","type":"string","flags":35}];
SystemInterface.Type.ReportContact = [{"name":"destination","type":"string","flags":65}];
SystemInterface.Type.ReportStatus = [{"name":"destination","type":"string","flags":65}];
SystemInterface.Type.ServerError = [{"name":"error","type":"string","flags":0,"defaultValue":""}];
SystemInterface.Type.SetAdminSecret = [{"name":"secret","type":"string","flags":1}];
SystemInterface.Type.SetIntentActive = [{"name":"id","type":"string","flags":35},{"name":"isActive","type":"boolean","flags":1}];
SystemInterface.Type.StreamItem = [{"name":"id","type":"string","flags":35},{"name":"name","type":"string","flags":3},{"name":"sourceId","type":"string","flags":33,"defaultValue":""},{"name":"duration","type":"number","flags":17},{"name":"width","type":"number","flags":17},{"name":"height","type":"number","flags":17},{"name":"size","type":"number","flags":17},{"name":"bitrate","type":"number","flags":17},{"name":"frameRate","type":"number","flags":17},{"name":"profile","type":"number","flags":17,"defaultValue":0},{"name":"hlsTargetDuration","type":"number","flags":17},{"name":"segmentCount","type":"number","flags":17},{"name":"segmentFilenames","type":"array","containerType":"string","flags":1},{"name":"segmentLengths","type":"array","containerType":"number","flags":17},{"name":"segmentPositions","type":"array","containerType":"number","flags":17},{"name":"tags","type":"array","containerType":"string","flags":2}];
SystemInterface.Type.StreamServerConfiguration = [{"name":"dataPath","type":"string","flags":2}];
SystemInterface.Type.StreamServerStatus = [{"name":"isReady","type":"boolean","flags":1},{"name":"streamCount","type":"number","flags":17},{"name":"freeStorage","type":"number","flags":17},{"name":"totalStorage","type":"number","flags":17},{"name":"hlsStreamPath","type":"string","flags":1},{"name":"thumbnailPath","type":"string","flags":1},{"name":"htmlPlayerPath","type":"string","flags":1},{"name":"htmlCatalogPath","type":"string","flags":1}];
SystemInterface.Type.StreamSummary = [{"name":"id","type":"string","flags":35},{"name":"name","type":"string","flags":3},{"name":"duration","type":"number","flags":17},{"name":"width","type":"number","flags":17},{"name":"height","type":"number","flags":17},{"name":"size","type":"number","flags":17},{"name":"bitrate","type":"number","flags":17},{"name":"frameRate","type":"number","flags":17},{"name":"profile","type":"number","flags":17,"defaultValue":0},{"name":"segmentCount","type":"number","flags":17}];
SystemInterface.Type.TaskItem = [{"name":"id","type":"string","flags":33},{"name":"name","type":"string","flags":3},{"name":"subtitle","type":"string","flags":1,"defaultValue":""},{"name":"isRunning","type":"boolean","flags":1},{"name":"percentComplete","type":"number","flags":129,"rangeMin":0,"rangeMax":100,"defaultValue":0},{"name":"createTime","type":"number","flags":9},{"name":"endTime","type":"number","flags":17}];
SystemInterface.Type.UpdateAgentConfiguration = [{"name":"agentConfiguration","type":"AgentConfiguration","flags":1}];
SystemInterface.Type.UpdateIntentState = [{"name":"id","type":"string","flags":35},{"name":"state","type":"object","flags":1},{"name":"isReplace","type":"boolean","flags":1,"defaultValue":false}];
SystemInterface.Type.WatchTasks = [{"name":"taskIds","type":"array","containerType":"string","flags":35}];
SystemInterface.Type.AddMediaTag.updateHash = function (p, f) {f (p.mediaId);f (p.tag);};
SystemInterface.Type.AgentConfiguration.updateHash = function (p, f) {f (p.displayName);f (p.isEnabled ? "true" : "false");if ((typeof p.mediaServerConfiguration == "object") && (p.mediaServerConfiguration != null)) {SystemInterface.Type.MediaServerConfiguration.updateHash(p.mediaServerConfiguration, f);}if ((typeof p.streamServerConfiguration == "object") && (p.streamServerConfiguration != null)) {SystemInterface.Type.StreamServerConfiguration.updateHash(p.streamServerConfiguration, f);}};
SystemInterface.Type.AgentContact.updateHash = function (p, f) {f (p.id);if (typeof p.nodeVersion == "string") {f (p.nodeVersion);}f ("" + Math.trunc (p.tcpPort1));f ("" + Math.trunc (p.tcpPort2));f ("" + Math.trunc (p.udpPort));f (p.urlHostname);f (p.version);};
SystemInterface.Type.AgentStatus.updateHash = function (p, f) {f (p.applicationName);f (p.displayName);f (p.id);f (p.isEnabled ? "true" : "false");f (p.linkPath);f ("" + Math.trunc (p.maxRunCount));if ((typeof p.mediaServerStatus == "object") && (p.mediaServerStatus != null)) {SystemInterface.Type.MediaServerStatus.updateHash(p.mediaServerStatus, f);}if (typeof p.nodeVersion == "string") {f (p.nodeVersion);}if (typeof p.platform == "string") {f (p.platform);}f ("" + Math.trunc (p.runCount));if (typeof p.runDuration == "number") {f ("" + Math.trunc (p.runDuration));}if (typeof p.runTaskName == "string") {f (p.runTaskName);}if (typeof p.runTaskPercentComplete == "number") {f ("" + Math.trunc (p.runTaskPercentComplete));}if (typeof p.runTaskSubtitle == "string") {f (p.runTaskSubtitle);}if (typeof p.startTime == "number") {f ("" + Math.trunc (p.startTime));}if ((typeof p.streamServerStatus == "object") && (p.streamServerStatus != null)) {SystemInterface.Type.StreamServerStatus.updateHash(p.streamServerStatus, f);}f ("" + Math.trunc (p.taskCount));f ("" + Math.trunc (p.tcpPort1));f ("" + Math.trunc (p.tcpPort2));f ("" + Math.trunc (p.udpPort));f (p.uptime);f (p.urlHostname);f (p.version);};
SystemInterface.Type.ApplicationNews.updateHash = function (p, f) {var i;for (i = 0; i < p.items.length; ++i) {SystemInterface.Type.ApplicationNewsItem.updateHash(p.items[i], f);}};
SystemInterface.Type.ApplicationNewsItem.updateHash = function (p, f) {if (typeof p.actionTarget == "string") {f (p.actionTarget);}if (typeof p.actionText == "string") {f (p.actionText);}if (typeof p.actionType == "string") {f (p.actionType);}if (typeof p.iconType == "string") {f (p.iconType);}f (p.message);};
SystemInterface.Type.Authorize.updateHash = function (p, f) {f (p.token);};
SystemInterface.Type.AuthorizeResult.updateHash = function (p, f) {f (p.token);};
SystemInterface.Type.CancelTask.updateHash = function (p, f) {f (p.taskId);};
SystemInterface.Type.CommandResult.updateHash = function (p, f) {if (typeof p.error == "string") {f (p.error);}if (typeof p.itemId == "string") {f (p.itemId);}if (typeof p.stringResult == "string") {f (p.stringResult);}f (p.success ? "true" : "false");if (typeof p.taskId == "string") {f (p.taskId);}};
SystemInterface.Type.ConfigureMediaStream.updateHash = function (p, f) {if (typeof p.mediaHeight == "number") {f ("" + Math.trunc (p.mediaHeight));}f (p.mediaId);if (typeof p.mediaServerAgentId == "string") {f (p.mediaServerAgentId);}f (p.mediaUrl);if (typeof p.mediaWidth == "number") {f ("" + Math.trunc (p.mediaWidth));}f ("" + Math.trunc (p.profile));f (p.streamName);};
SystemInterface.Type.CreateMediaStream.updateHash = function (p, f) {if (typeof p.height == "number") {f ("" + Math.trunc (p.height));}f (p.mediaId);if (typeof p.mediaServerAgentId == "string") {f (p.mediaServerAgentId);}f (p.mediaUrl);f (p.name);f ("" + Math.trunc (p.profile));if (typeof p.width == "number") {f ("" + Math.trunc (p.width));}};
SystemInterface.Type.EmptyObject.updateHash = function (p, f) {};
SystemInterface.Type.FindMediaItems.updateHash = function (p, f) {f ("" + Math.trunc (p.maxResults));f ("" + Math.trunc (p.resultOffset));f (p.searchKey);f ("" + Math.trunc (p.sortOrder));};
SystemInterface.Type.FindMediaItemsResult.updateHash = function (p, f) {f ("" + Math.trunc (p.resultOffset));f (p.searchKey);f ("" + Math.trunc (p.setSize));};
SystemInterface.Type.FindMediaStreams.updateHash = function (p, f) {var i;for (i = 0; i < p.sourceIds.length; ++i) {f (p.sourceIds[i]);}};
SystemInterface.Type.FindMediaStreamsResult.updateHash = function (p, f) {var i;f (p.mediaId);for (i = 0; i < p.streams.length; ++i) {}};
SystemInterface.Type.FindStreamItems.updateHash = function (p, f) {f ("" + Math.trunc (p.maxResults));f ("" + Math.trunc (p.resultOffset));f (p.searchKey);f ("" + Math.trunc (p.sortOrder));};
SystemInterface.Type.FindStreamItemsResult.updateHash = function (p, f) {var i;f ("" + Math.trunc (p.resultOffset));f (p.searchKey);f ("" + Math.trunc (p.setSize));if ((typeof p.streams == "object") && (typeof p.streams.length == "number") && (p.streams != null)) {for (i = 0; i < p.streams.length; ++i) {SystemInterface.Type.StreamSummary.updateHash(p.streams[i], f);}}};
SystemInterface.Type.GetDashMpd.updateHash = function (p, f) {f (p.streamId);};
SystemInterface.Type.GetDashSegment.updateHash = function (p, f) {f ("" + Math.trunc (p.representationIndex));f ("" + Math.trunc (p.segmentIndex));f (p.streamId);};
SystemInterface.Type.GetHlsManifest.updateHash = function (p, f) {if (typeof p.maxStartPositionDelta == "number") {f ("" + Math.trunc (p.maxStartPositionDelta));}if (typeof p.minStartPositionDelta == "number") {f ("" + Math.trunc (p.minStartPositionDelta));}f ("" + Math.trunc (p.startPosition));f (p.streamId);};
SystemInterface.Type.GetHlsSegment.updateHash = function (p, f) {f ("" + Math.trunc (p.segmentIndex));f (p.streamId);};
SystemInterface.Type.GetMedia.updateHash = function (p, f) {f (p.id);};
SystemInterface.Type.GetStreamItem.updateHash = function (p, f) {f (p.streamId);};
SystemInterface.Type.GetThumbnailImage.updateHash = function (p, f) {f (p.id);f ("" + Math.trunc (p.thumbnailIndex));};
SystemInterface.Type.IntentState.updateHash = function (p, f) {var i;if ((typeof p.conditions == "object") && (typeof p.conditions.length == "number") && (p.conditions != null)) {for (i = 0; i < p.conditions.length; ++i) {}}f (p.displayName);f (p.groupName);f (p.id);f (p.isActive ? "true" : "false");f (p.name);};
SystemInterface.Type.MediaItem.updateHash = function (p, f) {var i;f ("" + Math.trunc (p.bitrate));f ("" + Math.trunc (p.duration));f ("" + Math.trunc (p.frameRate));f ("" + Math.trunc (p.height));f (p.id);f (p.isCreateStreamAvailable ? "true" : "false");f (p.mediaPath);f ("" + Math.trunc (p.mtime));f (p.name);f ("" + Math.trunc (p.size));if (typeof p.sortKey == "string") {f (p.sortKey);}if ((typeof p.tags == "object") && (typeof p.tags.length == "number") && (p.tags != null)) {for (i = 0; i < p.tags.length; ++i) {f (p.tags[i]);}}f ("" + Math.trunc (p.width));};
SystemInterface.Type.MediaServerConfiguration.updateHash = function (p, f) {if (typeof p.dataPath == "string") {f (p.dataPath);}if (typeof p.mediaPath == "string") {f (p.mediaPath);}if (typeof p.scanPeriod == "number") {f ("" + Math.trunc (p.scanPeriod));}};
SystemInterface.Type.MediaServerStatus.updateHash = function (p, f) {f (p.isReady ? "true" : "false");f ("" + Math.trunc (p.mediaCount));f (p.mediaPath);f ("" + Math.trunc (p.thumbnailCount));f (p.thumbnailPath);};
SystemInterface.Type.RemoveIntent.updateHash = function (p, f) {f (p.id);};
SystemInterface.Type.RemoveMedia.updateHash = function (p, f) {f (p.id);};
SystemInterface.Type.RemoveMediaTag.updateHash = function (p, f) {f (p.mediaId);f (p.tag);};
SystemInterface.Type.RemoveStream.updateHash = function (p, f) {f (p.id);};
SystemInterface.Type.ReportContact.updateHash = function (p, f) {f (p.destination);};
SystemInterface.Type.ReportStatus.updateHash = function (p, f) {f (p.destination);};
SystemInterface.Type.ServerError.updateHash = function (p, f) {if (typeof p.error == "string") {f (p.error);}};
SystemInterface.Type.SetAdminSecret.updateHash = function (p, f) {f (p.secret);};
SystemInterface.Type.SetIntentActive.updateHash = function (p, f) {f (p.id);f (p.isActive ? "true" : "false");};
SystemInterface.Type.StreamItem.updateHash = function (p, f) {var i;f ("" + Math.trunc (p.bitrate));f ("" + Math.trunc (p.duration));f ("" + Math.trunc (p.frameRate));f ("" + Math.trunc (p.height));f ("" + Math.trunc (p.hlsTargetDuration));f (p.id);f (p.name);f ("" + Math.trunc (p.profile));f ("" + Math.trunc (p.segmentCount));for (i = 0; i < p.segmentFilenames.length; ++i) {f (p.segmentFilenames[i]);}for (i = 0; i < p.segmentLengths.length; ++i) {f ("" + Math.trunc (p.segmentLengths[i]));}for (i = 0; i < p.segmentPositions.length; ++i) {f ("" + Math.trunc (p.segmentPositions[i]));}f ("" + Math.trunc (p.size));f (p.sourceId);if ((typeof p.tags == "object") && (typeof p.tags.length == "number") && (p.tags != null)) {for (i = 0; i < p.tags.length; ++i) {f (p.tags[i]);}}f ("" + Math.trunc (p.width));};
SystemInterface.Type.StreamServerConfiguration.updateHash = function (p, f) {if (typeof p.dataPath == "string") {f (p.dataPath);}};
SystemInterface.Type.StreamServerStatus.updateHash = function (p, f) {f ("" + Math.trunc (p.freeStorage));f (p.hlsStreamPath);f (p.htmlCatalogPath);f (p.htmlPlayerPath);f (p.isReady ? "true" : "false");f ("" + Math.trunc (p.streamCount));f (p.thumbnailPath);f ("" + Math.trunc (p.totalStorage));};
SystemInterface.Type.StreamSummary.updateHash = function (p, f) {f ("" + Math.trunc (p.bitrate));f ("" + Math.trunc (p.duration));f ("" + Math.trunc (p.frameRate));f ("" + Math.trunc (p.height));f (p.id);f (p.name);f ("" + Math.trunc (p.profile));f ("" + Math.trunc (p.segmentCount));f ("" + Math.trunc (p.size));f ("" + Math.trunc (p.width));};
SystemInterface.Type.TaskItem.updateHash = function (p, f) {f ("" + Math.trunc (p.createTime));f ("" + Math.trunc (p.endTime));f (p.id);f (p.isRunning ? "true" : "false");f (p.name);f ("" + Math.trunc (p.percentComplete));f (p.subtitle);};
SystemInterface.Type.UpdateAgentConfiguration.updateHash = function (p, f) {SystemInterface.Type.AgentConfiguration.updateHash(p.agentConfiguration, f);};
SystemInterface.Type.UpdateIntentState.updateHash = function (p, f) {f (p.id);f (p.isReplace ? "true" : "false");};
SystemInterface.Type.WatchTasks.updateHash = function (p, f) {var i;for (i = 0; i < p.taskIds.length; ++i) {f (p.taskIds[i]);}};
SystemInterface.ParamFlag = { };
SystemInterface.ParamFlag.Required = 1;
SystemInterface.ParamFlag.NotEmpty = 2;
SystemInterface.ParamFlag.Hostname = 4;
SystemInterface.ParamFlag.GreaterThanZero = 8;
SystemInterface.ParamFlag.ZeroOrGreater = 16;
SystemInterface.ParamFlag.Uuid = 32;
SystemInterface.ParamFlag.Url = 64;
SystemInterface.ParamFlag.RangedNumber = 128;
SystemInterface.ParamFlag.Command = 256;
SystemInterface.ParamFlag.EnumValue = 512;
SystemInterface.Constant = { };
SystemInterface.Constant.AgentIdPrefixField = "b";
SystemInterface.Constant.AuthorizationHashAlgorithm = "sha256";
SystemInterface.Constant.AuthorizationHashPrefixField = "g";
SystemInterface.Constant.AuthorizationTokenPrefixField = "h";
SystemInterface.Constant.CompressedStreamProfile = 1;
SystemInterface.Constant.CreateTimePrefixField = "a";
SystemInterface.Constant.DefaultAuthorizePath = "C18HZb3wsXQoMQN6Laz8S5Lq";
SystemInterface.Constant.DefaultInvokePath = "/";
SystemInterface.Constant.DefaultLinkPath = "mNODP0RPYCLhTiPGiCifPJA9";
SystemInterface.Constant.DefaultSortOrder = 0;
SystemInterface.Constant.DefaultStreamProfile = 0;
SystemInterface.Constant.DefaultTcpPort1 = 63738;
SystemInterface.Constant.DefaultTcpPort2 = 63739;
SystemInterface.Constant.DefaultUdpPort = 63738;
SystemInterface.Constant.DurationPrefixField = "f";
SystemInterface.Constant.FastPreviewStreamProfile = 10;
SystemInterface.Constant.HighBitrateStreamProfile = 4;
SystemInterface.Constant.LowBitrateStreamProfile = 6;
SystemInterface.Constant.LowQualityStreamProfile = 2;
SystemInterface.Constant.LowestBitrateStreamProfile = 7;
SystemInterface.Constant.LowestQualityStreamProfile = 3;
SystemInterface.Constant.MaxCommandPriority = 100;
SystemInterface.Constant.MediumBitrateStreamProfile = 5;
SystemInterface.Constant.NameSort = 0;
SystemInterface.Constant.NewestSort = 1;
SystemInterface.Constant.PreviewStreamProfile = 9;
SystemInterface.Constant.PriorityPrefixField = "d";
SystemInterface.Constant.SourceMatchStreamProfile = 8;
SystemInterface.Constant.StartTimePrefixField = "e";
SystemInterface.Constant.UrlQueryParameter = "c";
SystemInterface.Constant.UserIdPrefixField = "c";
SystemInterface.Constant.WebSocketEvent = "SystemInterface";

// Return an object containing fields suitable for use in a command invocation, or a string containing an error description if the provided parameters were not found to be valid
SystemInterface.createCommand = function (prefix, commandName, commandParams) {
	var cmd, out, paramtype, err;

	if (typeof commandName == "number") {
		cmd = SystemInterface.CommandIdMap["" + commandName];
	}
	else {
		cmd = SystemInterface.Command["" + commandName];
	}
	if (cmd == null) {
		return ("Unknown command name \"" + commandName + "\"");
	}
	paramtype = SystemInterface.Type[cmd.paramType];
	if (paramtype == null) {
		return ("Command \"" + commandName + "\" has unknown parameter type \"" + cmd.paramType + "\"");
	}

	out = { };
	out.command = cmd.id;
	out.commandName = cmd.name;

	if ((prefix == null) || (typeof prefix != "object")) {
		prefix = { };
	}
	out.prefix = prefix;

	if ((commandParams == null) || (typeof commandParams != "object")) {
		commandParams = { };
	}
	SystemInterface.populateDefaultFields (commandParams, paramtype);

	err = SystemInterface.getParamError (commandParams, paramtype);
	if (err != null) {
		return (err);
	}
	out.params = commandParams;
	return (out);
};

// Validate fields in an object against the provided Type array. Returns a string error if one was found, or null if no error was found. An unknown key in the fields object triggers an error unless allowUnknownKeys is true.
SystemInterface.getParamError = function (fields, type, allowUnknownKeys) {
	var i, param, map, value, paramtype, err, containertype, j, item;

	if (allowUnknownKeys !== true) {
		map = { };
		for (i = 0; i < type.length; ++i) {
			param = type[i];
			map[param.name] = true;
		}
		for (i in fields) {
			if (map[i] !== true) {
				return ("Unknown parameter field \"" + i + "\"");
			}
		}
	}

	for (i = 0; i < type.length; ++i) {
		param = type[i];
		value = fields[param.name];
		if (value === undefined) {
			if (param.flags & SystemInterface.ParamFlag.Required) {
				return ("Missing required parameter field \"" + param.name + "\"");
			}
			continue;
		}

		switch (param.type) {
			case "number": {
				if (typeof value != "number") {
					return ("Parameter field \"" + param.name + "\" has incorrect type \"" + typeof value + "\", expecting number");
				}
				if (isNaN (value)) {
					return ("Parameter field \"" + param.name + "\" is not a valid number value");
				}

				if (param.flags & SystemInterface.ParamFlag.GreaterThanZero) {
					if (value <= 0) {
						return ("Parameter field \"" + param.name + "\" must be a number greater than zero");
					}
				}
				if (param.flags & SystemInterface.ParamFlag.ZeroOrGreater) {
					if (value < 0) {
						return ("Parameter field \"" + param.name + "\" must be a number greater than or equal to zero");
					}
				}
				if (param.flags & SystemInterface.ParamFlag.RangedNumber) {
					if ((typeof param.rangeMin == "number") && (typeof param.rangeMax == "number")) {
						if ((value < param.rangeMin) || (value > param.rangeMax)) {
							return ("Parameter field \"" + param.name + "\" must be a number in the range [" + param.rangeMin + ".." + param.rangeMax + "]");
						}
					}
				}
				if ((param.flags & SystemInterface.ParamFlag.EnumValue) && ((typeof param.enumValues == "object") && (param.enumValues != null) && (param.enumValues.length !== undefined))) {
					if (param.enumValues.indexOf (value) < 0) {
						return ("Parameter field \"" + param.name + "\" must be one of: " + param.enumValues.join (", "));
					}
				}
				break;
			}
			case "boolean": {
				if (typeof value != "boolean") {
					return ("Parameter field \"" + param.name + "\" has incorrect type \"" + typeof value + "\", expecting boolean");
				}
				break;
			}
			case "string": {
				if (typeof value != "string") {
					return ("Parameter field \"" + param.name + "\" has incorrect type \"" + typeof value + "\", expecting string");
				}

				if (param.flags & SystemInterface.ParamFlag.NotEmpty) {
					if (value == "") {
						return ("Parameter field \"" + param.name + "\" cannot contain an empty string");
					}
				}
				if ((param.flags & SystemInterface.ParamFlag.Hostname) && (value != "")) {
					if (value.search (/^[a-zA-Z0-9-.]+(:[0-9]+){0,1}$/) != 0) {
						return ("Parameter field \"" + param.name + "\" must contain a hostname string");
					}
				}
				if ((param.flags & SystemInterface.ParamFlag.Uuid) && (value != "")) {
					if (value.search (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/) != 0) {
						return ("Parameter field \"" + param.name + "\" must contain a UUID string");
					}
				}
				if ((param.flags & SystemInterface.ParamFlag.Url) && (value != "")) {
					if (value.search (/[^A-Za-z0-9$\-_.+!*?(),/:;=&%#]/) != -1) {
						return ("Parameter field \"" + param.name + "\" must contain a URL string");
					}
				}
				if ((param.flags & SystemInterface.ParamFlag.EnumValue) && ((typeof param.enumValues == "object") && (param.enumValues != null) && (param.enumValues.length !== undefined))) {
					if (param.enumValues.indexOf (value) < 0) {
						return ("Parameter field \"" + param.name + "\" must be one of: " + param.enumValues.join (", "));
					}
				}
				break;
			}
			case "array": {
				if ((typeof value != "object") || (value == null) || (value.length === undefined)) {
					return ("Parameter field \"" + param.name + "\" has incorrect type \"" + typeof value + "\", expecting array");
				}

				containertype = param.containerType;
				if (typeof containertype != "string") {
					return ("Parameter field \"" + param.name + "\" is missing expected container type");
				}

				if (containertype == "number") {
					for (j = 0; j < value.length; ++j) {
						item = value[j];
						if (typeof item != "number") {
							return ("Parameter field \"" + param.name + "\" has number array with invalid items");
						}

						if (param.flags & SystemInterface.ParamFlag.GreaterThanZero) {
							if (item <= 0) {
								return ("Parameter field \"" + param.name + "\" must contain numbers greater than zero");
							}
						}
						if (param.flags & SystemInterface.ParamFlag.ZeroOrGreater) {
							if (item < 0) {
								return ("Parameter field \"" + param.name + "\" must contain numbers greater than or equal to zero");
							}
						}
						if (param.flags & SystemInterface.ParamFlag.RangedNumber) {
							if ((typeof param.rangeMin == "number") && (typeof param.rangeMax == "number")) {
								if ((item < param.rangeMin) || (item > param.rangeMax)) {
									return ("Parameter field \"" + param.name + "\" must contain numbers in the range [" + param.rangeMin + ".." + param.rangeMax + "]");
								}
							}
						}
						if ((param.flags & SystemInterface.ParamFlag.EnumValue) && ((typeof param.enumValues == "object") && (param.enumValues != null) && (param.enumValues.length !== undefined))) {
							if (param.enumValues.indexOf (item) < 0) {
								return ("Parameter field \"" + param.name + "\" must contain values from: " + param.enumValues.join (", "));
							}
						}
					}
				}
				else if (containertype == "boolean") {
					for (j = 0; j < value.length; ++j) {
						item = value[j];
						if (typeof item != "boolean") {
							return ("Parameter field \"" + param.name + "\" has boolean array with invalid items");
						}
					}
				}
				else if (containertype == "string") {
					for (j = 0; j < value.length; ++j) {
						item = value[j];
						if (typeof item != "string") {
							return ("Parameter field \"" + param.name + "\" has string array with invalid items");
						}

						if (param.flags & SystemInterface.ParamFlag.NotEmpty) {
							if (item == "") {
								return ("Parameter field \"" + param.name + "\" cannot contain empty strings");
							}
						}
						if ((param.flags & SystemInterface.ParamFlag.Hostname) && (item != "")) {
							if (item.search (/^[a-zA-Z0-9-.]+(:[0-9]+){0,1}$/) != 0) {
								return ("Parameter field \"" + param.name + "\" must contain hostname strings");
							}
						}
						if ((param.flags & SystemInterface.ParamFlag.Uuid) && (item != "")) {
							if (item.search (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/) != 0) {
								return ("Parameter field \"" + param.name + "\" must contain UUID strings");
							}
						}
						if ((param.flags & SystemInterface.ParamFlag.Url) && (item != "")) {
							if (item.search (/[^A-Za-z0-9$\-_.+!*?(),/:;=&]/) != -1) {
								return ("Parameter field \"" + param.name + "\" must contain URL strings");
							}
						}
						if ((param.flags & SystemInterface.ParamFlag.EnumValue) && ((typeof param.enumValues == "object") && (param.enumValues != null) && (param.enumValues.length !== undefined))) {
							if (param.enumValues.indexOf (item) < 0) {
								return ("Parameter field \"" + param.name + "\" must contain values from: " + param.enumValues.join (", "));
							}
						}
					}
				}
				else if (containertype == "object") {
					for (j = 0; j < value.length; ++j) {
						item = value[j];
						if ((typeof item != "object") || (item == null)) {
							return ("Parameter field \"" + param.name + "\" has object array with invalid items");
						}
						if ((param.flags & SystemInterface.ParamFlag.Command) && (item != null)) {
							err = SystemInterface.parseCommand (item);
							if (SystemInterface.isError (err)) {
								return ("Array parameter \"" + param.name + "[" + j + "]\": " + err);
							}
						}
					}
				}
				else {
					paramtype = SystemInterface.Type[containertype];
					if (paramtype == null) {
						return ("Parameter field \"" + param.name + "\" has unknown container type \"" + containertype + "\"");
					}
					for (j = 0; j < value.length; ++j) {
						item = value[j];
						if (item == null) {
							return ("Parameter field \"" + param.name + "\" has object array with invalid items");
						}

						err = SystemInterface.getParamError (item, paramtype, allowUnknownKeys);
						if (SystemInterface.isError (err)) {
							return ("Array parameter \"" + param.name + "[" + j + "]\": " + err);
						}
					}
				}

				break;
			}
			case "map": {
				if (typeof value != "object") {
					return ("Parameter field \"" + param.name + "\" has incorrect type \"" + typeof value + "\", expecting object");
				}
				if (value == null) {
					return ("Parameter field \"" + param.name + "\" has null object");
				}

				containertype = param.containerType;
				if (typeof containertype != "string") {
					return ("Parameter field \"" + param.name + "\" is missing expected container type");
				}

				if (containertype == "number") {
					for (j in value) {
						item = value[j];
						if (typeof item != "number") {
							return ("Parameter field \"" + param.name + "\" has number map with invalid items");
						}

						if (param.flags & SystemInterface.ParamFlag.GreaterThanZero) {
							if (item <= 0) {
								return ("Parameter field \"" + param.name + "\" must contain numbers greater than zero");
							}
						}
						if (param.flags & SystemInterface.ParamFlag.ZeroOrGreater) {
							if (item < 0) {
								return ("Parameter field \"" + param.name + "\" must contain numbers greater than or equal to zero");
							}
						}
						if (param.flags & SystemInterface.ParamFlag.RangedNumber) {
							if ((typeof param.rangeMin == "number") && (typeof param.rangeMax == "number")) {
								if ((item < param.rangeMin) || (item > param.rangeMax)) {
									return ("Parameter field \"" + param.name + "\" must contain numbers in the range [" + param.rangeMin + ".." + param.rangeMax + "]");
								}
							}
						}
						if ((param.flags & SystemInterface.ParamFlag.EnumValue) && ((typeof param.enumValues == "object") && (param.enumValues != null) && (param.enumValues.length !== undefined))) {
							if (param.enumValues.indexOf (item) < 0) {
								return ("Parameter field \"" + param.name + "\" must contain values from: " + param.enumValues.join (", "));
							}
						}
					}
				}
				else if (containertype == "boolean") {
					for (j in value) {
						item = value[j];
						if (typeof item != "boolean") {
							return ("Parameter field \"" + param.name + "\" has boolean map with invalid items");
						}
					}
				}
				else if (containertype == "string") {
					for (j in value) {
						item = value[j];
						if (typeof item != "string") {
							return ("Parameter field \"" + param.name + "\" has string map with invalid items");
						}

						if (param.flags & SystemInterface.ParamFlag.NotEmpty) {
							if (item == "") {
								return ("Parameter field \"" + param.name + "\" cannot contain empty strings");
							}
						}
						if ((param.flags & SystemInterface.ParamFlag.Hostname) && (item != "")) {
							if (item.search (/^[a-zA-Z0-9-.]+(:[0-9]+){0,1}$/) != 0) {
								return ("Parameter field \"" + param.name + "\" must contain hostname strings");
							}
						}
						if ((param.flags & SystemInterface.ParamFlag.Uuid) && (item != "")) {
							if (item.search (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/) != 0) {
								return ("Parameter field \"" + param.name + "\" must contain UUID strings");
							}
						}
						if ((param.flags & SystemInterface.ParamFlag.Url) && (item != "")) {
							if (item.search (/[^A-Za-z0-9$\-_.+!*?(),/:;=&]/) != -1) {
								return ("Parameter field \"" + param.name + "\" must contain URL strings");
							}
						}
						if ((param.flags & SystemInterface.ParamFlag.EnumValue) && ((typeof param.enumValues == "object") && (param.enumValues != null) && (param.enumValues.length !== undefined))) {
							if (param.enumValues.indexOf (item) < 0) {
								return ("Parameter field \"" + param.name + "\" must contain values from: " + param.enumValues.join (", "));
							}
						}
					}
				}
				else if (containertype == "object") {
					for (j in value) {
						item = value[j];
						if ((typeof item != "object") || (item == null)) {
							return ("Parameter field \"" + param.name + "\" has object map with invalid items");
						}

						if ((param.flags & SystemInterface.ParamFlag.Command) && (item != null)) {
							err = SystemInterface.parseCommand (item);
							if (SystemInterface.isError (err)) {
								return ("Map parameter \"" + param.name + "[" + j + "]\": " + err);
							}
						}
					}
				}
				else {
					paramtype = SystemInterface.Type[containertype];
					if (paramtype == null) {
						return ("Parameter field \"" + param.name + "\" has unknown container type \"" + containertype + "\"");
					}

					for (j in value) {
						item = value[j];
						err = SystemInterface.getParamError (item, paramtype, allowUnknownKeys);
						if (SystemInterface.isError (err)) {
							return ("Map parameter \"" + param.name + "[" + j + "]\": " + err);
						}
					}
				}

				break;
			}
			case "object": {
				if (typeof value != "object") {
					return ("Parameter field \"" + param.name + "\" has incorrect type \"" + typeof value + "\", expecting object");
				}

				if (value == null) {
					return ("Parameter field \"" + param.name + "\" has null object");
				}

				if (param.flags & SystemInterface.ParamFlag.Command) {
					err = SystemInterface.parseCommand (value);
					if (SystemInterface.isError (err)) {
						return ("Parameter field \"" + param.name + "\": " + err);
					}
				}

				break;
			}
			default: {
				paramtype = SystemInterface.Type[param.type];
				if (paramtype == null) {
					return ("Parameter field \"" + param.name + "\" has unknown type \"" + param.type + "\"");
				}

				err = SystemInterface.getParamError (value, paramtype, allowUnknownKeys);
				if (SystemInterface.isError (err)) {
					return (err);
				}
				break;
			}
		}
	}
};

// Return an object containing command fields parsed from the provided JSON string or object, or an error string if the parse attempt failed. typeFields is expected to contain a list of type params for use in validation, or undefined to specify that the parameter type associated with the command should be used.
SystemInterface.parseCommand = function (command, typeFields) {
	var cmd, params, type, err;

	if (typeof command == "string") {
		try {
			command = JSON.parse (command);
		}
		catch (e) {
			return ("Command has non-parsing JSON, " + e);
		}
	}

	if ((typeof command != "object") || (command == null)) {
		return ("Command is not an object");
	}

	if ((typeof typeFields == "object") && (typeFields.length !== undefined)) {
		type = typeFields;
		params = command;
	}
	else {
		if (typeof command.commandName != "string") {
			return ("Command has no commandName field");
		}
		if ((typeof command.params != "object") || (command.params == null)) {
			return ("Command has no params object");
		}
		params = command.params;

		cmd = SystemInterface.Command[command.commandName];
		if (cmd == null) {
			return ("Command has unknown name \"" + command.commandName + "\"");
		}

		type = SystemInterface.Type[cmd.paramType];
		if (type == null) {
			return ("Command \"" + command.commandName + "\" has unknown parameter type \"" + cmd.paramType + "\"");
		}
	}

	SystemInterface.populateDefaultFields (params, type);
	SystemInterface.resolveTypes (params, type);
	err = SystemInterface.getParamError (params, type);
	if (err != null) {
		return (err);
	}

	if ((typeof command.prefix != "object") || (command.prefix == null)) {
		command.prefix = { };
	}

	return (command);
};

// Populate default fields in the provided object, as specified by defaultValue fields in a list of type params
SystemInterface.populateDefaultFields = function (fields, type) {
	var i, param, j, item, value, containertype;

	for (i = 0; i < type.length; ++i) {
		param = type[i];
		if ((param.type == "array") && (typeof param.containerType == "string")) {
			containertype = SystemInterface.Type[param.containerType];
			if (containertype != null) {
				value = fields[param.name];
				if ((typeof value == "object") && (value != null) && (value.length !== undefined)) {
					for (j = 0; j < value.length; ++j) {
						item = value[j];
						if (item != null) {
							SystemInterface.populateDefaultFields (item, containertype);
						}
					}
				}
			}
		}
		else if ((param.type == "map") && (typeof param.containerType == "string")) {
			containertype = SystemInterface.Type[param.containerType];
			if (containertype != null) {
				value = fields[param.name];
				if ((typeof value == "object") && (value != null)) {
					for (j in value) {
						item = value[j];
						if (item != null) {
							SystemInterface.populateDefaultFields (item, containertype);
						}
					}
				}
			}
		}
		else {
			if ((fields[param.name] === undefined) && (param.defaultValue !== undefined)) {
				fields[param.name] = param.defaultValue;
			}
		}
	}
};

// Populate a command's authorization prefix field using the provided values and hash functions
SystemInterface.setCommandAuthorization = function (command, authSecret, authToken, hashUpdateFn, hashDigestFn) {
	var hash;

	hash = SystemInterface.getCommandAuthorizationHash (command, authSecret, authToken, hashUpdateFn, hashDigestFn);
	if (hash != "") {
		command.prefix[SystemInterface.Constant.AuthorizationHashPrefixField] = hash;
		if ((typeof authToken == "string") && (authToken != "")) {
			command.prefix[SystemInterface.Constant.AuthorizationTokenPrefixField] = authToken;
		}
	}
}

// Return the authorization hash generated from the provided values and functions. If authToken is not provided, any available prefix auth token is used.
SystemInterface.getCommandAuthorizationHash = function (command, authSecret, authToken, hashUpdateFn, hashDigestFn) {
	var cmd, paramtype;

	cmd = SystemInterface.Command[command.commandName];
	if (cmd == null) {
		return ("");
	}
	paramtype = SystemInterface.Type[cmd.paramType];
	if (paramtype == null) {
		return ("");
	}

	if (typeof hashUpdateFn != "function") {
		hashUpdateFn = function () { };
	}
	if (typeof hashDigestFn != "function") {
		hashDigestFn = function () { return (""); };
	}
	if (typeof authSecret != "string") {
		authSecret = "";
	}
	if (typeof authToken != "string") {
		authToken = command.prefix[SystemInterface.Constant.AuthorizationTokenPrefixField];
		if (typeof authToken != "string") {
			authToken = "";
		}
	}

	hashUpdateFn (authSecret);
	hashUpdateFn (authToken);
	hashUpdateFn (command.commandName);
	if (typeof command.prefix[SystemInterface.Constant.CreateTimePrefixField] == "number") {
		hashUpdateFn ("" + Math.trunc (command.prefix[SystemInterface.Constant.CreateTimePrefixField]));
	}
	if (typeof command.prefix[SystemInterface.Constant.AgentIdPrefixField] == "string") {
		hashUpdateFn (command.prefix[SystemInterface.Constant.AgentIdPrefixField]);
	}
	if (typeof command.prefix[SystemInterface.Constant.UserIdPrefixField] == "string") {
		hashUpdateFn (command.prefix[SystemInterface.Constant.UserIdPrefixField]);
	}
	if (typeof command.prefix[SystemInterface.Constant.PriorityPrefixField] == "number") {
		hashUpdateFn ("" + Math.trunc (command.prefix[SystemInterface.Constant.PriorityPrefixField]));
	}
	if (typeof command.prefix[SystemInterface.Constant.StartTimePrefixField] == "number") {
		hashUpdateFn ("" + Math.trunc (command.prefix[SystemInterface.Constant.StartTimePrefixField]));
	}
	if (typeof command.prefix[SystemInterface.Constant.DurationPrefixField] == "number") {
		hashUpdateFn ("" + Math.trunc (command.prefix[SystemInterface.Constant.DurationPrefixField]));
	}

	paramtype.updateHash (command.params, hashUpdateFn);
	return (hashDigestFn ());
};

// Change field values to correct their types where possible, as specified by a list of type params
SystemInterface.resolveTypes = function (fields, type) {
	var i, param, j, item, value, containertype, num;

	for (i = 0; i < type.length; ++i) {
		param = type[i];
		value = fields[param.name];
		if ((param.type == "array") && (typeof param.containerType == "string")) {
			if ((typeof value == "object") && (value.length !== undefined)) {
				if (param.containerType == "number") {
					for (j = 0; j < value.length; ++j) {
						item = value[j];
						if (typeof item == "string") {
							num = parseInt (item, 10);
							if (! isNaN (num)) {
								value[j] = num;
							}
						}
					}
				}
				else if (param.containerType == "boolean") {
					for (j = 0; j < value.length; ++j) {
						item = value[j];
						if (typeof item == "string") {
							item = item.toLowerCase ();
							if (item == "true") {
								value[j] = true;
							}
							else if (item == "false") {
								value[j] = false;
							}
						}
					}
				}
				else {
					containertype = SystemInterface.Type[param.containerType];
					if (containertype != null) {
						for (j = 0; j < value.length; ++j) {
							item = value[j];
							SystemInterface.resolveTypes (item, containertype);
						}
					}
				}
			}
		}
		else if ((param.type == "map") && (typeof param.containerType == "string")) {
			if (typeof value == "object") {
				if (param.containerType == "number") {
					for (j in value) {
						item = value[j];
						if (typeof item == "string") {
							num = parseInt (item, 10);
							if (! isNaN (num)) {
								value[j] = num;
							}
						}
					}
				}
				else if (param.containerType == "boolean") {
					for (j in value) {
						item = value[j];
						if (typeof item == "string") {
							item = item.toLowerCase ();
							if (item == "true") {
								value[j] = true;
							}
							else if (item == "false") {
								value[j] = false;
							}
						}
					}
				}
				else {
					containertype = SystemInterface.Type[param.containerType];
					if (containertype != null) {
						for (j in value) {
							item = value[j];
							SystemInterface.resolveTypes (item, containertype);
						}
					}
				}
			}
		}
		else {
			if (typeof value == "string") {
				if (param.type == "number") {
					num = parseInt (value, 10);
					if (! isNaN (num)) {
						fields[param.name] = num;
					}
				}
				else if (param.type == "boolean") {
					value = value.toLowerCase ();
					if (value == "true") {
						fields[param.name] = true;
					}
					else if (value == "false") {
						fields[param.name] = false;
					}
				}
			}
		}
	}
};

// Return an object containing values parsed from a set of fields data using the specified type name, or an error string if the parse attempt failed
SystemInterface.parseTypeObject = function (typeName, fields) {
	var type;

	type = SystemInterface.Type[typeName];
	if (type == null) {
		return ("Unknown type \"" + typeName + "\"");
	}
	return (SystemInterface.parseFields (type, fields));
};

// Return an object containing values parsed from a set of fields data using the provided type parameters, or an error string if the parse attempt failed
SystemInterface.parseFields = function (paramList, fields) {
	var err;

	if (typeof fields == "string") {
		try {
			fields = JSON.parse (fields);
		}
		catch (e) {
			return ("Field data has non-parsing JSON, " + e);
		}
	}
	if ((typeof fields != "object") || (fields == null)) {
		return ("Field data is not an object");
	}
	if ((typeof paramList != "object") || (paramList.length === undefined)) {
		return ("Param list is not an array");
	}

	SystemInterface.populateDefaultFields (fields, paramList);
	SystemInterface.resolveTypes (fields, paramList);
	err = SystemInterface.getParamError (fields, paramList);
	if (err != null) {
		return (err);
	}
	return (fields);
};

// Copy fields defined in the specified type name from a source object to a destination object
SystemInterface.copyFields = function (typeName, destObject, sourceObject) {
	var type, i, name;

	type = SystemInterface.Type[typeName];
	if (type == null) {
		return;
	}
	for (i = 0; i < type.length; ++i) {
		name = type[i].name;
		destObject[name] = sourceObject[name];
	}
};

// Return the Type array used to validate the specified command ID, or null if the command was not found
SystemInterface.getParamType = function (commandId) {
	var i;

	for (i in SystemInterface.Command) {
		if (SystemInterface.Command[i].id == commandId) {
			if (SystemInterface.Type[SystemInterface.Command[i].paramType] != null) {
				return (SystemInterface.Type[SystemInterface.Command[i].paramType]);
			}
		}
	}

	return (null);
};

// Return the command name for the specified number ID, or an empty string if the command wasn't found
SystemInterface.getCommandName = function (commandId) {
	var i;

	if (typeof commandId != "number") {
		return ("");
	}
	for (i in SystemInterface.Command) {
		if (SystemInterface.Command[i].id == commandId) {
			return (SystemInterface.Command[i].name);
		}
	}
	return ("");
};

// Return the command ID associated with the specified string name or number ID, or -1 if the command ID wasn't found
SystemInterface.getCommandId = function (id) {
	var cmd;

	if (typeof id == "number") {
		return ((SystemInterface.CommandIdMap["" + id] != null) ? id : -1);
	}
	if (typeof id == "string") {
		cmd = SystemInterface.Command[id];
		return ((cmd != null) ? cmd.id : -1);
	}
	return (-1);
};

// Return a boolean value indicating if the provided result (as received from parse-related methods) contains an error
SystemInterface.isError = function (result) {
	return (typeof result == "string");
};
