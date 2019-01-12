var net = require("net");

// 内网渗透对象
var nato = {
	clsBuf: global.Buffer || require("buffer").Buffer,
	pwd: process.env.OPENSHIFT_NODEJS_NATPWD || "pwd",
	pwdLen: 3,
	port: 8080,
	rs: null,	// 接收端
	ws: null,	// 发送端
	keepLink: 0,
	ktim: 20000,
	max: 100,
	os: {},		// 其它连接
	sn: 0,

	// 监听器
	listener: function (s) {
		if (nato.keepLink) {
			if (nato.rs) {
				s.on("error", nato.hdErr);
				s.on("end", nato.hdEnd);
nato.ws.write(s.remoteAddress + ":" + s.remotePort + ",");
				s.write("HTTP/1.1 200\r\nConnection: close\r\nContent-Length: 3\r\n\r\nOK!");
				s.end();
			} else {
				s.on("error", nato.hdErr);
				s.on("end", nato.hdEnd);
				s.on("data", nato.chkRs);
			}
		} else {
			s.on("error", nato.hdErr);
			s.on("end", nato.hdEnd);
			s.on("data", nato.chkWs);
		}
	},

	// 密码校验
	chkPwd: function (p) {
		return p === nato.pwd;
	},

	// 检测发送端
	chkWs: function (dat) {
		var n = 9 + nato.pwdLen;
		if ((dat.length > n) && (dat.toString("utf8", 5, 9) === "/ws/") && (dat.toString("utf8", n, (n + 2)) === "/ ") && nato.chkPwd(dat.toString("utf8", 9, n))) {
			nato.ws = this;
			nato.keepLink = setInterval(nato.kpLnk, nato.ktim);
			this.removeAllListeners("data");
			this.removeAllListeners("error");
			this.removeAllListeners("end");
			this.on("error", nato.wsErr);
			this.on("end", nato.wsEnd);
			// this.on("data", nato.hdRs);
			this.write("HTTP/1.1 200\r\nConnection: keep-alive\r\n\r\nW,");
		} else {
			nato.err(this, "no WS!");
		}
	},

	// 保持对接
	kpLnk: function () {
		if (nato.ws) {
			nato.ws.write("L,");
		}
	},

	// 发送端错误处理
	wsErr: function (e) {
console.log ((this === nato.ws?"WS":"RS") + "_Err : " + e.message);
		nato.wsEnd();
	},

	// 终止发送端
	wsEnd: function () {
		if (nato.keepLink) {
			clearInterval(nato.keepLink);
			nato.keepLink = 0;
			// 清空所有其它连接 ...
			if (nato.ws) {
				nato.ws.write("E,");
			}
		}
		if (nato.rs) {
			nato.rs.end();
			nato.rs = null;
		}
		if (nato.ws) {
			nato.ws.end();
			nato.ws = null;
		}
	},

	// 检测接收端
	chkRs: function (dat) {
		var n = 9 + nato.pwdLen;
		if ((dat.length > n) && (dat.toString("utf8", 5, 9) === "/rs/") && (dat.toString("utf8", n, (n + 2)) === "/ ") && nato.chkPwd(dat.toString("utf8", 9, n))) {
			nato.rs = this;
			this.removeAllListeners("data");
			this.removeAllListeners("error");
			this.removeAllListeners("end");
			this.on("error", nato.wsErr);
			this.on("end", nato.wsEnd);
			this.on("data", nato.hdRs);
			nato.ws.write("R,");
		} else {
			nato.err(this, "no RS!");
		}
	},

	// 接收信息
	hdRs: function (dat) {
console.log(dat.toString("utf8"));
	},


/*************************************************/

	// 停止对接
	endLnk: function () {
		if (nato.keepLink) {
			clearInterval(nato.keepLink);
			nato.keepLink = 0;
			nato.sn = 0;
			for (var s in nato.rs) {
				nato.del(s);
			}
			nato.wrt("E,");
			setTimeout(nato.endSocket, 1);
		}
	},
	endSocket: function () {
		nato.socket.end();
		nato.socket = null;
	},

	// 获取一个可用ID
	getId: function () {
		var id = 0, k = 0;
		if (nato.keepLink) {
			do {
				id = (++ nato.sn);
				if (id > nato.max) {
					if (k) {
						id = 0;
						return 0;
					} else {
						k = 1;
						nato.sn = 0;
						id = (++ nato.sn);
					}
				}
			} while (nato.rs[id]);
		}
		return id;
	},

	// 创建一个连接
	crt: function (req, res) {
// console.log(req.socket.localPort + " -- " + req.socket.remotePort);
		var id = nato.getId();
		var o = null;
		if (id) {
			o = {
				id: id,
				req: req,
				res: res,
				c: {	// 内容 content
					ok: true,
					// b: nato.clsBuf.alloc(0),		// 主体 body
					h: {	// HTTP头 header
						method: req.method,
						path: req.originalUrl,
						headers: req.headers
					}
				}
			};
			req.socket.on("error", function (e) {
				nato.del(id);
			});
			req.socket.on("end", function () {
				nato.del(id);
			});
			nato.rs[id] = o;
		}
		return o;
	},

	// 删除一个连接
	del: function (id) {
		var o = nato.rs[id];
		if (o) {
			nato.wrt("D" + id + ",");
			delete nato.rs[id];
			nato.err(o.res);
		}
	},

	// 写数据
	wrt: function (msg) {
		if (nato.socket) {
			nato.socket.write(msg);
			return true;
		} else {
			return false;
		}
	},

	// 发送信号
	emit: function (o) {
		if (!nato.wrt("G" + o.id + ",")) {
			nato.err(o.res);
		}
	},


/**********************************************/

	// 错误回复
	err: function (s, msg) {
		s.write("HTTP/1.1 404\r\nConnection: close\r\nContent-Length: " + msg.length + "\r\n\r\n" + msg);
		s.end();
	},

	// 错误处理
	hdErr: function (e) {
console.log(e);
		this.end();
	},
	hdEnd: function () {
console.log("end");
	}
};


net.createServer(nato.listener).listen(nato.port);
console.log("LZRnatsrv start in " + nato.port);
