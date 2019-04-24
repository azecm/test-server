import * as fs from "fs";
import * as http from "http";


import * as fw from "./fw";
import { SocketList } from "./worker-ws";
import { config } from "./config";
import { ServerRequest } from "./server-request";

import { route as routeSite } from "./app-site/main";
//import {route as routeMail} from "./app-mail/main";


fw.setProcOwn();
fw.onError();

const server = http.createServer();
server.on("request", onRequest);
server.on("clientError", onError);

if (config.port) {
    server.listen(config.port);
}
else {
    if (fs.existsSync(config.socket)) {
        fs.unlinkSync(config.socket);
    }
    server.listen(config.socket);
}
new SocketList(server);

const ipList = [] as string[];

function onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    if (typeof (req.url) != "string") {
        res.statusCode = 404;
        res.end();
        console.log(fw.logDate(), "404", (req.headers["host"] || '') + req.url, "URL not string");
        return;
    }
    if (req.url.substr(0, 6) == "/goto/") {
        
        return;
    }

    const ip = req.headers["remote-addr"] as string || "";
    if (req.url.startsWith('/xhr/search')) {
        const key = ip + '-' + Math.floor(new Date().getTime() / 15000);

        if (ipList.includes(key)) {
            res.statusCode = 200;
            //responce.end(buffer);
            res.end(new Buffer("ok", "utf-8"));
            console.log(fw.logDate(), "404", (req.headers["host"] || '') + req.url, "/xhr/search слишком часто");
            return;
        }
        ipList.push(key);
        while (ipList.length > 100) ipList.shift();
    }

    if (req.url.substr(0, 6) == "/xhr2/") req.url = "/xhr/" + req.url.substr(6);

    if (req.url.substr(0, 5) != "/xhr/") {
        res.statusCode = 404;
        res.end();
        console.log(fw.logDate(), "404", req.headers["host"] + req.url);
        return;
    }

    let request = new ServerRequest(req, res);

    if (request.host == "bbb.hnh.ru") {
        request.flagMail = true;
        //routeMail.route(request);
    }
    else {
        routeSite.route(request);
    }
    //request = req = res = void (0);
    //res.writeHead(200, { 'Content-Type': 'text/plain' });
    //res.end('okay');
}

function onError(err: any, socket: any) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    console.log(fw.logDate(), "400 Bad Request", err);
}