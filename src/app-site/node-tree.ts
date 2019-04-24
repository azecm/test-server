import * as fs from "fs";
import * as fw from "../fw";

import { PostgreSQL } from "../promise/postgre";
import * as tracker from "./tracker";


let host: string, tree = {} as fw.ITree;



if (!module.parent)
    //if(process.argv.length)
    if (process.argv.length > 2 && process.argv[2]=="del") {

        (async function(){
            host = process.argv[3];
            tree = await fw.asyncTreeSyncLoad(host);
            let idn = process.argv[4];
            if(tree[idn]){
                let data = {idn: idn} as IDataGet;
                await asyncNodeRemove(data);
            }
            //console.log(process.argv.length, process.argv);
        })();

        
        //if (process.argv.length, process.argv)
            
    }
    else {

        new fw.Spawn().data(process.stdin, async function (data: IDataGet) {

            host = data.host;
            tree = await fw.asyncTreeSyncLoad(host);
            if (typeof (data.idn) == 'string') {
                await asyncAddto(<any>data);
            }
            else {
                if (data.del) await asyncNodeRemove(data)
                else await asyncNodeUpdate(data);
            }
            await asyncRedisUpdateStart();
        });
    }


let redisUpdateList = [] as { idn: number, data: any }[];

interface IAddTo {
    userID: number
    idp: number
    text?: string
    path?: string
}

async function asyncRedisUpdateStart() {
    if (redisUpdateList.length) {
        await fw.redisConnect();
        for (let line of redisUpdateList) {
            await fw.redisTreeUpdate(host, line.idn, line.data);
        }
        await fw.redisQuit();
        redisUpdateList = [];
    }
}

export async function asyncAddto(data: IAddTo, a2?: string, a3?: fw.ITree) {
    let flagFinish = true;
    if (a2 && a3) {
        host = a2;
        tree = a3;
        flagFinish = false;
    }

    let date = fw.dateJSON();
    if (!data.text) data.text = 'новая статья';
    if (!data.path) data.path = new Date().toISOString().substr(0, 19).replace(/[^\d]/g, '-');

    let idu = data.userID, idp = parseInt(data.idp + '', 10), prev = tree[idp].last || 0, next = 0;
    let idnDoc = <number>(!Object.keys(tree).length ? 1 : (Math.max.apply(null, fw.slice(Object.keys(tree))) + 1));
    tree[idnDoc] = {
        idp: idp,
        idu: idu,
        text: data.text,
        path: data.path,
        prev: prev,
        next: next
    } as fw.ITreeLine;
    fw.treePath(tree, idnDoc);

    let dataFile = <fw.INode>{
        head: {
            idn: idnDoc
            , idu: idu
            , idp: idp
            , title: 'новая статья'
            , keywords: []
            , labels: []
            , link: [tree[idnDoc].text, tree[idnDoc].path]
            , date: [date, date]
        }
        , order: {
            prev: prev
            , next: next
        }
        , descr: ''
        , content: ''
        , attach: []
    };

    fw.saveSyncNode(host, dataFile);

    let dbLine = {
        idn: idnDoc,
        idp: idp,
        idu: idu,
        text: tree[idnDoc].text,
        path: tree[idnDoc].path,
        prev: prev,
        next: next,
        dateAdd: fw.dateDBSet()
    } as IDBTree


    const db = new PostgreSQL(host);
    await db.connect('node-tree::asyncAddto');
    await db.begin();
    await db.insert('tree', dbLine);
    redisUpdateList.push({ idn: idnDoc, data: dbLine });
    await asyncOrderOnInsert(db, idnDoc, idp, prev, next);
    await db.commit();
    await db.end();

    await asyncRedisUpdateStart();
    await fw.redisUrlUpdate(host, tree, idnDoc);

    if (flagFinish) finish({ ok: 1, idn: idnDoc });
    return dataFile.head;
}


async function asyncDataUpdate(db: PostgreSQL, idn: number, data: any) {
    await db.update('tree').set(data).where({ idn: idn }).exec();
    redisUpdateList.push({ idn: idn, data: data });
    let node = fw.loadSyncNode(host, idn, true);
    if (node) {
        for (let key in data) {
            (node.order as any)[key] = data[key];
        }
        fw.saveSyncNode(host, node);
    }
}
async function asyncOrderOnRemove(db: PostgreSQL, idn: number) {
    let next = tree[idn].next || 0, prev = tree[idn].prev || 0, idp = tree[idn].idp;
    if (prev) await asyncDataUpdate(db, prev, { next: next });
    if (next) await asyncDataUpdate(db, next, { prev: prev });
    if (!prev) await asyncDataUpdate(db, idp, { first: next });
    if (!next) await asyncDataUpdate(db, idp, { last: prev });
}
async function asyncOrderOnInsert(db: PostgreSQL, idn: number, idp: number, prev: number, next: number) {
    if (prev) await asyncDataUpdate(db, prev, { next: idn });
    if (next) await asyncDataUpdate(db, next, { prev: idn });
    if (!prev) await asyncDataUpdate(db, idp, { first: idn });
    if (!next) await asyncDataUpdate(db, idp, { last: idn });

    let data = { idp: idp, prev: prev, next: next };
    await db.update('tree').set(data).where({ idn: idn }).exec();
    redisUpdateList.push({ idn: idn, data: data });
}


async function asyncNodeUpdate(dataGet: IDataGet) {
    let idnDoc = parseInt(dataGet.idn, 10);
    let dataFile = fw.loadSyncNode(host, idnDoc), dataDB = {} as IDBTree;
    let out = '';
    if (dataFile) {
        let updateUrl = false;
        let idp: number, childList: number[], posOld: number, posNew: number;

        if (dataGet.flagFolder) {
            if (dataGet.flagFolder > 0) {
                if (!dataFile.head.flagFolder) {
                    dataFile.head.flagFolder = true;
                    dataFile.order.first = 0;
                    dataFile.order.last = 0;
                    dataDB.first = dataDB.last = 0;
                    dataDB.flagFolder = true;
                }
            }
            else {
                if (dataFile.head.flagFolder) {
                    delete (dataFile.head.flagFolder);
                    delete (dataFile.order.first);
                    delete (dataFile.order.last);
                    dataDB.first = dataDB.last = 0;
                    dataDB.flagFolder = false;
                }
            }
        }
        if (dataGet.flagBlock) {
            if (dataGet.flagBlock) {
                dataFile.head.flagBlock = true;
                dataDB.flagBlock = true;
            }
            else {
                delete (dataFile.head.flagBlock);
                dataDB.flagBlock = false;
            }
        }
        if (dataGet.flagValid) {
            if (dataGet.flagValid) {
                dataFile.head.flagValid = true;
                dataDB.flagValid = true;
            }
            else {
                delete (dataFile.head.flagValid);
                dataDB.flagValid = false;
            }
        }

        if (dataGet.date != void (0)) {
            dataFile.head.date[0] = dataGet.date;
            dataDB.dateAdd = fw.dateDBSet(dataGet.date);
        }
        if (dataGet.idu != void (0)) {
            tree[idnDoc].idu = dataDB.idu = dataGet.idu;
        }

        if (dataGet.text != void (0)) {
            dataFile.head.link[0] = dataDB.text = fw.treeText(dataGet.text);
        }
        if (dataGet.path != void (0)) {
            fw.treePath(tree, idnDoc, dataGet.path);
            dataFile.head.link[1] = dataDB.path = tree[idnDoc].path;
            updateUrl = true;
        }

        if (dataGet.order != void (0)) {
            dataGet.order = parseInt(dataGet.order, 10);
            if (!isNaN(dataGet.order) && dataGet.order > -1) {
                idp = tree[idnDoc].idp;
                childList = fw.treeChild(tree, idp);
                posOld = childList.indexOf(idnDoc);
                if (posOld > -1) {

                    childList.splice(posOld, 1);
                    childList.splice(dataGet.order, 0, idnDoc);
                    posNew = childList.indexOf(idnDoc);

                    let prevNew = childList[posNew - 1] || 0;
                    let nextNew = childList[posNew + 1] || 0;

                    dataFile.order.prev = prevNew;
                    dataFile.order.next = nextNew;

                    let db = new PostgreSQL(host);
                    await db.connect('node-tree::asyncNodeUpdate-1');
                    await db.begin();
                    await asyncOrderOnRemove(db, idnDoc);
                    await asyncOrderOnInsert(db, idnDoc, dataFile.head.idp, prevNew, nextNew);
                    await db.commit();
                    await db.end();
                }
            }
        }
        if (dataGet.tree != void (0)) {
            dataGet.tree = parseInt(dataGet.tree, 10);
            if (!isNaN(dataGet.tree) && dataGet.tree > -1) {
                let idpOld = dataFile.head.idp;
                childList = fw.treeChild(tree, idpOld);
                posOld = childList.indexOf(idnDoc);
                if (posOld > -1) {

                    // добавляем в конец списка
                    let idpNew = dataGet.tree;
                    let prevNew = tree[idpNew].last || 0;
                    let nextNew = 0;

                    dataFile.head.idp = idpNew;
                    dataFile.order.prev = prevNew;
                    dataFile.order.next = nextNew;

                    let db = new PostgreSQL(host);
                    await db.connect('node-tree::asyncNodeUpdate-2');
                    await db.begin();
                    // используются данные из tree[idnDoc]
                    await asyncOrderOnRemove(db, idnDoc);
                    await asyncOrderOnInsert(db, idnDoc, idpNew, prevNew, nextNew);
                    await db.commit();
                    await db.end();

                    // проверяем уникальность пути в новой папке
                    tree[idnDoc].idp = idpNew;
                    tree[idnDoc].prev = prevNew;
                    tree[idnDoc].next = nextNew;
                    let pathCur = tree[idnDoc].path;
                    fw.treePath(tree, idnDoc);
                    if (pathCur != tree[idnDoc].path) {
                        dataFile.head.link[1] = dataDB.path = tree[idnDoc].path;
                    }

                    updateUrl = true;

                }
            }
        }
        fw.saveSyncNode(host, dataFile);

        // сначала обновляем текущий элемент в базах
        if (Object.keys(dataDB).length) {
            await fw.asyncTreeSyncUpdate(host, idnDoc, dataDB);
        }

        // потом обновляем путь
        if (updateUrl) {
            await fw.redisUrlUpdate(host, tree, idnDoc);
        }

        out = 'ok';
    }
    finish(out);
}

async function asyncNodeRemove(dataGet: IDataGet) {
    let idnDoc = parseInt(dataGet.idn, 10);
    if (tree[idnDoc].first) {
        finish('hasElements');
        return;
    }

    let out = '';
    let node = fw.loadSyncNode(host, idnDoc);
    if (node) {
        out = 'ok';
        for (let line of node.attach) {
            if (line.src) {
                let srcKey = line.src;

                for (const line of fw.imageCacheList(host, srcKey).concat([{ path: fw.imageSource(host, srcKey), size: 0 }])) {
                    if (fs.existsSync(line.path)) {
                        fs.unlinkSync(line.path);
                    }
                    else {
                        console.error('node-tree.js delete attach: not', line.path);
                    }
                }
            }
        }

        tracker.delIdn(host, idnDoc);
        fs.unlinkSync(fw.nodePathFull(host, idnDoc));

        const db = new PostgreSQL(host);
        await db.connect('node-tree::asyncNodeRemove');
        await db.begin();
        await db.delete('tree', { idn: idnDoc });
        await asyncOrderOnRemove(db, idnDoc);
        await db.commit();
        await db.end();

        await fw.redisTreeRemove(host, idnDoc);
        await fw.redisUrlRemove(host, tree, idnDoc);

    }
    finish(out);
}

function finish(text: any) {
    fw.Spawn.msg(text);
    //process.exit(0);
}

interface IDataGet {
    host: string
    idn: string
    text: string
    path: string
    userID: number
    idp: string
    idu: number
    del: any
    date: string
    flagFolder: number
    flagBlock: number
    flagValid: number
    order: any
    tree: any
}
