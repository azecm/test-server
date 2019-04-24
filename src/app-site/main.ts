
import * as fso from "fs";
import * as fsp from "../promise/fs-promise";

import * as fw from "../fw";
import { config } from "../config";
import { PostgreSQL } from "../promise/postgre";
import { ServerRequest } from "../server-request";

import { addMarkAsync } from "./tracker";

import { INodeFile } from './node-file';

//import { posix } from "path";

//var reDgt = new RegExp("^\\d+$");

const iniHost: { [s: string]: fw.IIni } = {};

const hostToybytoy = '';
const _gameList = [] as string[];

function isToybytoy(req: ServerRequest) {
    return req.host == hostToybytoy;
}

export var route = new fw.Route();

const scp = {
    path: '_' + fw.logDate() + '.json',
    data: {
        blockedUri: {} as { [s: string]: number },
        violatedDirective: {} as { [s: string]: number }
    }
}

route.push("get", "/on/stat", getStatistic);
route.push("get", "/on/log", function (req: ServerRequest) { getStatistic(req, true) });

route.push("get", "/on/tree", getTree);
route.push("get", "/on/treetune", getTreeTune);
route.push("post", "/on/treetune", postTreeTune);

route.push("get", "/on/verify", getVerify);
route.push("post", "/on/verify", postVerify);

route.push("get", "/on/user/list", getUserList);
route.push("get", "/on/user/page", getUserPage);
route.push("post", "/on/user/page", postUserPage);

route.push("post", "/on/keywords", postKeywords);
route.push("get", "/on/keywords", getKeywords);

// ========

route.push("get", "/on/node", getNode);
route.push("post", "/on/node", postNode);
route.push("post", "/file/on/", postFile);
route.push("post", "/file/", postFile);

// ========

route.push("post", "/recovery", postRecovery);
route.push("get", "/registration", getRegistration);
route.push("post", "/registration", postRegistration);

// ========

route.push("post", "/user-key", postUserKey);
route.push("post", "/on/user-key", postUserKeyToSession);

route.push("get", "/search", getSearch);
route.push("post", "/like", postLike);
route.push("post", "/rating", postRating);
route.push("post", "/testing", postTesting);

route.push("post", "/mailform", postMailform);

route.push("post", "/quiz", postQuiz);
route.push("post", "/on/quiz", postQuiz);

route.push("get", "/game-data", gameDataLoad);
route.push("post", "/game-data", gameDataSave);
route.push("post", "/on/game-data", gameDataSave);

route.push("post", "/game-log", gameLog);
route.push("post", "/on/game-log", gameLog);

route.push("post", "/quiz-result", postQuizResult);
route.push("post", "/on/quiz-result", postQuizResult);
route.push("post", "/game-result", postGameResult);
route.push("post", "/on/game-result", postGameResult);

route.push("post", "/comment-voting/", postCommentVoting);
route.push("post", "/comment-voting/on/", postCommentVoting);

// ========

route.push("post", "/on", sessionOpen);
route.push("get", "/on/test", function (req: ServerRequest) { req.endText("ok") });

route.push("get", "/json", getJavascript);
route.push("get", "/test-page", testPage);
route.push("post", "/csp", postCSP);
route.push("get", "/toysha/brush.json", getToyshaBrush);

// ========

function pathToSaved(req: ServerRequest, userKey: string) {
    let path = '';
    if (req.session && req.session.data.idu) {

        path = fw.pathType.data + hostToybytoy + '/user-data/' + req.session.data.idu + '.json';
    }
    else if (userKey) {
    
        path = fw.pathType.memory + hostToybytoy + '/user-data/' + userKey + '.json';
    }
    return path;
}

function saveGame(req: ServerRequest, userKey: string, idn: number, type: 'quiz' | 'game', quizRes: { err: number[] }) {
    if (!isToybytoy(req)) return;

    const path = pathToSaved(req, userKey);

    const jsonData = (data: IUserResult) => {
        if (!data[type]) data[type] = {};
        switch (type) {
            case 'quiz': {
                const { quiz } = data;
                const val = quizRes.err.length;
                if (quiz[idn] === void (0)) {
                    quiz[idn] = { played: 0, min: val };
                }
                else {
                    if (typeof (quiz[idn]) == 'number') {
                        quiz[idn] = { played: 0, min: quiz[idn] } as any;
                    }
                    if (quiz[idn].min > val) quiz[idn].min = val;
                }
                quiz[idn].played++;
                break;
            }
            case 'game': {
                const { game } = data;
                if (game[idn] === void (0)) game[idn] = { played: 0 };
                game[idn].played++;
                break;
            }
        }
        if (!req.session) {
            data.browser = req.browser;
            data.ip = req.ip;
        }
        fw.saveJson(path, data).then(() => { }).catch(() => { });
    };

    fw.loadJson(path)
        .then(jsonData)
        .catch(() => {
            jsonData({} as IUserResult);
        });
}

function getUserKey(req: ServerRequest) {
    return fw.codeAlpha(req.host + '::' + req.browser + '::' + req.ip);
}

async function postUserKey(req: ServerRequest) {
    req.endText(getUserKey(req));
}

async function postUserKeyToSession(req: ServerRequest) {
    let resText = 'ok';
    if (req.session && req.session.data.idu) {
        const [err, dataPost] = await req.dataPost();
        if (err === null && dataPost.key) {
            //const path = pathToSaved(req, userKey);
            fw.log('UserKeyToSession', req.session.data.idu, dataPost.key);
            //resText = 'moved';
            //delete (dataFile.browser)
            //delete (dataFile.ip)
        }
    }
    req.endText(resText);
}

async function folderTree(host: string, idpCur: number) {
    let out: [number, string][] = [];
    let rows = await fw.postgreFolderList(host);
    function iter(idp: number, level: number, line: { text: string, path: string }) {
        // тире длины M &mdash; &#8212; \u2014
        let levelStr = '', i = level;
        while (i--) levelStr += "\u2014";

        out.push([idp, levelStr + (levelStr ? " " : "") + (line.text || line.path)]);
        if (idpCur == idp) out[out.length - 1].push(1);

        for (let row of rows) {
            if (row.idp == idp) {
                iter(row.idn, level + 1, row);
            }
        }
    }
    iter(0, 1, { text: host, path: '' });
    return out;
}

// ========

async function getStatistic(req: ServerRequest, flagLog: boolean) {
    if (/^\d\d\d\d\-\d\d\-\d\d$/.test(req.query)) {
        let data = await fw.loadJson(fw.pathType.stat + req.query.replace(/\-/g, "/") + fw.extJson)
        if (data) {
            if (flagLog) {
                req.endJson(data);
            }
            else if (data.hosts && data.hosts[req.host]) {
                const host = data.hosts[req.host];
                data.hosts = {};
                data.hosts[req.host] = host;
                req.endJson(data);
            }
            else {
                req.endText("3");
            }
            /*
            else if (data[req.host]) {
                data[req.host].date = data.date;
                req.endJson(data[req.host]);
            }
            else {
                if (data.head && data.head.affiliate) {
                    let affiliate = data.head.affiliate.host.src.filter(function (line: string[]) {
                        return req.host.endsWith(line[1]);
                    });
                    data.host[req.host].date = data.date;
                    data.host[req.host].affiliate = affiliate.length == 1 ? affiliate[0][0] : 0;
                    req.endJson(data.host[req.host]);
                }
                else {
                    req.endJson(data);
                }
            }
            */

        }
        else {
            req.endText("1");
        }
    }
    else {
        req.endText("2");
    }
}

async function testPage(req: ServerRequest) {
    req.endText('ok');
}

async function getJavascript(req: ServerRequest, version?: string) {
    if (/^[a-z]+$/.test(req.query) && req.session && req.session.data.idu && (req.query != "admin" || req.session.user.status == 5)) {
        let path = fw.pathType.publ + "js/" + req.query + "-OnlyAuthUser.js";
        if (version) {
            //path  = '/usr/local/www/cache/file/'+req.pathlist[2]+'/'+req.pathlist[3]+'/'+req.query+'-OnlyAuthUser.js';
        }
        let stats = await fsp.stats(path);
        if (stats) {
            if (req.ifModifiedSince == stats.mtime.toUTCString()) {
                req.end304();
            }
            else {
                let text = await fw.load(path);
                req.modified = stats.mtime;
                req.maxAge = 36000;
                req.end(200, "javascript", text);
            }
        }
        else {
            req.end404();
        }
    }
    else {
        req.end404();
    }
}

async function postTreeTune(req: ServerRequest) {
    if (req.session.user.status == 5) {
        let [err, data] = await req.dataPost();
        if (err === null && data.idn) {
            data.host = req.host;
            data.userID = req.session.data.idu;
            new fw.Spawn().spawn(req, 15, ["app-site/node-tree.js"], data);
        }
        else {
            if (err !== null) console.error(`site::main::postTreeTune ${err}`)
            req.endText("ok");
        }
    }
    else {
        req.endText("ok");
    }
}

async function getToyshaBrush(req: ServerRequest) {
    // /usr/local/www/public/image/toysha
    const
        out: { [s: string]: string[] } = {},
        dir = "/usr/local/www/public/image/toysha/"
        ;
    let c1 = 0, c2 = 0;
    for (let folderName of (await fsp.asyncReadDir(dir))) {
        c1++;
        out[folderName] = [];
        c2++;
        for (let fileName of (await fsp.asyncReadDir(dir + folderName))) {
            if (fileName.endsWith(".png"))
                out[folderName].push(fileName);
        }
        if (c1 == c2) req.endJson(out);
    }
}

async function getTreeTune(req: ServerRequest) {
    let idnDoc = parseInt(req.query, 10);

    if (req.session.user.status == 5 && await fw.redisExists(req.host, idnDoc)) {
        let dataFile = await fw.loadNode(req.host, idnDoc);
        if (!dataFile) {
            req.end404();
            return;
        }

        let order1: [number, string][] | undefined, order2: number | undefined;
        //let t1 = new Date().getTime();
        let childList = await fw.postgreTreeChild(req.host, dataFile.head.idp);
        //console.log('getTreeTune 1', (new Date().getTime() - t1)/1000);
        if (childList.length > 50) {
            order2 = childList.length;
        }
        else {
            let order = order1 = [] as [number, string][];
            let counter = 0;
            let flag = false;
            for (let idn of childList) {
                if (idn == idnDoc) {
                    flag = true;
                }
                else {
                    let line = await fw.redisTreeLine(req.host, idn);
                    if (line) {
                        order.push([counter, line.text || line.path]);
                        if (flag) {
                            flag = false;
                            order[order.length - 1].push(1);
                        }
                    }
                    counter++;
                }
            }
            order1.push([counter, "ПОСЛЕДНИЙ"]);
        }
        //console.log('getTreeTune 2', (new Date().getTime() - t1) / 1000);
        let data: IDict<any> = {
            text: dataFile.head.link[0],
            path: dataFile.head.link[1],
            date: dataFile.head.date[0],
            idu: dataFile.head.idu,
            order: order1 || order2,
            tree: await folderTree(req.host, dataFile.head.idp),
            orderGet: childList.indexOf(idnDoc),
            treeGet: dataFile.head.idp
        };
        //console.log('getTreeTune 3', (new Date().getTime() - t1) / 1000);
        if (dataFile.head.flagFolder) data["flagFolder"] = 1;
        if (dataFile.head.flagBlock) data["flagBlock"] = 1;
        if (dataFile.head.flagValid) data["flagValid"] = 1;
        req.endJson(data);
    }
    else {
        req.end404();
    }
}

async function getTree(req: ServerRequest) {
    if (req.session.user.status != 5) {
        req.end404();
        return;
    }

    let data: any[] = [];
    let idpList = req.query.split("-"), page = 1, perPage = 100, idp: number;
    if (idpList.length == 2) {
        page = parseInt(idpList[1], 10);
        idp = parseInt(idpList[0], 10);
    }
    else {
        idp = parseInt(req.query, 10);
    }

    let line = await fw.redisTreeLine(req.host, idp);
    if (!line) {
        req.end404();
        return;
    }

    if (!line.first) {
        let node = await fw.loadNode(req.host, idp);
        if (!node || !node.head) {
            req.end404();
            return;
        }
        if (!node.head.flagFolder) {
            req.endJson({ idp: node.head.idp });
            //req.endRedirect(301, req.host + '/admin/tree#' + node.head.idp);
            return;
        }
    }

    let idnList = await fw.postgreTreeChild(req.host, idp);

    //console.error('getTree', req.host, idp, idnList);

    let pageMax = Math.ceil(idnList.length / perPage);
    let path: any[] = [];
    let idPath = idp;
    while (idPath) {
        let line = await fw.redisTreeLine(req.host, idPath);
        if (line) {
            path.push([idPath, line.path]);
            idPath = line.idp;
        }
        else idPath = 0;
    }
    path.push([0, req.host]);
    data.push([page, pageMax, path]);

    let im = idnList.length;
    if (im) {
        let i1 = (page - 1) * perPage, i2 = page * perPage;
        if (i2 > im) i2 = im;
        for (let i = i1; i < i2; i++) {
            let idn = idnList[i];
            let node = await fw.loadNode(req.host, idn);
            if (node) {
                if (node.head && node.head.link) {
                    data.push([idn, node.head.link[0], node.head.link[1], node.head.flagFolder ? 1 : 0]);
                }
                else {
                    console.error('not node.head.link', req.host, idn, node.head);
                }
            }
        }
    }
    req.endJson(data);
}

async function postMailform(req: ServerRequest) {
    let [err, dataPost] = await req.dataPost();
    if (err === null && Array.isArray(dataPost) && dataPost.length == 3 || (dataPost.name && dataPost.message)) {
        let data = { host: req.host, ip: req.ip, browser: req.browser, data: dataPost };
        new fw.Spawn().spawn(req, 5, ["app-site/mail.js"], data);
    }
    else {
        req.endText("ok");
    }
}

async function sessionOpen(req: ServerRequest) {
    let [err, data] = await req.dataPost();
    if (err !== null) {
        req.end404();
        return;
    }
    let session = new fw.Session(req);
    let res = session.open(data);
    if (res.type == 1) {
        let uData = data.split("&");
        if (uData.length != 2) {
            req.end404();
            return;
        }
        uData = fw.encode(uData, true);

        //fw.log('+', uData);
        let user = await fw.userByName(req.host, uData[0]);
        //fw.log('+', user);

        if (!user || user.name != uData[0] || user.password != uData[1] || !user.status) {
            req.end404();
            return;
        }

        let menu = [user.name];
        if (user.status == 5) {
            //fw.log(req.host, user.status, user.subnet, req.ip, req.ip.search(config.adminsubnet), config.adminsubnet);
            if (user.subnet == "ini") {
                let ini: fw.IIni = require("./ini/" + req.host);
                menu = menu.concat(ini.admin.menu || []);
            }
            else if (user.subnet == -1 || req.ip.search(config.adminsubnet) > -1) {
                menu.push("новые:fa-verify:/admin/verify");
                menu.push("структура:fa-struct:/admin/tree#0");
                menu.push("темы:fa-theme:/admin/keywords");
                if (req.host == "hnh") {
                    menu.push("логи:fa-logs:/admin/log");
                }
                menu.push("статистика:fa-statistic:/admin/statistic");
                menu.splice(0, 0, "главная:fa-home:/");
            }
        }
        let timeStart = fw.now();
        let key = session.keyInit(timeStart, { ip: req.ip, browser: req.browserLine, start: timeStart, idu: user.idu });
        session.save();
        let out = [key + "-" + session.secret(timeStart, req.ip, req.browserLine), menu];
        req.endJson(out);
    }
    else if (res.type == 2) {
        req.endText(res.text);
    }
    else {
        req.end404();
    }
}

async function postRegistration(req: ServerRequest) {
    let [err, userData] = await req.dataPost();
    if (err !== null || !userData || userData.length != 3) {
        req.end404();
        return;
    }
    for (let i = 0; i < 3; i++)
        userData[i] = fw.textClean(userData[i]).trim();


    let
        reName = /^[a-zа-яё0-9\s]{7,}$/i,
        reMail = /^[^@]+@[^\.]+\..+$/,
        name = fw.textClean(userData[0]),
        pw = fw.textClean(userData[1]),
        email = fw.textClean(userData[2])
        ;

    if (!reName.test(name) || pw.length < 8 || !reMail.test(email)) {
        req.endText("msg:Данные некорректны.");
        return;
    }

    const host = req.host;

    let idu = await fw.redisUserId(host, name) || await fw.redisUserId(host, email, true);

    if (idu) {
        req.endText("msg:Пользователь с похожими данными уже есть.");
    }
    else {
        req.endText("ok:Для завершения регистрации пройдите по ссылке в письме,<br>высланном на указанный адрес.");
        let data = { host: req.host, ip: req.ip, browser: req.browser, registration: userData };
        new fw.Spawn().spawn(req, 5, ["app-site/mail.js"], data);
    }
}
async function getRegistration(req: ServerRequest) {
    if (!(/^[a-z0-9]{27}$/i.test(req.query))) {
        req.end404();
        return;
    }

    let path = fw.pathType.memory + req.host + "/registration/" + req.query + fw.extJson;
    let userData: fw.IRegistration = await fw.loadJson(path);
    if (!userData) {
        req.end404();
        return;
    }

    fso.unlink(path, () => { });
    const host = req.host;
    let idu = await fw.redisUserId(host, userData.data.name) || await fw.redisUserId(host, userData.data.email, true);
    if (idu) {
        req.end404();
    }
    else {
        new fw.Spawn().spawn(req, 5, ["app-site/user.js"], { host: host, route: "add", data: userData.data });
        req.endText("true");
    }
}
async function postRecovery(req: ServerRequest) {
    let user: IUser | undefined;
    let [err, userData] = await req.dataPost(), host = req.host;
    if (err !== null) {
        req.endText();
        return;
    }
    if (userData) {
        userData = fw.textClean(userData);

        let idu = await fw.redisUserId(host, userData);
        if (!idu) idu = await fw.redisUserId(host, userData, true);

        if (idu) {
            user = await fw.loadUser(host, idu);
        }
    }
    if (user) {
        req.endText("ok:Данные высланы на контактный email.");
        let data = { host: host, recovery: { email: user.email, name: user.name, pass: user.password } };
        new fw.Spawn().spawn(req, 5, ["app-site/mail.js"], data);
    }
    else {
        req.endText("ok:Пользователя с указанными данными не найдено.");
    }
}

async function postCSP(req: ServerRequest) {
    let [err, data_str] = await req.dataPost("text");
    if (err === null) {
        let data = JSON.parse(data_str);
        if (data && data['csp-report']) {
            let blockedUri = data['csp-report']['blocked-uri'], violatedDirective = data['csp-report']['violated-directive'];
            if (blockedUri) {
                if (!(blockedUri in scp.data.blockedUri)) scp.data.blockedUri[blockedUri] = 0;
                scp.data.blockedUri[blockedUri]++;
            }
            if (violatedDirective) {
                if (!(violatedDirective in scp.data.violatedDirective)) scp.data.violatedDirective[violatedDirective] = 0;
                scp.data.violatedDirective[violatedDirective]++;
            }
            fso.writeFile(fw.pathType.log + 'csp/' + scp.path, JSON.stringify(scp.data, null, '\t'), () => { });
        }
        //fso.writeFile(fw.pathType.log + 'csp/' + fw.logDate() + '.json', data, () => { });
        //fso.appendFile(fw.pathType.log+"node.csp.log", "\n\n" + data);
    }
    req.endText();
}

function getSearch(req: ServerRequest) {
    let key = fw.codeAlpha(fw.now() + req.browser + req.ip);
    req.endText("ok" + key);
    new fw.Spawn().spawn(req, 10, ["app-site/search.js"], {
        host: req.host,
        key: key,
        search: req.query
    });
}

async function postLike(req: ServerRequest) {
    let [err, data] = await req.dataPost();
    req.endText("ok");
    if (err !== null) return;
    let flagIdf = data.length == 3 && data[2] == "idf";
    if (typeof (data[0]) == "number" && (data.length == 2 || flagIdf)) {
        let idn = await fw.redisNodeId(req.host, data[1]);
        let likeNum = parseInt(data[0], 10);
        if (idn && isFinite(likeNum) && isFinite(idn)) {
            data = { host: req.host, likeNum: likeNum, idn: idn, idnPath: data[1], flagIdf: flagIdf };
            new fw.Spawn().spawn(req, 5, ["app-site/node-like.js"], data);
        }
    }
}

async function postRating(req: ServerRequest) {
    let [err, data] = await req.dataPost();
    if (err !== null) {
        req.endText();
        return;
    }
    let code = parseInt(data[0], 10);
    let idn = await fw.redisNodeId(req.host, data[1]);
    if (idn && code > 0 && code < 6) {
        new fw.Spawn().spawn(req, 10, ["app-site/node-rating.js"], { host: req.host, code: code, idn: idn, path: data[1] });
    }
    else {
        req.endText();
    }
}

async function postTesting(req: ServerRequest) {
    let [err, data] = await req.dataPost();
    if (err !== null) {
        req.endText();
        return;
    }
    let v1 = parseInt(data[0], 10);
    let v2 = parseInt(data[1], 10);
    let idn = await fw.redisNodeId(req.host, data[2]);
    if (idn && isFinite(v1) && isFinite(v2)) {
        new fw.Spawn().spawn(req, 10, ["app-site/node-testing.js"], { host: req.host, v1: v1, v2: v2, idn: idn, path: data[2] });
        req.endText("ok");
    }
    else {
        req.endText();
    }
}


async function postGameResult(req: ServerRequest) {
    const result = { status: 200, data: {} } as any;
    let [err, postData] = await req.dataPost();

    if (!err && postData) {
        await fw.loadJson(pathToSaved(req, postData.key))
            .then((dataFile) => {
                if (dataFile.game) {
                    result.data = dataFile.game;
                }
            })
            .catch(() => { });
    }

    req.endJson(result);
}


async function postQuizResult(req: ServerRequest) {
    const result = { status: 200, data: {} } as any;
    let [err, postData] = await req.dataPost();

    if (!err && postData) {
        await fw.loadJson(pathToSaved(req, postData.key))
            .then((dataFile) => {
                if (dataFile.quiz) {
                    result.data = dataFile.quiz;
                }
            })
            .catch(() => { });
    }

    req.endJson(result);
}


async function gameLog(req: ServerRequest) {
    interface IPost {
        idn: number
        key: string
        type: string
        name: string
        message: string
        result: any
    }

    let [err, post] = await req.dataPostType<IPost>();
    if (err !== null || (!post.result)) {
        req.endText();
        return;
    }

    const resultData = { status: 200 } as { status: number, key: string };
    if (isToybytoy(req) && await fw.redisExists(req.host, post.idn)) {
        if (!req.session && !post.key) {
            resultData.key = post.key = getUserKey(req);
        }

        const activityType = _gameList.indexOf(post.type) > -1 ? 'game' : (post.result.err !== void (0) ? 'quiz' : '');
        if (activityType) {
            saveGame(req, post.key, post.idn, activityType, post.result);
        }
        else {
            fw.log('gameLog not defined', post);
        }

        const pathActivity = fw.pathType.memory + hostToybytoy + '/tracker/activity/';
        const idu = req.session ? req.session.user.idu : 0;

        const data = {
            date: fw.dateJSON(),
            ip: req.ip,
            idn: post.idn,
            type: post.type,
            content: post.message,
            result: post.result,
            user: Object.assign({ name: post.name }, idu ? { idu } : { key: post.key })
        };

        const pathName = new Date().getTime() + '' + ~~(Math.random() * 10);
        fw.saveJson(`${pathActivity}${pathName}.json`, data, true);


        if (post.message) {
            const node = await fw.loadNode(req.host, post.idn);
            if (node && !/<a/.test(post.message)) {
                const idf = node.attach.length ? node.attach[node.attach.length - 1].idf + 1 : 1;
                const commentData = {
                    idf: idf,
                    date: fw.dateJSON(),
                    content: post.message,
                    flagComment: true,
                    gameResult: post.result,
                } as fw.IAttach;

                if (idu) commentData.idu = idu;
                else commentData.anonym = post.name;

                node.attach.push(commentData);

                await fw.saveNode(req.host, node);

                addMarkAsync(req.host, post.idn);
            }
            else {
                fw.log('gameLog', '!!!', post);
            }
        }
    }

    req.endJson(resultData);
}

async function postQuiz(req: ServerRequest) {
    req.endText('ok');

    let [err, data] = await req.dataPost();
    if (err !== null) return;

    let src = data[0];
    let v1 = parseInt(data[1], 10);
    let v2 = parseInt(data[2], 10);
    let vErr = parseInt(data[3], 10);
    let idn = await fw.redisNodeId(req.host, data[4]);
    if (idn && isFinite(v1) && isFinite(v2) && isFinite(vErr) && /^\d{4}\/\d{4}\.\w{3}$/.test(src)) {
        new fw.Spawn().spawn(req, 10, ["app-site/node-testing.js"], { host: req.host, src: src, v1: v1, v2: v2, idn: idn, path: data[2] });
    }
}

function gameDataLoad(req: ServerRequest) {
    req.endFile(fw.pathType.data + req.host + "/node-data/" + req.query + fw.extJson, "json");
}

async function gameDataSave(req: ServerRequest) {
    req.endText('ok');

    let [err, post] = await req.dataPost();

    if (err === null && post) {
        if (await fw.redisExists(req.host, post.idn)) {

            let path = fw.pathType.data + req.host + "/node-data/" + post.idn + fw.extJson;
            let data = await fw.loadJson(path, {});
            if (post.idn && post.data) {
                data.data = post.data;
            }
            else if (post.idn && post.result && post.name) {
                if (!data.result) data.result = {};
                data.result[post.name] = post.result;
            }
            else if (post.idn && post.funny && post.name) {
                post.funny = fw.jsonObj(fw.encode([post.funny], true)[0], true);
                if (post.funny) {
                    if (!('time' in post.funny) || post.funny.time > 5) {
                        if (post.type) {
                            if (!data[post.type]) data[post.type] = {};
                            data[post.type][post.name] = post.funny;
                        }
                        else {
                            data[post.name] = post.funny;
                        }
                    }
                }
            }
            else {
                // старый формат
                if (!data[post.game]) {
                    data[post.game] = {};
                }
                data[post.game][post.name] = {};
                for (let key in post) {
                    if (key != "game" && key != "name" && key != "idn") {
                        data[post.game][post.name][key] = post[key];
                    }
                }
            }
            await fw.save(path, JSON.stringify(data));
        }
    }
}


async function getNode(req: ServerRequest) {
    let out = <any>{};
    if (!iniHost[req.host]) iniHost[req.host] = require("./ini/" + req.host);
    if (/^0-\d+$/.test(req.query)) {
        let idp = parseInt(req.query.substr(2), 10);
        if (await fw.redisExists(req.host, idp)) {
            if (req.session.user.status == 5) {
                out = {
                    idn: req.query,
                    idp: idp,
                    folder: await fw.redisNodePath(req.host, idp),
                    title: "",
                    keywords: [],
                    labels: [],
                    link: ["", ""],
                    descr: "",
                    content: "",
                    attach: [],
                    flag: { valid: 0, block: 0, event: '' }
                };
                if (iniHost[req.host].flagShop) {
                    out.flag.shop = 1;
                }
            }
            else {
                out = {
                    idn: req.query,
                    url: "",
                    content: "",
                    attach: []
                };
            }
        }
        req.endJson(out);
    }
    else {
        let idnDoc = parseInt(req.query, 10);
        if (await fw.redisExists(req.host, idnDoc)) {
            let dataFile = await fw.loadNode(req.host, idnDoc);
            if (dataFile) {
                if (req.session.user.status == 5) {

                    let stats = await fsp.stats(fw.pathType.file + req.host + "/json/keywords.json");
                    let last = stats ? stats.mtime.getTime() : 0;
                    stats = await fsp.stats(fw.pathType.file + req.host + "/json/wordcount.json");
                    last = Math.max(stats ? stats.mtime.getTime() : 0, last) / 1000 >> 0;
                    out = {
                        idn: dataFile.head.idn,
                        idp: dataFile.head.idp,
                        folder: await fw.redisNodePath(req.host, dataFile.head.idp),
                        title: dataFile.head.title,
                        keywords: dataFile.head.keywords,
                        labels: dataFile.head.labels,
                        link: dataFile.head.link,
                        dateKeywords: last,
                        descr: dataFile.descr,
                        content: dataFile.content,
                        attach: dataFile.attach,
                        notice: dataFile.head.notice,
                        flag: {
                            valid: dataFile.head.flagValid || 0,
                            block: dataFile.head.flagBlock || 0,
                            event: ""
                            // dataFile.head.dateEvent || ''
                        }
                    };
                    //if (dataFile.head.lang) {
                    //	out.lang = dataFile.head.lang;
                    //}
                    if (iniHost[req.host].flagShop) {
                        out.flag.shop = 1;
                    }
                    req.endJson(out);
                }
                else if (dataFile.head.idu == req.session.data.idu) {
                    out = {
                        idn: dataFile.head.idn,
                        url: await fw.redisNodePath(req.host, dataFile.head.idn),
                        content: dataFile.content,
                        attach: dataFile.attach.filter(line => line.idu == (dataFile && dataFile.head.idu) || 0)
                    };
                    req.endJson(out);
                }
            }
        }
        else {
            req.endJson({});
        }
    }
}

async function postNode(req: ServerRequest) {
    let [err, data] = await req.dataPost();
    if (err !== null) {
        req.endText("not");
        return;
    }
    // idn,attach,title,text,path,content,descr,keywords
    let idn = data.idn || data[0];
    if (/^0-\d+$/.test(idn) || await fw.redisExists(req.host, idn)) {
        new fw.Spawn().spawn(req, 10, ["app-site/node.js"], { host: req.host, idu: req.session.data.idu, status: req.session.user.status, data: data });
    }
    else {
        req.endText("not");
    }
}

async function postCommentVoting(req: ServerRequest) {
    let out = 'err';

    if (req.referrer && /application\/json;\scharset=UTF-8/i.test(req.type)) {
        let [err, data] = await req.dataPost();
        if (err === null) {
            let
                host = req.host,
                idf = data.idf,
                idu = req.session && req.session.data.idu ? req.session.data.idu + '' : (req.ip + req.browser.replace(/[\s\:]/g, '')),
                rePath = /:\/\/[^\/]*([^\?#]*)/,
                res = req.referrer.match(rePath)
                ;
            if (res && idf) {
                let idn = await fw.redisNodeId(host, res[1]);
                if (idn) {
                    out = 'no';
                    let voteKey = `${idn}:${idf}:${idu}`;

                    let [err, res] = await fw.redis.sadd(fw.redisKeyCommentDayVoting(host), voteKey);
                    if (err !== null) console.error(__filename + '::postCommentVoting::redis.sadd - ' + err);
                    if (res) {
                        [err, res] = await fw.redis.sadd(fw.redisKeyCommentVoting(host), voteKey)
                        if (err !== null) console.error(__filename + '::postCommentVoting::redis.sadd(2) - ' + err);
                        if (res) {
                            out = 'yes';
                        }
                    }
                }
            }
            if (out == 'err') {
                console.error('CommentVoting data:', data, 'idf:', idf, 'res:', res);
            }
        }
    }
    if (out == 'err') {
        console.error('CommentVoting referrer:', req.referrer, 'type:', req.type);
    }
    req.endText(out);
}

async function postFile(req: ServerRequest) {
    if (req.type.indexOf("multipart/form-data") === 0) {
        let [err, key] = await req.dataPost();
        if (err !== null) {
            req.endText("err");
            return;
        }
        let
            idu = 0,
            status = -1,
            boundry = "--" + req.type.substring(req.type.indexOf("=") + 1, req.type.length)
            ;
        if (req.session) {
            idu = req.session.data.idu as number;
            status = req.session.user.status;
        }

        const data: INodeFile = { host: req.host, boundry: boundry, key: key, idu: idu, status: status, browser: req.browser, ip: req.ip }

        new fw.Spawn().spawn(req, 20, ["app-site/node-file.js"], data);
        await fw.save(fw.pathType.file + req.host + "/file/wait/" + key + fw.extJson, "[]");
        req.endText("ok" + key);
    }
    else {
        req.endText("err");
    }
}

function getVerify(req: ServerRequest) {
    if (req.session.user.status == 5) {
        new fw.Spawn().spawn(req, 30, ["app-site/tracker.js"], { route: "verify", host: req.host });
    }
}

async function postVerify(req: ServerRequest) {
    if (req.session.user.status == 5) {
        let [err, data] = await req.dataPost();
        if (err !== null) {
            req.end404();
            return;
        }
        data.host = req.host;
        new fw.Spawn().spawn(req, 60, ["app-site/tracker.js"], data);
    }
}

async function getUserList(req: ServerRequest) {
    if (!req.session) {
        req.endText();
        return;
    }

    let query = fw.jsonObj(req.query);
    let name = query[0];
    let page = parseInt(query[1], 10);
    if (!isFinite(page) || page < 1) page = 1;
    page--;

    const perPage = 30, host = req.host;
    const user = await fw.userByName(host, name);
    const idu = req.session.data.idu;

    if (!user) {
        req.endText("ok");
        return;
    }

    interface IMini {
        idn: number
        idp: number
        text: string
        path: string
        flagBlock: boolean
        flagValid: boolean
        commentAll: number
        commentLast: number
    }

    const folderAdd: [number, string][] = await fw.loadJson(fw.pathFolderAdd(host));
    const flagSelf = user.idu == idu;

    //let whereAnd = { flagFolder: false, idu: user.idu };

    let where = {
        and: { flagFolder: false, idu: user.idu, idp: { gt: 0 } }
    };

    let db = new PostgreSQL(host);
    await db.connect('main::getUserList');

    const select1 = await db.select({ idn: 0, idp: 0 }).fromTree().where(where).order({ dateAdd: -1 }).limit(perPage).offset(page * perPage).exec();

    const selectCount = await db.select({ count: 0 }).fromTree().where(where).exec();

    let idns = [] as number[];
    for (let row of select1.rows) {
        idns.push(row.idn);
        if (idns.indexOf(row.idp) == -1) idns.push(row.idp);
    }
    let rowsTree: IMini[] | undefined;
    if (idns.length) {
        const where = flagSelf ?
            { idn: { in: idns } }
            :
            { and: { idn: { in: idns }, flagBlock: false, flagValid: true } }
            ;
        const select2 = await db.select<IMini>({ idn: 0, idp: 0, text: '', path: '', flagBlock: true, flagValid: true, commentAll: 0, commentLast: 0 }).fromTree().where(where).exec();
        rowsTree = select2.rows;
    }

    await db.end();

    let data = <(string | number)[][]>[];
    if (rowsTree) {
        let treeMini = {} as IDict<IMini>;
        for (let row of rowsTree) treeMini[row.idn] = row;

        for (let row of select1.rows) {
            const idn = row.idn, line = treeMini[idn];
            if (!line || !line.idp) continue;
            const idp = line.idp, linePnt = treeMini[idp];
            if(!linePnt) continue;
            let path = '';
            if (!line.flagBlock && line.flagValid) {
                if (!linePnt.idp) {
                    path = '/' + linePnt.path + '/' + line.path;
                }
                else {
                    path = await fw.redisNodePath(host, idn);
                }
            }
            let dataLine = [line.commentAll, line.commentLast, fw.textClean(linePnt.text), fw.textClean(line.text), path];
            data.push(dataLine);
            if (flagSelf) dataLine.push(idn);
        }
    }
    let out = {
        maxAge: !page ? 60 : 600,
        add: folderAdd,
        max: Math.ceil(selectCount.rows[0].count / perPage),
        data
    };
    if (!flagSelf) delete (out.add);

    req.endJson(out);
}

function getUserPage(req: ServerRequest) {
    if (req.session) {
        //let name = decodeURIComponent(req.query);
        let name = req.query;
        new fw.Spawn().spawn(req, 10, ["app-site/user.js"], { route: "pageAbout", host: req.host, idu: req.session.data.idu, name: name });
    }
    else {
        req.endText();
    }
}

async function postUserPage(req: ServerRequest) {
    let [err, data] = await req.dataPost();
    if (err === null && Array.isArray(data) && req.session) {
        if (data.length == 4) {
            new fw.Spawn().spawn(req, 10, ["app-site/user.js"], { route: "pageAboutSave", host: req.host, idu: req.session.data.idu, data: data });
        }
        else if (data.length == 2) {
            new fw.Spawn().spawn(req, 10, ["app-site/user.js"], { route: "pageAboutSend", host: req.host, idu: req.session.data.idu, ip: req.ip, browser: req.browser, data: data });
        }
        else {
            req.endText();
        }
    }
    else {
        req.endText();
    }
}

function getKeywords(req: ServerRequest) {
    new fw.Spawn().spawn(req, 30, ["app-site/keywords.js"], { find: req.query, host: req.host });
}

async function postKeywords(req: ServerRequest) {
    let [err, data] = await req.dataPost();
    if (err === null) {
        new fw.Spawn().spawn(req, 30, ["app-site/keywords.js"], { data: data, host: req.host, idu: req.session.data.idu });
    }
    else {
        req.end404();
    }
}
