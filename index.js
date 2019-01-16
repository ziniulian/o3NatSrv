var net = require("net");

// 内网渗透对象
var nato = {
	clsBuf: global.Buffer || require("buffer").Buffer,
	pwd: process.env.OPENSHIFT_NODEJS_NATPWD || "pwd",
	pwdLen: 10 + 3,
	port: 8080,

	socket: null,
	size: 0,		// 尚未接收完的数据大小
	buf: null,	// 已接收到的数据缓存
	keepLink: 0,	// 心跳ID
	ws: [],		// 任务堆
	pw: null,	// 回滚任务堆
	rs: {},		// 连接池
	sn: 0,

	ktim: 5000,
	max: 100,

	// 监听器
	listener: function (s) {
		s.on("error", nato.hdErr);
		// s.on("data", nato.first);
		s.on("data", nato.lnk);
	},

	// 密码校验
	chkPwd: function (p) {
		return p === nato.pwd;
	},

	// 对接
	lnk: function (dat) {
		if ((dat.length > nato.pwdLen) && (dat.toString("utf8", 5, 10) === "/lnk/") && (dat.toString("utf8", nato.pwdLen, (nato.pwdLen + 2)) === "/ ") && nato.chkPwd(dat.toString("utf8", 10, nato.pwdLen))) {
			if (nato.socket) {
				// (this.remoteAddress === nato.socket.remoteAddress) // O3内网的IP每次连接都可能不一样，故此判断没意义。
				nato.endLnk.call(nato.socket);
			}
			nato.socket = this;
			nato.size = 0;
			this.removeAllListeners("data");
			this.removeAllListeners("error");
			this.on("error", nato.endLnk);
			this.on("end", nato.endLnk);
			this.on("data", nato.hdDat);
			nato.send(this, "lnk");
			console.log("已连接 : " + Date.now());
		} else if (nato.socket) {
			nato.addWrk(this, dat);
		} else {
			this.write("HTTP/1.1 503 nle\r\nConnection: close\r\nContent-Length: 20\r\n\r\n<H1>no! No! NO!</H1>");
			// this.write("HTTP/1.1 503 LZR\r\nConnection: close\r\nContent-Length: 135\r\n\r\n<style type=\"text/css\">body,iframe{padding:0;margin:0;width:100%;height:100%;}</style><iframe src=\"https://www.ziniulian.tk/\"></iframe>");
		}
	},

	// 停止对接
	endLnk: function () {
		this.removeAllListeners("data");
		this.removeAllListeners("error");
		this.removeAllListeners("end");
		this.on("error", natc.hdErr);
		this.end();
		if (nato.keepLink) {
			clearTimeout(nato.keepLink);
			nato.keepLink = 0;
		}
		if (nato.socket) {
			nato.socket = null;
			console.log("已断开 : " + Date.now());
		}
	},

	// 交互信息处理
	hdDat: function (dat) {
		if (nato.size === 0) {
			var k = dat.indexOf("\r\n\r\n");
			if (k > 0) {
				switch (dat.toString("utf8", 6, 9)) {
					case "lnk":	// 心跳
						nato.hdRtn(true);
						break;
					case "rtn":	// 反馈
						nato.hdRtn();
						break;
					case "wrk":	// 任务
						var i = dat.indexOf("Content-Length: ") + 16;
						var j = dat.indexOf("\r\n", i, "utf8");
						nato.size = dat.toString("utf8", i, j);
						i = k + 4;	// 数据起始位置
						j = dat.length - i;		// 数据实际长度
						if (nato.size > j) {
							nato.size -= j;
							nato.buf = [dat.slice(i)];
						} else {
							k = i + nato.size;
							nato.size = 0;
							nato.doWrk(dat.slice(i, k));
							if (nato.size < j) {
								console.log("理论上不会出现的数据溢出");
								// nato.hdDat(dat.slice(i + nato.size));
							}
						}
						break;
				}
			} else if (dat.indexOf("\n\n")) {
				console.log("不规范的结束符");
				nato.endLnk.call(this);
			} else {
				console.log("理论上不太会出现的HTTP头信息不完整");
				nato.buf = dat;
				nato.size = -1;
			}
		} else if (nato.size > 0) {
			var d = false;
			if (dat.length > nato.size) {
				// 理论上不会出现的数据溢出
				d = dat.slice(nato.size);
				dat = dat.slice(0, nato.size);
			}
			nato.buf.push(dat);
			nato.size -= dat.length;
			if (nato.size === 0) {
				nato.doWrk(nato.clsBuf.concat(nato.buf));
				if (d) {
					console.log("理论上不会出现的数据溢出");
					// nato.hdDat(d);
				}
			}
		} else {
			console.log("补充理论上不太会出错的HTTP头信息");
			nato.size = 0;
			nato.hdDat(nato.clsBuf.concat([nato.buf, dat]));
		}
	},

	// 反馈处理
	hdRtn: function (isLnk) {
		if (nato.ws.length) {
			nato.sendWrk();
		} else if (isLnk) {
			nato.keepLink = setTimeout(nato.kepLnk, nato.ktim);
		} else {
			nato.kepLnk();
		}
	},

	// 保持对接，发送心跳
	kepLnk: function () {
		nato.keepLink = 0;
		nato.send(nato.socket, "lnk");
	},

	// 发送任务
	sendWrk: function () {
		// ... 主内容 ...

		nato.pw = nato.ws;
		nato.ws = [];
	},

	// 执行任务
	doWrk: function (dat) {
		// ... 主内容 ...

		// 连接继续
		nato.hdRtn();
	},

	// 添加任务
	addWrk: function (s, dat) {
		// ... 主内容 ...

		nato.send(s, "oOK", nato.clsBuf.from("OK!"));
		s.end();

		// 若处于心跳期，则停止心跳，发送任务
		if (nato.keepLink) {
			clearTimeout(nato.keepLink);
			nato.keepLink = 0;
			nato.sendWrk();
		}
	},

	// 发送信息
	send: function (s, nam, dat) {
		if (s) {
			var d = "HTTP/1.1 200 " + nam + "\r\nConnection: keep-alive\r\nContent-Length: ";
			if (dat) {
				d = nato.clsBuf.concat ([
					nato.clsBuf.from (d + dat.length + "\r\n\r\n"),
					dat
				]);
			} else {
				d += "0\r\n\r\n";
			}
			s.write(d);
		}
	},

	// 测试回复
	test: function (s, msg) {
		s.write("HTTP/1.1 503\r\nConnection: close\r\nContent-Length: " + msg.length + "\r\n\r\n" + msg);
		s.end();
	},

	// 错误处理
	hdErr: function (e) {
		this.end();
	}
};


net.createServer(nato.listener).listen(nato.port);
console.log("LZRnatsrv start in " + nato.port);
