
// для работы сайтов
// node /usr/local/www/app.back/app-site/helper.js siteTreePostgreAll
// node /usr/local/www/app.back/app-site/helper/user.js updateAll


// ps aux | grep node
// kill -9 $(ps aux | grep "\snode\s" | awk "{print $2}")
// node /usr/local/www/app.back/server.js
// kill -HUP 67725
// ./node-app-restart

// npm install -g typescript

// "C:\Program Files (x86)\Microsoft SDKs\TypeScript\2.6\tsc.exe"

//declare module "v8" {
//	export function setFlagsFromString(string: string): void;
//}
//"use strict";

//import * as fs from "fs";
//import * as v8 from "v8";
//import * as path from "path";
import * as cluster from "cluster";
//import * as http from "http";
import { execSync, spawn as spawnAsync } from "child_process";
import * as fw from "./fw";
//import {config} from "./config";

//const v8 = require("v8");
// --use_strict --harmony
//v8.setFlagsFromString("--use_strict");

process.chdir(__dirname);
cluster.setupMaster({ exec: "./worker.js" });

const glob = { counter: 0 };

fw.setProcOwn();

if (cluster.isMaster) {
	if (process.argv.slice(-1)[0] == "timer") timer();
	else master();
}

function timer() {
	setTimeout(function () {
		execSync("/root/node-app-start");
		process.exit(0);
	}, 1);
}
function master() {
	
	console.log(fw.logDate(), "Started", process.pid);

	cluster.on("exit", onExit);
	cluster.on("listening", onListening);

	mail("node fork");
	cluster.fork();

	/*
	function addEvent() {
		Object.keys(cluster.workers).forEach(function (id) {
			(<any>cluster.workers)[id].on("message", function (msg: any) {
				if (typeof (msg) == "string" && msg == "reload") reload();
			});
		});
	}
	function reload() {
		console.log(fw.logDate(), "restarting all slaves");
		// important: force node.js to reload all js sources
		delete (require.cache);

		for (let id in cluster.workers) {
			//cluster.workers[id].disconnect();
			cluster.workers[id].kill();
			//cluster.workers[id].send("stop");
		}
	};
	*/
}
function onExit(worker: cluster.Worker, code: number, signal: string) {
	console.log(fw.logDate(), "worker " + worker.process.pid + " died (" + (signal || code) + ")");
	glob.counter++;
	if (glob.counter == 1) {
		mail("node fork (reload)");
		cluster.fork();
	}
	else {
		mail("node close");
        let child = spawnAsync("node", ["--use_strict", fw.pathType.app +"server.js", "timer"], { detached: true, stdio: ["ignore", "ignore", "ignore"] });
		child.unref();
		process.exit(0);
	}
}
function onListening(worker: cluster.Worker, address: { address: string, port: number }) {
	console.log(fw.logDate(), "A worker [" + worker.process.pid + "] is now connected to " + address.address + ":" + address.port + "(listening)");
}
function mail(message: string) {
    // npm install -g email
    let Email = require("email").Email;
    let myMsg = new Email({ from: "", to: "", subject: fw.toMimeUTF(message), body: message });
    myMsg.send(function (err: any) {
        if (err) console.log(err);
    });

}
