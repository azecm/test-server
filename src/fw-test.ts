import * as fso from "fs";
import * as fw from "./fw";

// node /usr/local/www/app.back/fw-test.js

//1486304013603
//1400000000000
//console.log(Math.ceil(Math.random() * 9))
let t = (new Date().getTime() - 1480000000000) + Math.ceil(Math.random() * 90) * 100000000000;
console.log(t, fw.codeAlpha(t));


/*

userKey

idu
idn
time
data
progress

verify("---(++++)----") -> 1
verify("") -> 1
verify("before ( middle []) after ") -> 1
verify(") (") -> 0
verify("} {") -> 1 //no, this is not a mistake.
verify("<(   >)") -> 0
verify("(  [  <>  ()  ]  <>  )") -> 1
verify("   (      [)") -> 0


function verify(text: string) {
    let list = [/\([^\(\[\]<>]*\)/g, /\[[^\[\(\)<>]*\]/g, /<[^<\[\]\(\)]*>/g];
    let reTest = /[\(\)\[\]<>]/;
    let res = text === "" ? 1 : 0;
    if (typeof (text) == "string") {
        res = reTest.test(text) ? 0 : 1;
        if (!res) {
            let isTest = true;
            while (isTest) {
                isTest = false;
                for (let re of list) {
                    while (re.test(text)) {
                        isTest = true;
                        text = text.replace(re, "");
                    }
                }
            }
            res = reTest.test(text) ? 0 : 1;
        }
    }
    return res;
}


function func2(s: string, a: string, b: string) {
    return s && (a || b) ? Math.max(a ? s.lastIndexOf(a) : -1, b ? s.lastIndexOf(b) : -1) : -1;
}

function func(s: string, a: string, b: string) {
    var match_empty = /^$/;
    if (s.match(match_empty)) {
        return -1;
    }
    else {
        var i = s.length - 1;
        var aIndex = -1;
        var bIndex = -1;

        while ((aIndex == -1) && (bIndex == -1) && (i >= 0)) {
            if (s.substring(i, i + 1) == a)
                aIndex = i;
            if (s.substring(i, i + 1) == b)
                bIndex = i;
            i--;
        }

        if (aIndex != -1) {
            if (bIndex == -1)
                return aIndex;
            else
                return Math.max(aIndex, bIndex);
        }
        else {
            if (bIndex != -1)
                return bIndex;
            else
                return -1;
        }
    }
}
*/





const host = 'www.toybytoy.com';

function loadDirNodeSync(host: string, fn: (node: fw.INode) => void, flagZero?: boolean) {
    !flagZero && (flagZero = false);
    let dirPath = fw.pathType.data + host + '/node/';
    for (let dirkey of fso.readdirSync(dirPath)) {
        dirkey += '/';
        for (let filename of fso.readdirSync(dirPath + dirkey)) {
            let node = fw.loadSyncNode(host, parseInt(filename, 10));
            if (node) {
                if (flagZero || node.head && node.head.idn) fn(node);
            }
            //else err('loadDirNode', host, filename);
        }
    }
}


function sync() {
    let timeStart = fw.now();

    loadDirNodeSync(host, function (node) {
    });

    console.log(fw.toMin(timeStart), 'мин');
    let memory = process.memoryUsage();
    console.log('rss: ', fw.toMb(memory.rss));
    console.log('heapTotal: ', fw.toMb(memory.heapTotal));
    console.log('heapUsed: ', fw.toMb(memory.heapUsed));
}

async function asyn() {
    let timeStart = fw.now();

    await fw.loadDirNode(host, async function (node) {
    });

    console.log(fw.toMin(timeStart), 'мин');
    let memory = process.memoryUsage();
    console.log('rss: ', fw.toMb(memory.rss));
    console.log('heapTotal: ', fw.toMb(memory.heapTotal));
    console.log('heapUsed: ', fw.toMb(memory.heapUsed));
}

function genr() {
    let timeStart = fw.now();

    //for (let node of fw.loadDirNodeGen(host)) {
    //}

    console.log(fw.toMin(timeStart), 'мин');
    let memory = process.memoryUsage();
    console.log('rss: ', fw.toMb(memory.rss));
    console.log('heapTotal: ', fw.toMb(memory.heapTotal));
    console.log('heapUsed: ', fw.toMb(memory.heapUsed));
}

if (!module.parent) {
    switch (process.argv[2]) {
        case 'sync': sync(); break;
        case 'asyn': asyn(); break;
        case 'genr': genr(); break;
    }
}