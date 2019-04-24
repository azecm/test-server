import * as WebSocket from "ws";
import * as http from "http";
//import * as crypto from "crypto";
import * as fw from "./fw";


//interface WebSocket {
//    upgradeReq: any
//    send: any
//}

/*
var server = http.createServer(function (req, res) {
	res.statusCode = 200;
	let content = "Привет мир!";
	let buffer = new Buffer(content || "", "utf-8");
	res.setHeader("Content-Type", "text/plain; charset=UTF-8");
	res.setHeader("Content-Length", buffer.length.toString());
	res.end(buffer);
});
server.listen(8080);
*/


const wsHost = "";
const wsUrl = "/online/stratego/";
interface IWSMessage {
	cmd: string
	data: any
}

interface IRoom {
	[s: string]: {
		user: SocketData[]
		game: string
		state: number
		key: string
		board: number[]
		move: number
	}
}

enum User { second, first }
enum moveState {
	none, both, win, attack, defence
}
enum FName {
	none,
	spy, scout, miner, sergeant, lieutenant,
	captain, major, colonel, general, marshal,
	flag, bomb, opponent
}

export class SocketList {
	wait = <SocketData[]>[]
	room = <IRoom>{}
	boardZero = [42, 43, 52, 53, 46, 47, 56, 57]
	constructor(server: http.Server) {
        let wss = new WebSocket.Server({ server: server });
		wss.on("connection", this.connection);
	}
    private connection = (ws: WebSocket) => {

        let upgradeReq = (ws as any).upgradeReq;

        let host = <string>("origin" in upgradeReq.headers && upgradeReq.headers.origin || "");
        let reHost = /[a-z\-\.]+$/;
        if (reHost.test(host)) {
            let m = host.match(reHost);
            if(m) host = m[0];
        }
        let url = upgradeReq.url;
        if (host != wsHost || upgradeReq.method != "GET" || (url && url.substr(0, wsUrl.length) != wsUrl)) {
			ws.close(1000, "player-disconnect");
			return;
		}
		new SocketData(ws, this);
	}
	add(data: SocketData) {
		this.wait.push(data);
        let list = this.wait.map((line) => { return { name: line.name, key: line.key, flag: line.key == data.key } });
		this.sendTo(this.wait, "waitlist", list);
	}
	invite(srcKey: string, dstKey: string, state: number) {
        let srcPos = -1, dstPos = -1;
        let i = this.wait.length;
		while (i--) {
			switch (this.wait[i].key) {
				case srcKey: srcPos = i; break;
				case dstKey: dstPos = i; break;
				default: break;
			}
		}
		if (srcPos > -1 && dstPos > -1) {
			if (state == 1) {
                let src = this.wait[srcPos];
                let dst = this.wait[dstPos];
				dst.send("invite", { name: src.name, key: src.key });
			}
			else {
                if (srcPos < dstPos) {
                    //[srcPos, dstPos] = [dstPos, srcPos];
                    let t1 = srcPos, t2 = dstPos;
                    dstPos = t1, srcPos = t2;
                }
                let src = this.wait.splice(srcPos, 1)[0];
                let dst = this.wait.splice(dstPos, 1)[0];
				this.sendTo(this.wait, "waitremove", [srcKey, dstKey]);

                let roomKey = fw.codeAlpha(new Date().getTime());

				this.roomInit(roomKey, src, User.first);
				this.roomInit(roomKey, dst, User.second);

                let users = this.room[roomKey].user;

				users[User.first].send("gameinit", { room: roomKey, num: User.first });
				users[User.second].send("gameinit", { room: roomKey, num: User.second });
			}
		}
	}
	ready(roomKey: string, userNum: number, board: number[]) {
		if (!this.room[roomKey]) return;
        let users = this.room[roomKey].user;
		if (!users[userNum]) return;
		users[userNum].ready = true;

		this.roomSet(roomKey, userNum, board);

        let allReady = true;
        let i = users.length;
		while (i--) {
			if (!users[i].ready) {
				users[i].send("gamewait", users[userNum].name);
				allReady = false;
			}
		}
		if (allReady) {
			this.sendTo(users, "gamestart");
			this.nextMove(roomKey, [0, 0]);
			//let that = this;
			//setTimeout(function () { that.nextMove(roomKey, [0, 0]) }, 500);
		}
	}
	nextMove(roomKey: string, data: number[]) {
        let room = this.room[roomKey];
		if (!room) return;

        let n1 = data[0], n2 = data[1], c1 = 0, c2 = 0, res = 0;
		if (room.move) {

            let flagFirst = room.move % 2 == User.first;
			if (flagFirst) {
				n1 = 99 - n1, n2 = 99 - n2;
			}

			c1 = room.board[n1], c2 = room.board[n2];
			if (flagFirst) c1 -= 100;
			else if (c2) c2 -= 100;

			room.board[n1] = FName.none;

			if (c2) {
				if (c1 == c2) {
					// оба проиграли
					res = moveState.both;
					room.board[n2] = FName.none;
				}
				else if (c2 == FName.flag) {
					// конец игры
					res = moveState.win;
				}
				else if ((c1 == FName.spy && c2 == FName.marshal) || (c1 == FName.miner && c2 == FName.bomb) || (c1 > c2 && c2 != FName.bomb)) {
					// победа c1
					res = moveState.attack;
					room.board[n2] = c1 + (flagFirst ? 100 : 0);
				}
				else {
					// победа c2
					res = moveState.defence;
					room.board[n2] = c2 + (flagFirst ? 0 : 100);
				}
			}
			else {
				room.board[n2] = c1 + (flagFirst ? 100 : 0);
			}
		}

		// передаем результаты предыдущего хода и делаем следующий

		room.move++;

		room.user[User.first].send(
			"move", [User.first == room.move % 2, 99 - n1, 99 - n2, c1, c2, res, room.move]
		);

		room.user[User.second].send(
			"move", [User.second == room.move % 2, n1, n2, c1, c2, res, room.move]
		);
	}
	chat(roomKey: string, userNum: number, text: string) {
		if (!this.room[roomKey]) return;
        let users = this.room[roomKey].user, i = users.length;
		while (i--) {
			if (users[i].num != userNum) {
				users[i].send("chat", text);
			}
		}
	}
	sendTo(list: { send: (cmd: string, data?: any) => void }[], cmd: string, data?: any) {
        let i = list.length;
		while (i--) list[i].send(cmd, data);
	}
	remove(data: SocketData, reason: string) {
		if (data.room) {
			if (this.room[data.room]) {
				if (reason) {
                    let users = this.room[data.room].user;
					users.splice(data.num, 1);
                    let i = users.length;
					while (i--) {
						users[i].close(1000, reason)
					}
					delete (this.room[data.room]);
				}
			}
		}
		else {
            let pos = this.wait.indexOf(data);
			if (pos > -1) {
				this.wait.splice(pos, 1);
				this.sendTo(this.wait, "waitremove", [data.key]);
			}
		}
	}
	roomSet(roomKey: string, userNum: number, board: number[]) {
        let im = board.length;
        for (let i = 0; i < im; i++) {
			if (userNum == User.first) {
				if (board[im - 1 - i])
					this.room[roomKey].board[i] = 100 + board[im - 1 - i];
			}
			else {
				if (board[i])
					this.room[roomKey].board[i] = board[i];
			}
		}
	}
	userFind(roomKey: string, ws: WebSocket, num: number) {
		if (!this.room[roomKey]) return;
        let room = this.room[roomKey];
		if (room.user[num]) {
			room.user[num].setWS(ws);
		}
	}
	roomInit(roomKey: string, user: SocketData, num: number) {
		user.room = roomKey;
		if (!this.room[roomKey]) {
			this.room[roomKey] = { key: roomKey, game: "", state: 0, board: [], user: [], move: 0 };
            let board = this.room[roomKey].board;
            for (let i = 0; i < 100; i++) {
				board.push(this.boardZero.indexOf(i) == -1 ? 0 : -1);
			}
		}
		user.num = num;
		this.room[roomKey].user[num] = user;
	}

	onMessage = (user: SocketData, msg: IWSMessage) => {
		switch (msg.cmd) {
			case "add":
				if (typeof (msg.data.name) == "string" && typeof (msg.data.time) == "number") {
					if (this.wait.length < 50 && Object.keys(this.room).length < 50) {
						user.set(msg.data.name, msg.data.time);
						this.add(user);
					}
				}
				break;
			case "reconnect":
				this.userFind(msg.data.room, user.getWS(), msg.data.num);
				break;
			case "roominit":
				user.set(msg.data.name, msg.data.time);
				this.roomInit(msg.data.room, user, msg.data.num);
				break;
			case "gameinit":
				user.set(msg.data.name, msg.data.time);
				this.roomInit(msg.data.room, user, msg.data.num);
				this.roomSet(msg.data.room, msg.data.num, msg.data.board);
				if (msg.data.ready) {
					user.ready = true;
				}
				if (this.room[msg.data.room].move < msg.data.move) {
					this.room[msg.data.room].move = msg.data.move;
				}
				break;
			case "invite":
				if (typeof (msg.data) == "string") this.invite(user.key, msg.data, 1);
				break;
			case "agree":
				if (Array.isArray(msg.data)) this.invite(msg.data[0], msg.data[1], 2);
				break;
			case "ready":
				if (Array.isArray(msg.data)) {
					this.ready(user.room, user.num, msg.data);
				}
				break;
			case "chat":
				this.chat(user.room, user.num, msg.data);
				break;
            case "next":
                if (Array.isArray(msg.data) && msg.data.length == 2 && typeof (msg.data[0]) == "number" && typeof (msg.data[1]) == "number") {
                    this.nextMove(user.room, msg.data);
                }
                break;
			default:
				break;
		}
	}
}

class SocketData {
	name!: string
	key!: string
	time!: number
	ready = false
	room!: string
	num!: number
	private pingPongSign = "@"
	private data!: string
	private ws!: WebSocket
	private list: SocketList
	constructor(ws: WebSocket, list: SocketList) {
		this.list = list;
		this.setWS(ws)
	}
	private onmessage = (data: string) => {
		if (data == this.pingPongSign) this.ws.send(data);
		else {
            let msg: any
			try { msg = JSON.parse(data); }
			catch (e) { }
			if (msg) {
				this.list.onMessage(this, msg);
				if (msg.key) this.ws.send(msg.key.toString());
			}
		}
	}
	private onclose = (e: number, reason: string) => {
		if (e == 1001 && !reason) reason = "player-disconnect";
		this.list.remove(this, reason);
	}
	private sendResult = (err: Error) => {
		if (err) {
			//fw.log("socket send error", err, this.data);
			//this.sendData();
		}
		else {
			this.data = "";
		}
	}
	private sendData() {
		this.ws.send(this.data, this.sendResult);
	}
	close(code: number, reason: string) {
		this.ws.close(code, reason);
	}
	send(cmd: string, data?: any) {
		this.data = data ? JSON.stringify({ cmd: cmd, data: data }) : JSON.stringify({ cmd: cmd });
		this.sendData();
	}
	getWS() {
		return this.ws;
	}
	setWS(ws: WebSocket) {
		this.ws = ws;
		ws.on("message", this.onmessage);
		ws.on("close", this.onclose);
		if (this.data) this.sendData();
	}
	set(name: string, time: number) {
		this.name = name;
		this.time = time;
		let key = parseInt(((this.ws as any).upgradeReq.headers["user-agent"] || "0").replace(/[^1-9]/g, ""), 10) + this.time;
		this.key = fw.codeAlpha(key);
	}
}