

//import * as querystring from "querystring";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import { parse as urlParse } from "url";
import { HTMLDoc } from "../fw-dom";
import * as fw from "fw";


// node /usr/local/www/app.back/script/iqsha-scan.js

interface ILink {
    path: string
    ref: string
    to: string
    status: number
}
class ScanSite {
    protocol: string
    hostname: string
    path!: string
    //headers: any
    html!: string
    //scaned: string[] = []
    linkCur!: ILink
    linkList: ILink[] = []
    linkAdded: string[] = []
    linkExt: { [s: string]: string[] } = {}
    linkRef: { [s: string]: { path: string, text: string }[] } = {}
    //link404: { [s: string]: string[] } = {}
    linkErr: string[] = []
    linkPos = 0
    reImg = /\.(png|jpg|gif|bmp|pdf)$/i
    extList = [] as string[]
    timeStart = new Date().getTime()
    constructor(firstPage: string) {
        this.pageLoaded = this.pageLoaded.bind(this);
        //this.pageError = this.pageError.bind(this);

        let urlData = urlParse(firstPage);
        this.protocol = urlData.protocol || '';
        this.hostname = urlData.hostname || '';

        this.linkAdded.push(urlData.path || '');
        this.linkList.push({ path: urlData.path || '', ref: '' } as ILink);

        this.pageLoad();
    }
    pageLoad() {
        this.linkCur = this.linkList[this.linkPos];
        this.path = this.linkCur.path;
        const href = this.protocol + '//' + this.hostname + this.path;

        let getProtocol = http.get;
        if (href.substr(0, 6) == 'https:') getProtocol = https.get;
        getProtocol(href, (res) => {
            let chunks: Buffer[] = [];
            this.linkCur.status = res.statusCode || 0;

            if (res.statusCode && res.statusCode > 299 && res.statusCode < 400) {
                this.linkCur.to = res.headers.location || '';
                //console.log(res.headers.location);
                //for (let key in res)
                //    if (/boolean|string|number/.test(typeof ((res as any)[key])))console.log(key, (res as any)[key]);
            }

            res.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });
            res.on('end', () => {
                this.html = Buffer.concat(chunks).toString();
                this.pageLoaded();
                chunks = [];
            });
            res.on('close', () => {
                this.linkErr.push(`CLOSE ${href}`);
                console.log('CLOSE', href);
                this.html = '';
                this.pageLoaded(true);
                chunks = [];
            });
            res.on('error', () => {
                this.linkErr.push(`ERROR ${href}`);
                console.log('ERROR', href);
                this.html = '';
                this.pageLoaded(true);
                chunks = [];
            });
        });
    }
    pageLoaded(err?: boolean) {
        let reExt = /\.[a-z]{2,4}$/i;
        if (reExt.test(this.linkCur.path)) {
            let m = this.linkCur.path.match(reExt);
            if (m) {
                let ext = m[0];
                if (this.extList.indexOf(ext) == -1) this.extList.push(ext);
            }
        }

        console.log(this.linkCur.status, this.linkPos, this.linkList.length, this.linkCur.path);
        if (this.linkCur.status == 200) {
            let doc = new HTMLDoc(this.html);
            for (let elem of doc.findByTag('a')) {
                let href = elem.get('href') || '';
                let pos = href.indexOf('#');
                if (href.indexOf('#') > -1) href = href.substr(0, pos);
                if (href) {
                    if (href.startsWith(this.protocol + '//' + this.hostname)) {
                        href = href.substr((this.protocol + '//' + this.hostname).length);
                    }
                    if (href.indexOf('//') > -1) {
                        if (!this.linkExt[href]) this.linkExt[href] = [];
                        if (this.linkExt[href].indexOf(this.path) == -1)
                            this.linkExt[href].push(this.path);
                    }
                    else {
                        let text = elem.toText().trim();
                        if (!text) text = elem.toHtml(true);
                        let val = { path: this.path, text: text };
                        if (!this.linkRef[href]) this.linkRef[href] = [];
                        if (this.linkRef[href].indexOf(val) == -1)
                            this.linkRef[href].push(val);
                        /*
                        if (!this.linkRef[href]) this.linkRef[href] = [];
                        if (this.linkRef[href].indexOf(this.path)==-1)
                            this.linkRef[href].push(this.path);
                        */

                        if (this.linkAdded.indexOf(href) == -1) {
                            this.linkAdded.push(href);
                            if (!this.reImg.test(href)) {
                                this.linkList.push({ path: href, ref: this.path } as ILink);
                            }
                        }
                    }
                }
            }
        }
        this.linkPos++;
        
        //this.linkPos > 100
        if (this.linkPos == this.linkList.length) this.finish();
        else this.pageLoad();
    }
    finish() {
        let status = {} as { [s: string]: number };
        let status404 = [] as string[], status404Link = [] as string[];
        let status300 = [] as string[];
        const host = this.protocol + '//' + this.hostname;
        this.linkList.forEach((line) => {
            if (!status['_' + line.status]) status['_' + line.status] = 0
            status['_' + line.status]++;
            if (line.status > 399) {
                status404Link.push(line.path);
                status404.push(line.status + ' ' + host + line.path + ' ref: ' + host + line.ref);
            }
            if (line.status > 299 && line.status < 400) {
                status300.push(line.status + ' ' + host + line.path + ' to: ' + host + line.to + ' ref: ' + host + line.ref);
            }
        });
        console.log(this.extList.join('\n'))
        console.log(this.linkList.length);
        console.log(status);
        console.log((new Date().getTime() - this.timeStart) / (1000 * 60), 'm');

        let basePath = fw.pathType.log + this.hostname;
        fs.writeFileSync(basePath + '.status.txt', Object.keys(status).map(el => `${el.substr(1)}: ${status[el]}`).join('\n'));
        fs.writeFileSync(basePath + '.404.txt', status404.join('\n'));
        fs.writeFileSync(basePath + '.300.txt', status300.join('\n'));
        fs.writeFileSync(basePath + '.err.txt', this.linkErr.join('\n'));
        fs.writeFileSync(basePath + '.err.txt', this.linkErr.join('\n'));

        let text = [] as string[];
        for (let path of status404Link) {
            text.push(host + path);
            if (this.linkRef[path]) {
                for (let ref of this.linkRef[path]) {
                    text.push('- ' + host + ref.path + ' :: ' + ref.text);
                }
            }
            else {
                text.push('- NOT FOUND');
            }
            text.push('');
        }
        fs.writeFileSync(basePath + '.404.ext.txt', text.join('\n'));


        text = []
        for (let path in this.linkExt) {
            text.push(path);
            for (let ref of this.linkExt[path]) {
                text.push('- ' + this.hostname + ref);
            }
            text.push('');
        }
        fs.writeFileSync(basePath + '.ext.txt', text.join('\n'));
    }
}

new ScanSite('https://iqsha.com/');
//new ScanSite('https://iqsha.ru/');