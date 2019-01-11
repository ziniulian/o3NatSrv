// LZR 模块加载
require("lzr");

// LZR 子模块加载
LZR.load(["LZR.Node.Srv"]);

// 内外渗透对象
var nato = {
	socket: null,
	keepLink: 0,
	clsBuf: global.Buffer || require("buffer").Buffer,
	pwd: process.env.OPENSHIFT_NODEJS_NATPWD || "zi%niu%lian",
	ktim: 2000,
	max: 1000,
	rs: {},
	sn: 0,

	// 密码校验
	chkPwd: function (p) {
		return p === nato.pwd;
	},

	// 对接
	lnk: function (s) {
console.log("linking ...");
		nato.socket = s;
		s.removeAllListeners("data");
		s.removeAllListeners("error");
		s.removeAllListeners("end");
		s.on("error", nato.endLnk);
		s.on("end", nato.endLnk);
		s.write("HTTP/1.1 200\r\nConnection: keep-alive\r\n\r\nO,");
		nato.keepLink = setInterval(nato.kpLnk, nato.ktim);
	},

	// 保持对接
	kpLnk: function () {
console.log("linking : " + Date.now());
		if (!nato.wrt("T,")) {
			nato.endLnk();
		}
	},

	// 停止对接
	endLnk: function () {
		if (nato.keepLink) {
console.log("nato.socket.end!");
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
console.log("连接满了");
						id = 0;
						return 0;
					} else {
						k = 1;
						nato.sn = 0;
						id = (++ nato.sn);
					}
				}
			} while (nato.rs[id]);
console.log(id);
		}
		return id;
	},

	// 创建一个连接
	crt: function (req, res, next) {
// console.log(req.socket.localPort + " -- " + req.socket.remotePort);
		var id = nato.getId();
		var o = null;
		if (id) {
			o = {
				id: id,
				req: req,
				res: res,
				next: next,
				c: {	// 内容 content
					// b: nato.clsBuf.alloc(0),		// 主体 body
					h: {	// HTTP头 header
						method: req.method,
						path: req.originalUrl,
						headers: req.headers
					}
				}
			};
			req.socket.on("error", function (e) {
				console.log(id + " : " + e.message);
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
console.log(id + " : next_001");
			o.next();
console.log(id + " : next_002");
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
			o.next();
		}
	}
};

// 服务的实例化
var srv = new LZR.Node.Srv ({
	ip: process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0",
	port: process.env.OPENSHIFT_NODEJS_PORT || 8080
});
nato.ktim -= 0;

// 内网渗透_对接
srv.ro.post("/LZR/nat/lnk/:pwd/", function (req, res) {
	if (!nato.keepLink && nato.chkPwd(req.params.pwd)) {
		nato.lnk(req.socket);
	} else {
		res.send("Err!");
	}
});

// 内网渗透_停止对接
srv.ro.post("/LZR/nat/endLnk/:pwd/", function (req, res) {
	if (nato.keepLink && req.params.pwd === nato.pwd) {
		nato.endLnk();
		res.send("OK");
	} else {
		res.send("Err!");
	}
});

// 内网渗透_获取请求
srv.ro.post("/LZR/nat/getReq/:id/", function (req, res) {
	res.send("获取请求");
});

// 内网渗透_发送应答
srv.ro.post("/LZR/nat/sendRes/:id/", function (req, res) {
	res.send("发送应答");
});

// 内网渗透_断开连接
srv.ro.post("/LZR/nat/end/:id/", function (req, res) {
	res.send("断开连接");
});

/******** 代理服务 ********/
// 代理_创建连接
srv.ro.post("/LZR/prx/end/:id/:host/:port/", function (req, res, next) {
	res.send("创建连接");
});

// 代理_发送请求
srv.ro.post("/LZR/prx/sendReq/:id/", function (req, res) {
	res.send("发送请求");
});

// 代理_获取应答
srv.ro.post("/LZR/prx/getRes/:id/", function (req, res) {
	res.send("获取应答");
});

// 代理_断开连接
srv.ro.post("/LZR/prx/end/:id/", function (req, res) {
	res.send("断开连接");
});

/******** 内网渗透 ********/
srv.ro.get("*", function (req, res, next) {
	var o = nato.crt(req, res, next);
	if (o) {
		nato.emit(o);
	} else {
		next();
	}
});

srv.ro.post("*", function (req, res, next) {
	var o = nato.crt(req, res, next);
	if (o) {
		var d = [];
		var size = 0;
		req.on("data", function (dat) {
			d.push(dat);
			size += dat.length;
		});
		req.on("end", function () {
			if (size) {
				o.c.b = nato.clsBuf.concat(d, size);		// 主体 body
			}
			nato.emit(o);
		});
	} else {
		next();
	}
});

// 错误处理
srv.use("*", function (req, res) {
console.log("Err_101");
// console.log(res.connection === res.socket);	// 返回为 true。connection 和 socket 是一个东西。
	if (res.connection) {
console.log("Err_102");
		// 已经应答过的 res 没有 connection 属性，若再次应答将会报错！
		try {
			if (nato.keepLink) {
				// res.status(408).send("超时!");
				res.set({"Retry-After": "10"});	// 过载延迟时间
				res.status(503).send("过载!");
console.log("Err_103");
			} else {
				res.status(404).send("Hi!");
console.log("Err_104");
			}
		} catch (e) {
			console.log(e.message);
		}
	}
console.log("Err_105");
});

srv.start();
console.log("LZRnatsrv start " + srv.ip + ":" + srv.port);
