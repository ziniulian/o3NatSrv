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
	rs: {},		// 连接池
	sn: 0,

	ktim: 5000,
	max: 100,

	// 重连测试数据
	reLinkTestDat: [],

	// 监听器
	listener: function (s) {
		s.on("error", nato.hdErr);
		s.on("data", nato.first);
	},

	// 密码校验
	chkPwd: function (p) {
		return p === nato.pwd;
	},

	// 初次连接
	first: function (dat) {
		// 流程：
		// 检查HTTP头 \r\n\r\n ， 若没有则报错
		// 检查是否为对接连接的交互信息（lnk、rtn、wrk）
			// 是，检查是否为有密码的对接指令
				// 是，密码检查
					// 正确：
						// 若已存在 对接连接（ socket ），则删除原对接连接
						// 将对接连接改为此连接
					// 错误：报错
				// 否，检查是否存在对接连接（ socket ）
					// 存在：
						// 删除原对接连接
						// 将对接连接改为此连接
						// 处理交互信息
					// 不存在：报错
			// 否，检查是否存在对接连接（ socket ）
				// 存在：添加任务
				// 不存在：报错

		var i, e = false;
		i = dat.indexOf("\r\n\r\n");
		if (i) {
			switch (dat.toString("utf8", 5, 10)) {
				case "/lnk/":	// 心跳
					if (dat.toString("utf8", 10, 11) === " ") {
						if (nato.socket) {
							nato.endLnk.call(nato.socket);
							nato.lnk(this, dat);
						} else {
							e = true;
							nato.send(this, "nLLOK", nato.clsBuf.from("no link + lnk ..."));
						}
					} else {
						if (nato.chkPwd(dat.toString("utf8", 10, nato.pwdLen))) {
							if (nato.socket) {
								nato.endLnk.call(nato.socket);
							}
							nato.lnk(this);
						} else {
							e = true;
							nato.send(this, "nPOK", nato.clsBuf.from("no pwd ..."));
						}
					}
					break;
				case "/rtn/":	// 反馈
				case "/wrk/":	// 任务
					if (nato.socket) {
						nato.endLnk.call(nato.socket);
						nato.lnk(this, dat);
					} else {
						e = true;
						nato.send(this, "nLWOK", nato.clsBuf.from("no link + wrk ..."));
					}
					break;
				default:
					if (nato.socket) {
						// TODO: 添加任务 ...
						nato.send(this, "oOK", nato.clsBuf.from(JSON.stringify(nato.reLinkTestDat)));
						this.end();
					} else {
						e = true;
						nato.send(this, "nLOK", nato.clsBuf.from("no link ..."));
					}
					break;
			}
		} else {
			e = true;
			nato.send(this, "nRN", nato.clsBuf.from("no \\r\\n\\r\\n ..."));
		}
		if (e) {
			// nato.send(this, "oOK", nato.clsBuf.from("欢迎来到犟子工作室!"));
			this.end();
		}
	},

	// 对接
	lnk: function (s, dat) {
		nato.socket = s;
		nato.size = 0;
		s.removeAllListeners("data");
		s.removeAllListeners("error");
		s.on("error", nato.endLnk);
		s.on("end", nato.endLnk);
		s.on("data", nato.hdDat);
		if (dat) {
			nato.reLinkTestDat.push(Date.now() + " : ReLink");
			nato.hdDat(dat);
		} else {
			nato.reLinkTestDat.push(Date.now() + " : link");
			nato.send(s, "lnk");
		}
	},

	// 停止对接
	endLnk: function () {
		if (nato.keepLink) {
			clearTimeout(nato.keepLink);
			nato.keepLink = 0;
		}
		if (nato.socket) {
			nato.socket = null;
			nato.reLinkTestDat.push(Date.now() + " : cut");
			// console.log("已断开 : " + Date.now());
		}
		this.end();
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

		nato.ws = [];
	},

	// 执行任务
	doWrk: function (dat) {
		// ... 主内容 ...

		// 连接继续
		nato.hdRtn();
	},

	// 添加任务
	addWrk: function (id, lng, dat) {
		// ... 主内容 ...

		// 若处于心跳期，则停止心跳，发送任务
		if (nato.keepLink) {
			clearTimeout(nato.keepLink);
			nato.keepLink = 0;
			nato.sendWrk();
		}
	},

	// 发送信息
	send: function (s, nam, dat) {
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
