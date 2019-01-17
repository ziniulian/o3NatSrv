var net = require("net");

// 内网渗透对象
var nato = {
	clsBuf: global.Buffer || require("buffer").Buffer,
	pwd: process.env.OPENSHIFT_NODEJS_NATPWD || "pwd",
	pwdLen: 10 + 3,
	port: process.env.OPENSHIFT_NODEJS_PORT || 8080,
	logAble: process.env.OPENSHIFT_NODEJS_LOG || false,

	socket: null,
	buf: null,	// 头部不足的缓存
	twrk: null,	// 未接收完数据的任务
	swrk: 0,	// 一次任务请求的总数据长度

	rs: {},		// 连接池
	sn: 0,

	keepLink: 0,
	ktim: process.env.OPENSHIFT_NODEJS_NATIM || 17000,
	max: 100,	// id 最值
	maxConn: 6,	// 最大连接数 （并发连接数超过 7 时，node.js 连接将处于阻塞排队状态）

	// 监听器
	listener: function (s) {
		s.on("error", nato.hdErr);
		s.on("data", nato.lnk);
	},

	// 密码校验
	chkPwd: function (p) {
		return p === nato.pwd;
	},

	// 对接
	lnk: function (dat) {
		var e = false;
		if ((dat.length > nato.pwdLen) && (dat.toString("utf8", 5, 10) === "/lnk/") && (dat.toString("utf8", nato.pwdLen, (nato.pwdLen + 10)) === "/ HTTP/1.1") && nato.chkPwd(dat.toString("utf8", 10, nato.pwdLen))) {
			if (nato.socket) {
				nato.endLnk.call(nato.socket);
			}
			nato.socket = this;
			this.removeAllListeners("data");
			this.removeAllListeners("error");
			this.on("error", nato.endLnk);
			this.on("end", nato.endLnk);
			this.write("HTTP/1.1 200 lnk\r\nConnection: keep-alive\r\n\r\n");
			nato.kepLnk();
			nato.log("已连接 : " + Date.now());
		} else if (nato.socket) {
			if (dat.indexOf("POST /wrk/ ") === 0) {
				if ((nato.swrk === 0) && (dat.indexOf("\r\n\r\n") > 0)) {
					this.removeAllListeners("data");
					this.on("data", nato.hdWrk);
					nato.hdWrk.call(this, dat);
				} else {
					this.end();
				}
			} else if (srv._connections <= nato.maxConn) {
				var id = this.id || nato.getId(this);
				if (id) {
					this.removeAllListeners("data");
					this.removeAllListeners("error");
					this.on("error", nato.endDat);
					this.on("end", nato.endDat);
					this.on("data", nato.hdDat);
					nato.hdDat.call(this, dat);
				} else {
					e = true;
				}
			} else {
				e = true;
			}
		} else {
			e = true;
		}
		if (e) {
			this.write("HTTP/1.1 302\r\nLocation: https://www.ziniulian.tk/home.html\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
			this.end();
		}
	},

	// 停止对接
	endLnk: function () {
		this.removeAllListeners("error");
		this.removeAllListeners("end");
		this.on("error", nato.hdErr);
		this.end();
		if (nato.keepLink) {
			clearTimeout(nato.keepLink);
			nato.keepLink = 0;
		}
		if (nato.socket) {
			nato.socket = null;
			nato.log("已断开 : " + Date.now());
		}
		// TODO: 任务回滚
	},

	// 保持对接，发送心跳
	kepLnk: function () {
		if (nato.socket) {
			if (nato.keepLink) {
				nato.socket.write("0.");
			}
			nato.keepLink = setTimeout(nato.kepLnk, nato.ktim);
		} else {
			nato.keepLink = 0;
		}
	},

	// 任务处理
	hdWrk: function (dat) {
		nato.log("<< -- " + dat.length);
		var i, j, p, id;
		p = 0;	// 指针
		if (nato.buf) {
			nato.buf.push(dat);
			dat = nato.clsBuf.concat(nato.buf);
			nato.buf = null;
		} else if (nato.swrk === 0) {
			p = dat.indexOf("\r\n\r\n") + 4;
			i = dat.indexOf("Content-Length: ", 18, "utf8") + 16;
			j = dat.indexOf("\r\n", i, "utf8");
			nato.swrk = dat.toString("utf8", i, j) - 0;
			if (nato.twrk) {
				// 数据传输出现了错误！理论不太可能发生。
				nato.log("hdWrk err twrk");
				nato.twrk = null;
			}
		}
		if (nato.swrk) {
			nato.swrk += p;
			while (dat.length > p) {
				if (nato.twrk) {
					i = dat.length - p;
					if (i < nato.twrk.size) {
						nato.twrk.size -= i;
						nato.twrk.buf.push(dat.slice(p));
						p = dat.length;
					} else {
						j = p + nato.twrk.size;
						nato.twrk.buf.push(dat.slice(p, j));
						nato.doWrk(nato.twrk.id, nato.clsBuf.concat(nato.twrk.buf));
						nato.twrk = null;
						p = j;
					}
				} else {
					i = dat.indexOf(".", p);
					if (i > 0) {
						id = dat.toString("utf8", p, i) - 0;
						i ++;
						if (id === 0) {
							p = i;
						} else {
							j = dat.indexOf(".", i);
							if (j > 0) {
								p = dat.toString("utf8", i, j) - 0;
								if (p) {
									nato.twrk = {
										id: id,
										buf: [],
										size: p,
									};
								} else {
									nato.clrSub(id);
								}
								p = j + 1;
							} else {
								nato.buf = [dat.slice(p)];
								p = dat.length;
							}
						}
					} else {
						nato.buf = [dat.slice(p)];
						p = dat.length;
					}
				}
			}
			nato.swrk -= dat.length;
		}
		if (nato.swrk <= 0) {
			if (nato.swrk || nato.twrk || nato.buf) {
				// 数据传输出现了错误！理论不太可能发生。
				nato.log("hdWrk err ...");
				nato.log(nato.swrk);
				nato.log(nato.twrk);
				nato.log(nato.buf);
				nato.log("hdWrk err_end!");
				this.write("HTTP/1.1 404 wER\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
				this.end();
			} else {
				this.write("HTTP/1.1 200 wOK\r\nConnection: keep-alive\r\nContent-Length: 0\r\n\r\n");
			}
		}
	},

	// 执行任务
	doWrk: function (id, dat) {
		nato.log(id + " : >> " + dat.length);
		var s = nato.rs[id];
		if (s) {
			s.write(dat);
		}
	},

	// 清除子连接
	clrSub: function (id) {
		if (nato.rs[id]) {
			nato.log("End : " + id);
			nato.rs[id].end();
			delete nato.rs[id];
		}
	},

	// 获取ID
	getId: function (s) {
		var id = 0, k = 0;
		do {
			id = (++ nato.sn);
			if (id > nato.max) {
				if (k) {
					id = 0;
				} else {
					k = 1;
					nato.sn = 0;
					id = (++ nato.sn);
				}
			}
		} while (id && nato.rs[id]);
		if (id) {
			s.id = id;
			nato.rs[id] = s;
		}
		return id;
	},

	// 关闭子连接
	endDat: function () {
		var id = this.id;
		this.removeAllListeners("data");
		this.removeAllListeners("error");
		this.removeAllListeners("end");
		this.on("error", nato.hdErr);
		this.id = 0;
		this.end();
		if (id) {
			nato.sendWrk(nato.clsBuf.from(id + ".0."));
			nato.clrSub(id);
		}
	},

	// 添加任务
	hdDat: function (dat) {
		nato.log(this.id + " : << " + dat.length);
		nato.sendWrk(nato.clsBuf.concat([
			nato.clsBuf.from(this.id + "." + dat.length + "."),
			dat
		]));
	},

	// 发送任务
	sendWrk: function (dat) {
		if (nato.socket) {
			if (nato.keepLink) {
				clearTimeout(nato.keepLink);
				nato.keepLink = 0;
			}
			nato.socket.write(dat);
			nato.kepLnk();
		}
	},

	// 错误处理
	hdErr: function (e) {
		this.removeAllListeners("data");
		this.removeAllListeners("end");
		this.end();
	},

	// 信息输出
	log: function (msg) {
		if (nato.logAble) {
			console.log(msg);
		}
	}
};


var srv = net.createServer(nato.listener).listen(nato.port);
// srv.maxConnections = 1;
console.log("LZRnatsrv start in " + nato.port);
