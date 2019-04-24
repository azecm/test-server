import * as fs from "fs";
import * as fw from "../fw";
import * as tracker from "./tracker";
import { HTMLDoc } from "../fw-dom";

const __quality = 80;

const reIsImg = /\.(jpeg|jpg|png)$/i;
const reIsSvgImg = /\.(svg)$/i;
const reIsOther = /\.(svg|mp3|mp4|webm|js)$/i;

const __reIP = /^194\.16\./; // 194.16.194.160
const __disabledIDns = [9094];

class NodeFile {
    param = {} as {
        host: string;
        boundry: string;
        pathKey: string;
        user: {
            status: number;
            id: number;
            browser: string;
            ip: string;
            enabled: (idu: number) => boolean;
        }
        ini: fw.IIni;
    }
    flag = {
        anonym: false,
        isSvg: false
    }
    state = {} as {
        tmpPath: string
    }
    data!: IDataParse;
    node!: fw.INode;
    dataAdd: IDataAdd[] = [];
    constructor(data: INodeFile) {
        this.param.host = data.host;
        this.param.boundry = data.boundry;
        this.param.pathKey = data.key;
        this.param.ini = require('./ini/' + data.host);

        this.param.user = {
            id: data.idu,
            ip: data.ip,
            status: data.status,
            browser: data.browser,
            enabled: fw.userEnabled(data.idu, data.status == 5)
        };
    }
    async asyncRoute() {

        const pathTmpData = fw.pathType.temp + this.param.pathKey + '.tmp';
        const dataText = fs.readFileSync(pathTmpData, 'binary');
        fs.unlinkSync(pathTmpData);
        try {
            this.data = fw.multipartParser(dataText, this.param.boundry);
        }
        catch (e) {
            fw.err('ОШИБКА MultipartParser ' + e);
        }
        if (this.data) {


            const { data } = this;
            if (data.idn) data.idn = ~~data.idn;
            if (data.idf) data.idf = ~~data.idf;
            if (data.last) data.last = ~~data.last;

            if (data.files && data.idn) await asyncFileAdd(this);
            else if (data.idn && data.idf && (data.update || data.rotate)) {
                if (data.update) fileUpdate(this);
                else fileRotate(this);
            }

            else if (data.comment !== void (0) && data.last !== void (0) && data.path) await asyncFileComment(this);
            else fw.err('node-file::route error', this.param.host);
        }
    }
}

// =========================

async function asyncFileComment(nodeFile: NodeFile) {
    const { data } = nodeFile;
    const { host, user } = nodeFile.param;

    let dataOut: any[] = [];


    //let dataNode: fw.INode | undefined;

    const tree = await fw.asyncTreeSyncLoad(host);

    const idn = data.idn = fw.getNodeID(host, data.path) as number;

    if (idn === null || __disabledIDns.indexOf(idn) > -1 || __reIP.test(user.ip)) {
        fw.log('++', 'idn:', idn, 'ip:', user.ip, 'browser:', user.browser);
        saveDataout(nodeFile, { ok: true });
        return;
    }

    data.comment = data.comment.trim()
    if (data.comment.length > 2) {
        data.comment = textNormal(host, data.comment);
    }
    else {
        data.comment = '';
    }


    if (idn && tree[idn].idp && !tree[idn].first) {
        if (data.files) {
            if (reIsImg.test(data.files[0].name)) {
                nodeFile.state.tmpPath = fw.pathType.temp + nodeFile.param.pathKey + '-0.tmp';
                fs.writeFileSync(nodeFile.state.tmpPath, data.files[0].content, { encoding: 'binary', mode: 0o644 });
                commentAdd(nodeFile, dataOut);
            }
            else if (reIsSvgImg.test(data.files[0].name) && data.files[0].type == 'image/svg+xml') {
                nodeFile.flag.isSvg = true;
                commentAdd(nodeFile, dataOut);
            }
        }
        else {
            commentAdd(nodeFile, dataOut);
        }
    }

    if (nodeFile.node) {
        let flagOut = data.last ? false : true;
        let lastIdf = 0;
        dataOut.push(0);
        for (let line of nodeFile.node.attach) {
            if (line.flagComment) {
                lastIdf = line.idf
                if (flagOut) dataOut.push(line);
            }
            if (!flagOut && line.idf == data.last) flagOut = true;
        }
        dataOut[0] = lastIdf;
    }
    if (!dataOut.length) {
        dataOut.push('-');
    }
    let userDict = <{ [s: string]: IUser }>{};
    for (const line of dataOut) {
        if (typeof (line) == 'object') {
            if (line.idu) {
                if (!userDict[line.idu]) {
                    userDict[line.idu] = fw.loadSyncUser(host, line.idu);
                }
                if (line.content) {
                    line.content = testLocalLink(host, line.content);
                }

                line.name = userDict[line.idu].name;
                delete (line.idu);
            }
        }
    }

    saveDataout(nodeFile, dataOut);

}

function commentAdd(nodeFile: NodeFile, dataOut: any[]) {

    const { tmpPath } = nodeFile.state;
    const { user, host } = nodeFile.param;
    const { data } = nodeFile;

    if (nodeFile.param.user.id) {
        if (nodeFile.data.comment || tmpPath || nodeFile.flag.isSvg) {
            if (tmpPath) {
                workImage(nodeFile, user.id);
            }
            else if (nodeFile.flag.isSvg) {
                workSVG(nodeFile, data.files[0].content);
            }
            userAdd(nodeFile);
        }
        else {
            nodeFile.node = fw.loadSyncNode(host, data.idn) as fw.INode;
        }
    }
    else {
        if (nodeFile.data.comment || tmpPath || nodeFile.flag.isSvg) {
            if (tmpPath) {
                nodeFile.flag.anonym = true;
                workImage(nodeFile, -1);
            }
            else if (nodeFile.flag.isSvg) {
                nodeFile.flag.anonym = true;
                workSVG(nodeFile, data.files[0].content);
            }
            anonymAdd(nodeFile, dataOut);
        }
    }
}

function anonymAdd(nodeFile: NodeFile, dataOut: any[]) {
    const { user, host } = nodeFile.param;
    const { data, dataAdd } = nodeFile;

    dataOut.push(data.last);
    let name = textNormal(host, data.name || '', true);
    if (name.length < 4) {
        name = '';
    }
    // anonymous
    let line = { idn: data.idn, content: data.comment, name: name, key: data.key, ip: user.ip, browser: user.browser, flagAnonym: true, date: fw.dateJSON(), idf: 0, idu: 0 } as fw.IDataAnonym;
    let out: ICommentOut = { date: fw.dateJSON(), content: testLocalLink(host, data.comment), name: 'Гость' + (name ? ' (' + name + ')' : ''), anonym: 1 }
    if (dataAdd.length) {
        out.src = line.src = dataAdd[0].key;
        out.w = line.w = dataAdd[0].width;
        out.h = line.h = dataAdd[0].height;
        if (dataAdd[0].mark) line.flagMark = true;
        else delete (line.flagMark);
    }
    dataOut.push(out);
    tracker.add(host, 0, line);
}

function userAdd(nodeFile: NodeFile) {
    const { user, host } = nodeFile.param;
    const { dataAdd } = nodeFile;
    const { idn, comment } = nodeFile.data;

    nodeFile.node = fw.loadSyncNode(host, idn, true) as fw.INode;

    let idf = attachID(nodeFile.node) + 1;
    let line = attachLine(idf, user.id);
    line.content = comment;
    line.flagComment = true;
    if (dataAdd.length) {
        line.src = dataAdd[0].key;
        line.w = dataAdd[0].width;
        line.h = dataAdd[0].height;
        if (dataAdd[0].mark) line.flagMark = true;
        else delete (line.flagMark);
    }
    nodeFile.node.attach.push(line);
    fw.saveSyncNode(host, nodeFile.node);
    tracker.add(host, user.status, line as fw.IDataAnonym, { idn: idn, add: 1 });
}

function textNormal(host: string, text: string, flagInline?: boolean) {
    //text = text.replace(/<[^>\n]+>/gi, '').trim();
    text = fw.textClean(text, flagInline ? 0 : 1);
    const text2: string[] = [];
    //let i: number, im = textList.length, line: string;
    //for (let i = 0; i < im; i++) {
    for (let line of text.split('\n')) {
        line = line.trim();
        if (!line) continue;
        line = line.replace(/\s+/gi, ' ');
        if (!flagInline) {

            line = line.replace(/(?:https?\:)?(?:\/\/)?([a-z0-9\-\.]+\.[a-z]{2,})(\/[a-z0-9_%&=\?\/\.\-]*)/gi, (_:string,arg1:string,arg2:string) => {

                let pos = arg2.indexOf('?');
                if (pos == -1) pos = arg2.indexOf('#');

                let href = '/goto/' + arg1 + arg2;
                if (host.endsWith(arg1)) {
                    const idn = fw.getNodeID(host, arg2);
                    if (idn) href = idn + '';
                }
                return '<a href="' + href + '">' + arg1 + (pos == -1 ? arg2 : arg2.substr(0, pos)) + '</a> ';
            });
        }

        // &#9786; &#x263a;
        // http://www.charbase.com/block/miscellaneous-symbols
        // Unicode Category: Miscellaneous Symbols
        // Unicode Range: 2600–26FF
        line = line.replace(/\:\-*\)+/g, '\u263a').replace(/\){3,}/g, '\u263a');
        line = line.replace(/\:\-*\(+/g, '\u2639').replace(/\({3,}/g, '\u2639');
        // for(i=0;i<256;i++){a='26'+('0'+i.toString(16)).slice(-2);console.log(a+': '+String.fromCharCode(parseInt(a,16)));}


        line = line.replace(/([A-ZА-ЯЁ])([A-ZА-ЯЁ\s]{5,})/g, (_:string, a:string, b:string) =>  (a||'') + (b||'').toLowerCase() );
        line = line.replace(/(.)\1{5,}/g, '$1');
        line = line.replace(/([a-zа-яё0-9])([,;:!\)\}\]])([a-zа-яё0-9])/gi, '$1$2 $3');
        line = line.replace(/([\.\?\)\]\}])([а-яё])/gi, '$1 $2');
        line = line.replace(/([а-яё])([\(\[\{])/gi, '$1 $2');
        //line=line.replace(/(\S)?(\"[а-яёa-z\s]+\")/gi, '$1 $2');
        line = line.replace(/([a-zа-яё0-9])([\(\{\[])([a-zа-яё0-9])/gi, '$1 $2$3');
        line = line.replace(/([a-zа-яё])([\.!\?])\s+([a-zа-яё])/g, (_, b:string, c:string, d:string) =>  (b||'') + (c||'') + ' ' + (d||'').toUpperCase() );

        text2.push(line);
    }

    text = '';
    if (text2.length) {
        if (flagInline) {
            text = text2[0];
        }
        else {
            text = '<p>' + text2.join('<br>') + '</p>';
        }
    }
    return text;
}

function testLocalLink(host: string, text: string) {
    return text.replace(/href="(\d+)"/g, function () {
        return 'href="' + fw.getNodePath(fw.mem(host, 'tree'), arguments[1], 'node-file::' + host) + '"';
    });
}

// =========================

async function asyncFileAdd(nodeFile: NodeFile) {
    const { host, pathKey, user } = nodeFile.param;
    const { data } = nodeFile;
    let tree = await fw.asyncTreeSyncLoad(host);
    let idu = tree[data.idn].idu;
    if (!nodeFile.param.user.enabled(idu)) return;

    for (let i = 0; i < data.files.length; i++) {
        const l = data.files[i];
        if (reIsImg.test(l.name) || reIsOther.test(l.name)) {
            nodeFile.state.tmpPath = fw.pathType.temp + pathKey + '-' + i + '.tmp';
            fs.writeFileSync(nodeFile.state.tmpPath, l.content, { encoding: 'binary', mode: 0o644 });
            if (reIsImg.test(l.name)) {
                workImage(nodeFile, idu);
            }
            else if (reIsOther.test(l.name)) workBinary(nodeFile, l.name);

        }
    }

    let idn = ~~data.idn;
    let flagNode = 'node' in data;
    let dataOut: fw.IDataAnonym[] = [];
    let dataFile = fw.loadSyncNode(host, idn, true);
    if (!dataFile) return;
    let idf = attachID(dataFile);

    for (let line of nodeFile.dataAdd) {
        idf++;
        let attachData = attachLine(idf, user.id);
        if (line.width && line.height) {
            attachData.src = line.key;
            attachData.w = line.width;
            attachData.h = line.height;
            if (flagNode) {
                attachData.flagNode = true;
            }
            else {
                attachData.flagCatalog = true;
            }
            if (line.mark) {
                attachData.flagMark = true;
            }
        }
        else {
            attachData.src = line.key;
            if (line.key.slice(-4) == '.svg') {
                if (flagNode) {
                    attachData.flagNode = true;
                }
                else {
                    attachData.flagCatalog = true;
                }
            }
        }
        dataFile.attach.push(attachData);
        dataOut.push(attachData as fw.IDataAnonym);
        if (dataFile.head.flagValid) {
            tracker.add(host, user.status, attachData as fw.IDataAnonym, { idn: idn, add: 1 })
        }
    }
    fw.saveSyncNode(host, dataFile);
    saveDataout(nodeFile, dataOut);
}


function fileUpdate(nodeFile: NodeFile) {
    const dataNode = fw.loadSyncNode(nodeFile.param.host, nodeFile.data.idn);
    if (dataNode && nodeFile.param.user.enabled(dataNode.head.idu)) {
        nodeFile.node = dataNode;
        updateFile(nodeFile, { update: nodeFile.data.update });
    }
}

function fileRotate(nodeFile: NodeFile) {
    let dataNode = fw.loadSyncNode(nodeFile.param.host, nodeFile.data.idn);
    if (dataNode && nodeFile.param.user.enabled(dataNode.head.idu)) {
        updateFile(nodeFile, { rotate: nodeFile.data.rotate });
    }
}

function updateFile(nodeFile: NodeFile, data: { update?: any, rotate?: string }) {
    let lineTest: fw.IAttach | undefined;
    //let idnDoc = nodeFile.node.head.idn;
    for (let i = 0, im = nodeFile.node.attach.length; i < im; i++) {
        if (nodeFile.node.attach[i].idf == nodeFile.data.idf && !!nodeFile.node.attach[i].w) {
            lineTest = nodeFile.node.attach[i];
            break;
        }
    }
    //let tmpPath: string;
    if (lineTest) {
        nodeFile.state.tmpPath = fw.pathType.temp + nodeFile.param.pathKey + '-0.tmp';
        if (data.update) {
            fs.writeFileSync(nodeFile.state.tmpPath, data.update[0].content, { encoding: 'binary', mode: 0o644 });
            updateFileMake(nodeFile, lineTest);
        }
        else {
            let path = fw.imageSource(nodeFile.param.host, lineTest.src);
            let cmd = 'convert ' + path + ' -rotate ' + (data.rotate == 'left' ? '-' : '') + '90 ' + path;

            if (fw.execSync(cmd) !== null) {
                fs.renameSync(path, nodeFile.state.tmpPath);
                updateFileMake(nodeFile, lineTest);
            }
        }
    }
}

function updateFileMake(nodeFile: NodeFile, line: fw.IAttach) {
    let dataOut: any[] = [];
    workImage(nodeFile, 1, line.src);
    line.w = nodeFile.dataAdd[0].width;
    line.h = nodeFile.dataAdd[0].height;

    if (nodeFile.dataAdd[0].mark) {
        line.flagMark = true;
    }
    else {
        delete (line.flagMark);
    }

    const dataNode = fw.loadSyncNode(nodeFile.param.host, nodeFile.node.head.idn, true);
    if (dataNode) {
        dataNode.attach[fw.attachPos(dataNode, nodeFile.data.idf)] = line;
        dataOut.push(line);
        if (dataNode.head.flagValid) {
            tracker.add(nodeFile.param.host, nodeFile.param.user.status, line as fw.IDataAnonym, { idn: dataNode.head.idn, update: 1 })
        }
        fw.saveSyncNode(nodeFile.param.host, dataNode);
        saveDataout(nodeFile, dataOut);
    }
}

function saveDataout(nodeFile: NodeFile, dataOut: any) {
    fw.saveSyncJson(fw.pathType.file + nodeFile.param.host + '/file/wait/' + nodeFile.param.pathKey + fw.extJson, dataOut);
}

// =========================

function workImage(nodeFile: NodeFile, idu = -1, srcKey = '') {
    const { tmpPath } = nodeFile.state;
    let identifyData = fw.execSync('identify ' + tmpPath);
    if (!identifyData) return;
    let imgData = identifyData.split(' ');
    let ext = (imgData[1] == 'JPEG' && 'jpg') || (imgData[1] == 'PNG' && 'png') || null;
    if (ext) {
        let size = imgData[2].split('x');
        let width = parseInt(size[0], 10);
        let height = parseInt(size[1], 10);
        let flagMark = idu > 0 && idu < 10 && width + height > 1500 && width > 700;
        let sizeList = fw.slice(fw.imageCacheSize);
        let k = sizeList[sizeList.length - 1] / Math.max(width, height);
        k = k > 1 ? 1 : k;
        width = Math.round(width * k);
        height = Math.round(height * k);

        if (nodeFile.flag.anonym) {
            cachedAnonym(nodeFile, ext, width, height);
        }
        else {
            if (srcKey) {
                srcKey = srcKey.split('.')[0] + '.' + ext;

                fs.renameSync(tmpPath, fw.imageSource(nodeFile.param.host, srcKey));
            }
            else {
                srcKey = souceFile(nodeFile.param.host, tmpPath, ext);
            }
            cachedImage(nodeFile.param.host, srcKey, width, height);
            nodeFile.dataAdd.push({ key: srcKey, mark: flagMark, width: width, height: height });
        }
    }
}

function workBinary(nodeFile: NodeFile, name: string) {
    const { tmpPath } = nodeFile.state;
    const { host } = nodeFile.param;

    let ext = fw.getFileExt(name);
    let srcKey = souceFile(host, tmpPath, ext);
    let cacheList = fw.imageCacheList(host, srcKey);
    fw.fileCopySync(fw.imageSource(host, srcKey), cacheList.slice(-1)[0].path);
    nodeFile.dataAdd.push({ key: srcKey });

    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
}

function workSVG(nodeFile: NodeFile, content: string) {
    const { host, pathKey } = nodeFile.param;

    const xml = new HTMLDoc(content);
    const svg = xml.firstByTag('svg');
    const ext = 'svg';

    if (svg) {
        const width = parseInt(svg.get('width') || '0', 10);
        const height = parseInt(svg.get('height') || '0', 10);
        if (isFinite(width) && isFinite(height)) {

            if (nodeFile.flag.anonym) {

                const path = fw.pathType.file + host + '/file/anonym/';
                const name = nodeFile.param.pathKey + '.' + ext;

                fs.writeFileSync(path + name, content, { encoding: 'binary', mode: 0o644 });

                nodeFile.dataAdd.push({ key: name, mark: false, width: width, height: height });

            }
            else {

                const tmpPath = fw.pathType.temp + pathKey + '-0.tmp';
                fs.writeFileSync(tmpPath, content, { encoding: 'binary', mode: 0o644 });
                const srcKey = souceFile(host, tmpPath, ext);

                const cacheList = fw.imageCacheList(host, srcKey);
                fw.fileCopySync(fw.imageSource(host, srcKey), cacheList.slice(-1)[0].path);

                nodeFile.dataAdd.push({ key: srcKey, mark: false, width: width, height: height });
            }
        }
    }
}

function souceFile(host: string, tmpPath: string, ext: string) {
    let pathDir = fw.imageSource(host);
    let lastDir = fs.readdirSync(pathDir).pop();
    if (!lastDir) {
        lastDir = '0001';
        // parseInt('755',8)
        fs.mkdirSync(pathDir + lastDir, 0o755);
    }
    let lastFile = fs.readdirSync(pathDir + lastDir).pop();
    let lastFileKey = lastFile ? parseInt(lastFile, 10) + 1 : 1;
    lastFileKey = isNaN(lastFileKey) ? 1 : lastFileKey;
    if (lastFileKey == 10000) {
        lastFileKey = 1;
        lastDir = ('0000' + (parseInt(lastDir, 10) + 1)).substr(-4);
    }
    lastFile = ('0000' + lastFileKey).substr(-4) + '.' + ext;
    let fullPath = pathDir + lastDir + '/' + lastFile;

    fw.testDirSync(fullPath);
    fs.renameSync(tmpPath, fullPath);

    //return {path: fullPath, key: lastDir+'/'+lastFile};
    return lastDir + '/' + lastFile;
}

function cachedAnonym(nodeFile: NodeFile, ext: string, width: number, height: number) {
    const { tmpPath } = nodeFile.state;
    let path = fw.pathType.file + nodeFile.param.host + '/file/anonym/';
    let name = tmpPath.substr(tmpPath.lastIndexOf('/') + 1);
    name = name.slice(0, -3) + ext;

    let cmd = 'convert ' + tmpPath + ' -resize 150x150\\> -quality ' + __quality + ' -unsharp 1.5x1+0.7+0.02 ' + path + '150/' + name;
    if (fw.execSync(cmd) !== null) {
        fs.renameSync(tmpPath, path + name);
        nodeFile.dataAdd.push({ key: name, mark: false, width: width, height: height });
    }
}

function cachedImage(host: string, srcKey: string, width: number, height: number) {
    /*
    let pointsize: number | undefined;
    
	if (flagMark) {
		if (width * 0.6 > height) {
			pointsize = Math.ceil((width + height) / 2);
		}
		else {
			pointsize = width;
		}
		pointsize = ~~(pointsize / watermark.k);
    }
    */

    let srcPath = fw.imageSource(host, srcKey);
    let cacheList = fw.imageCacheList(host, srcKey);

    for (const line of cacheList) {
        fw.testDirSync(line.path);

        // http://www.imagemagick.org/Usage/filter/
        // http://www.imagemagick.org/Usage/resize/
        // http://www.imagemagick.org/Usage/distorts/
        // http://www.imagemagick.org/Usage/filter/#aliasing

        // избыточная выборка сглаживания (англ. Super Sampling anti-aliasing, SSAA)
        // и множественная выборка сглаживания (англ. Multisample anti-aliasing, MSAA)
        // -strip -resize 600x600 -quality 100 new.jpg
        // -define filter:blur=$blur -filter Spline
        // -define filter:blur=0.75 -filter Gaussian

        if (line.size > width && line.size > height) {
            if (fs.existsSync(line.path)) fs.unlinkSync(line.path);
            fw.fileCopySync(srcPath, line.path);
        }
        else {
            let filter = ' ';
            switch (line.size) {
                case 150:
                case 250:
                    filter = ' -unsharp 1.5x1+0.7+0.02 ';
                    break;
                case 600:
                    filter = ' -define filter:blur=0.5 -filter Spline ';
                    break;
                default:
                    filter = ' -filter Spline ';
                    break;
            }
            let cmd = 'convert ' + srcPath + ' -resize ' + line.size + 'x' + line.size + '\\> -quality ' + __quality + filter + line.path;
            fw.execSync(cmd);
        }
    }

    //if (pointsize) {
    //	let path = cacheList[cacheList.length - 1].path;
    //	let cmd = 'convert ' + path + ' -font /usr/local/www/data/font/' + watermark.font + ' -pointsize ' + pointsize + ' -draw "' + watermark.cmd + '" -quality ' + watermark.quality + ' ' + path;
    //	fw.execSync(cmd);
    //}
}

function attachID(dataFile: fw.INode) {
    return !dataFile.attach.length ? 0 : Math.max.apply(null, dataFile.attach.map(function (line) {
        return line.idf
    }));
}

function attachLine(idf: number, userID: number): fw.IAttach {
    // flag 1-node  2-catalog 3-comment 4-marked
    // attachData.src = [key,width,height]
    // attachData.group = [idf1,idf2,...]
    // attachData.price = number
    return { idf: idf, idu: userID, date: fw.dateJSON(), content: '' };
}

// =========================

export interface IFaceUpdateMark {
    flag: boolean
    src: string
    w: number
    h: number
}
export let updateMark = function (getHost: string, getList: IFaceUpdateMark[]) {
    //host = getHost;
    //setIni();
    //getList.forEach(function (line) {
    //	cachedImage(line.src, line.flag, line.w, line.h);
    //});
    for (const line of getList) {
        cachedImage(getHost, line.src, line.w, line.h);
    }
}

export function confirmAnonym(getHost: string, dataAnonym: fw.IDataAnonym, flagCatalog = false) {
    let srcKey: string | undefined, ext: string;

    //host = getHost;

    if (dataAnonym.src) {
        //if (!watermark) {
        //	setIni();
        //}
        ext = fw.getFileExt(dataAnonym.src);
        srcKey = souceFile(getHost, fw.pathType.file + getHost + '/file/anonym/' + dataAnonym.src, ext);
    }

    let line: fw.IAttach | undefined;
    let dataNode = fw.loadSyncNode(getHost, dataAnonym.idn, true);
    if (dataNode) {
        let idf = attachID(dataNode) + 1;
        line = attachLine(idf, 0);
        line.content = dataAnonym.content;

        if (dataAnonym.gameResult) {
            line.gameResult = dataAnonym.gameResult;
        }

        if (dataAnonym.like) {
            line.like = dataAnonym.like;
        }

        if (dataAnonym.idu) {
            line.idu = dataAnonym.idu;
        }
        else if (dataAnonym.name) {
            line.anonym = dataAnonym.name;
        }
        if (srcKey) {
            line.src = srcKey;
            if (dataAnonym.w && dataAnonym.h) {
                line.w = dataAnonym.w;
                line.h = dataAnonym.h;
            }
            if (dataAnonym.flagMark) {
                line.flagMark = true;
            }
        }
        if (flagCatalog) line.flagCatalog = true;
        line.flagComment = true;
        dataNode.attach.push(line);
        fw.saveSyncNode(getHost, dataNode);
    }
    return line;
}

// =========================


if (!module.parent) {
    new fw.Spawn().data(process.stdin, async function (data: INodeFile) {
        await new NodeFile(data).asyncRoute();
        process.exit(0);
    });
}

export interface INodeFile {
    host: string
    boundry: string
    key: string
    idu: number
    status: number
    browser: string
    ip: string
}

interface IDataParse {
    files: { name: string, type: string, content: string }[]
    idn: number
    idf: number
    update: number
    rotate: string
    path: string
    last: number
    comment: string
    name: string
    node: string
    key: string
}

interface IDataAdd {
    key: string
    width?: number
    height?: number
    mark?: boolean
}

interface ICommentOut {
    date: string
    content: string
    name: string
    anonym: number
    src?: string
    w?: number
    h?: number
}