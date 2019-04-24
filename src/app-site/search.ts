
import * as fs from "fs";
import { spawnSync } from "child_process";
import * as fw from "../fw";

let reDgt = /^\d+$/;
let host: string, idnDoc: number, errorLen: string[];

let reEnd10 = /[аеёийоуыъьэюя]+$/;
let reEnd11 = /[аеёиоуыъьэюя]+$/;
let reEnd20 = /[вхмтсгхцчщшкн]+$/;
let reEnd21 = /[вхмтсх]+$/;

let flagTest = false;
let tree = {} as fw.ITree;

let t0 = new Date().getTime();

if (!module.parent) {
    // node --use_strict /usr/local/www/app.back/app-site/search.js test
    if (process.argv[2] == 'test') {
        
    }
    else
        new fw.Spawn().data(process.stdin, function (data: any) {
            host = data.host;
            loadTree(() => {
                let url = '';
                try {
                    url = decodeURI(data.search.replace(/,/g, '+'));
                }
                catch (e) { }
                webSearch(data.key, decodeURI(url).split('+'));
            });
        });
}

function loadTree(callFN: () => void) {
    fw.asyncTreeSyncLoad(host)
        .then((data) => {
            tree = data;
            callFN();
        })
        .catch((e) => {
            console.error('search::treeload', e);
        });
}


interface IOutdata {
    label?: string[][]
    full?: string[][]
    part?: string[][]
    end?: string
    search?: string
}

function webSearch(outKey: string, wordList: string[]) {
    let outData = <IOutdata>{};
    let outPath = fw.pathType.file + host + '/file/wait/' + outKey + fw.extJson;
    outSave();

    let keyword = <fw.IHostKeyword>fw.loadSyncJson(fw.pathType.file + host + '/json/keywords.json');
    delete (keyword['extList']);
    let keywordDict = Object.keys(keyword);

    wordList = wordList.
        map(word => wordNorm(word)).
        filter(word => !!word.trim());

    // первые 5 слов из запроса
    wordList = wordList.slice(0, 5);

    let flagFull: boolean;
    let outFull: number[][] = [], outPart: number[][] = [];


    if (wordList.length) {
        searchStart(true);
    }
    else {
        outSave(true);
    }

    function searchStart(flag: boolean) {
        let param = [
            '-Erl'
            , ' (' + (wordList.join('|')) + (flag ? ') ' : ')')
            , fw.pathType.memory + host + '/search'
        ];
        let data = spawnSync('/usr/bin/grep', param).output[1].toString().trim().split('\n');
        console.log('time(end):',new Date().getTime()-t0);
        searchEnd(data);
    }

    function searchEnd(searchData: string[]) {

        let label = outData.label = [] as string[][];
        for (const word of wordList) {
            let reWord = new RegExp(word, 'i');
            for (let i = 0, im = keywordDict.length; i < im; i++) {
                if (reWord.test(keywordDict[i])) {
                    label.push([fw.getNodePath(tree, <any>keyword[keywordDict[i]], 'search-1::' + host), keywordDict[i]]);
                }
            }
        }
        if (!outData.label.length) {
            delete (outData.label);
        }

        searchData.filter(line => !!line.trim()).forEach(make);

        if (flagTest) {
            console.log(wordList);
            console.log(outFull);
        }

        if (outFull.length || !flagFull) {
            treeSet();
        }
        else {
            searchStart(false);
        }
        function make(path: string) {
            let dataFile = fw.loadSync(path);
            let flagPart = false;
            let idn = keyFile(path);

            let mark = 0;

            //let reKeywords = /"keywords":\s?(\[[^\]]+\])/;
            //let reKeywords = /keywords/;
            //console.log(dataFile);

            //console.log(tree[path].)
            //dataFile
            // (word.toString().search(reDgt) > -1 ? tree[word].text : word).toString()

            for (const word of wordList) {
                let res: RegExpExecArray | null | undefined;
                if (dataFile) {
                    if (flagFull) {
                        res = new RegExp('(\\d+)\\s' + word + '\\s', 'g').exec(dataFile);
                    }
                    else {
                        res = new RegExp('(\\d+)\\s' + word, 'g').exec(dataFile);
                    }
                }
                if (res) {
                    mark += 1000 + parseInt(res[1], 10);
                }
                else {
                    flagPart = true;
                }
            }

            if (flagPart) {
                if (mark) {
                    outPart.push([mark, idn]);
                }
            }
            else {
                outFull.push([mark, idn]);
            }
        }
    }
    function treeSet() {
        if (outFull.length || outPart.length) {
            prepare(tree);
        }
        else {
            outSave(true);
        }
    }
    function keyFile(path: string) {
        return parseInt(path.substr(path.lastIndexOf('/') + 1), 10);
    }
    function prepare(tree: fw.ITree) {
        let idnList: number[] = [];
        outData.search = wordList.join('+');
        if (outFull.length) {
            outFull.sort(sort);
            outData.full = outFull.slice(0, 100).filter(outFilter).map(outAdd);
        }
        if (outFull.length < 20 && outPart.length) {
            //fw.sort(outPart, false)
            outPart.sort(sort);
            outData.part = outPart.slice(0, 100).filter(outFilter).map(outAdd);
        }
        function sort(a: number[], b: number[]) {
            return b[0] - a[0]
        }
        function outFilter(data: number[]) {
            return tree[data[1]] && idnList.indexOf(data[1]) == -1 && idnList.push(data[1]) && true || false;
        }
        function outAdd(data: number[]) {
            return [fw.getNodePath(tree, data[1], 'search-2::' + host), tree[data[1]].text];
        }
        outSave(true);
    }
    function outSave(flag?: boolean) {
        console.log('time:',new Date().getTime()-t0);
        if (flag && !Object.keys(outData).length) {
            outData = { end: '' };
        }
        fw.saveSyncJson(outPath, outData);
    }
}

export function dataSet(hostGet: string, tree: fw.ITree, nodeData: fw.INode) {
    host = hostGet;
    idnDoc = nodeData.head.idn;

    let reTagHeader = /<(?:h\d)[^>]*>((?:.(?!\/h\d))*)/g;
    let reHeaderNum = /<h(\d)/;

    let pathToFile = fw.pathType.memory + host + '/search/' + fw.pathFolder(idnDoc) + '.txt';

    let h = nodeData.head;
    if (h.flagFolder || h.flagBlock || !h.flagValid) {
        if (fs.existsSync(pathToFile)) {
            fs.unlinkSync(pathToFile);
        }
        return;
    }

    errorLen = [];

    let keywords = [
        nodeData.head.keywords.map(word=>word)
        .concat(nodeData.head.labels.map(idn=>tree[idn].text)).join(' ')
    ];

    let title = [nodeData.head.title];
    let counter = 10;
    while (counter) {
        counter--;
        keywords.push(keywords[0]);
        title.push(title[0]);
    }

    let attach = nodeData.attach.map(line => line.content || '').join(' ');
    let content = fw.textOnly(nodeData.content + ' ' + attach);
    // удаляем ссылки в тексте
    content = content.replace(/\S+\/\S+/g, '');

    let wordDict: { [s: string]: number } = {}, weight = 1;


    weight = 300;
    (title.join(' ')).replace(/[a-zа-яё0-9]+/gi, wordGet);

    if (reTagHeader.test(nodeData.content)) {
        let m1 = nodeData.content.match(reTagHeader);
        if (m1) {
            for (const header of m1) {
                let m2 = header.match(reHeaderNum);
                if (m2) {
                    weight = (7 - ~~m2[1]) * 100;
                    fw.textOnly(header).replace(/[a-zа-яё0-9]+/gi, wordGet);
                }
            }
        }
    }

    weight = 1;
    content = content + ' ' + keywords.join(' ');
    content.replace(/[a-zа-яё0-9]+/gi, wordGet);
    function wordGet() {
        let word = wordNorm(arguments[0]);
        if (word) {
            if (!wordDict[word]) wordDict[word] = 0;
            wordDict[word] += weight;
        }
        return '';
    }

    let text = Object.keys(wordDict).map(word =>
        wordDict[word] + ' ' + word + ' '
    ).join('\n');

    if (errorLen.length > 4) {
        let tmp: string[] = [];
        for (const line of errorLen) {
            if (tmp.indexOf(line) == -1) {
                tmp.push(line);
            }
        }
        if (tmp.length > 4) {
            console.error('app-site/search.js wordNorm >16 всего:', tmp.length, tmp, host, idnDoc);
        }
    }

    fw.saveSync(pathToFile, text);
}

export function wordNorm(word: string) {
    word = word.toLowerCase();

    if (/\d/.test(word) && word.search(reDgt) == -1) word = '';

    word = word.replace(/ё/gi, 'е');
    word = word.replace(/<[^>]*>/g, '').replace(/[^а-яa-z0-9]/g, '');
    // два и более знаков порряд на один
    word = word.replace(/(\D)\1{1,}/g, '$1');

    let i = 3, wordSave: string;
    while (i) {
        i--;
        wordSave = word;
        word = word.length > 4 ? word.replace(reEnd10, '') : word.replace(reEnd11, '');
        if (word.length < 3) {
            word = wordSave;
            break;
        }
        if (word.length > 6) {
            word = word.length > 7 ? word.replace(reEnd20, '') : word.replace(reEnd21, '');
        }
        else {
            break;
        }
        if (word == wordSave) {
            break;
        }
    }

    if (word.length < 2) word = '';
    else if (word.length > 16) {
        if (idnDoc) {
            errorLen.push(word);
        }
        word = '';
    }
    return word;
}