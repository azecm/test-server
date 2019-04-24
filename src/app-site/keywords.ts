
//import * as fs from "fs";
import * as fw from "../fw";
import * as nTree from "./node-tree";

if (!module.parent)
    new fw.Spawn().data(process.stdin, async function (data) {
        if (data.find) {
            find(data)
        }
        else {
            await asyncStart(data);
        }
    });

interface IDataFind {
    find: string
    host: string
}
function find(dataPost: IDataFind) {
    let host = dataPost.host;
    let flagOnly = true;
    if (dataPost.find.charAt(0) == '~') {
        flagOnly = false;
        dataPost.find = dataPost.find.substr(1);
    }
    //fw.log('keywords-find', dataPost.find, flagOnly, host);

    let outList: number[] = [];
    for (let data of fw.loadDirNodeGen(host)) {
        let flagFind = false, kw = data.head.keywords.concat(data.head.labels.map(a=>a.toString()));
        if (kw) {
            let keywords = [] as string[];
            for (let word of kw) if (word) keywords.push(word.toString());
            if (flagOnly) {
                if (keywords.indexOf(dataPost.find) > -1) {
                    flagFind = true;
                }
            }
            else {
                for (let word of keywords) {
                    if (word) {
                        if (word.toString().indexOf(dataPost.find) > -1) {
                            flagFind = true;
                        }
                    }
                }
            }
        }
        if (flagFind) {
            outList.push(data.head.idn);
        }

    }
    fw.Spawn.msg(outList);
}

interface IDataStart {
    data: string[]
    host: string
    idu: number
}
async function asyncStart(dataPost: IDataStart) {
    let host = dataPost.host;
    let srcStr = dataPost.data[0];
    let dstStr = dataPost.data[1];
    let src = srcStr, dst: number|undefined;

    //if (/^\d+$/.test(srcStr)) {
    //    src = parseInt(srcStr, 10);
    //}
    if (/^\d+$/.test(dstStr)) {
        dst = parseInt(dstStr, 10);
    }
    let flagDel = dstStr == '-';
    let flagAdd = dstStr == '+';
    if (flagAdd) {
        let ini = require('./ini/' + host);
        let tree = await fw.asyncTreeSyncLoad(host);
        let data = { userID: dataPost.idu, idp: ini.idnLabel, text: srcStr };
        let nodeHead = await nTree.asyncAddto(data, host, tree);
        if (nodeHead) dst = nodeHead.idn;
    }

    let counter = 0;
    for (let data of fw.loadDirNodeGen(host)) {
        let flagUp=false;
        let head = data.head, kwOrig = head.keywords, lbOrig = head.labels;
        if (kwOrig && lbOrig) {
            //let kwStr = [] as string[];
            //for (let word of kwOrig) kwStr.push(word.toString());

            let pos = kwOrig.indexOf(src);
            if (pos > -1) {
                counter++;
                flagUp = true;
                if (flagDel) {
                    console.log('del kw', head.idn, src);
                    kwOrig.splice(pos, 1);
                }
                else {
                    if(flagAdd){
                        if(dst && typeof(dst)=="number"){
                            console.log('add label', head.idn, src, '>', dst);
                            kwOrig.splice(pos, 1);
                            lbOrig.push(dst);
                        }
                        else{
                            console.log('ERROR on add label', head.idn, src, '>', dst);
                            console.log('keywords::asyncStart не доделаны labels');
                        }
                    }
                }
            }
            else {
                //pos = lbOrig.indexOf(src);

            }
        }
        if (flagUp) {
            //console.log('keywords::asyncStart не доделаны labels');
            fw.saveSyncNode(host, data);
        }
    }

    let out = 'html:надено статей: ' + counter;
    if (flagAdd && dst) {
        out += ', <a href="/operation/edit#' + dst + '" target="_blank">' + dst + '</a>';
    }
    fw.Spawn.msg(out);
}


