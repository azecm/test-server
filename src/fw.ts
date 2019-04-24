


// https://nodejs.org/api/errors.html
// Error.captureStackTrace(targetObject[, constructorOpt])

//import * as http from "http";
import * as util from "util";
import * as crypto from "crypto";
import * as fso from "fs";
import * as childProcess from "child_process";
import { spawnSync as spawnSyncFn, spawn as spawnAsync, execSync as execSyncFn } from "child_process";
import { dirname as DirName } from "path";
import * as fsp from "./promise/fs-promise";
import { ServerRequest } from "./server-request";
//import { PostgreSQLSync } from "./promise/postgre";
import { PostgreSQL } from "./promise/postgre";
import { RedisClass } from "./promise/redis";
import * as fwcm from "./fw-command";

import { HTMLDoc, Elem } from "./fw-dom";

const memData: IDict<any> = {};
const dateMonth = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// ==================

function printDuration(ms: number) {
    let s = 0;
    let m = 0;
    if (ms > 1000) {
        s = Math.floor(ms / 1000);
        ms = ms - s * 1000;
    }
    if (s > 60) {
        m = Math.floor(s / 60);
        s = s - m * 60;
    }
    return `${('0' + m).slice(-2)}:${('0' + s).slice(-2)}.${ms}`;
}

function duration() {
    const t = new Date().getTime();
    return function () {
        return printDuration(new Date().getTime() - t);
    }
}

class CmdJava {
    private path = '/usr/local/bin/java';
    private pathToServerJar = '/usr/local/www/app.java/server-java-1.0.jar';
    private param = ['-jar'];
    private flagStdout!: boolean;
    private timer = duration();
    site(host?: string) {
        this.param.push(this.pathToServerJar);
        if (host) this.param.push(host);
        return this;
    }
    cron(key: number|string) {
        this.param.push(this.pathToServerJar, 'cron', key.toString());
        this.exec('');
    }
    crontab() {
        this.param.push(this.pathToServerJar, 'crontab');
        this.exec('');
    }
    price() {
        this.param.push(this.pathToServerJar, 'price');
        this.exec('');
    }
    mail(key: string) {
        this.param.push(this.pathToServerJar, 'mail');
        this.exec(key);
    }
    counter() {
        this.param.push(this.pathToServerJar, 'counter');
        return this;
    }
    voting() {
        this.param.push(this.pathToServerJar, 'voting');
        return this;
    }
    sape() {
        this.param.push(this.pathToServerJar, 'sape');
        return this;
    }
    //log(){
    //    this.param.push(this.pathToServerJar, 'log');
    //    return this;
    //}
    idn(idn: number) {
        this.param.push(idn.toString());
        return this;
    }
    url(url: string) {
        this.param.push(url);
        return this;
    }
    update() {
        this.param.push('update');
        return this;
    }
    viewStdout() {
        this.flagStdout = true;
        return this;
    }
    exec(keyMsg: string) {
        let child = spawnSyncFn(this.path, this.param);
        if (child.stderr.length) {
            this.msg(keyMsg, child.stderr.toString().trim(), true);
        }
        this.msg(keyMsg, (this.flagStdout && child.stdout.length) ? child.stdout.toString().trim() : '');
        return this;
    }
    private msg(keyMsg: string, message: string, flagErr?: boolean) {
        const text = '\t' + this.timer() + '\t' + this.param.join(' ') + (keyMsg ? ' [' + keyMsg + ']' : '') + (message ? '\n' + message + '\n' : '');
        let path = pathType.log + 'java' + (flagErr ? '-err' : '-log') + '.txt';
        fso.appendFileSync(path, logDate() + text + '\n');
        fso.chownSync(path, 80, 80);
    }
}

export function cmdJava() {
    return new CmdJava();
}

// ==================

export const redis = new RedisClass();

export async function redisConnect() {
    if (!redis.isConnected) {
        let [err] = await redis.connect('/tmp/redis.sock');
        if (err) throw ('fw::redisConnect - ' + err);
    }
}
export async function redisQuit() {
    if (redis.isConnected) await redis.quit();
}
export async function redisExists(host: string, idn: number | string) {
    let [err, res] = await redis.hexists(redisKeyTree(host, idn), 'idp');
    if (err !== null) throw (__filename + '::redisExists::redis.hexists - ' + err + ' host:' + host + ' idn:' + idn);
    return res;
}

export async function redisUrlRemove(host: string, tree: ITree, idn: number) {
    let isConnected = redis.isConnected;
    if (!isConnected) await redisConnect();

    let [err] = await redis.hdel(redisKeyUrl(host), getNodePath(tree, idn, 'fw-1::' + host));
    if (err !== null) throw (__filename + '::redisUrlRemove::redis.hdel - ' + err);

    if (!isConnected) await redis.quit();
}
export async function redisUrlUpdate(host: string, tree: ITree, idn: number) {
    let isConnected = redis.isConnected;
    if (!isConnected) await redisConnect();

    let line = {} as any;
    line[getNodePath(tree, idn, 'fw-2::' + host)] = idn;

    let [err] = await redis.hmset(redisKeyUrl(host), line);
    if (err !== null) throw (`fw::redisUrlUpdate::redis.hmset - ${err} ${host} ${idn}`);

    if (!isConnected) await redis.quit();
}
export async function redisTreeUpdate(host: string, idn: string | number, data: any) {
    let isConnected = redis.isConnected;
    if (!isConnected) await redisConnect();
    //let l: IRedisTree;
    /*
    idp: number
    path: string
    text: string
    first: number
    next: number
    */
    let redisKeys = /^(idp|path|text|first|next)$/;
    let redisLine = {} as any, redisUpdate = false;
    for (let key in data) {
        if (redisKeys.test(key)) {
            redisLine[key] = data[key];
            redisUpdate = true;
        }
    }
    if (redisUpdate) {
        let [err] = await redis.hmset(redisKeyTree(host, idn), redisLine);
        if (err !== null) throw (`fw::redisTreeUpdate::redis.hmset - ${err} ${host} ${idn}`);
    }
    if (!isConnected) await redis.quit();

}
export async function redisNodePath(host: string, idn: number) {
    let docPath = '';
    let line = await redisTreeLine(host, idn);
    if (line) {
        docPath = line.first ? '/' : '';
        while (line && line.idp) {
            docPath = '/' + encodeURI(line.path) + docPath;
            line = await redisTreeLine(host, line.idp);
        }
        if (line)
            docPath = '/' + encodeURI(line.path) + docPath;
        if (docPath == '//')
            docPath = '/';
    }
    else {
        docPath = '/';
        err('fw.redisNodePath', host, idn)
    }
    return docPath;
}

export function redisKeyUrl(host: string) {
    return `${host}:url`;
}
export function redisKeyTree(host: string, idn: number | string) {
    return `${host}:tree:${idn}`;
}
export function redisKeyUser(host: string) {
    return `${host}:user`;
}
//export function redisKeyCommentIdns(host: string) {
//    return `${host}:commentIdnList`;
//}
//export function redisKeyCommentResult(host: string) {
//    return `${host}:commentResult`;
//}
export function redisKeyCommentVoting(host: string) {
    return `${host}:commentVoting`;
}
export function redisKeyCommentDayVoting(host: string) {
    return `${host}:commentDayVoting`;
}

export async function redisNodeId(host: string, path: string) {
    if (path.charAt(0) != '/') path = '/' + path;
    let [err, idn] = await redis.hget(redisKeyUrl(host), path);
    if (err !== null) throw ('fw::redisNodeId::redis.hget - ' + err);
    return idn ? ~~idn : 0;
}
export async function redisUserId(host: string, val: string, flagEmail?: boolean) {
    let findBy = flagEmail ? userEmailLower(val) : userNameLower(val);
    let [err, idu] = await redis.hget(redisKeyUser(host), findBy);
    if (err !== null) throw ('fw::redisUserId::redis.hget - ' + err);
    return idu ? ~~idu : 0;
}
export async function redisUserAdd(user: IUser, redisKey: string, redisClass?: RedisClass) {
    !redisClass && (redisClass = redis);

    let name = userNameLower(user.name);
    let email = userEmailLower(user.email);

    let line = {} as IDict<number>;
    line[name] = line[email] = user.idu;
    let [err] = await redisClass.hmset(redisKey, line);
    if (err !== null) throw (`fw::redisUserAdd::redis.hmset - ${err} redisKey:${redisKey} userName:${name}`);
}

export async function redisTreeRemove(host: string, idn: number) {
    let isConnected = redis.isConnected;
    if (!isConnected) await redisConnect();
    let [err] = await redis.del(redisKeyTree(host, idn));
    if (err !== null) throw (__filename + '::redisTreeRemove - ' + err);
    if (!isConnected) await redisQuit();
}
export async function redisTreeLine(host: string, idn: number) {
    //, keys: string[]
    //let line = await redis.hmget<IRedisTree>(redisHostTree(host, idn), keys);
    //if (line.idp) line.idp = ~~line.idp;
    //if (line.first) line.first = ~~line.first;
    //if (line.next) line.next = ~~line.next;
    let [err, line] = await redis.hgetall<IRedisTree>(redisKeyTree(host, idn));
    if (err !== null) throw (`fw::redisTreeLine::redis.hgetall - ${err} host: ${host} idn: ${idn}`);
    if (line) {
        line.idp = ~~line.idp, line.first = ~~line.first, line.next = ~~line.next;
    }
    return line;
}
//export async function redisIdp(host: string, idn: number | string) {
//    return await redis.hget(redisTreeKey(host, idn), 'idp');
//}
//export async function redisTreeVal(host: string, idn: number, key: string) {
//    return await redis.hget(redisTreeKey(host, idn), key);
//}
//export async function redisTreeFirst(host: string, idn: number) {
//    return ~~await redisTreeVal(host, idn, 'first');
//}
//export async function redisTreeNext(host: string, idn: number) {
//    return ~~await redisTreeVal(host, idn, 'next');
//}
//export async function redisTreeChild(host: string, idp: number) {
//    let out: number[] = [];
//    let idNext = await redisTreeFirst(host, idp);
//    while (idNext) {
//        out.push(idNext);
//        idNext = await redisTreeNext(host, idNext);
//    }
//    return out;
//}


export function onError() {
    process.on('uncaughtException', (e: Error) => {
        err('fw.onError uncaughtException', e && e.message);
        if (e && typeof (e) == 'object')
            for (let key in e)
                err(key, (e as any)[key]);
        err('fw.onError uncaughtException', e && e.stack);
        err('fw.onError uncaughtException', util.inspect(e));
        //EPIPE means that writing of (presumably) the HTTP request failed
        //because the other end closed the connection.
    });
    process.on('unhandledRejection', (reason: any, p: any) => {
        console.error(logDate(), 'unhandledRejection');
        console.error(logDate(), reason);
        console.error(logDate(), p);
    });
    process.on('warning', (warning: any) => {
        err('fw.onError warning', warning);
    });
}
export function bind(obj: any) {
    for (let key of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
        //console.log(key, typeof (obj[key]));
        obj[key] = obj[key].bind(obj);
    }
}

export class Session {
    data!: ISession
    user!: IUser
    private key: string
    private host: string
    private ip: string
    private browserLine: string
    private flagMail: boolean
    constructor(req: ServerRequest) {
        this.host = req.host;
        this.ip = req.ip;
        this.browserLine = req.browserLine;
        this.flagMail = req.flagMail;
        this.key = req.onKey;
    }
    open(data: any) {
        let out = { type: 0, text: '' };
        let sessionDict: IDict<ISession> = mem(this.host, ['on', {}]);
        if (typeof (data) == 'string') {
            out.type = 1
        }
        else {
            // session up
            out.type = 2;
            if (Array.isArray(data) && data.length == 2) {
                // грузятся в route, через session.find
                let key: string = this.key = data[0];
                let onData = this.data = sessionDict[key];
                let keyBrowser = this.browserLine;
                if (data[1] == this.secret(onData.start, onData.ip, keyBrowser)) {
                    sessionDict[key].ip = this.ip;
                    this.save();
                    out.text = 'ok' + this.secret(onData.start, this.ip, keyBrowser);
                }
            }
        }
        return out;
    }
    async save() {
        await saveJson(pathType.on + this.host + '/' + this.key + extJson, this.data);
    }
    keyInit(timeStart: number, data: ISession) {
        let sessionDict: IDict<ISession> = mem(this.host, ['on', {}]);
        let key = this.key = codeAlpha(timeStart - 1300000000000);
        sessionDict[key] = this.data = data;
        return key;
    }
    secret(timeStart: number, ip: string, browser: string) {
        return codeAlpha(timeStart + 'liveweb' + browser + ip);
    }
    find() {
        return new Promise<void>(async (resolve, reject) => {
            let sessionDict: IDict<ISession> = mem(this.host, ['on', {}]);
            if (!sessionDict[this.key]) {
                let data: ISession = await loadJson(pathType.on + this.host + '/' + this.key + extJson);
                if (data) {
                    sessionDict[this.key] = data;
                }
                else {
                    reject(404)
                    return;
                }
            }

            let session = sessionDict[this.key];
            if (session) {
                this.data = session;
                if (session.ip == this.ip && session.browser == this.browserLine) {
                    if (this.flagMail && session.email) {
                        let path = pathType.data + this.host + '/user/' + session.email.join('@') + extJson;
                        let user = await loadJson(path);
                        if (user) {
                            if ('notes' in user) delete (user.notes);
                            this.user = user;
                            resolve();
                        }
                        else {
                            reject(404)
                        }
                    } else if (session.idu) {
                        let user = await loadUser(this.host, session.idu);
                        if (user) {
                            if (now() - new Date(user.dateLast).getTime() > 36000) {
                                user.dateLast = dateJSON();
                                user.visits++;
                                await saveUser(this.host, user);
                            }
                            this.user = user;
                            resolve();
                        }
                        else {
                            reject(404)
                        }
                    }
                }
                else {
                    reject('up')
                }
            }
            else {
                reject(404)
            }
        });
    }
}
export function getNodeViews(host: string, idn: number) {
    const statData = loadSyncStatNode(host, idn);
    let counterViews = 0;
    for (let year of Object.keys(statData.year)) {
        for (let month of Object.keys(statData.year[year])) {
            counterViews += statData.year[year][month];
        }
    }
    return counterViews;
}
export class Route {
    private dict: IDict<any> = {}
    private key(method: string, path: string) {
        return method.toLowerCase() + '::' + path;
    }
    push(method: string, path: string, fn: any) {
        this.dict[this.key(method, path)] = fn;
    }
    async route(req: ServerRequest) {
        let key = req.method + '::' + req.pathlist.join('/').substr(4);
        let func = this.dict[key];
        if (func) {
            if (!req.flagMail) {
                if (!redis.isConnected) await redisConnect();;
            }
            if (req.onKey) {
                req.session = new Session(req);
                try {
                    await req.session.find()
                    func(req);
                }
                catch (err) {
                    switch (err) {
                        case 'up':
                            req.endText('up');
                            break;
                        case 404:
                            req.end404();
                            break;
                        default:
                            console.error(logDate(), 'fw.route', err);
                            req.end404();
                            break;
                    }
                }
            }
            else {
                func(req);
            }
        }
        else {
            err('fw::route', req.host, key);
            req.end404();
        }
    }
}

const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function codeCode(i: number) {
    let out: string[] = [];
    let baseLen = alphabet.length;
    while (i) {
        out.push(alphabet[i % baseLen]);
        i = Math.floor(i / baseLen);
    }
    return out.join('');
}
export function codeAlpha(a: number | string) {
    let out = '';
    if (arguments.length > 1 || typeof (a) == 'string') {
        let shasum = crypto.createHash('sha1');
        shasum.update(Array.prototype.slice.call(arguments).join(''));
        out = codeCode(parseInt(shasum.digest('hex'), 16));
    }
    else {
        if (typeof (a) == 'number') {
            out = codeCode(<number>a);
        }
    }
    return out;
}

export var logDate = function (d?: Date) {
    d === void (0) && (d = new Date());
    return util.format('%d-%s-%s %s:%s:%s', d.getFullYear(), ('0' + (d.getMonth() + 1)).substr(-2), ('0' + d.getDate()).substr(-2), ('0' + d.getHours()).substr(-2), ('0' + d.getMinutes()).substr(-2), ('0' + d.getSeconds()).substr(-2));
}

export const pathType = {
    cache: '/usr/local/www/cache/',
    price: '/usr/local/www/cache/price/',
    stat: '/usr/local/www/stat/',
    temp: '/usr/local/www/cache/temp/',
    memory: '/usr/local/www/cache/memory/',
    on: '/usr/local/www/cache/session/',
    html: '/usr/local/www/cache/html/',
    file: '/usr/local/www/cache/file/',
    data: '/usr/local/www/data/domain/',
    statistic: '/usr/local/www/data/statistic/',
    tpl: '/usr/local/www/public/tpl/site-public/',
    app: '/usr/local/www/app.back/',
    log: '/usr/local/www/app.log/',
    appSite: '/usr/local/www/app.back/app-site/',
    mail: '/var/mail/virtual/',
    publ: '/usr/local/www/public/'
}
export const extJson = '.json';
export function pathFolderAdd(host: string) {
    return pathType.memory + host + '/folderAdd' + extJson;
}
export function pathFolder(idn: number) {
    return Math.floor(idn / 5000) + '/' + idn
}
export function nodePathFull(host: string, idn: number) {
    return pathType.data + host + '/node/' + pathFolder(idn) + extJson;
}
export function nodeStatPath(host: string, idn: number) {
    return pathType.statistic + 'domain/' + host + '/' + pathFolder(idn) + extJson;
}
//export function nodePathCache(host: string, idn: number) {
//fw.getNodePath(req.tree, idp)
//pathType.html + host + decodeURI(webPath) + (webPath.slice(-1) == '/' ? 'index' : '');
//}
export function userPathFull(host: string, idu: number) {
    return pathType.data + host + '/user/' + pathFolder(idu) + extJson;
}

function argsToLog() {
    let out = '\n';
    if (arguments.length) {
        out += logDate();
        for (let a of Array.prototype.slice.call(arguments)) {
            if (typeof (a) == 'object') out += '\n\t' + jsonStr(a, true);
            else out += '\t' + a;
        }
    }
    return out;
}
export function jsonStr(data: any, flagBeauty?: boolean) {
    let out = '';
    try {
        if (flagBeauty) out = JSON.stringify(data, null, '\t');
        else out = JSON.stringify(data);
    }
    catch (e) {
        console.error(logDate(), 'fw.jsonStr', data, e);
    }
    return out;
}
export function jsonObj(data: string, flagDecode?: boolean) {
    let out: any;
    if (flagDecode) {
        try {
            data = decodeURIComponent(data);
        }
        catch (e) {
            err('fw.jsonObj::decode', data, e);
        }
    }
    try {
        out = JSON.parse(data.trim());
    }
    catch (e) {
        err('fw.jsonObj::parse', data, e);
    }
    return out;
}

export function err(...args: any[]) {
    setProcOwn();
    let out = '';
    try {
        out = argsToLog.apply(null, args as any)
    }
    catch (e) {
        out = 'argsToLog' + e;
    }
    //fsp.appendFile(pathType.log + 'node.err.txt', out)
    fso.appendFileSync(pathType.log + 'node.err.txt', out)
}
//export async function logGame(...args: any[]) {
//    fso.appendFileSync(pathType.log + 'game.txt', argsToLog.apply(null, args));
//}
export async function log(...args: any[]) {
    setProcOwn();
    fso.appendFileSync(pathType.log + 'node.msg.txt', argsToLog.apply(null, args as any));
    //fsp.appendFile(pathType.log + 'node.msg.txt', argsToLog.apply(null, args));
    //fso.appendFileSync(pathType.log + 'node.msg.txt', '---');
}
export function now() {
    return new Date().getTime()
}
export function toMb(byte: number) {
    return Math.round(100 * byte / (1024 * 1024)) / 100
}
export function toMin(timeStart: number) {
    return Math.round((new Date().getTime() - timeStart) / 600) / 100
}
export function toMsec(timeStart: number) {
    return Math.round((new Date().getTime() - timeStart) / 100) / 10;
}
export function dateDBSet(val?: string | number | Date) {
    let date: Date;
    if (val) {
        if (typeof (val) == 'object') date = val;
        else date = new Date(val as string);
    }
    else {
        date = new Date();
    }
    return Math.floor(date.getTime() / 1000) - 1400000000;
}
export function dateDBGet(val: number) {
    return (val + 1400000000) * 1000;
}
export function dateJSON(val?: string | number) {
    let date: Date;
    if (val) {
        date = new Date(val as string);
    }
    else {
        date = new Date();
    }
    return date.toISOString().substr(0, 19) + 'Z';
}
export function dateString(dateGet: string | Date) {
    let date = typeof (dateGet) == 'string' ? new Date(<string>dateGet) : <Date>dateGet;
    let out = date.getDate() + ' ' + dateMonth[date.getMonth()] + ' ' + date.getFullYear();
    // 24*3600*1000*3 = 259200000
    if (now() - date.getTime() < 259200000) {
        let time = date.toTimeString();
        out += ' ' + time.substr(0, time.indexOf(' '));
    }
    return out;
}
export function dateDate(date: string | Date) {
    if (typeof (date) == 'string') date = new Date(<string>date);
    return (<Date>date).toISOString().substr(0, 19).replace('T', ' ');
}

export function getParam<T>(dataSrc: string) {
    let res = {} as T;

    dataSrc = textClean(dataSrc);

    //''.replace(/[\{,]\s*([\w\-]+)\s*:/, '')

    let data = '{' + dataSrc.replace(/=/g, ':') + '}';
    data = data.replace(/([\wа-яё\-\!\(\^][\wа-яё\s\-\|\(\)\.\?\!\+\*\\\^\$\"\+\^<>]*[\wа-яё\)]*)/ig, '"$1"');
    data = data.replace(/"(-?\d+\.?(\d+)?|true|false)"/g, '$1');
    data = data.replace(/</g, '[').replace(/>/g, ']');

    try {
        res = JSON.parse(data);
        //console.log(res);
    }
    catch (e) {
        console.error('!!getParam!!', e);
        console.error(dataSrc);
        console.error(data);
    }

    return res;
}

export function getHosts() {
    let out = fso.readdirSync(pathType.data);
    out.splice(out.indexOf('bbb.hnh.ru'), 1);
    out.splice(out.indexOf('aaa.hnh.ru'), 1);
    return out;
}
export async function unlockNode(host: string, idn: number) {
    let path = nodePathFull(host, idn);
    if (!(await testStats(path))) await fsp.chmod(path, 0o644);
}
async function testStats(path: string) {
    let stats = await fsp.stats(path);
    return stats ? stats.mode.toString(8).substr(-3) == '644' : true;
}
function testStatsSync(path: string) {
    return fso.statSync(path).mode.toString(8).substr(-3) == '644';
}
async function testDir(path: string, flagDir?: boolean) {
    let listAdd = [] as string[];
    if (!flagDir) path = DirName(path);
    while (!(await fsp.exists(path))) {
        listAdd.push(path);
        path = DirName(path);
    }
    listAdd.reverse();
    for (let pathName of listAdd) await fsp.mkdir(pathName, 0o755);
}
export function testDirSync(path: string, flagDir?: boolean) {
    let listAdd = [] as string[];
    if (!flagDir) path = DirName(path);

    while (!(fso.existsSync(path))) {
        listAdd.push(path);
        path = DirName(path);
    }
    listAdd.reverse();
    for (let pathName of listAdd) fso.mkdirSync(pathName, 0o755);
}

export function saveSync(path: string, data: string) {
    testDirSync(path);
    fso.writeFileSync(path, data, { encoding: 'utf8', mode: 0o644 });
    if (!(testStatsSync(path))) fso.chmodSync(path, 0o644);
}
export function saveSyncJson(path: string, data: any, flagBeauty?: boolean) {
    saveSync(path, flagBeauty ? JSON.stringify(data, null, '\t') : JSON.stringify(data));
}
export function saveSyncNode(host: string, node: INode) {
    saveSyncJson(nodePathFull(host, node.head.idn), node, true)
}
export function saveSyncStatNode(host: string, idn: number, data: INodeStat) {
    saveSyncJson(nodeStatPath(host, idn), data, true);
}
export function saveSyncUser(host: string, data: IUser) {
    saveSyncJson(userPathFull(host, data.idu), data, true)
}

export async function save(path: string, data: string) {
    await testDir(path);
    await fsp.writeFile(path, data, { encoding: 'utf8', mode: 0o644 });
    if (!(await testStats(path))) await fsp.chmod(path, 0o644);
}
export async function saveJson(path: string, data: any, flagBeauty?: boolean) {
    await save(path, flagBeauty ? JSON.stringify(data, null, '\t') : JSON.stringify(data));
}
export async function saveNode(host: string, node: INode) {
    await saveJson(nodePathFull(host, node.head.idn), node, true)
}
export async function saveUser(host: string, data: IUser) {
    await saveJson(userPathFull(host, data.idu), data, true)
}

export function loadSync(path: string) {
    let out: string | undefined;
    if (fso.existsSync(path)) out = fso.readFileSync(path, { encoding: 'utf8' });
    return out;
}
export function loadSyncJson(path: string, defValue?: any) {
    let text = loadSync(path);
    let out = defValue || null;
    if (text) {
        try {
            out = JSON.parse(text);
        }
        catch (e) {
            err('fw.loadSyncJson', path);
            console.error('loadSyncJson', path);
        }
    }
    return out;
}
//
export function loadSyncStatNode(host: string, idn: number) {
    const path = nodeStatPath(host, idn);
    return loadSyncJson(path, { year: {} }) as INodeStat;
}
export function loadSyncNode(host: string, idnGet: number | string, flagLock?: boolean) {
    let out: INode | undefined;
    let idn = <number>(typeof (idnGet) == 'string' ? getNodeID(host, <string>idnGet) : idnGet);
    if (isFinite(idn)) {
        let path = nodePathFull(host, idn);
        if (flagLock) {
            let counter = 0, t = now();
            //err('testStatsSync', path, fso.statSync(path).mode.toString(8), testStatsSync(path))
            while (!testStatsSync(path) && counter < 500) {
                counter++;
                let w = 10000000;
                while (w) { w-- }
            }
            if (counter) {
                err('loadSyncNode::statTestSync', idn, counter, toMin(t));
            }
            fsp.chmod(path, 0o640);
        }
        out = loadSyncJson(path, {});
    }
    return out;
}
export function loadSyncUser(host: string, idu: number) {
    return loadSyncJson(userPathFull(host, idu)) as IUser
}
export function* loadDirNodeGen(host: string, flagZero = false) {
    let dirPath = pathType.data + host + '/node/';
    for (let dirkey of fso.readdirSync(dirPath)) {
        dirkey += '/';
        for (let filename of fso.readdirSync(dirPath + dirkey)) {
            let node = loadSyncNode(host, parseInt(filename, 10));
            if (node) {
                if (flagZero || node.head && node.head.idn) yield node;
            }
            //else err('loadDirNode', host, filename);
        }
    }
}
export function* loadDirUserGen(host: string) {
    let dirPath = pathType.data + host + '/user/';
    for (let dirkey of fso.readdirSync(dirPath)) {
        dirkey += '/';
        for (let filename of fso.readdirSync(dirPath + dirkey)) {
            let user = loadSyncUser(host, parseInt(filename, 10));
            if (user) yield user;
        }
    }
}

export async function load(path: string) {
    let out = '';
    if (await fsp.exists(path)) {
        out = await fsp.readFile(path);
    }
    else {
        //throw (`file not exists - fw.load: ${path}`);
    }
    return out;
}
export async function loadJson(path: string, defValue?: any) {
    let text = await load(path);
    let out = defValue || null;
    if (text) {
        try {
            out = JSON.parse(text);
        }
        catch (e) {
            console.log(`fw.loadJson ${path}, JSON.parse ERR - ${err}`);
        }
    }
    return out;
}
export async function loadUser(host: string, idu: number) {
    return (await loadJson(userPathFull(host, idu))) as IUser
}
export async function loadNode(host: string, idnGet: number | string, flagLock?: boolean) {
    let out: INode | null = null;
    let idn = <number>(typeof (idnGet) == 'string' ? getNodeID(host, <string>idnGet) : idnGet);
    if (isFinite(idn)) {
        let path = nodePathFull(host, idn);
        if (flagLock) {
            let counter = 0, t = now();
            while (!(await testStats(path)) && counter < 500) {
                counter++;
                let w = 10000000;
                while (w) { w-- }
            }
            if (counter) {
                err('loadNode', idn, counter, toMin(t));
            }
            fsp.chmod(path, 0o640);
        }
        out = await loadJson(path, {});
    }
    return out;
}
export async function loadDirNode(host: string, fn: (node: INode) => void, flagZero?: boolean) {
    !flagZero && (flagZero = false);
    let dirPath = pathType.data + host + '/node/';
    for (let dirkey of (await fsp.asyncReadDir(dirPath))) {
        dirkey += '/';
        for (let filename of (await fsp.asyncReadDir(dirPath + dirkey))) {
            let node = await loadNode(host, parseInt(filename, 10));
            if (node)
                if (flagZero || node.head && node.head.idn) await fn(node);
            //else err('loadDirNode', host, filename);
        }
    }
}

export function mem(host: string, keyGet?: string | any[], val?: any) {
    let out: any, key: string;
    if (!memData[host]) memData[host] = {};
    if (val !== void (0)) {
        key = <string>keyGet;
        if (val === null) {
            delete (memData[host][key]);
        }
        else {
            if (val.expire && val.data) {
                if (typeof (val.expire) == 'number') {
                    // приходит значение в минутах
                    val.expire = val.expire * 1000 * 60 + new Date().getTime();
                }
                else {
                    if (/\d+h/.test(val.expire)) {
                        let h = parseInt(val.expire, 10);
                        let n = new Date();
                        if (n.getHours() > h) {
                            val.expire = n.setHours(h, 0, 0, 0) + 24 * 3600 * 1000;
                        }
                        else {
                            val.expire = n.setHours(h, 0, 0, 0);
                        }
                    }
                }
            }
            memData[host][key] = val;
        }
    }
    else {
        if (typeof (keyGet) == 'string') {
            out = memData[host][<string>keyGet];
            if (out && out.expire && out.data) {
                if (out.expire > new Date().getTime()) {
                    out = out.data;
                }
                else {
                    out = void (0);
                }
            }
        }
        else {
            let keyList = <any[]>keyGet;
            out = memData[host][keyList[0]];
            if (out === void (0)) {
                memData[host][keyList[0]] = out = keyList[1];
            }
        }
    }
    return out;
}

function treeFolder(tree: ITree, url: string) {
    let out: IDict<any> = {};
    make(0, '/');
    function make(idp: number, path: string) {
        out[path] = idp;
        if (tree[idp]) {
            let idNext = tree[idp].first;
            while (idNext) {
                if (tree[idNext]) {
                    if (tree[idNext].first) {
                        make(idNext, path + encodeURI(tree[idNext].path) + '/');
                    }
                }
                else {
                    console.log('treeFolder(2) idNext error', idNext, tree[idNext], url);
                    break;
                }
                idNext = tree[idNext].next;
            }
        }
        else {
            console.log('treeFolder(1) idp error', idp, url);
        }
    }
    return out;
}


export async function treeLoad(host: string) {
    const out = {} as ITree;
    const db = new PostgreSQL(host);
    if (await db.connect('fw::treeLoad')) {
        const rows = await db.select({ idn: 0, idp: 0, idu: 0, text: '', path: '', prev: 0, next: 0, first: 0, last: 0 }).fromTree().exec();
        await db.end();
        for (const row of rows.rows) {
            out[row.idn] = row;
        }
    }
    mem(host, 'tree', out);
    return out;
}

/*
export function treeSyncLoad(host: string) {
    let out = {} as ITree;
    let db = new PostgreSQLSync(host);
    let rows = db.select({ idn: 0, idp: 0, idu: 0, text: '', path: '', prev: 0, next: 0, first: 0, last: 0 }).fromTree().exec();
    db.end();
    for (let row of rows) {
        out[row.idn] = row;
    }
    mem(host, 'tree', out);
    return out;
}
*/

export async function asyncTreeSyncLoad(host: string) {
    let out = {} as ITree;
    const db = new PostgreSQL(host);
    if (await db.connect('fw::asyncTreeSyncLoad')) {
        let rows = await db.select({ idn: 0, idp: 0, idu: 0, text: '', path: '', prev: 0, next: 0, first: 0, last: 0 }).fromTree().exec();
        await db.end();
        for (let row of rows.rows) {
            out[row.idn] = row;
        }
    }
    mem(host, 'tree', out);
    return out;
}

export async function asyncTreeSyncUpdate(host: string, idn: number, data: IDBTree) {
    const db = new PostgreSQL(host);
    if (await db.connect('fw::asyncTreeSyncUpdate')) {
        await db.update('tree').set(data).where({ idn: idn }).exec();
        await db.end();
    }
    await redisTreeUpdate(host, idn, data);
}


export async function postgreTreeChild(host: string, idp: number) {
    const out: number[] = [];
    const db = new PostgreSQL(host);
    await db.connect('fw::postgreTreeChild');
    const select1 = await db.select({ idn: 0, next: 0 })
        .fromTree()
        .where({ idp: idp })
        .exec();

    const select2 = await db.select({ first: 0 })
        .fromTree()
        .where({ idn: idp })
        .exec();
    await db.end();

    const childDict = {} as IDict<number>;
    for (const row of select1.rows) {
        childDict[row.idn] = row.next;
    }
    let idNext = select2.rows[0].first;
    while (idNext) {
        out.push(idNext);
        idNext = childDict[idNext];
    }
    return out;
}

export async function postgreFolderList(host: string) {
    let db = new PostgreSQL(host);
    await db.connect('fw::postgreFolderList');
    const select1 = await db.select({ idn: 0, idp: 0, text: '', path: '' }).fromTree()
        .where({
            and: {
                flagFolder: true, flagBlock: false, flagValid: true
            }
        })
        .exec();
    await db.end();
    return select1.rows;
}

export function userNameLower(name: string) { return name.toLowerCase().replace(/[^\wа-яё]/, '') }
export function userEmailLower(email: string) { return email.toLowerCase().trim() }
export async function userByName(host: string, name: string) {
    let user: IUser | undefined, idu = await redisUserId(host, name);
    if (idu) user = await loadUser(host, idu);
    return user;
}

export function textClean(text: string, flagFull?: number) {
    // Data Cleaning null characters
    // replace(/\u0008/g, '\\b'). // backspace
    // replace(/\u000c/g, '\\f'). // form-feed
    // replace(/\u0009/g, '\\t'). // tab
    // replace(/\u000a/g, '\\n'). // new line
    // replace(/\u000d/g, '\\r'). // carriage return
    // replace(/\u000b/g, '\\v'). // vertical tab
    // JSLint has a list of characters it sees as unsafe
    // http://www.jslint.com/lint.html#unsafe
    switch (flagFull) {
        case 1:
            //  исключаем \n
            text = text.replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g, ' ').replace(/[^\S\n]+/g, ' ');
            break;
        case 2:
            // исключаем \n \t
            text = text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g, ' ').replace(/[^\S\n\t]+/g, ' ');
            break;
        default:
            // чистим все
            text = text.replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g, ' ').replace(/\s+/g, ' ');
            break;
    }
    return text;
}
export function textOnly(html: string) {
    return html ? html
        .replace(/<\/?[a-z][^>]*>/ig, ' ')
        .replace(/&#?([a-z0-9]+);/ig, ' ')
        .replace(/[\n\r\t\s]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        : '';
}

export function treeChild(tree: ITree, idp: number) {
    let out: number[] = [];
    let idNext = tree[idp].first;
    while (idNext) {
        out.push(idNext);
        idNext = tree[idNext].next;
    }
    return out;
}

//export function getNodeValidFlag(host: string, idn: number) {
//    let
//        path = nodePathFull(host, idn),
//        text = fso.readFileSync(path, { encoding: 'utf8' });
//    let out = !~text.indexOf('"flagFolder":') && !~text.indexOf('"flagBlock":') && !!~text.indexOf('"flagValid":');
//    return out;
//}
export function getNodeID(host: string, path: string) {
    let tree = <ITree>mem(host, 'tree');
    if (!tree || !tree[0] || !tree[0].first) {
        err(logDate(), 'fw.getNodeID', host, path);
    }

    let folder = mem(host, 'folder');
    if (!folder) {
        folder = treeFolder(tree, host + path);
        mem(host, 'folder', folder);
    }

    let
        idn: number | null = null,
        pos = (path || '').lastIndexOf('/') + 1,
        idp = pos && folder[path.substr(0, pos)]
        ;

    if (idp !== void (0)) {
        let pathLast = path.substr(pos);
        try { pathLast = decodeURI(pathLast).trim(); }
        catch (e) { }
        if (pathLast || !idp) {
            let idNext = tree[idp].first;
            while (idNext) {
                if (tree[idNext].path == pathLast) {
                    idn = idNext;
                    break;
                }
                idNext = tree[idNext].next;
            }
        }
        else {
            idn = idp;
        }
    }
    return idn;
}
export function getNodePath(tree: ITree, idn: number, text = '') {
    let docPath = '';
    if (tree[idn]) {
        docPath = tree[idn].first ? '/' : '';
        while (idn) {
            docPath = '/' + encodeURI(tree[idn].path) + docPath;
            idn = tree[idn].idp;
        }
    }
    else {
        docPath = '/';
        err('fw.getNodePath', idn, tree[0], text);
    }
    return docPath;
}

const reImgKey = /\/file\/(\d{4})(?:\/(150|250|600))?\/(\d{4})\.(png|jpg|svg)/;
export function imgKey(src: string) {
    //[ "/file/0020/150/0631.jpg", "0020", "150", "0631", "jpg" ]
    let m = src.match(reImgKey);
    let key = '', size: number | null = null;
    if (m) {
        size = m[2] ? ~~m[2] : null;
        key = m[1] + '/' + m[3] + '.' + m[4];
    }
    return { key: key, size: size };
}
export function imgSize(size: number, width: number, height: number) {
    let k = Math.max(width / size, height / size);
    return { width: Math.round(width / k), height: Math.round(height / k) };
}

export function attachLine(nodeData: INode, idf: number) {
    let line: IAttach | null = null;
    let attach = nodeData.attach, i = attach.length;
    while (i--) {
        if (attach[i].idf == idf) {
            line = attach[i];
            break;
        }
    }
    return line;
}
export function attachPos(nodeData: INode, idf: number) {
    let pos = -1;
    let attach = nodeData.attach, i = attach.length;
    while (i--) {
        if (attach[i].idf == idf) {
            pos = i;
            break;
        }
    }
    return pos;
}

export function toBase64(text: string) {
    return new Buffer(text).toString('base64');
}
export function toMimeUTF(text: string) {
    return '=?UTF-8?B?' + toBase64(text) + '?=';
}
export function multipartParser(data: string, boundry: string) {
    let NL = '\r\n' // RFC2046 S4.1.1
        //,BOUNDARY_PREFIX = NL+'--' // RFC2046 S5.1.1
        //,HEADER_PAIR_DELIM = ':'
        //,HEADER_SUB_DELIM = '='
        ;
    let multipartData = <any>{};

    let i: number, j: number | undefined, name: string, value: any, flagFile: boolean;
    let index = data.indexOf(boundry + NL);
    while (index > -1) {
        index += (boundry + NL).length;

        i = data.indexOf(" name=\"", index);
        j = data.indexOf("\"", i + 7);
        name = data.substring(i + 7, j);
        value = {};
        flagFile = data.charAt(j + 1) == ';';
        if (flagFile) {
            i = j + 3;
            j = data.indexOf("\"", i + 14);
            value['name'] = decodeURIComponent(data.substring(i + 10, j));
            i = j + 17;
            j = data.indexOf(NL, i);
            value['type'] = data.substring(i, j);
        }

        i = data.indexOf(NL + NL, j) + (NL + NL).length;
        j = data.indexOf(NL + boundry, i);

        if (j == -1) {
            j = void (0);
        }

        if (flagFile) {
            value['content'] = data.substring(i, j);
        }
        else {
            value = (new Buffer(data.substring(i, j), 'ascii')).toString('utf8');
        }

        if (multipartData[name]) {
            if (!Array.isArray(multipartData[name])) {
                multipartData[name] = [multipartData[name]];
            }
            multipartData[name].push(value);
        }
        else {
            if (flagFile) {
                multipartData[name] = [value];
            }
            else {
                multipartData[name] = value;
            }
        }
        index = data.indexOf(boundry + NL, index);
    }
    return multipartData;
}

export function encode(args: string[], flagDecode?: boolean) {
    let
        k = flagDecode ? 1 : -1,
        res = [] as string[],
        num = -1
        ;
    for (let a of args) {
        num++;
        if (flagDecode) a = decodeURIComponent(a);
        let text: string[] = [];
        for (let i = 0; i < a.length; i++) {
            let key = (num + i) % 4 + 1;
            text.push(String.fromCharCode(a.charCodeAt(i) + ((num + i) % 2 ? -k * key : k * key)));
        }
        res.push(flagDecode ? text.join('') : encodeURIComponent(text.join('')))
    }
    return res;
}

export function setProcOwn() {
    //console.log('-uid', process.getuid(), '-gid', process.getgid());
    if (!process.getgid()) {
        process.setgid('www');
    }
    if (!process.getuid()) {
        process.setuid('www');
    }
    //console.log('+uid', process.getuid(), '+gid', process.getgid());
}

export var imageCacheSize = [150, 250, 600, 1500];
export function getFileExt(name: string) {
    return name.substr(name.lastIndexOf('.') + 1).toLowerCase()
}
export function imageSource(host: string, key?: string) {
    return pathType.data + host + '/file/' + (key ? key : '');
}
export function imageCacheList(host: string, key: string) {
    let
        keyList = key.split('/'),
        im = imageCacheSize.length - 1,
        sizeList = [] as { path: string, size: number }[],
        i = -1
        ;
    for (let size of imageCacheSize) {
        i++;
        let path = pathType.file + host + '/file/' + keyList[0] + '/' + (im == i ? '' : size + '/') + keyList[1];
        sizeList.push({ path: path, size: size });
    }

    return sizeList;
}

export function spawnSync(cmd: string, param?: string[], flagLog?: boolean) {
    if (cmd.endsWith('node') && param) {
        // --regexp_optimization
        if (param.indexOf('--expose-gc') == -1) param.splice(0, 0, '--expose-gc');
        if (param.indexOf('--use_strict') == -1) param.splice(0, 0, '--use_strict');
    }
    let res = spawnSyncFn(cmd, param, { encoding: 'utf8' });
    if (res.stderr && res.stderr.length && !cmd.endsWith('/curl')) {
        err('fw::spawnSync', cmd, param, res.stderr.toString().trim());
    }
    if (flagLog) {
        if (res.stdout.length) {
            log('fw::spawnSync', cmd, param, res.stdout.toString().trim());
        }
    }
    return res && res.output && res.output[1].trim() || '';
}
export function getDirlistOrdTime(path: string) {
    return spawnSync('/bin/ls', ['-t', path]).trim().split('\n');
}
export function execSync(cmd: string) {
    let out: string | undefined;
    try {
        //{ encoding: 'utf8', timeout: 60000 }
        out = execSyncFn(cmd).toString().trim();
    }
    catch (e) {
        err('fw::execSync', cmd)
        err('fw::execSync', e.stderr.toString())
    }
    return out;
}

export class Spawn {
    reMessage = /<begin([^\n]+)end>/
    private stdin!: NodeJS.ReadableStream
    private chunksErr!: Buffer[]
    private chunksData!: Buffer[]
    private resolve: any
    private child!: childProcess.ChildProcess
    private timerLink!: NodeJS.Timer
    private timerErr!: string
    private req!: ServerRequest | null
    //private callFn: ((obj: any) => void) | void
    constructor() {
        this.inData = this.inData.bind(this);
        this.inEnd = this.inEnd.bind(this);

        this.close = this.close.bind(this);
        this.chData = this.chData.bind(this);
        this.chEnd = this.chEnd.bind(this);
        this.chErrData = this.chErrData.bind(this);
        this.chErrEnd = this.chErrEnd.bind(this);
        this.timerFn = this.timerFn.bind(this);
    }
    static msg(data: any) {
        if (data && typeof (data) == 'object') data = JSON.stringify(data);
        console.log('<begin' + data.toString() + 'end>');
        //process.stdout.write(new Buffer('<begin' + data.toString() + 'end>', 'utf8'));
        //process.stdout.end();
    }
    static end() {
        //msg('close');
        //process.nextTick(() => {  });
        //	process.exit(0);
        //});
    }
    private inData(chunk: Buffer) {
        this.chunksData.push(chunk);
    }
    private inEnd() {
        this.stdin.removeAllListeners('data');
        this.resolve(JSON.parse(Buffer.concat(this.chunksData).toString()));
        this.chunksData = [];
        //this.destroy();
    }
    data(stdin: NodeJS.ReadableStream, fnCall: (data: any) => any) {
        this.chunksData = [];
        this.stdin = stdin;
        stdin.resume();
        stdin.on('data', this.inData);
        stdin.on('end', this.inEnd);
        this.resolve = fnCall;
        //return new Promise<any>((resolve) => {
        //    this.resolve = resolve;
        //})
    }
    spawn(req: ServerRequest | null, timeSec: number, param: string[], data?: IDict<any>, fn?: (obj: any) => void) {
        this.timerErr = JSON.stringify(param) + ' time: ' + timeSec;
        this.req = req;
        //this.callFn = fn;
        if (!param[0].startsWith('/'))
            param[0] = pathType.app + param[0];

        // , '--harmony'
        param.splice(0, 0, '--use_strict');
        let child = this.child = spawnAsync('node', param);

        this.chunksErr = [];
        this.chunksData = [];

        child.on('close', this.close);
        child.stderr.on('data', this.chErrData);
        child.stderr.on('end', this.chErrEnd);
        child.stdout.on('data', this.chData);
        child.stdout.on('end', this.chEnd);

        if (data) {
            let dataStr = <string>(typeof (data) == 'object' ? JSON.stringify(data) : <any>data)
            child.stdin.write(new Buffer(dataStr.toString(), 'utf8'));
            child.stdin.end();
        }

        this.timerLink = setTimeout(this.timerFn, timeSec * 1000);

        return child;
    }
    private timerFn() {
        err('fw.spawn.timer:', this.timerErr);
        this.child.kill();
        if (this.req) this.req.endText('timeout');
    }
    private close() {
        if (this.timerLink) clearTimeout(this.timerLink);
    }
    private chErrData(chunk: Buffer) {
        this.chunksErr.push(chunk)
    }
    private chErrEnd() {
        let data = Buffer.concat(this.chunksErr).toString().trim();
        if (data) console.error(data);
        this.chunksErr = [];
        //this.destroy();
    }
    private chData(chunk: Buffer) {
        this.chunksData.push(chunk)
    }
    private chEnd() {
        let data = Buffer.concat(this.chunksData).toString().trim();
        while (this.reMessage.test(data)) {
            let m = data.match(this.reMessage);
            if (m) {
                this.message(m[1]);
                data = data.replace(m[0], '').trim();
            }
        }
        if (data) console.log(data);
        //this.destroy();
        this.chunksData = [];
    }
    private message(msg: string) {
        let req = this.req;
        if (req && (msg.charAt(0) == '{' || msg.charAt(0) == '[')) {
            let data = JSON.parse(msg);
            if (Array.isArray(data)) {
                req.endJson(data);
            }
            else {
                //if ('func' in data && this.callFn) {
                //    this.callFn(data.func);
                //    delete (data.func)
                //}
                if (Object.keys(data).length) req.endJson(data);
            }
        }
        else {
            if (msg == 'close') {
                this.child.kill();
            }
            else {
                if (req !== null) {
                    req.endText(msg);
                }
                else {
                    //TypeError: 'caller', 'callee', and 'arguments' properties may not be accessed on strict mode
                    //console.error('fw::message', msg, arguments.callee.caller.name);
                    // process.env,


                    //console.error('fw-spawn-message', msg, process.argv, this.timerErr);
                    //console.trace();
                }
            }
        }
    }
    /*
    private destroy() {
        this.close();
        this.chunksErr
            = this.reMessage
            = this.stdin
            = this.callFn
            = this.timerLink
            = this.req
            = this.chunksData
            = this.child
            = this.resolve
            = this.timerErr
            = void (0);
    }
    */
}

export function userEnabled(userId: number, flagStatus: boolean) {
    return (recordIdu: number) => {
        return flagStatus || userId == recordIdu;
    };
}

export function fileCopySync(srcFile: string, destFile: string) {
    fwcm.fileCopySync(srcFile, destFile);
}
export function fileCacheHtml(host: string, webPath: string, text?: string, fileDate?: Date) {
    let pathToFile = pathType.html + host + decodeURI(webPath) + (webPath.slice(-1) == '/' ? 'index' : '');
    if (text) {
        testDirSync(pathToFile);
        fso.writeFileSync(pathToFile, text, { encoding: 'utf8', mode: 0o644 });
        if (fileDate) fso.utimesSync(pathToFile, fileDate, fileDate);
    }
    else {
        if (fso.existsSync(pathToFile)) text = fso.readFileSync(pathToFile, 'utf8');
    }
    return text;
}
export function randInt(max: number) {
    return Math.floor(Math.random() * max);
}
export function randSelect<T>(list: T[], amount: number): T[] {
    if (amount > list.length) amount = list.length;
    let max = list.length, data: number[] = [], out: T[] = [];
    for (let i = 0; i < max; i++) data.push(i);
    while (amount--) {
        let i = Math.floor(Math.random() * data.length), pos = data.splice(i, 1)[0];
        out.push(list[pos]);
    }
    out = JSON.parse(JSON.stringify(out));
    return out;
}
export function slice<T>(list: T) {
    //return <T>Array.prototype.slice.call(list)
    return Array.prototype.slice.call(list);
}
export function each<T>(list: T[], fnNext: (line: T, fnNext: () => void, i?: number) => void, fnEnd?: () => void) {
    let i = -1;
    let next = () => {
        i++;
        if (i < list.length) {
            fnNext(list[i], next, i);
        }
        else {
            if (fnEnd) fnEnd();
        }
    };
    next();
}

export function treeText(text: string) {
    return text.slice(0, 100);
}

export function treePath(tree: ITree, idnDoc: number, path?: string) {
    let test = (path: string) => {
        // а-яё
        return path.charAt(0) == '@' ? path : path.replace(/[^0-9a-z]/gi, ' ').trim().replace(/\s+/gi, '-');
    }
    if (path === void (0)) {
        path = tree[idnDoc].path.trim();
    }

    path = test(path);

    let pathEnd = '', pathBase = '';
    let rePathEnd = /\-\d{1,4}$/;
    if (rePathEnd.test(path)) {
        path = path.replace(rePathEnd, (a) => { pathEnd = a; return ''; });
    }
    pathBase = test(path.slice(0, 65));
    path = pathBase + pathEnd;

    let ext = 1;
    let firstEQ = true;
    let list = treeChild(tree, tree[idnDoc].idp);
    let i: number, im = list.length, idn: number;
    let testOk = false;
    while (!testOk) {
        testOk = true;
        for (i = 0; i < im; i++) {
            idn = list[i];
            if (idnDoc == idn) continue;
            if (path == tree[idn].path) {
                if (firstEQ) {
                    firstEQ = false;
                    testOk = false;
                    break;
                }
                ext++;
                path = pathBase + '-' + ext;
                testOk = false;
                break;
            }
        }
    }
    tree[idnDoc].path = path;
}


export function getOldKeyWords(node: INode) {
    return node.head.keywords.map(a => a).concat(node.head.labels.map(a => a as any)) as (string | number)[];
}


// ====
// ====
// ====


export interface INodeStat {
    year: { [propName: string]: { [propName: string]: number } }
}
export interface INode {
    order: {
        next: number
        prev: number
        first?: number
        last?: number
    }
    head: {
        idn: number
        idp: number
        idu: number
        flagValid?: boolean
        flagFolder?: boolean
        flagBlock?: boolean
        flagOpenLink?: boolean
        title: string
        rating?: number[]
        link: [string, string]
        date: [string, string]
        keywords: string[]
        labels: number[]
        notice?: {
            date?: string
            message?: string
            email?: string
        }
    }
    descr: string
    content: string
    attach: IAttach[]
}
export interface IAttach {
    idf: number
    date: string
    idu?: number
    like?: number
    price?: number
    anonym?: string
    flagMark?: boolean
    flagNode?: boolean
    flagComment?: boolean
    flagCatalog?: boolean
    content?: string
    group?: number[]
    src?: string
    w?: number
    h?: number
    quiz?: string
    gameResult?: any
}

export interface ITreeLine {
    idp: number
    idu: number
    text: string
    path: string
    prev: number
    next: number
    first: number
    last: number
}
//export interface ITreeDBLine extends ITreeLine{
//    idn: number
//    first: number
//    last: number
//}
export interface ITree {
    [propName: string]: ITreeLine
}

export interface IIniWaterMark {
    font: string
    cmd: string
    text: string
    k: number
    quality: number
}
export interface INewsAttr {
    class?: string
    id?: string
    'data-limit': number
}
export interface IIni {
    jsFile?: string
    idnLabel: number
    idnAdvNode?: number
    idnBlogStream?: number
    idnNews?: number
    blogStreamIdn?: number
    blogStreamLevel?: number
    logo?: { src: string, width: number, height: number }
    //lazyLoad?: boolean
    yaMetrika?: { code: number, horiz?: string, vert?: string, mobile?: string }
    yaCounter?: number
    maxReadAlso?: number
    flagShop?: boolean
    flagWithShop?: boolean
    flagBodyURL?: boolean
    flagWithJoint?: boolean
    flagSite2016?: boolean
    sapeUpdate?: boolean // для перечитывания в сапе
    //flagOnlyDirect?: boolean
    flagSecure?: boolean
    flagSape?: boolean
    flagSSL?: boolean
    tracker?: number
    //jsLoad?: string
    blog?: {
        perPage?: number
    }
    admin: {
        email: string[]
        , menu?: string[]
    }
    watermark?: IIniWaterMark
    onInit?: (host: string) => void
    onFinish?: (data: IPageData, doc: HTMLDoc, tree: ITree) => void
    //onFinish?: (data: IPageData, doc: libxmljs.HTMLDocument, tree: ITree) => void
    html: {
        head?: (pageData: IPageData, tree?: ITree) => Elem[]
        //head?: (pageData: IPageData, tree?: ITree) => libxmljs.Element[]
        css?: string[]
        js?: string[]
        content: {
            header?: (pageData: IPageData) => string[]
            footer?: (pageData: IPageData) => string[]
            news?: (tagName?: string) => INewsAttr
            body: boolean
            catalog?: boolean
            comment?: boolean
        }
        sidebar?: (pageData?: IPageData) => void
    },
    menu?: {
        main?: (menu: string[][]) => void
        section?: (menu: string[][]) => void
    }
}
export interface IPageData {
    idn: number
    host: string
    path: string
    keywords?: string
    description?: string
    title?: string
    content?: string
    noindex?: boolean
    breadcrumb?: [string[]]
    css: string[]
    js: string[]
    jsData: any
    //jsLoad?: string
    node: INode
    pageNum: number
    dateLast?: string
    dateLastFn?: () => void
    linkUniID: number
    type?: {
        root: boolean
        folder: boolean
        label: boolean
        node: boolean
        outside: boolean
    }
    html?: {
        //doc: libxmljs.HTMLDocument
        //head: libxmljs.Element
        //content: libxmljs.Element
        //aside: libxmljs.Element
        doc: HTMLDoc
        head: Elem
        content: Elem
        aside: Elem
    }
    getUser: (idu: number) => string
    getNodePath: (idn: number) => string
}

export interface IHostKeyword {
    [s: string]: (string | number)[]
}
export interface IRegistration {
    key: string
    browser: string
    ip: string
    data: {
        name: string
        password: string
        email: string
    }
}

export interface IDataAnonym {
    src?: string
    w?: number
    h?: number
    idn: number
    idu: number
    content: string
    like?: number
    name?: string
    idf?: number
    date?: string
    flagMark: boolean
    flagAnonym: boolean
    flagComment: boolean
    ip: string
    browser: string
    gameResult?: any
    key: string
    add: any
}