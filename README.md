# o3NatSrv
内网渗透服务端
=======

公元2018年12月18日起，OpenShift3 的免费服务将不能再永久使用，一个服务只能使用60天。想用 OpenShift3 维持服务的运行已不再可靠。现决定用 OpenShift3 的Web服务做公网代理，来访问我内网主机部署的服务。

*******************************************************************

单通道读写流程：
-------------------------------------------------------------------

- 基本对接：
	1. 客户端：发送对接指令
	1. 服务端：验证指令
	1. 服务端：对接后，每17秒发一次心跳，保持连接
	1. 客户端：接收到心跳后，向服务端发送心跳返回
- 交互的信息分为三大类型：
	1. 心跳（lnk）：在网络空闲时相互传递，以保持连接不断线。由服务端发起，客户端响应。
	1. 任务（wrk）：实际工作的任务。包括四个功能：
		1. 服务端的请求
		1. 客户端的应答
			- 请求和应答不对数据内容进行分析，所以一次请求或应答都有可能被拆分成多个不连续的任务。
			- 多个任务可打包一并发送。打包格式：[ID号],[数据大小],[数据][下一个任务的ID号],[下一个任务的数据大小],[下一个任务的数据]...
			- 若数据大小为0，则表示关闭该ID号的子连接。
		1. 关闭子连接
		1. 停止对接（可能无用，暂时不实现）
	1. 反馈（rtn）：由客户端发送，当接收到服务端的任务类信息后，等待短暂时间（暂定100毫秒），若无法及时做出回应。则会先向服务端传回一个反馈信息。
- 请求：
	1. 服务端：收到的请求全部编上ID号，放入任务堆（先入先出）
	1. 服务端：任务放入任务堆后，检查连接是否处于心跳等待期。若在等待期，则停止等待，并立即向客户端发送所有任务。
	1. 服务端信息处理：
		- 心跳：收到客户端的心跳信息，检查任务堆中有无任务：
			1. 有任务，向客户端发送所有任务
			1. 无任务，进入心跳等待期
		- 任务：收到客户端的任务信息后，会立即完成所有任务，接着检查任务堆中有无任务：
			1. 有任务，向客户端发送所有任务
			1. 无任务，向客户端发送一个心跳
		- 反馈：收到客户端的任务信息后，必须立即回复。检查任务堆中有无任务：
			1. 有任务，向客户端发送所有任务
			1. 无任务，向客户端发送一个心跳
- 应答：
	1. 客户端：任务被分为两堆，一堆未完成的任务，一堆已完成的任务。只有已完成的任务才会向服务端传送。
		- 问题点：什么样的任务算是未完成的任务？（临时解决办法：暂定没有断开的子连接就是未完成的任务。）
	1. 客户端信息处理：
		- 任务：立即执行所有任务，而后根据以下情况返回信息：
			1. 有完成的任务，立即发送所有已完成的任务
			1. 只有未完成的任务，等待短暂时间，再发送反馈信息或任务信息
			1. 什么任务都没有，发送心跳信息
		- 心跳：根据以下情况返回信息：
			1. 有完成的任务，立即发送所有已完成的任务
			1. 只有未完成的任务，等待短暂时间，再发送反馈信息或任务信息
			1. 什么任务都没有，发送心跳信息

*******************************************************************

缓存：
-------------------------------------------------------------------

- 简单的内网渗透，接收拆包后的数据依然存在顺序问题。
- 并发测试
- O3 上的测试
	- OpenShift3 中间有转发。客户端断开连接时，不会触发服务端的end事件。故需要给服务端发送一个断开指令。
	- OpenShift3 有 timeout 时限，连接无法长时间挂机！时限约25秒左右。
	- OpenShift3 会自动修改 HTTP 头，增加 cookie 等信息
	- 实际传输数据大小与 Content-Length 不相同时，将会导致通信的阻塞。
	- 拆包后依然存在数据接收的乱序问题
- WebSocket连接测试
	- 测试结果 ：
		- 本地测试：因为没有 OpenShift3 对连接的访问控制，所以很理想、很好用、很完美。
		- 服务发布到 OpenShift3 以后：
			- 网页端测试勉强可用。初期连接不稳定，且速度很慢，但重连两三次后，网页端的WebSocket通信就会变得非常稳定，且速度很快，连接挂机十几分钟都不会断线。（至于为什么后边会变得稳定，其原理尚不明确，浏览器监测不到任何数据的传输变化，也不知这种稳定的连接是Ajax还是WebSocket实现的。）
			- 客户端测试非常糟糕。连接成功率不到30%，且成功连接后不出30秒必断线，再次重连成功率也不会变高。且连通后传输速度非常慢，无法正常使用。
- 放弃 WebSocket ，改用普通的 HTTP 来实现 O3 的内网渗透功能
- 新版对接测试结果：
	- 测试最大连接数 ：
		- 本地测试 : 最多 6 个
		- O3测试 ： 因网络状况及其差，预计最多连接也是 6 个
	- 无论本地、或O3，都会有数据拼接的情况发生。
	- 测试能否响应客户端的end事件，删除对应连接
		- 本地能响应到 end 事件
		- O3响应到的是 error 事件 （read ECONNRESET）
	- O3连接时间：
		- 30 秒：偶尔能持续连接，大部分都会断线。
		- 25 秒：稳定时，可以持续保持连接，不稳定时也有掉线的情况
		- 20 秒：安全起见，设置为 20 秒。
	- 网络不稳定时，停止对接后，客户端不会收到 next 的处理结果，而是直至 timout 为止。
- 停止对接后，部分网页 timeout 问题测试结果：
	- 服务端程序确实执行力 next 处理，但客户端实际无法接收到处理结果是 O3 的管控导致，与服务端程序无关。
- 简单HTTP渗透的BUG ：
	- 由于连接数最大为6，若六个连接都被阻塞，则真正的功能性请求（如：获取请求、发送应答等）将无法正常工作。
	- 简单解决办法：限制连接数小于6，但这样会导致客户端经常报过载错误。
- 双通道测试结果：
	- 在O3上，接收端还是无法持续接收，不设 Content-Length，则不接收，设置 Content-Length 后，也是O3将相等数量的数据接收完毕后才转发至我的服务端，在数据没有接收完毕之前，我的服务端什么都收不到。

*******************************************************************

计划：
-------------------------------------------------------------------

- 实现内网渗透
- 增加密码校验的复杂度
- 使用 ws 进行 WebSocket 连接测试
- OpenShift3 免费服务规定：
	1. 每72小时必须休息18小时
	1. 每30分钟不活动将会自动休眠
	1. 60天后服务自动过期
	故，为保证服务的稳定性，需考虑服务的多班倒。

*******************************************************************





开发明细：
-------------------------------------------------------------------

##### 2019-1-13 （ 单通道再测试 ）：
	O3上，单通道对接，每次连续通信三个回合后，连接会自动关闭。不知原因。现将时间间隔缩短，返回值加入一点数据，再次进行测试。

##### 2019-1-13 （ 对所有连接都添加上错误处理 ）：

##### 2019-1-13 （ 单通道基本对接测试 ）：
	改用单通道进行对接

##### 2019-1-12 （ 双通道对接测试 ）：
	改用读写双通道的 socket 通信进行对接

##### 2019-1-11 （ 简单渗透 ）：
	此方法受最大连接数为 6 的限制

##### 2019-1-11 （ 对接再测试 ）：
	连接最大值和连接间隔不再设为可变参数
	主要测试停止对接时的 timeout 问题

##### 2019-1-11 （ 新版对接测试 ）：
	放弃 WebSocket ，改用普通的 HTTP 来实现 O3 的内网渗透功能

##### 2019-1-9 （ WebSocket连接测试 ）：

##### 2019-1-8 （ O3测试结果 ）：

##### 2019-1-8 （ O3测试 ）：

##### 2019-1-8 （ 并发测试 ）：
	目前的方式不能实现并发

##### 2019-1-8 （ 简单对接 ）：
	实现了简单的内网渗透
	接收拆包后的数据依然存在顺序问题

##### 2018-12-26 （ 初建 ）：
	初建

*******************************************************************
