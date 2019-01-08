var net = require("net");
var clsBuf = global.Buffer || require("buffer").Buffer;

var tools = {
	ip: process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0",
	port: process.env.OPENSHIFT_NODEJS_PORT || 8080,
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
// console.log(bs.toString("utf8"));
				if (dat.toString("utf8", 0, tools.key.length) === tools.key) {
					s.removeAllListeners("data");
					s.on("error", function (e) {
						tools.endSocket();
						s.end();
					});
					s.on("end", tools.endSocket);
					tools.initSocket(s);
					console.log("OK!");
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
		for (i = 0; i < tools.max; i ++) {
			s = tools.ss[i];
			if (s) {
				s.end();
			}
		}
		tools.socket = null;
		console.log("END!");
	},

	endSubSocket: function (id) {
		tools.socket.write("HTTP/1.1 200 -" + id + "\r\nConnection: keep-alive\r\nContent-Length: 1\r\n\r\n1");
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
			console.log("Srv end : " + s.id);
			tools.endSubSocket(s.id);
        });
		s.on("data", function (dat) {
			// console.log("Srv <<! --- s");
			console.log("Srv << ", s.id + " , " + dat.length);
			// console.log(dat.toString("utf8"));
			// console.log("Srv <<! --- e");
			tools.socket.write(clsBuf.concat([
				new clsBuf("HTTP/1.1 200 " + s.id + "\r\nConnection: keep-alive\r\nContent-Length: " + dat.length + "\r\n\r\n", "utf8"),
				dat
			]));
        });
	},

	initSocket: function (ss) {
		var bs = new clsBuf(0);
		var cs = null;	// 未接收完的连接
		var n = 0;		// 未接收完的字节数
		ss.on("data", function (dat) {
			var id, b = true;
			if (n) {
				// 对未能一次性收齐的数据进行处理
				id = cs.id;
				if (dat.length < n) {
					cs.write (dat);
					n -= dat.length;
					b = false;
				} else if (dat.length === n) {
					cs.write (dat);
					n = 0;
					cs = null;
					b = false;
					bs = new clsBuf(0);
				} else {
					// 一个新的请求接在前一个数据的尾部，是不太可能发生的情况
					cs.write (dat.slice(0, n));
					bs = dat.slice(n);
					n = 0;
					cs = null;
				}
			} else {
				bs = clsBuf.concat([bs, dat]);
			}

			if (b) {
				b = bs.indexOf("\r\n\r\n");
				if (b > 0) {
					b += 4;
					var t = bs.toString("utf8", 0, b);
					id = t.substring(8, t.indexOf(" HTTP", 8)) - 0;
					switch (t.substring(0, 8)) {
						case "POST /R/":
							var d = bs.slice(b);
							var nn = t.indexOf("Content-Length: ", 20) + 16;
							nn = t.substring(nn, t.indexOf("\r\n", nn)) - 0;

							// console.log("Srv >>! --- s");
							console.log("Srv >> ", id + " , " + nn);
							// console.log(d.toString("utf8"));
							// console.log("Srv >>! --- e");

							if (d.length < nn) {
								// 数据未能一次性收齐
								cs = tools.ss[id];
								n = nn;
								cs.write (d);
							} else {
								tools.ss[id].write (d);
								if (d.length > nn) {
									// 一个新的请求接在前一个数据的尾部，是不太可能发生的情况。直接报错
									console.log("--- Err --- " + d.length + " , " + nn));
								}
							}
							break;
						case "GET /End":
							var s = tools.ss[id];
							if (s) {
								s.end();
							}
							break;
					}
					bs = new clsBuf(0);
				}
			}
		});
	}

};

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
