var net = require("net");

// 内网渗透对象
var nato = {
	clsBuf: global.Buffer || require("buffer").Buffer,
	pwd: process.env.OPENSHIFT_NODEJS_NATPWD || "pwd",
	pwdLen: 3,
	port: 8080,

	socket: null,
	size: 0,		// 尚未接收完的数据大小
	buf: null,	// 已接收到的数据缓存
	keepLink: 0,	// 心跳ID
	ws: [],		// 任务堆
	rs: {},		// 连接池
	sn: 0,

	ktim: 17000,
	max: 100,

	// 监听器
	listener: function (s) {
		if (nato.socket) {
			nato.test(s, "OK!");
		} else {
			s.on("data", nato.lnk);
		}
	},

	// 密码校验
	chkPwd: function (p) {
		return p === nato.pwd;
	},

	// 对接
	lnk: function (dat) {
		var n = 10 + nato.pwdLen;
		if ((dat.length > n) && (dat.toString("utf8", 5, 10) === "/lnk/") && (dat.toString("utf8", n, (n + 2)) === "/ ") && nato.chkPwd(dat.toString("utf8", 10, n))) {
			nato.socket = this;
			this.removeAllListeners("data");
			this.on("error", nato.hdErr);
			// this.on("error", nato.endLnk);	// 实际运行时，将不显示错误信息
			this.on("end", nato.endLnk);
			this.on("data", nato.hdDat);
			nato.initLnk();
		} else {
			nato.test(this, "no link");
		}
	},

	// 停止对接
	endLnk: function () {
		if (nato.keepLink) {
			clearTimeout(nato.keepLink);
			nato.keepLink = 0;
		}
		if (nato.socket) {
			var s = nato.socket;
			nato.socket = null;
			// 清空所有任务
			// 清空连接池
			s.end();
		}
console.log("link end!");
	},

	// 对接初始化
	initLnk: function () {
		nato.size = 0;
		nato.keepLink = 0;
		nato.sn = 0;
		nato.ws = [];
		nato.rs = {};
		nato.socket.write("HTTP/1.1 200 lnk\r\nConnection: keep-alive\r\nContent-Length: 3\r\n\r\nlnk");
console.log("linked");
	},

	// 保持对接，发送心跳
	kepLnk: function () {
		nato.keepLink = 0;
		nato.socket.write("HTTP/1.1 200 lnk\r\nConnection: keep-alive\r\nContent-Length: 0\r\n\r\n");
	},

	// 接收信息
	hdDat: function (dat) {
		if (nato.size) {
			nato.buf.push(dat);
			nato.size -= dat.length;
			if (nato.size === 0) {
				nato.doWrk(nato.clsBuf.concat(nato.buf));
			} else if (nato.size < 0) {
				// 有问题，不应出现这种状况
console.log("数据溢出");
				nato.endLnk();
			}
		} else {
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
					i = dat.indexOf("\r\n\r\n", j, "utf8") + 4;
					j = dat.length - i;
					if (nato.size === j) {
						nato.size = 0;
						nato.doWrk(dat.slice(i));
					} else {
						nato.size -= j;
						nato.buf = [dat.slice(i)];
					}
					break;
			}
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

	// 测试回复
	test: function (s, msg) {
		s.write("HTTP/1.0 404\r\nConnection: close\r\nContent-Length: " + msg.length + "\r\n\r\n" + msg);
		s.end();
	},

	// 错误处理 （临时测试使用，实际运行时不需要）
	hdErr: function (e) {
console.log ("Err : " + e.message);
		nato.endLnk();
	}
};


net.createServer(nato.listener).listen(nato.port);
console.log("LZRnatsrv start in " + nato.port);
