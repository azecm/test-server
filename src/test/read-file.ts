import * as fs from "fs";
import * as readline from "readline";
import * as crypto from "crypto";

const reLine = /([^\s]+) ([^\s]+) (\d\d\d) \[([^\]]+)\] ([^\s]+) (\d+) (\d+) "([^"]+)" "([^"]+)" "([^"]+)"/;


const pathToLog = process.argv.length > 2 ? process.argv[2] : 'nginx.log.0';


const userMap = new Map<String, LogUser>();
const reDisablePaths = /^\/(js|goto|xhr|json)\//;
const reUserOn = /^\/js\/useron\.gif/;



console.log(process.argv);
//for(let i=0;i<100;i++){
    readByLine(pathToLog, fnLine, fnEnd);
//}


class LogUser{
    host: string;
    hit = 0;
    enabled = false;
    constructor(host: string){
        this.host = host;
    }
}

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

        //console.log(ip, );
    }
    isGET() {
        return this.type == 'GET';
    }
}

function fnLine(line: string) {
    const m = line.match(reLine);
    if (m) fnLineData(new LogLine(Array.from(m)));
}
function getHash(text:string){
    return crypto.createHash('sha1').update(text).digest('hex');
}
function fnLineData(line: LogLine) {
    if (line.isGET() && line.status < 400) {

        const userKey = getHash(line.host+line.ip + line.browser);
        if (!userMap.has(userKey)) {
            userMap.set(userKey, new LogUser(line.host));
            
        }

        const user = userMap.get(userKey);
        if(user){
            if (!reDisablePaths.test(line.url)) {
                user.hit++;
            }

            if (reUserOn.test(line.url)) {
                user.enabled = true;
            }            
        }
    }
}

function fnEnd() {
    interface IHost{
        user:number
        userHost:number
        bot:number
        botHost:number
    }
    const res = {} as {[s:string]:IHost};
    
    for(const userObj of userMap){
        const user = userObj[1];
        const {host} =user;
        if(!res[host]){
            res[host] = {
                user:0,
                userHost:0,
                bot:0,
                botHost:0
            };
            console.log(host);
        }
        const hostLine = res[host];
        if(user.enabled){
            hostLine.user++;
            hostLine.userHost+=user.hit;
        }
        else{
            hostLine.bot++;
            hostLine.botHost+=user.hit;
        }
    }
    fs.writeFileSync('res-nodejs.json', JSON.stringify(res));

}


function readByLine(pathToFile: string, fnLine: (fnLine: string) => void, fnEnd: () => void) {
    let rd = readline.createInterface({
        input: fs.createReadStream(pathToFile),
        output: process.stdout,
        terminal: false
    });
    rd.on('line', fnLine);
    rd.on('close', fnEnd);
}