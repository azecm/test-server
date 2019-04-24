

// "D:\Game\net\node\node.exe" "D:\nginx\html\ts-server\ts-server\script\nginx-local-log.js" %FILE%

// команда C:\Program Files\nodejs\node.exe  
// параметры D:\\nginx\\html\\ts-2018\\server\\es6\\script\\nginx-local-log.js $(Path)
// папка $(Dir)

import * as fs from "fs";
import * as crypto from "crypto";
import * as punycode from "punycode";
import * as readline from "readline";
import { parse as urlParse } from "url";
import { parse as queryParse } from "querystring";


let reLine = /([^\s]+) ([^\s]+) (\d\d\d) \[([^\]]+)\] ([^\s]+) (\d+) (\d+) "([^"]+)" "([^"]+)" "([^"]+)" ([\w\.\-]+)\/([\w\-]+)/;
let reLineData = /([^\s]+) (\d\d\d) \[([^\]]+)\] ([^\s]+) (\d+) (\d+) "([^"]+)" "([^"]+)"/;

// www.hnh.ru 200 [25/Feb/2017:00:00:02 +0300] 0.000 390 6373 "GET /css/QCmgAugM2UYYwMYUYwNuTbyXzjH.css HTTP/1.1" "http://www.hnh.ru/health/2010-08-24-2"

let reRefHost = /\/\/([^\/\:]+)(?:\:\d+)?(\/.*)$/;

let lineCounter = 0;


let tbtVisit = {} as { [s: string]: { frec: number, hits: number, browser: string, name: string, flag: string, page: string[] } }, ONE_DAY = 1000 * 60 * 60 * 24;
//let tbtView = {} as { [s: string]: number };

let compatUni = [] as string[];
let compatUser = {} as { [s: string]: number };
let compatHost = {} as { [s: string]: number };
let passHost = {} as { [s: string]: number };
let megaIndex = {} as { [s: string]: number }, megaIndexCounter = 0;
let passData = {} as { [s: string]: string[] };
let compatData = {} as { [s: string]: number };
let compatBot = 0;
const error = {
    eval: 0,
    scriptErr: 0,
    lineZero: 0,
    other: 0,
    fetch: 0
};

let browserDict = {
    mobile: { apple: 0, other: 0, windows: 0, all: 0 },
    bot: { all: 0 },
    webkit: { all: 0, android: 0, opera: 0, yandex: 0, safari: 0, other: 0 },
    firefox: 0,
    opera: 0,
    windows: 0,
    other: 0
};

const browserMap = new Map<string,number>();

let screen = {} as { [s: string]:number};


// ODI3 Navigator
let reBot = /(bot|yahoo|ODI3|feedly|WebIndex|libwww|Akregator|URLGrabber|pflink|ia_archiver|wscheck|SEOstats|megaindex|Crawler|Bloglovin|admantx|PubSub|drupal|fetcher|Spider|python|google)/i;
let reiPad = /(ipad|iphone);/i;
let reMobile = /Mobile/i;
let reWebKit = /AppleWebKit/i;
let reTrident = /Trident\//;
let reFirefox = /Firefox\//;
let reYaBrowser = /YaBrowser\//;
let reOpr = /OPR\//;
let reOpera = /Opera\//;
let reWindowsNT = /^Mozilla\/.*Windows NT/;
let reAndroid = /Linux;.*Android /;
let reSafari = /Macintosh;.*Mac OS X.*Safari\//;

let apiTest = {} as { [s: string]: { yes: number, no: number } };
//let rePassLine = /\/js\/onerror\.gif\?line=(\d+)&source=(?:[^&]*)?(\/js\/[^&]+.js)&message=(.*)/;
// \/js\/main\.pass\.js\
// /js/onerror.gif?line=4014&message=


//let badErrList = [];

let brList = [] as string[];

let browserAll = {} as { [s: string]: number };
let ssl = { on: 0, off: 0 } as { [s: string]: number, on: number, off: number };


let lillu = [] as string[], lilluCount = [] as number[];
let longReq = 0, longReqCount = 0, longReqList = [] as number[];


let pathToLog = process.argv[2];
readByLine(pathToLog, fnLine, fnEnd);

function fnLine(line: string) {
    let ip = '', host = '', timeReq = 0, urlData: string[] = [], time = '', browser = '', ssl_protocol = '';//, code = 0, ssl_cipher = '';
    let refHost = '', referer = '';//refPage = '', 
    lineCounter++;
    let m0 = line.match(reLine), ver = 1;
    if (!m0) m0 = line.match(reLineData), ver = 2;
    if (m0) {
        if (ver == 1) {
            ip = m0[1];
            host = m0[2];
            //code = parseInt(m0[3], 10);
            time = m0[4];
            timeReq = parseFloat(m0[5]);
            urlData = m0[8].split(' '); // GET /js/user.gif HTTP/1.1
            referer = m0[9];
            browser = m0[10];

            ssl_protocol = m0[11];
            //ssl_cipher = m0[12];
        }
        else {
            host = m0[1];
            //code = parseInt(m0[2], 10);
            time = m0[3];
            timeReq = parseFloat(m0[4]);
            urlData = m0[7].split(' '); // GET /js/user.gif HTTP/1.1
            referer = m0[8];
        }

        ssl[ssl_protocol && ssl_protocol != '-' ? 'on' : 'off']++;


        if (timeReq > 0.1) {
            longReqCount++;
            longReq += timeReq
            if (timeReq > 1) longReqList.push(timeReq);
        }

        if(urlData[0]=='POST' && urlData[1].startsWith('/js/log/in?')){
            const c = browserMap.get(browser);
            if(c==null){
                browserMap.set(browser,1);
            }
            else{
                browserMap.set(browser,c+1);
            }
        }

        if (urlData[1].substr(0, 12) == '/goto/lillu/') {
            let pos = lillu.indexOf(referer);
            if (pos == -1) {
                lillu.push(referer);
                lilluCount.push(1);
            }
            else {
                lilluCount[pos]++;
            }
        }


        if (!browserAll[browser]) browserAll[browser] = 0;
        browserAll[browser]++;

        let isBot = false;
        if (reBot.test(browser) || browser == '-') {
            isBot = true;
            browserDict.bot.all++;
        }
        else {
            if (reiPad.test(browser)) {
                browserDict.mobile.apple++;
                browserDict.mobile.all++;
            }
            else {
                if (reMobile.test(browser)) {
                    browserDict.mobile.all++;
                    if (reTrident.test(browser)) {
                        browserDict.mobile.windows++;
                    }
                    else {
                        browserDict.mobile.other++;
                    }
                }
                else {
                    if (reWebKit.test(browser)) {
                        browserDict.webkit.all++;
                        if (reAndroid.test(browser)) {
                            browserDict.webkit.android++;
                        }
                        else {
                            if (reOpr.test(browser)) {
                                browserDict.webkit.opera++;
                            }
                            else {
                                if (reYaBrowser.test(browser)) {
                                    browserDict.webkit.yandex++;
                                }
                                else {
                                    if (reSafari.test(browser)) {
                                        browserDict.webkit.safari++;
                                    }
                                    else {
                                        browserDict.webkit.other++;
                                        //if(brList.indexOf(browser)==-1)brList.push(browser);
                                    }
                                }
                            }
                        }
                    }
                    else {
                        if (reFirefox.test(browser)) {
                            browserDict.firefox++;
                        }
                        else {
                            if (reOpera.test(browser)) {
                                browserDict.opera++;
                            }
                            else {
                                if (reWindowsNT.test(browser)) {
                                    browserDict.windows++;
                                }
                                else {
                                    browserDict.other++;
                                }
                            }
                        }
                    }
                }
            }
        }

        let urlDict = urlParse(urlData[1])
        let urlPath = urlDict.pathname || '';
        let urlParam = queryParse(urlDict.query as string);

        //try { url = decodeURIComponent(urlData[1]); }
        //catch (e) { url = urlData[1]; }

        refHost = '';
        //refPage = '';
        let m1 = referer.match(reRefHost);
        if (m1) {
            refHost = m1[1];
            //refPage = m1[2];
            if (refHost.indexOf('xn--') > -1) {
                refHost = punycode.toUnicode(refHost);
            }
        }

        // /2.0;
        if (line.toLowerCase().indexOf('megaindex.ru') > -1) {
            megaIndexCounter++;
            if (!megaIndex[ip]) megaIndex[ip] = 0;
            megaIndex[ip]++;
            //if(megaIndex.indexOf(ip)==-1){
            //	megaIndex.push(ip);
            //}
        }

        if (urlPath == '/js/useron.gif') {
            // cssFilter: '1', WebSocket: '1'
            let keys = Object.keys(urlParam);
            if (keys.length) {
                let data = (urlParam as any) as { first: string, date: string, day: number, key: string, name: string, flag: string };
                if (!isBot && data.first && data.day && data.date && data.key && data.name !== void (0) && data.flag !== void (0)) {
                    let delta = 0;
                    delta = Math.round((new Date(data.date).getTime() - new Date(data.first).getTime()) / ONE_DAY) + 1;
                    let frec = Math.ceil(Math.round(delta / data.day * 10) / 10);
                    if (data.date == data.first) frec = 0;

                    if (!tbtVisit[data.key]) tbtVisit[data.key] = { frec: frec, hits: 0, browser: browser, name: data.name, flag: data.flag, page: [] };
                    tbtVisit[data.key].frec = frec;
                    tbtVisit[data.key].hits++;
                    if (frec && referer && data.name != 'admin') tbtVisit[data.key].page.push(referer);

                }
                //scripts screen
                let data2 = urlParam as { scripts: string, screen: string };
                if (data2.scripts) {
                    //console.log(data2.scripts);
                }
                if (data2.screen) {
                    let [w, h, dpi] = data2.screen.split('x').map(a => ~~a);
                    dpi;
                    if (h > w)[w, h] = [h, w];
                    let k = w < 750 ? 'max<750' : (w < 1100 ? '750<max<1100' : (w < 1400 ? '1100<max<1400' : 'max>1400'));   //`${w}x${h}`;
                    if (!screen[k]) screen[k] = 0;
                    screen[k]++;
                    //console.log(data2.screen);
                }

                for (let key of keys) {
                    if (/^(first|day|view|date|key|name|flag|scripts|screen)$/.test(key)) continue;
                    if (!apiTest[key]) apiTest[key] = { yes: 0, no: 0 };
                    if (urlParam[key] == '1') apiTest[key].yes++;
                    else apiTest[key].no++;
                }
            }
        }
        else if (urlPath == '/js/onerror.gif') {
            if (urlParam.compat) {
                compatHost[host] && (compatHost[host]++) || (compatHost[host] = 1);
                let text = urlParam.compat as string;
                if (!compatData[text]) compatData[text] = 0;
                compatData[text]++;
                if (reBot.test(browser)) {
                    compatBot++;
                }

                let d = crypto.createHash('sha1').update(host + ip + browser).digest('hex');
                if (compatUni.indexOf(d) == -1) {
                    compatUni.push(d);
                    compatUser[host] && (compatUser[host]++) || (compatUser[host] = 1);
                }

            }
            else if (urlParam.message) {
                const isReject = urlParam.source == 'rejection' || urlParam.source == 'fetch';
                //console.log(urlParam.stack);
                //if (urlParam.message.indexOf('Window')>1)
                //    console.log(urlParam.message.indexOf('Window'), /(evaluating|unsafe\-eval|Window\.eval|\(eval at)/i.test(urlParam.message));
                if (!isReject && /(evaluating|unsafe\-eval|Window\.eval|\(eval at)/ig.test(urlParam.message as string + urlParam.stack)) {
                    error.eval++;
                }
                else if (!isReject && /(mecash\.ru|Unexpected token <| hookAppData )/i.test(urlParam.message as string)) {
                    error.other++;
                }
                else if (!isReject && /^Script error|Access is denied/.test((urlParam.message as string || '').trim())) {
                    error.scriptErr++;
                }
                else if (/fetch/i.test(urlParam.message.toString())) {
                    error.fetch++;
                }
                else {
                    const num = parseInt(urlParam.line as string, 10);
                    if ((isFinite(num) && num>1) || urlParam.line == 'rejection' || urlParam.line == 'fetch' || urlParam.line == 'es5') {
                        passHost[host] && (passHost[host]++) || (passHost[host] = 1);
                        let errLine = [
                            '',
                            time.substr(0, 20) + ' ' + ip + ' ' + browser,
                            referer,
                            urlParam.message || '',
                            urlParam.stack || '',
                            ''
                        ].join('\n');

                        let source = '';
                        if (urlParam.source) {
                            let urlDict = urlParse(urlParam.source as string);
                            source = urlDict.path || '';
                        }
                        let key = urlParam.line + ':' + source;
                        if (!passData[key]) {
                            passData[key] = [];
                        }
                        passData[key].push(errLine);
                    }
                    else {
                        error.lineZero++;
                        //console.log('------' + urlParam.line, typeof (urlParam.line), urlParam.message);
                    }
                }
            }
            else {
                //console.log(urlParam);
            }
        }
    }
}
function fnEnd() {
    let LINE = '\n+++++++++++++\n';

    function browserAdd(key:string, count: number){
        const c = browserNamed.get(key);
        if(c==null)browserNamed.set(key, count);
        else browserNamed.set(key, c+count);
    }

    const reIphone = /\(iPhone; CPU iPhone OS .* like Mac OS X\)/;
    const reiPad = /\(iPad; CPU OS .* like Mac OS X\)/;
    const reChrome = /AppleWebKit.* \(KHTML, like Gecko\) Chrome.* Safari.*/;
    const reFirefox = /Gecko.*Firefox/;
    const reMacintosh = /Macintosh; Intel Mac OS X.*AppleWebKit.*Version.*Safari/;
    const reAndroid = /\(Linux.*Android/;

    const reYandexSearchBrowser = /Linux; Android.*YandexSearchBrowser/;
    //iPad; CPU OS 12_0_1 like Mac OS X
    //Gecko/20100101 Firefox

    
    //const browserList = [] as {name:string, count: number}[];
    let browserNamed = new Map<string,number>();
    for(const l of browserMap.entries()){
        if(reIphone.test(l[0])){
            browserAdd('iPhone', l[1]);
        }
        else if(reiPad.test(l[0])){
            browserAdd('iPad', l[1]);
        }
        else if(reMacintosh.test(l[0])){
            browserAdd('Macintosh', l[1]);
        }
        else if(reYandexSearchBrowser.test(l[0])){
            browserAdd('YandexSearchBrowser', l[1]);
        }
        else if(reAndroid.test(l[0])){
            browserAdd('Android', l[1]);
        }
        else if(reChrome.test(l[0])){
            browserAdd('Chrome', l[1]);
        }
        else if(reFirefox.test(l[0])){
            browserAdd('Firefox', l[1]);
        }
        else{
            //browserList.push({name: l[0], count:l[1]});
            browserAdd('other', l[1]);
        }
    }
    browserNamed = new Map([...browserNamed.entries()].sort((a, b) => b[1] - a[1]));
    console.log(browserNamed);
    console.log('');


    function iterObj(obj: any) {
        let keys = Object.keys(obj);
        keys.forEach(function (key) {
            if (typeof (obj[key]) == 'object') {
                iterObj(obj[key]);
            }
            else {
                obj[key] = obj[key] + ' / ' + (Math.ceil(obj[key] / lineCounter * 1000) / 10) + '%';
            }
        });
    }

    let screenList = Object.keys(screen).map(k => [screen[k],k]) as [number, string][];
    screenList.sort((a, b) => b[0]-a[0]);
    console.log(screenList.map(l => l[1] + ': ' + l[0]));

    


    let userHits = 0;
    let userCount = Object.keys(tbtVisit).length;
    let visit = {} as { [s: string]: number }, view = {} as { [s: string]: number };
    let topUser = [] as [number, string][], pagesDict = {} as { [s: string]: number };
    for (let key in tbtVisit) {
        let val = tbtVisit[key];

        if (!visit[val.frec]) visit[val.frec] = 0;
        visit[val.frec]++;

        if (!view[val.hits]) view[val.hits] = 0;
        view[val.hits]++;

        userHits += ~~val.hits;

        if (val.hits > 5 || val.flag) {
            topUser.push([val.hits, (val.flag ? '+' : '-') + val.name + ' ' + val.hits + ' ' + val.browser]);
            //console.log('view', (val.flag ? '+' : '-') + val.name, val.view, val.browser);
        }

        for (let page of val.page) {
            if (!pagesDict[page]) pagesDict[page] = 0;
            pagesDict[page]++;
        }
    }
    topUser.sort((a, b) => b[0] - a[0]);

    let topPage = [] as [number, string][];
    for (let key in pagesDict) topPage.push([pagesDict[key], key]);
    topPage.sort((a, b) => b[0] - a[0]);

    console.log('');
    console.log('toybytoy visit', userCount, userHits, Math.round(userHits / userCount * 10) / 10);
    //topPage.forEach(l => console.log(' ', l[0], l[1]));
    //topUser.forEach(l => console.log(' ', l[1]));
    console.log('visit:',visit);
    //console.log('view:', view);
    console.log('');

    console.log(LINE);
    console.log('ssl:', ((~~((ssl.on / (ssl.on + ssl.off)) * 1000)) / 10) + '%');
    console.log(LINE);

    let apiFirst = apiTest[Object.keys(apiTest)[0]];
    if (apiFirst) console.log('all: ' + (apiFirst.yes + apiFirst.no));
    for (let key in apiTest) {
        let v = apiTest[key];
        console.log(key + ': ' + (Math.round((v.yes / (v.yes + v.no)) * 1000) / 10) + '% ' + v.no);
    }

    console.log(LINE);

    let passDataSort = Object.keys(passData).map(function (key) {
        return { count: passData[key].length, name: key };
    });
    passDataSort.sort(function (a, b) { return b.count - a.count });
    passDataSort.forEach(function (l) {
        let key = l.name;
        console.log('========', key, '[' + passData[key].length + ']');
        console.log(passData[key].join('\n'));
    });

    console.log(LINE);
    console.log('pass eval:', error.eval);
    console.log('pass other:', error.other);
    console.log('pass script:', error.scriptErr);
    console.log('pass lineZero:', error.lineZero);
    console.log('pass fetch:', error.fetch);
    console.log(LINE);

    console.log('Долгие запросы')
    console.log(longReq / 3600, 'ч')
    console.log(longReqCount, 'шт')
    if (longReqList.length) {
        longReqList.sort((a, b) => b - a);
        longReqList.slice(0, 10).forEach(v => {
            console.log(v, 'сек');
        });
    }
    console.log('')

    if (Object.keys(passHost).length) {
        console.log('passHost:', Object.keys(passHost).map(function (key) { return passHost[key] }).reduce(function (a, b) { return a + b; }));
        console.log('passHost', passHost);
    }
    console.log('megaIndex', megaIndexCounter, megaIndex);

    console.log(LINE);

    iterObj(browserDict);

    if (brList.length) {
        brList.sort();
        console.log(brList.join('\n'));
        console.log(LINE);
    }

    if (Object.keys(compatHost).length) {
        console.log('compatHost:', Object.keys(compatHost).map(function (key) { return compatHost[key] }).reduce(function (a, b) { return a + b; }));
        console.log('compatUni:', compatUni.length);
        console.log('compatBot:', compatBot);

        console.log('compatHost:');
        Object.keys(compatHost).forEach(function (host) {
            console.log('\t', host, compatHost[host], compatUser[host]);
        });
    }
    console.log(LINE);
    console.log('compatData', compatData);
    console.log(LINE);
    console.log('browserDict', browserDict);
    console.log(LINE);

    let l = Object.keys(browserAll).map(function (k) {
        return { count: browserAll[k], name: k };
    });
    l.sort(function (a, b) { return b.count - a.count });
    console.log('\n\n');
    for (let i = 0; i < 100; i++) {
        console.log(l[i].count, l[i].name);
    }
}

function readByLine(pathToFile: string, fnLine: (line: string) => void, fnEnd: () => void) {
    let rd = readline.createInterface({
        input: fs.createReadStream(pathToFile),
        output: process.stdout,
        terminal: false
    });
    rd.on('line', fnLine);
    rd.on('close', fnEnd);
}
