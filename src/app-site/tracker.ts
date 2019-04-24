
import * as fs from "fs";
import * as fw from "../fw";
import * as mNode from "./node";
import * as mNodeFile from "./node-file";

const
    extJson = fw.extJson,
    folderUpdate = 'update/',
    folderAnonym = 'anonym/',
    folderTracker = '/tracker/'
    ;


function getPath(host: string) {
    return fw.pathType.memory + host + folderTracker;
}

export function delIdn(host: string, idn: number) {
    let path = getPath(host);
    let fileName = idn + extJson;
    if (fs.existsSync(path + fileName)) {
        fs.unlinkSync(path + fileName);
    }
    if (fs.existsSync(path + folderUpdate + fileName)) {
        fs.unlinkSync(path + folderUpdate + fileName);
    }
}
/*
export interface IAddData extends fw.IAttach {
    idn?: number
    flagAnonym?: number
    add?: string
    //name?: string
    //ip?: string
    //flagComment?: boolean
    //flagMark?: number
    //content?: string
    //date?: string
    //src?: string
    ///w?: number
    ///height?: number
}
*/
export function addPath(host: string, name = new Date().getTime().toString()) {
    return fw.pathType.memory + host + folderTracker + folderAnonym + name + extJson;
}
export function add(host: string, userStatus: number, data: fw.IDataAnonym, dataExt?: any) {
    let name: string;
    let path = fw.pathType.memory + host + folderTracker;
    if (typeof (dataExt) == 'object') {
        data = Object.assign({}, data, dataExt);
    }
    if (data.flagAnonym) {
        fw.saveSyncJson(addPath(host), data);
    }
    else {
        if (data.idn) {
            addMark(host, data.idn);
            name = data.idn + (data.idf ? '-' + data.idf : '') + extJson;

            if (data.idf) {
                if (data.flagComment && data.add) {
                    fw.saveSyncJson(path + name, data);
                }
            }

            if (userStatus == 5) {
                if (fs.existsSync(path + folderUpdate + name)) {
                    fs.unlinkSync(path + folderUpdate + name);
                }
            }
            else {
                if (fs.existsSync(path + name)) {
                    fs.unlinkSync(path + name);
                }
                fw.saveSyncJson(path + folderUpdate + name, data);
            }
        }
    }
}

export function del(host: string, idn: number, idf?: number) {
    let path = getPath(host);
    let fileName: string, flagAnonym = false;
    if (idf) {
        fileName = idn + '-' + idf + extJson;
    }
    else {
        fileName = idn + extJson;
        if (idn.toString().length == 13) {
            flagAnonym = true;
            if (fs.existsSync(path + folderAnonym + fileName)) {
                fs.unlinkSync(path + folderAnonym + fileName);
            }
        }
    }
    if (!flagAnonym) {
        addMark(host, idn);
        if (fs.existsSync(path + fileName)) {
            fs.unlinkSync(path + fileName);
        }
        if (fs.existsSync(path + folderUpdate + fileName)) {
            fs.unlinkSync(path + folderUpdate + fileName);
        }
    }
}

export function addMark(host: string, idn: number | string) {
    let path = fw.pathType.memory + host + folderTracker + 'mark/' + idn + '.txt';
    if (!fs.existsSync(path)) fw.saveSync(path, '');
}

export function addMarkAsync(host: string, idn: number | string) {
    const path = fw.pathType.memory + host + folderTracker + 'mark/' + idn + '.txt';
    const fnSave = () => {
        fw.save(path, '');
    };
    fs.exists(path, fnSave);
}

function addMarkObj(host: string, idnDict: { [s: string]: number }) {
    for (let idn in idnDict) addMark(host, idn);
}



if (!module.parent) {
    new fw.Spawn().data(process.stdin, function (data) {
        if(data.host){
            fw.asyncTreeSyncLoad(data.host).then((tree)=>{
                switch (data.route) {
                    case 'verify':
                        verify(data.host, tree);
                        break;
                    case 'rotate':
                        rotate(data);
                        break;
                    case 'confirm':
                        confirm(data, tree);
                        break;
                    case 'delete':
                        verifyRemove(data);
                        break;
                }
            }).catch((e)=>{
                console.error('tracker::treeload', e);
            });
        }
        else{
            fw.err('tracker data:', data);
        }
    });
}

interface IDataVerify {
    host: string
    list: string[]
}
function verifyRemove(data: IDataVerify) {
    let host = data.host;

    //console.log('verifyRemove', data);

    // [ "1426321687963", "11754-39" ]
    for(const line of data.list){
        //console.log('verifyRemove', line);
        if (line.indexOf('-') == -1) {
            
            let pathToJS = addPath(host, line);
            if (fs.existsSync(pathToJS)) {
                delAnonymFiles(host, <any>fw.loadSyncJson(pathToJS), pathToJS);
            }
        }
        else {
            let data = line.split('-');
            let idn = parseInt(data[0], 10);
            let idf = parseInt(data[1], 10);
            let dataFile = fw.loadSyncNode(host, idn, true);
            if (dataFile) {
                mNode.attachDel([idn, idf], dataFile, host);
                fw.saveSyncNode(host, dataFile);
            }
        }
    }
    fw.Spawn.msg('ok');
}


function delAnonymFiles(host: string, dataFile: { src?: string }, pathToJS: string) {
    if (dataFile.src) {
        let path = fw.pathType.file + host + '/file/anonym/';
        if (fs.existsSync(path + dataFile.src)) {
            fs.unlinkSync(path + dataFile.src);
        }
        if (fs.existsSync(path + '150/' + dataFile.src)) {
            fs.unlinkSync(path + '150/' + dataFile.src);
        }
    }
    fs.unlinkSync(pathToJS);
}


interface IDataConfirm {
    host: string
    route: string
    data: {
        [s: string]: {
            content: string
            catalog: boolean
            like: number
        }
    }
}
function confirm(dataGet: IDataConfirm, tree: fw.ITree) {
    let host = dataGet.host;
    let data = dataGet.data;

    // data = {"1516904098915":{"content":""},"1516904369040":{"content":"","like":3}}

    let listUpdateMark: mNodeFile.IFaceUpdateMark[] = [];
    let pathTracker = fw.pathType.memory + host + folderTracker;
    let markDict: { [s: string]: number } = {};

    for (let key of Object.keys(data)) {
        let pathToJS: string, pathToNew: string, line: fw.IAttach | null | undefined, dataFile: fw.IDataAnonym, dataNode: fw.INode | undefined;
        if (key.indexOf('-') == -1) {
            // анонимные
            pathToJS = pathTracker + folderAnonym + key + extJson;
            if (fs.existsSync(pathToJS)) {
                dataFile = <fw.IDataAnonym>fw.loadSyncJson(pathToJS);

                if (data[key]) {
                    const { content, like } = data[key];
                    if (content) dataFile.content = content;
                    if (like) dataFile.like = like;
                }

                //console.log('===========');
                //console.log(host);
                //console.log(dataFile);
                //console.log(data[key]);

                line = mNodeFile.confirmAnonym(host, dataFile, data[key] && data[key].catalog);

                if (line) {

                    delAnonymFiles(host, dataFile, pathToJS);

                    if (line.src && line.w && line.h) {
                        listUpdateMark.push({ flag: line.flagMark||false, src: line.src, w: line.w, h: line.h });
                    }

                    pathToNew = pathTracker + dataFile.idn + '-' + line.idf + extJson;
                    fw.saveSyncJson(pathToNew, line);

                    markDict[dataFile.idn] = 1;
                }
            }
        }
        else {
            // от авторизованных
            pathToJS = pathTracker + folderUpdate + key + extJson;
            if (fs.existsSync(pathToJS)) {
                dataFile = <fw.IDataAnonym>fw.loadSyncJson(pathToJS);
                if (data[key]) {
                    let { content, like } = data[key];
                    if (content || like) {
                        if (content) {
                            dataFile.content = content;
                            fw.saveSyncJson(pathToJS, dataFile);
                        }

                        dataNode = fw.loadSyncNode(host, dataFile.idn, true);
                        if (dataNode && dataFile.idf) {
                            line = fw.attachLine(dataNode, dataFile.idf);
                        }
                        if (dataNode && line) {
                            if (content) {
                                line.content = data[key].content;
                                if (data[key].catalog) line.flagCatalog = true;
                            }
                            if (like) {
                                line.like = like;
                            }
                            fw.saveSyncNode(host, dataNode);
                        }
                        else {
                            fw.unlockNode(host, dataFile.idn);
                        }
                        markDict[dataFile.idn] = 1;
                    }
                }
                pathToNew = pathTracker + key + extJson;
                fs.renameSync(pathToJS, pathToNew);
                if (dataFile.date)
                    fs.utimes(pathToNew, new Date(dataFile.date), new Date(dataFile.date), () => { });
            }
        }
    }

    addMarkObj(host, markDict);
    if (listUpdateMark.length) {
        mNodeFile.updateMark(host, listUpdateMark);
        verify(host, tree);
    }
    else {
        verify(host, tree);
    }
    fw.cmdJava().site(host).update().exec('tracker');
    //fw.spawnSync('node', [fw.pathType.appSite + 'site.js', host, 'miniup']);
}


interface IDataRotate {
    host: string
    side: string
    anonym: number
    idn: number
    idf: number
}
function rotate(data: IDataRotate) {
    let host = data.host;
    let pathList: string[] | undefined;
    if (data.anonym) {
        let pathToJS = addPath(host, data.anonym.toString());
        if (fs.existsSync(pathToJS)) {
            let dataFile = <any>fw.loadSyncJson(pathToJS);
            let tmp1 = dataFile.w;
            dataFile.w = dataFile.h;
            dataFile.h = tmp1;
            fw.saveSyncJson(pathToJS, dataFile);
            let path = fw.pathType.file + host + '/file/anonym/';
            pathList = [path + dataFile.src, path + '150/' + dataFile.src];
        }
    }
    else {
        let dataNode = fw.loadSyncNode(host, data.idn, true);
        let line: fw.IAttach | null | undefined;
        if (dataNode) {
            line = fw.attachLine(dataNode, data.idf);
        }
        if (dataNode && line) {
            let tmp1 = line.w;
            line.w = line.h;
            line.h = tmp1;
            fw.saveSyncNode(host, dataNode);
            if (line.src) {
                pathList = fw.imageCacheList(host, line.src).map(i => i.path );
                pathList.push(fw.imageSource(host, line.src));
            }
        }
        else {
            fw.unlockNode(host, data.idn);
        }
    }

    let out = 'error';
    if (pathList) {
        for(const path of pathList){
            if (fs.existsSync(path)) {
                let cmd = 'convert ' + path + ' -rotate ' + (data.side == 'left' ? '-' : '') + '90 ' + path;
                fw.execSync(cmd);
            }
        }
        out = 'ok';
    }
    fw.Spawn.msg(out);
}

function verify(host: string, tree: fw.ITree) {

    let path = fw.pathType.memory + host + folderTracker;
    //let tree = fw.treeSyncLoad(host);
    let listNode: string[] = [];
    let listAttach: string[] = [];
    let listAnonym: string[] = [];
    let userDict: IDict<string> = {};
    let data = fw.getDirlistOrdTime(path + folderUpdate);
    let i = data.length;
    while (i--) {
        if (data[i].endsWith(extJson)) {
            if (data[i].indexOf('-') == -1) {
                listNode.push(data[i]);
            }
            else {
                listAttach.push(data[i]);
            }
        }
    }
    data = fw.getDirlistOrdTime(path + folderAnonym);
    i = data.length;
    while (i--) {
        if (data[i].endsWith(extJson)) {
            listAnonym.push(data[i]);
        }
    }
    let out = { node: <any[]>[], attach: <any[]>[], anonym: <any[]>[] };
    for (let fileName of listNode) {
        let data = <any>fw.loadSyncJson(path + folderUpdate + fileName);
        out.node.push({
            idn: data.idn,
            user: userName(data.idu),
            folder: tree[data.idp].text,
            text: tree[data.idn].text,
            date: data.date[1]
        });
    }
    for (let fileName of listAttach) {
        let data = <any>fw.loadSyncJson(path + folderUpdate + fileName);
        out.attach.push({
            idn: data.idn,
            idf: data.idf,
            user: userName(data.idu),
            folder: tree[tree[data.idn].idp].text,
            text: tree[data.idn].text,
            path: fw.getNodePath(tree, data.idn, 'tracker-1::'+host),
            flagComment: data.flagComment ? true : false,
            flagCatalog: data.flagCatalog ? true : false,
            flagNode: data.flagNode ? true : false,
            date: data.date,
            content: data.content,
            src: data.src && (typeof (data.src) == 'string' ? data.src : data.src[0]) || ''
        } as fw.IAttach);
    }
    
    for (let fileName of listAnonym) {
        let data = fw.loadSyncJson(path + folderAnonym + fileName) as fw.IDataAnonym;
        out.anonym.push({
            idn: data.idn,
            anonym: fileName.substr(0, 13),
            folder: tree[tree[data.idn].idp].text,
            text: tree[data.idn].text,
            path: fw.getNodePath(tree, data.idn, 'tracker-2::'+host),
            date: data.date,
            ip: data.ip,
            browser: data.browser||'',
            content: data.content,
            user: data.name,
            src: data.src || '',
            key: data.key || ''
        });
    }

    fw.Spawn.msg(out);

    function userName(idu: number) {
        if (!userDict[idu]) {
            if (idu) {
                let data = fw.loadSyncUser(host, idu);
                userDict[idu] = data ? data.name : '---';
            }
            else {
                userDict[idu] = 'Гость';
            }
        }
        return userDict[idu];
    }
}
