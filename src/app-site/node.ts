
// portmaster www/npm
// npm install node-expat --python=python2.7

// https://www.npmjs.com/package/htmlparser2
// npm install htmlparser2


import * as fs from "fs";
//import * as url from "url";
//import * as crypto from "crypto";

// https://github.com/bestiejs/punycode.js
// npm install punycode --save
import * as punycode from "punycode";


import * as fw from "../fw";
import { HTMLDoc, Elem } from "../fw-dom";
import * as nodeSearch from "./search";
import * as css from "../pbl-css";
import * as nodeTree from "./node-tree";
import * as nodeFile from "./node-file";
import * as tracker from "./tracker";
import { setTimeout } from "timers";

let listUpdateMark: nodeFile.IFaceUpdateMark[] = [];

//  address
let tagLevel1 = 'p table hr ol ul h1 h2 h3 h4 h5 h6 blockquote'.split(' ');
let tagLevel2 = 'li tbody td th tr'.split(' ');
let tagLevel3 = 'a b br cite dfn em del i img ins q small strong sub sup u iframe'.split(' ');
let tagList = tagLevel1.concat(tagLevel2).concat(tagLevel3);

let reDgt = /^\d+$/;
interface IAttribs {
    [s: string]: {
        classList?: string[]
        classRe?: RegExp
        param?: string[]
    }
}
let attribs = <IAttribs>{
    p: { param: ['data-like'], classList: ['center', 'right', 'left', 'justify', 'notice', 'attention', 'page', 'shop', 'audio', 'like', 'command'] },
    img: { param: ['width', 'height', 'alt', 'src', 'data-type', 'data-param'], classRe: /^(imgl|imgr|svg\-.*)$/ },
    iframe: { param: ['src', 'height', 'width'] },
    a: { param: ['href', 'target'] },
    strong: { classList: ['notice', 'attention', 'simple'] },
    em: { classList: ['notice', 'attention', 'simple'] },
    blockquote: { classList: ['col3r', 'col3'] },
    td: { param: ['colspan', 'rowspan'] },
    th: { param: ['colspan', 'rowspan'] },
    table: { classList: ['center', 'center-col2', 'center-col3', 'center-col4', 'box', 'boxtop', 'small', 'simple'] },
    h1: { classList: ['center', 'right', 'left', 'justify'] },
    h2: { classList: ['center', 'right', 'left', 'justify'] },
    h3: { classList: ['center', 'right', 'left', 'justify'] },
    h4: { classList: ['center', 'right', 'left', 'justify'] },
    h5: { classList: ['center', 'right', 'left', 'justify'] },
    h6: { classList: ['center', 'right', 'left', 'justify'] }
};


let host: string, userID: number, userStatus: number;
//let flagUpdate = false;
let userEnabled: (idu: number) => boolean;

if (!module.parent)
    new fw.Spawn().data(process.stdin, async function (data) {
        host = data.host;
        userID = data.idu;
        userStatus = data.status;
        userEnabled = fw.userEnabled(userID, userStatus == 5);

        let route: string | undefined;
        let dd = data.data;
        if ('idn' in dd) {
            if (typeof (dd.idn) == 'number') {
                //if ('content' in dd || 'descr' in dd || 'title' in dd || 'keywords' in dd || 'text' in dd || 'path' in dd || 'attach' in dd) route = 'nodeUpdate';
                if ('flag' in dd) route = 'nodeHead';
                else if ('notice' in dd) route = 'nodeNotice';
                else route = 'nodeUpdate';
            }
            else if (dd.idn.toString().substr(0, 2) == '0-') route = 'nodeAdd';
        }
        else if (Array.isArray(dd)) {
            if (dd.length == 3) {
                if (typeof (dd[2]) == 'number') {
                    route = 'attachOrder';
                }
                else {
                    route = 'attachGroup';
                }
            }
            else if (dd.length == 2) {
                route = 'attachDel';
            }
        }
        //console.log(route, dd)
        switch (route) {
            case 'nodeUpdate':
                asyncNodeUpdate(dd);
                break;
            case 'nodeAdd':
                await asyncNodeAdd(dd);
                break;
            case 'nodeHead':
                await asyncNodeHead(dd);
                break;
            case 'nodeNotice':
                nodeNotice(dd);
                break;
            case 'attachOrder':
                attachOrder(dd);
                break;
            case 'attachGroup':
                attachGroup(dd);
                break;
            case 'attachDel':
                attachDel(dd);
                break;
            default:
                fw.err('node::route error', host, data);
                break;
        }

        finish();
    });

interface INodeUpd {
    idn: number
    attach: { [k: string]: fw.IAttach }
    title: string
    text: string
    path: string
    content: string
    descr: string
    keywords: string[]
    labels: number[]
}
async function asyncNodeUpdate(data: INodeUpd) {
    let node = getNode(data.idn);
    if (!node) return;
    let idn = data.idn;
    let tree = await fw.asyncTreeSyncLoad(host);
    let dbData = {} as IDBTree;

    let head = node.head;
    if ('title' in data && head.title != data.title) {
        //let reLang = /^lang=([a-zA-Z\-]+)/;
        //if (reLang.test(data.title)) {
        //	let m = data.title.match(reLang);
        //	node.head.lang = m[1];
        //	data.title = data.title.substr(m[0].length);
        //}
        head.title = data.title.trim();
    }
    if ('text' in data && head.link[0] != data.text) {
        data.text = data.text.trim();
        tree[idn].text = head.link[0] = fw.treeText(data.text);
        dbData.text = data.text;
    }
    if ('path' in data && head.link[1] != data.path) {
        fw.treePath(tree, idn, data.path);
        dbData.path = head.link[1] = tree[idn].path;
    }
    /*
	if ('path' in data && 'text' in data && (head.link[0] != data.text || head.link[1] != data.path)) {
		data.text = data.text.trim();
		data.path = data.path.trim();
		if (tree[idn].text != data.text) {
			tree[idn].text = data.text;
			flagTree = true;
		}
		if (tree[idn].path != data.path) {
		}
		head.link = [tree[idn].text, tree[idn].path];	
	}
    */
    if ('keywords' in data && Array.isArray(data.keywords)) {
        head.keywords = data.keywords;
    }
    if('labels' in data && Array.isArray(data.labels)){
        head.labels = data.labels;
    }

    let flagOpenLink = !!head.flagOpenLink || (userStatus == 5 && head.idu == userID);
    if ('descr' in data) {
        node.descr = testHtml(data.descr, tree, flagOpenLink);
    }

    if ('content' in data) {
        if (head.link[1].startsWith('@style') || head.link[1].startsWith('@template')) {
            node.content = data.content;
        }
        else {
            node.content = testHtml(data.content, tree, flagOpenLink);
        }
    }

    if ('attach' in data) {
        for (let keyStr of Object.keys(data.attach)) {
            let key = parseInt(keyStr, 10);
            let line = data.attach[key];
            let pos = fw.attachPos(node, key);
            if (pos > -1 && userEnabled(node.attach[pos].idu || 0)) {
                if (line.flagMark) {
                    //if (line.flagMark && !node.attach[pos].flagMark || line.flagMark == -1 && node.attach[pos].flagMark) {
                    if (line.flagMark && !node.attach[pos].flagMark || !line.flagMark && node.attach[pos].flagMark) {
                        let linePos = node.attach[pos];
                        if (linePos.w && linePos.h && linePos.src) {
                            listUpdateMark.push({ flag: line.flagMark||false, src: linePos.src, w: linePos.w, h: linePos.h });
                        }
                    }
                }
                for (let flag of ['flagNode', 'flagCatalog', 'flagComment', 'flagMark'] as ('flagNode'| 'flagCatalog'| 'flagComment'|'flagMark')[]) {
                    if (flag in line) {
                        if ((line[flag]as any)==1) {
                            node.attach[pos][flag] = true;
                        }
                        else {
                            delete (node.attach[pos][flag]);
                        }
                    }
                }
                if (line.content) {
                    node.attach[pos].content = testHtml(line.content, tree, flagOpenLink);
                }
                if ('quiz' in line) {
                    node.attach[pos].quiz = line.quiz;
                    if (!node.attach[pos].quiz) {
                        delete (node.attach[pos].quiz);
                    }
                }
                if ('price' in line) {
                    if (line.price) {
                        node.attach[pos].price = parseFloat(line.price + '');
                    }
                    else {
                        delete (node.attach[pos].price);
                    }
                }
                if ('like' in line) {
                    if (line.like) {
                        node.attach[pos].like = parseFloat(line.like + '');
                    }
                    else {
                        delete (node.attach[pos].like);
                    }
                }
            }
        }
    }

    setNode(node);

    if (userStatus == 5) {
        nodeSearch.dataSet(host, tree, node);
    }

    if (Object.keys(dbData).length) {
        await fw.asyncTreeSyncUpdate(host, idn, dbData);
        await fw.redisUrlUpdate(host, tree, idn);
    }

    if (listUpdateMark.length) {
        nodeFile.updateMark(host, listUpdateMark);
    }

    if (head.link[1].charAt(0) == '@') {
        if (head.link[1] == '@style') {
            let pathToCss = fw.pathType.file + host + '/css/';
            let cssText = css.make(node.content);
            fw.saveSync(pathToCss + 'style.css', cssText)
            cssUpdate(host, 'style', cssText);
        }
    }
    else {
        tracker.add(host, userStatus, <any>node.head);
        fw.cmdJava().site(host).idn(node.head.idn).exec('node');
        //await siteUpdate.asyncmMakePage(host, node.head.idn + '', true);
        //siteUpdate.asyncmMakePage(host, node.head.idn + '');
    }
}


interface IHeadData {
    idn: number
    flag: {
        block: boolean
        valid: boolean
    }
}
async function asyncNodeHead(data: IHeadData) {
    let node = getNode(data.idn);
    if (node) {
        let dbUpdate = {} as IDBTree;
        if (!!data.flag.block != !!node.head.flagBlock) {
            dbUpdate.flagBlock = !!data.flag.block;
            if (dbUpdate.flagBlock) {
                node.head.flagBlock = true;
            }
            else {
                delete (node.head.flagBlock);
            }
        }

        if (data.flag.valid && !node.head.flagValid) {

            let date = new Date().getTime();
            dbUpdate.flagValid = true;
            dbUpdate.dateAdd = fw.dateDBSet(date);

            node.head.flagValid = true;
            node.head.date[0] = fw.dateJSON(date);
            node.head.date[1] = fw.dateJSON(date);

            if (node.attach) {
                let quizCount = 0;
                for (const row of node.attach) {
                    if (row.quiz) quizCount++;
                }
                if (quizCount > 5) {
                    setTimeout(() => {
                        
                        fw.log('activity.genList');
                    }, 100);
                }
            }
        }

        if (Object.keys(dbUpdate).length) {
            await fw.asyncTreeSyncUpdate(host, node.head.idn, dbUpdate);
        }
        setNode(node);
    }
}
interface INoticeData {
    idn: number
    notice: {
        date?: string
        message?: string
        email?: string
    }
}
function nodeNotice(data: INoticeData) {
    let node = getNode(data.idn);
    if (node) {
        if (Object.keys(data.notice).length) {
            node.head.notice = data.notice;
        }
        else {
            if ('notice' in node.head) delete (node.head.notice);
        }
        setNode(node);
    }
}


interface INodeAdd {
    idn: string
    userID: number
    idp: number
}
async function asyncNodeAdd(data: INodeAdd) {
    if (!userStatus) return;
    let tree = await fw.asyncTreeSyncLoad(host);
    data.userID = userID;
    data.idp = parseInt(data.idn.substr(2), 10);
    let nodeHead = await nodeTree.asyncAddto(data, host, tree);
    tracker.add(host, userStatus, <any>nodeHead);
    finish('ok-' + nodeHead.idn + fw.getNodePath(tree, nodeHead.idn, 'node-1::'+host));
}


function attachGroup(data: any) {
    // [idn, idf, tuneGroupIdf]

    let node = getNode(data[0]);
    if (node) {
        let flagUp = false;
        for (let i = 0, im = node.attach.length; i < im; i++) {
            if (data[1] == node.attach[i].idf) {
                if (data[2].length) {
                    node.attach[i].group = data[2];
                }
                else {
                    if (node.attach[i].group) {
                        delete (node.attach[i].group);
                    }
                }
                flagUp = true;
                break;
            }
        }
        if (flagUp) setNode(node);
    }
}

function attachOrder(data: any) {
    let node = getNode(data[0]);
    if (node) {
        let line: fw.IAttach | undefined;
        for (let i = 0, im = node.attach.length; i < im; i++) {
            if (data[1] == node.attach[i].idf) {
                line = node.attach.splice(i, 1)[0];
                break;
            }
        }
        if (line) {
            if (data[2] == -1) {
                node.attach.push(line);
            }
            else {
                for (let i = 0, im = node.attach.length; i < im; i++) {
                    if (data[2] == node.attach[i].idf) {
                        node.attach.splice(i, 0, line);
                        break;
                    }
                }
            }
            setNode(node);
        }
    }
}

export function attachDel(data: number[], nodeSet?: fw.INode, hostSet?: string) {
    let node: fw.INode;
    if (hostSet) host = hostSet;
    node = (nodeSet || getNode(data[0])) as fw.INode;
    if (node) {
        let line: fw.IAttach | undefined, flag = false;
        for (let i = 0, im = node.attach.length; i < im; i++) {
            if (data[1] == node.attach[i].idf) {
                tracker.del(host, data[0], data[1]);
                line = node.attach.splice(i, 1)[0];
                flag = true;
                break;
            }
        }
        // удалить файлы
        if (line && line.src) {
            let delList: string[] = [];
            if (line.w && line.h) {
                delList = fw.imageCacheList(host, line.src).concat([{ path: fw.imageSource(host, line.src), size: 0 }]).map(line =>line.path );
            }
            else {
                delList = [fw.imageCacheList(host, line.src).slice(-1)[0].path, fw.imageSource(host, line.src)];
            }
            
            for(const path of delList) {
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path);
                }
            }
        }
        if (flag) setNode(node);
    }
}

// =========

function getNode(idn: number) {
    let node = fw.loadSyncNode(host, idn);
    return node && userEnabled(node.head.idu) && node || void (0);
}
function setNode(node: fw.INode) {
    node.head.date[1] = fw.dateJSON();
    fw.saveSyncNode(host, node);
}


function finish(text?: string) {
    // 'ok' + (flag.update ? 'up' : '')
    !text && (text = 'ok')
    fw.Spawn.msg(text);
    fw.Spawn.end();
}

function testHtml(text: string, tree: fw.ITree, flagOpenLink: boolean) {

    //console.log(text);
    let doc = new HTMLDoc(text);

    //console.log(doc.html());

    let reDgtPre = /^\/\d+$/;
    let reHostStart = /^([a-z0-9\-]+\.[a-z0-9\-\.]+)(\/.*)$/;

    let reOpenLink = /\/\/([^\/]+)(\/.*)?/;

    let tagFn: { [s: string]: any } = {
        a: function (elem: Elem) {
            let pos: number, pos2: number;
            let href = elem.get('href');
            if (href) {
                let hrefOrig = href;
                if (href.search(reDgtPre) > -1) {
                    href = href.substr(1);
                    elem.set('href', href);
                }
                else {
                    if (href.substr(0, 6) == '/goto/' && href.substr(6, host.length) == host && href.indexOf('/js/game/') == -1) {
                        // чтобы исправить далее на idn
                        href = 'http://' + href.substr(6);
                    }
                }

                //console.log(href, flagOpenLink, href.substr(0,2)=='//');
                if (href.search(reDgt) > -1 || href.substr(0, 6) == '/goto/' || (flagOpenLink && href.substr(0, 2) == '//')) {
                    if (href.search(reDgt) > -1) {
                        if (!tree[href]) {
                            elemDrop(elem);
                            fw.err('a drop 1', href, host, elem.toHtml());
                        }
                    }
                    else {
                        if (href.substr(0, 2) == '//') {
                            let openHref = href.match(reOpenLink);
                            if (openHref && openHref[1].indexOf('%') > -1) {
                                openHref[1] = punycode.toASCII(decodeURI(openHref[1]));
                                href = '//' + openHref[1] + (openHref[2] || '/');
                                elem.set('href', href);
                                //flagUpdate = true;
                            }
                        }
                    }
                }
                else {
                    let urlHost: string | undefined, pathname = '/';
                    pos = href.indexOf('//');
                    let flagSec = false;
                    if (pos == -1) {
                        if (href.search(reHostStart) > -1) {
                            let m = href.match(reHostStart);
                            if (m) {
                                urlHost = m[1];
                                pathname = m[2];
                            }
                        }
                        else {
                            urlHost = host;
                            pathname = (href.charAt(0) == '/' ? '' : '/') + href;
                        }
                    }
                    else {
                        flagSec = href.substr(0, pos).toLowerCase() == 'https:';
                        pos2 = href.substr(pos + 2).indexOf('/');
                        if (pos2 > -1) {
                            urlHost = href.substr(pos + 2, pos2);
                            pathname = href.substr(pos + pos2 + 2);
                        }
                        else {
                            urlHost = href.substr(pos + 2);
                        }
                    }

                    href = '';
                    if (urlHost && pathname) {
                        if (host == urlHost) {
                            let idn = fw.getNodeID(host, pathname);
                            if (idn) {
                                href = idn + '';
                            }
                            else {
                                href = '';
                            }
                        }
                        else {
                            if (urlHost.indexOf('%') > -1) {
                                urlHost = punycode.toASCII(decodeURI(urlHost));
                            }
                            href = '/goto/' + (flagSec ? 's/' : '') + urlHost + pathname;
                        }
                    }

                    if (href) {
                        if (hrefOrig != href) {
                            elem.set('href', href);
                            //flagUpdate = true;
                        }
                    }
                    else {
                        elemDrop(elem);
                        fw.err('a drop 2', href, host, elem.toHtml());
                    }
                }
            }
            else {
                elemDrop(elem);
            }
        },
        img: function (elem: Elem) {
            //let attrSrc = elem.attr('src'), src = attrSrc && attrSrc.value() || '';
            let src = elem.get('src') || '', srcOrig = src;
            let pos = src.indexOf('file/');
            if (pos > -1 && src) {
                if (!pos) src = '/' + src;
                if (src.substr(0, 6) == '/file/') {
                    pos = src.indexOf('?');
                    if (pos > -1) {
                        src = src.substr(0, pos);
                    }
                    if (srcOrig != src) {
                        elem.set('src', src);
                        //flagUpdate = true;
                    }
                }
                else {
                    elemRemove(elem);
                }
            }
            else {
                elemRemove(elem);
            }
        },
        iframe: function (elem: Elem) {
            let src = elem.get('src') || '';
            let pos = src.indexOf('youtube.com');
            if (pos > -1 && src) {
                elem.set('src', '/goto/www.' + src.substr(pos))
            }
            else {
                elemRemove(elem);
            }
        }
    };

    let tagRemove = ['style', 'script'];

    function elemRemove(elem: Elem) {
        //flagUpdate = true;
        elem.remove();
    }
    function elemDrop(elem: Elem) {
        //flagUpdate = true;
        elem.drop();
    }

    function iter(elMain: Elem) {
        for (let elem of fw.slice(elMain.childNodes())) {
            if (elem.isElem()) {
                let tag = elem.getName();
                if (tagList.indexOf(tag) > -1) {
                    if (tag in attribs) {
                        let attrData = attribs[tag];
                        let attrs = elem.el.attrs;
                        if (attrs && attrs.length) {
                            let i = attrs.length;
                            while (i--) {
                                let flagRemove = false;
                                let attr = attrs[i];
                                let name = attr.name;
                                if (name == 'class') {
                                    let test: ((nameClass: string) => boolean) | undefined;
                                    if (attrData.classList)
                                        test = (nameClass: string) => attrData.classList ? attrData.classList.indexOf(nameClass) > -1 : false;
                                    else if (attrData.classRe) {
                                        test = (nameClass: string) => attrData.classRe ? attrData.classRe.test(nameClass) : false
                                    }
                                    if (test) {
                                        let value = attr.value;
                                        value = value.split(' ').filter(test).join(' ');
                                        if (value) attr.value = value;
                                        else flagRemove = true;
                                    }
                                    else flagRemove = true;
                                }
                                else if (!attrData.param || attrData.param.indexOf(name) == -1) flagRemove = true;
                                if (flagRemove) {
                                    attrs.splice(i, 1);
                                }
                            }
                        }
                    }
                    else {
                        elem.removeAttrs()
                    }

                    iter(elem);

                    if (tagFn[tag]) {
                        tagFn[tag](elem);
                    }
                }
                else {
                    if (tagRemove.indexOf(tag) == -1) {
                        iter(elem);
                        elemDrop(elem);
                    }
                    else {
                        elemRemove(elem);
                    }
                }
            }
            else {
                if (!elem.isText()) {
                    elemRemove(elem);
                }
            }
        }
    }

    iter(doc.body());

    let html = fw.textClean(doc.htmlBody());
    html = html.replace(/[a-z]{3,}\:\/\//gi, '');

    return html;
}

function cssUpdate(host: string, key: string, data: string) {
    if (key.indexOf('.') > -1) key = key.substr(0, key.indexOf('.'));
    let cssDir = fw.pathType.file + host + '/css/';
    for (let fileName of fs.readdirSync(cssDir)) {
        let text = fw.loadSync(cssDir + fileName);
        if (text) {
            let keyLine = '/* ' + key + ' */';
            let pos1 = text.indexOf(keyLine);
            if (pos1 > -1) {
                let textNew = text.substr(0, pos1 + keyLine.length + 1) + data;
                let pos2 = text.indexOf('/* ', pos1 + 2);
                if (pos2 > -1) {
                    textNew = textNew + text.substr(pos2 - 1);
                }
                fw.saveSync(cssDir + fileName, textNew);
            }
        }
    }
}

