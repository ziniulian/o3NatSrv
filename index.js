var net = require("net");
var clsBuf = global.Buffer || require("buffer").Buffer;

var tools = {
	ip: process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0",
	port: process.env.OPENSHIFT_NODEJS_PORT || 80,
	socket: null,
	key: "GET /" + (process.env.OPENSHIFT_NODEJS_NATKEY || "zi%niu%lian") + "/ HTTP",
	ss: {},
	sn: 0,
	max: 10000,		// 最大连接数

	init: function (s) {
		var bs = new clsBuf(0);
		s.on("error", function () {});
		s.on("data", function(dat) {
			bs = clsBuf.concat([bs, dat]);
			if (bs.indexOf("\r\n\r\n") > 0) {
// console.log(bs.toString());
				if (dat.slice(0, tools.key.length).toString("utf8") === tools.key) {
					s.removeAllListeners("data");
					s.on("error", function (e) {
						tools.endSocket();
						s.end();
					});
					s.on("end", tools.endSocket);
					tools.initSocket(s);
					s.write("HTTP/1.1 200\r\nConnection: keep-alive\r\n\r\n");
					tools.socket = s;
				} else {
					tools.err(s);
				}
			}
		});
	},

	getId: function (s) {
		var id = 0, k = 0;
		do {
			id = (++ tools.sn);
			if (id > tools.max) {
				if (k) {
					console.log("连接满了");
					tools.err(s);
					id = 0;
					break;
				} else {
					k = 1;
					tools.sn = 0;
					id = (++ tools.sn);
				}
			}
		} while (tools.ss[id]);
		if (id) {
			s.id = id;
			tools.ss[id] = s;
		}
		return id;
	},

	endSocket: function () {
		var i, s;
		for (var i = 0; i < tools.max) {
			s = tools.ss[i];
			if (s) {
				s.end();
			}
		}
		tools.socket = null;
	},

	endSubSocket: function (id) {
		tools.socket.write(id + ",end,");
		delete tools.ss[id];
	},

	err: function (s) {
		s.write("HTTP/1.1 503\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nContent-Length: 63\r\n\r\n网站临时维护中，请个把小时后再来尝试访问。");
		s.end();
	},

	initSubSocket: function (s) {
        s.on("error", function () {
			tools.endSubSocket(s.id);
			s.end();
        });
        s.on("end", function () {
			tools.endSubSocket(s.id);
        });
		s.on("data", function (dat) {
			console.log("<<! --- s");
			console.log("<<",dat.length);
			console.log("<<",dat.toString());
			console.log("<<! --- e");
			tools.socket.write(clsBuf.concat([
				new clsBuf(s.id + "," + data.length + ","),
				dat
			]));
        });
	},

	initSocket: function (ss) {
		var bs = new clsBuf(0);
		var cs = null;	// 未接收完的连接
		var n = 0;		// 未接收完的字节数
		ss.on("data", function (dat) {
			console.log(">>! --- s");
			console.log(">>",dat.length);
			console.log(">>", dat.toString());
			console.log(">>! --- e");
			var b = true;
			if (n) {
				if (dat.length < n) {
					cs.write (dat);
					n -= dat.length;
					b = false;
				} else if (dat.length === n) {
					cs.write (dat);
					n = 0;
					cs = null;
					b = false;
				} else {
					cs.write (dat.slice(0, n));
					n = 0;
					cs = null;
					bs = clsBuf.concat([bs, dat.slice(n)]);
				}
			} else {
				bs = clsBuf.concat([bs, dat]);
			}

			if (b) {
				if (bs.indexOf(",") > 0) {
			}
		});
	}

}

function mainSrv (s) {
	if (tools.socket) {
		var id = tools.getId(s);
		if (id) {
			tools.initSubSocket(tools.ss[id]);
		}
	} else {
		tools.init(s);
	}
}

// 服务启动
net.createServer(mainSrv).listen(tools.port, tools.ip);
console.log("LZRnatsrv start " + tools.ip + ":" + tools.port);
