
import * as fs from "fs";
import * as readline from "readline";
import * as crypto from "crypto";

import * as fw from "../fw";

const __reLine = /([^\s]+) ([^\s]+) (\d\d\d) \[([^\]]+)\] ([^\s]+) (\d+) (\d+) "([^"]+)" "([^"]+)" "([^"]+)"/;
const __reUserOn = /^\/js\/useron\.gif/;
const __reIgnore = /www\.host\-tracker\.com/i;
const __reFirst = /^\/([^\/]*)/;
const __reFirstTrue = /^[a-z0-9-_]+$/i;
const __folderDisabled = new Set(['js', 'goto', 'xhr', 'json']);

const __nameStatSrc = 'statSrc.json';
const __nameData = 'statData-2.json';

//scalac ReadFileByScala.scala -d ReadFileByScala.jar
//time scala ReadFileByScala
//2.228u 0.110s 0:01.52 153.2%    30+170k 4+4io 4pf+0w

//time java -jar main.jar
//1.390u 0.101s 0:00.96 155.2%    23+170k 0+4io 0pf+0w

// time node read-file.js
// 0.693u 0.039s 0:00.70 102.8%    24850+398k 1+0io 0pf+0w

// time ./first-rust
// 1.613u 0.031s 0:01.64 100.0%    1643+334k 0+0io 0pf+0w

// time java -jar helloLambdaTest.jar
// 1.071u 0.078s 0:00.80 142.5%    69+175k 0+4io 0pf+0w

// 6546 root         20  20    0  5747M   587M uwait   4   1:01 103.03% java
// 107.305u 3.148s 1:42.07 108.2%  5+167k 0+4io 0pf+0w

//  6650 root         10  20    0   755M   190M uwait   2   1:33 100.98% node
// 177.600u 2.889s 2:54.10 103.6%  24703+396k 0+0io 0pf+0w

/*

window.addEventListener("unload", logData, false);

function logData() {
  navigator.sendBeacon("/log", analyticsData);
}

*/


// node /usr/local/www/app.back/script/nginx.log-new.js

class LogLine {
    ip: string;
    host: string;
    status: number;

    // 20/Jun/2018:00:00:33 +0300
    dateTime: string;

    duration: number;
    timeIn: number
    timeOut: number

    type: string;
    url: string;
    protocol: string;

    folder: string;

    referer: string;
    browser: string;
    constructor(data: string[]) {
        this.ip = data[1];
        this.host = data[2];
        this.status = parseInt(data[3], 10);

        // 20/Jun/2018:00:00:33 +0300
        this.dateTime = data[2];

        this.duration = parseFloat(data[5]);
        this.timeIn = parseInt(data[6], 10);
        this.timeOut = parseInt(data[7], 10);

        const reqData = data[8].split(" ");
        this.type = reqData[0];
        this.url = reqData[1];
        this.protocol = reqData[2];

        this.referer = data[9];
        this.browser = data[10];

        // =============

        const m = this.url.match(__reFirst);
        this.folder = m ? m[1] : '';

    }
    isGET() {
        return this.type == 'GET';
    }
}


function getHash(text: string) {
    return crypto.createHash('sha1').update(text).digest('hex');
}

function isToy(host:string){
    return host == '';
}


class ReadByLine {
    constructor(pathToFile: string) {
        this.onLine = this.onLine.bind(this);
        this.onEnd = this.onEnd.bind(this);
        this.beforeStart();
        this.init(pathToFile);
    }
    beforeStart() {

    }
    private init(pathToFile: string) {
        const rd = readline.createInterface({
            input: fs.createReadStream(pathToFile),
            output: process.stdout,
            terminal: false
        });
        rd.on('line', this.onLine);
        rd.on('close', this.onEnd);
    }
    onLine(line: string) {

    }
    onEnd() {

    }
}

type IStatCounter = { [s: string]: { hits: number, user: number, phits: number, puser: number } };

type IUser = { hit: number, enable: boolean };
type TUserMap = { counter: number } & { [s: string]: Map<String, IUser> };
type TUserMapJSON = { counter: number } & { [s: string]: [String, IUser][] };

class Counter extends ReadByLine {
    lineCounter = 0;
    userMap = { counter: 0 } as TUserMap;

    //folders = new Set<string>();

    beforeStart() {
        if (fs.existsSync(fw.pathType.cache + __nameStatSrc)) {
            const userMap: TUserMapJSON = fw.loadSyncJson(fw.pathType.cache + __nameStatSrc, {});

            this.userMap = {} as TUserMap;
            for (const name in userMap) {
                if (name == 'counter') this.userMap.counter = userMap.counter;
                else this.userMap[name] = new Map(userMap[name]);
            }
        }
    }
    onLine(line: string) {
        this.lineCounter++;
        if (this.userMap.counter < this.lineCounter) {
            const m = line.match(__reLine);
            if (m) {
                const log = new LogLine(Array.from(m));
                if (!__reIgnore.test(log.browser)) {
                    if(!log.folder || __reFirstTrue.test(log.folder)){
                        this.onLogLine(log);
                    }
                }
            }
        }
    }

    onLogLine(line: LogLine) {
        const { userMap } = this;
        const { host } = line;

        if (!userMap[host]) userMap[host] = new Map();

        if (line.isGET() && line.status < 400) {
            const userKey = getHash(host + line.ip + line.browser);

            if (!userMap[host].has(userKey)) {
                userMap[host].set(userKey, { hit: 0, enable: false });
            }

            const user = userMap[host].get(userKey);
            if (user) {
                if (__folderDisabled.has(line.folder)) {
                    if (__reUserOn.test(line.url)) user.enable = true;
                }
                else {
                    //if(isToy(host))this.folders.add(line.folder);
                    user.hit++;
                }
            }
        }
    }

    onEnd() {
        const now = new Date();
        const flagNew = !now.getHours() && !now.getMinutes();

        const prev: IStatCounter = fw.loadSyncJson(fw.pathType.cache + 'statData.json', {});
        const stat: IStatCounter = JSON.parse(JSON.stringify(prev));

        let user0 =0;
        const userMap = {} as TUserMapJSON;
        for (const host in this.userMap) {
            if (host == 'counter') {
                userMap.counter = this.lineCounter;
            }
            else {
                userMap[host] = Array.from(this.userMap[host]);

                let hits = 0, user = 0;
                for (const data of this.userMap[host].values()) {
                    if (data.enable) {
                        hits += data.hit;
                        user += 1;
                    }
                    else {
                        if (isToy(host)) {
                            if (data.hit > 10) console.log(data.hit);
                            user0++;
                        }
                    }
                }

                const statHost = stat[host];
                statHost.hits = hits;
                statHost.user = user;

                const statPrev = prev[host];

                const out = {
                    user: user,
                    hits: hits,
                    userAdd: statPrev ? user - statPrev.user : 0,
                    hitsAdd: statPrev ? hits - statPrev.hits : 0,
                    userPrev: statHost.puser,
                    hitsPrev: statHost.phits
                };
                if (fs.existsSync(fw.pathType.file + host)) {
                    console.log(host, out);
                    //fs.writeFileSync(fw.pathType.file + host + '/json/counter.json', JSON.stringify(out), { encoding: 'utf8' });
                }
            }
        }

        console.log(user0);

        //console.log(Array.from(this.folders));

        if (flagNew) {
            for (const host of fs.readdirSync(fw.pathType.data)) {
                stat[host] = {
                    user: 0,
                    hits: 0,
                    puser: stat[host].user,
                    phits: stat[host].hits
                };
            }
        }

        fs.writeFileSync(fw.pathType.cache + __nameStatSrc, JSON.stringify(userMap), { encoding: 'utf8' });
        fs.writeFileSync(fw.pathType.cache + __nameData, JSON.stringify(stat), { encoding: 'utf8' });
    }
}


new Counter('/var/log/nginx/nginx.log');
