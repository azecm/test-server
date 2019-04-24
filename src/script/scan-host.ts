
import * as Path from 'path';
import * as fs from 'fs';
import * as Http from 'http';
import * as Https from 'https';
import * as Url from 'url';

interface IResult {
    [s: string]: number | string | undefined
    path: string
    vk?: number
}

interface IFBData extends Array<IFacebook> {
}
interface IFacebook {
    url: string
    normalized_url: string
    share_count: number
    like_count: number
    comment_count: number
    total_count: number
    click_count: number
    comments_fbid: string
    commentsbox_count: number
}
interface IPointer {
    re?: RegExp
    json?: (data: string) => any
    url: string
}
interface IPointerObj {
    [s: string]: IPointer
}

enum Pointer {
    vk, fb, pinterest
}



class Scanner {
    host: string
    protocol: string
    stateMax = 4
    pointer = {
        vk: {
            re: /VK\.Share\.count\(\d+,\s*(\d+)\);/,
            url: 'https://vk.com/share.php?act=count&url='
        },
        fb: {
            json: (dataText: string) => {
                let out = null as any;
                let dataList = JSON.parse(dataText) as IFBData;
                if (dataList.length) {
                    out = {};
                    let data = dataList[0];
                    for (let name in data) {
                        let pos = name.indexOf('_count');
                        if (pos > -1 && (data as any)[name] && name != 'total_count') out[name.substr(0, pos)] = (data as any)[name];
                    }
                    if (!Object.keys(out).length) out = null;
                }
                return out;
            },
            url: 'https://api.facebook.com/method/links.getStats?format=json&urls='
        },
        pinterest: {
            // receiveCount({"url":"https://xakep.ru/2016/05/05/mongodb-leaks/","count":0})
            url: 'http://widgets.pinterest.com/v1/urls/count.json?source=6&url=',
            re: /"count":\s*(\d+)/

        }
    } as IPointerObj
    data = {
        state: 0,
        pos: 0,
        urls: [] as IResult[]
    }
    reLins = /<a[^>]+href="([^"]+)"/g
    reLink = /href="([^"]+)"/
    reNLnk = /^\/(goto|file)\//
    constructor(urlStart: string) {
        const url = Url.parse(urlStart);
        this.host = url.hostname || '';
        this.protocol = url.protocol || '';

        if (fs.existsSync(this.fileName()))
            this.data = JSON.parse(fs.readFileSync(this.fileName(), 'utf-8'));
        else
            this.data.urls.push({ path: url.pathname || '' });

        this.next();
    }
    next = () => {
        this.data.state++;
        if (this.data.state == this.stateMax) this.data.state = 0;
        else {
            if (this.data.pos >= this.data.urls.length) {
                this.finish();
                return;
            }
        }

        let path = this.data.urls[this.data.pos].path;
        let url = this.protocol + '//' + this.host + path;

        switch (this.data.state) {
            case 0:
                this.data.pos++;
                console.log(this.data.pos, path);
                this.getPage(url, this.next);
                break;
            case 1:
                this.getSocial(Pointer.vk, url, 0);
                break;
            case 2:
                this.getSocial(Pointer.fb, url, 0);
                break;
            case 3:
                this.getSocial(Pointer.pinterest, url, 0);
                break;
            default:
                break;
        }
    }
    finish() {
        console.log('finish');
    }
    get(url: string, callBack: (text?: string) => void) {
        let request = url.startsWith('https') ? Https.get : Http.get;
        request(url, (res) => {
            if (res.statusCode == 200) {
                this.getBody(res, (body) => {
                    callBack(body);
                });
            }
            else {
                res.resume();
                callBack();
                console.log('http status', res.statusCode);
                console.log('- ', url);
            }
        }).on('error', (e: Error) => {
            callBack();
            console.log('http error', url, e.message);
            console.log('- ', url);
            console.log('- ', e.message);
        });
    }
    getBody(res: Http.IncomingMessage, callBack: (body?: string) => void) {
        let chunks: Buffer[] = [];
        res.on('error', (err: Error) => {
            callBack();
        });
        res.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });
        res.on('end', () => {
            let buffer = Buffer.concat(chunks);
            callBack(buffer.toString());
        })
    }
    getPage(url: string, callBack: () => void) {
        this.get(url, (body) => {
            if (body && this.reLins.test(body)) {
                let scaned = this.data.urls.map((l) => l.path);
                let m = body.match(this.reLins);
                if (m)
                    m.forEach((text) => {
                        let m = text.match(this.reLink);
                        if (m) {
                            let link = m[1];
                            if (!this.reNLnk.test(link) && link.charAt(0) == '/' && scaned.indexOf(link) == -1) {
                                scaned.push(link);
                                this.data.urls.push({ path: link });
                            }
                        }
                    });
            }
            callBack();
        });
    }
    getSocial(key: Pointer, url: string, counter: number) {
        counter++;
        let name = Pointer[key];
        let pointer = this.pointer[name];
        this.get(pointer.url + encodeURIComponent(url), (body) => {
            let value: any = -1;
            if (body) {
                if (pointer.re) {
                    if (pointer.re.test(body)) {
                        let m = body.match(pointer.re);
                        if (m) value = ~~m[1];
                    }
                }
                else if (pointer.json) value = pointer.json(body);
            }
            if (value == -1 && counter < 5) this.getSocial(key, url, counter);
            else this.setResult(key, value);
        });
    }
    fileName() {
        return Path.resolve(__dirname, 'scan-host.json');
    }
    setResult(pointer: Pointer, value: any) {
        console.log(Pointer[pointer], value);
        if (value)
            this.data.urls[this.data.pos][Pointer[pointer]] = value;
        //let data = JSON.stringify(this.data, null, '\t');
        let data = JSON.stringify(this.data);
        fs.writeFileSync(this.fileName(), data);
        this.next();
    }
}

new Scanner('http://www.toybytoy.com/');