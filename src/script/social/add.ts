
// node --use_strict /usr/local/www/app.back/script/social/add.js

import * as fs from "fs";
import * as querystring from "querystring";
import * as http from "http";
import * as https from "https";
import { parse as urlParse } from "url";
import * as fw from "../../fw";
import { PostgreSQL } from "../../promise/postgre";

const socialList = ['twitter'];//['twitter', 'facebook', 'vk'];

const cache_file = fw.pathType.memory + 'toy/social_FILEKEY.json';

if (!module.parent) {
    if (process.argv.length == 3) {
        if (socialList.indexOf(process.argv[2]) > -1) {
            //socialList = [process.argv[2]];
            //for()
        }
    }
    start();
}


export interface IDataFileLine {
    host?: string
    content?: string
    link?: string
    files?: {
        src: string
        title: string
    }[]
    img?: string
    imgDescr?: string
    text?: string
    weight?: number
    src?: string
};


export interface IWordReplLine {
    s: string
    r: RegExp
}
async function start() {

    // 
    //let hosts = fw.getHosts();
    let hosts = [''];
    for (let host of hosts) {
        let idns = await nodeYesterday(host);
        if (!idns.length) continue;

        let wordRepl: IWordReplLine[] = [];
        let tree = await fw.asyncTreeSyncLoad(host);
        let ini = require(fw.pathType.app + 'app-site/ini/' + host);
        for (let idn in tree) {
            if (tree[idn].idp == ini.idnLabel) {
                if (/^[a-z]+$/i.test(tree[idn].path)) {
                    siteWords(tree[idn].path, wordRepl);
                }
                if (tree[idn].path.toLowerCase() != tree[idn].text.toLowerCase()) {
                    siteWords(tree[idn].text, wordRepl);
                }
            }
        }

        for (let word of fw.loadSyncJson(fw.pathType.file + host + '/json/keywords.json', <any>{}).extList || []){
            siteWords(word, wordRepl);
        }

        for (let socialKey of socialList){
            make_list(host, idns, cache_file.replace('FILEKEY', socialKey), require('./' + socialKey).data, wordRepl, tree);
        }
    }

    fw.Spawn.end();
}

function siteWords(wordGet: string, list: IWordReplLine[]) {
    //let flag = wordGet.indexOf('(') > -1;
    for (let word of wordGet.split('(')){
        if (/(новости)/i.test(word)) {
            word = 'новости';
        }
        let tmp = word.replace(/[^a-z0-9а-яё&]/gi, ' ').replace(/\s+/gi, ' ').trim().split(' ').map(function (t, i) {
            return i ? (t.slice(0, 1).toUpperCase() + t.slice(1)) : t;
        });
        let l = <IWordReplLine>{ s: '#' + tmp.join(''), r: new RegExp('(^|[^a-zа-яё0-9])' + tmp.join(' ') + '($|[^a-zа-яё0-9])', 'i') };
        //['#' + tmp.join(''), new RegExp('(^|[^a-zа-яё0-9])' + tmp.join(' ') + '($|[^a-zа-яё0-9])', 'i')];
        if (l.s.length < 16) {
            list.push(l);
        }
    }
}

async function nodeYesterday(host: string) {
    let d2 = new Date();
    d2.setHours(0);
    d2.setMinutes(0);
    d2.setSeconds(0);
    d2.setMilliseconds(0);
    let d1 = new Date(d2.getTime());
    d1.setDate(d1.getDate() - 1);
    //01.05.2015
    //d2.setDate(d2.getDate()-22);

    let out: number[] = [];
    let ini = <fw.IIni>require(fw.pathType.app + 'app-site/ini/' + host);

    let idpCond = { gt: 0, ne: 0 };
    if (ini.idnLabel > 0) idpCond.ne = ini.idnLabel;

    const db = new PostgreSQL(host);
    await db.connect('add::nodeYesterday');
    const select1 = await db.select({ idn: 0 }).fromTree().where({
        and: {
            dateAdd: { gt: fw.dateDBSet(d1), lt: fw.dateDBSet(d2) },
            idp: idpCond,
            flagFolder: false
        }
    }).order({ dateAdd: 1 }).exec();
    await db.end();

    for (let row of select1.rows) out.push(row.idn);

    return out;
}

function make_list(host: string, idns: number[], socialPath: string, fnAdd: any, wordRepl: IWordReplLine[], tree: fw.ITree) {
    let outFile = fw.loadSyncJson(socialPath, []);

    idns.forEach(function (idn) {
        //let addData = {};
        let node = fw.loadSyncNode(host, idn);

        let keywords: IWordReplLine[] = [];
        if (node && node.head.labels) {
            for (let idnWord of node.head.labels){
                siteWords(tree[idnWord].text, keywords);
            }
        }

        fnAdd(host, tree, wordRepl, keywords, node, outFile);

        let pos = outFile.length - 1;
        if (outFile.length && outFile[pos].content) {
            for (let kw of wordRepl){
                if (outFile[pos].content.search(kw.r) > -1) {
                    outFile[pos].content = outFile[pos].content.replace(kw.r, function (a0: string, a1: string, a2: string) {
                        return (a1.replace('#', '')) + kw.s + (a2.replace('®', ''));
                    });
                }
            }

            for (let kw of keywords.slice(0, 3)){
                if (outFile[pos].content.indexOf(kw.s) == -1) {
                    outFile[pos].content += ' ' + kw.s;
                }
            }
        }
    });

    fw.saveSyncJson(socialPath, outFile);
}


export function get(hostPath: string, data: any, fnCall?: (status: number, text: string) => void) {
    if (!fnCall && typeof (data) == 'function') {
        fnCall = data;
        data = void (0);
    }

    let urlData = urlParse(hostPath);
    if (urlData.query) {
        let tmp = querystring.parse(urlData.query.toString());
        if (!data) {
            data = {};
        }
        for (let key in tmp) {
            data[key] = tmp[key];
        }
    }

    let protocol = urlData.protocol || '';
    let url = protocol + '//' + urlData.host + urlData.pathname + (data ? querystring.stringify(data) : '');

    let getProtocol = http.get;
    if (protocol.slice(0, -1) == 'https') getProtocol = https.get;
    getProtocol(url, function (res) {
        let chunks: Buffer[] = [];
        //console.log('res.headers', res.headers);
        res.on('data', function (chunk: Buffer) {
            chunks.push(chunk);
        });
        res.on('end', function () {
            if (fnCall) fnCall(res.statusCode || 0, Buffer.concat(chunks).toString());
        });
        res.on('close', function () {
            fw.err(hostPath, 'connection close');
        });
    }).on('error', function (e: any) {
        fw.err(url, 'get error', e.message, e);
    });
}

export function post(hostPath: string, data: any, flagMedia: boolean, fnCall?: (status: number, text: string) => void) {
    // https://nodejs.org/api/http.html#http_http_request_options_callback
    // https://nodejs.org/api/http.html#http_http_get_options_callback

    let urlData = urlParse(hostPath);

    if (!fnCall && typeof (flagMedia) == 'function') {
        fnCall = <any>flagMedia;
        flagMedia = false;
    }

    let postData: string, type: string, len: number;
    if (flagMedia) {
        let mp = multipartData1(data);
        postData = <any>mp.body;
        type = mp.type;
        len = mp.len;
    }
    else {
        postData = querystring.stringify(data);
        type = 'application/x-www-form-urlencoded';
        len = postData.length;
    }

    let post_options = {
        host: urlData.host
        , path: urlData.path
        , method: 'POST'
        , headers: {
            'Content-Type': type
            , 'Content-Length': len
            , 'User-Agent': 'toy'
        }
    };


    let postProtocol = http.request
    if ((urlData.protocol || '').slice(0, -1) == 'https') {
        postProtocol = https.request;
    }

    let post_req = postProtocol(post_options, function (res) {
        //post_req.on('response', function(res){
        let chunks: Buffer[] = [];
        res.on('data', function (chunk: Buffer) {
            chunks.push(chunk);
        });
        res.on('end', function () {
            //console.log('res.headers', res.headers);
            if (fnCall) fnCall(res.statusCode || 0, Buffer.concat(chunks).toString());
        });
        res.on('close', function () {
            fw.err(hostPath, 'connection close');
        });
    });
    post_req.on('error', function (e: any) {
        fw.err((urlData.host || '') + urlData.path, 'post error', e.message, e);
    });

    if (Array.isArray(postData)) {
        fw.each(<any>postData,
            function (part: any, fnNext: any) {
                if (typeof (part) == 'string') {
                    post_req.write(part);
                    fnNext();
                }
                else {
                    part.on('end', function () {
                        fnNext();
                    });
                    part.pipe(post_req, { end: false });
                }
            },
            function () {
                post_req.end();
            }
        );
    }
    else {
        post_req.write(postData);
        post_req.end();
    }
    return function (fn: () => void) { fnCall = fn };
}


export function multipartData2(data: any) {
    let mime: IDict<string> = {
        gif: 'image/gif'
        , jpeg: 'image/jpeg'
        , jpg: 'image/jpeg'
        , png: 'image/png'
    };

    let endl = '\r\n';
    //let contentType = '';

    //stats: fs.Stats, 
    let name = '', filetype: string, ext: string;//, len = 0;

    let boundary = 'b' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    let toWrite: (string)[] = [];

    for (let k in data) {
        let value = data[k].toString();
        if (value.charAt(0) == '/') {
            if (fs.existsSync(value)) {
                name = value.replace(/\\/g, '/').replace(/.*\//, '');
                //stats = fs.statSync(value);
                //len += stats.size;

                ext = fw.getFileExt(value);
                filetype = mime[ext] ? mime[ext] : 'application/octet-stream';


                toWrite.push('--' + boundary);
                toWrite.push('Content-Disposition: form-data; name="' + k + '"; filename="' + name + '"');
                toWrite.push('Content-Type: ' + filetype);
                toWrite.push('Content-Transfer-Encoding: base64');
                toWrite.push('');
                toWrite.push(fs.readFileSync(value).toString('base64'));

            }
        }
        else {
            toWrite.push('--' + boundary);
            toWrite.push('Content-Disposition: form-data; name="' + k + '"');
            toWrite.push('Content-Type: text/plain');
            toWrite.push('');
            toWrite.push(value);
        }
    }
    toWrite.push('--' + boundary + '--');
    return { body: toWrite.join(endl), type: 'multipart/form-data; boundary=' + boundary };
}

export function multipartData1(data: any) {
    let mime: IDict<string> = {
        gif: 'image/gif'
        , jpeg: 'image/jpeg'
        , jpg: 'image/jpeg'
        , png: 'image/png'
    };

    let endl = '\r\n';
    //let contentType = '';

    let name = '', stats: fs.Stats, filetype: string, ext: string, len = 0;

    let boundary = 'b' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    let toWrite: (fs.ReadStream | string)[] = [];

    for (let k in data) {
        let value = data[k].toString();
        if (value.charAt(0) == '/') {
            if (fs.existsSync(value)) {
                name = value.replace(/\\/g, '/').replace(/.*\//, '');
                stats = fs.statSync(value);
                len += stats.size;

                ext = fw.getFileExt(value);
                filetype = mime[ext] ? mime[ext] : 'application/octet-stream';

                toWrite.push([
                    '--' + boundary
                    , 'Content-Disposition: form-data; name="' + k + '"; filename="' + name + '"'
                    , 'Content-Type: ' + filetype
                    , ''
                ].join(endl));
                toWrite.push(fs.createReadStream(value));
                toWrite.push(endl);
            }
        }
        else {
            toWrite.push([
                '--' + boundary
                , 'Content-Disposition: form-data; name="' + k + '"'
                , 'Content-Type: text/plain'
                , ''
                , value
                , ''
            ].join(endl));
        }
    }

    toWrite.push('--' + boundary + '--');

    toWrite.forEach(function (part) {
        if (typeof (part) == 'string') {
            len += (<string>part).length;
        }
    });
    //console.log('====',len);
    return { body: toWrite, len: len, type: 'multipart/form-data; boundary=' + boundary };
}
