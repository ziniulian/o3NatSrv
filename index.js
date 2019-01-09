require("lzr");
LZR.load(["LZR.Node.Srv"]);

var srv = new LZR.Node.Srv ({
	ip: process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0",
	port: process.env.OPENSHIFT_NODEJS_PORT || 8080
});
var pwd = process.env.OPENSHIFT_NODEJS_NATPWD || "/zi%niu%lian";

srv.ro.setStaticDir("/", "./web");
srv.use("*", function (req, res) {
	res.status(404).send("404!");
});

var wsio = require("socket.io").listen(srv.getApp());

// 只对 pwd 命名空间的连接做处理
wsio.of(pwd).on("connection", function (socket) {
	console.log("connection : " +
		socket.request.connection.remoteAddress + ":" +
		socket.request.connection.remotePort + " -- " +
		socket.request.connection.localAddress + ":" +
		socket.request.connection.localPort + " -- " +
		socket.nsp.name
	);
	socket.on("disconnect", function () {
		console.log("disconnect");
	});
	socket.on("hello", function (dat) {
		console.log("hello : " + dat);
		socket.emit("Hi", {hi: dat});
		// socket.disconnect();
	});
	socket.on("message", function (dat) {
		console.log("msg : " + dat);
	});
});

srv.start();
console.log("server start " + srv.ip + ":" + srv.port);
