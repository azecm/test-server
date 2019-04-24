import * as Http from "http";
import * as Https from "https";
import * as fs from "fs";
import { parse as urlParse } from "url";
import { parse as queryParse, stringify as queryStringify } from "querystring";
import * as iconv from 'iconv-lite';

const filePref = 'file:';
const bufferName = 'buffer';

export interface IError {
    code: number
    message: string
    location?: string
    cookie?: string
    res: Http.IncomingMessage
}

const userAgents = {
    pos: 0,
    default: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:59.0) Gecko/20100101 Firefox/59.0',
    list: [
        'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:59.0) Gecko/20100101 Firefox/59.0'
    ],
    get: function () {
        let ua = userAgents.list[userAgents.pos++];
        if (!ua) {
            userAgents.pos = 0;
            ua = userAgents.list[userAgents.pos++];
        }
        return ua;
    }
}

export interface IRequestResult<T> {
    text: string
    json: T
    code: number
    message: string
    cookie: { [s: string]: string }
    headers: {
        [s: string]: string
        Cookie: string
    }
}

export interface IRequestSimple {
    code: number
    status: string
    location?: string
    cookie: { [s: string]: string }
    headers: {
        [s: string]: string
        Cookie: string
    }

    text: string
    buffer: Buffer
    json: any
}

export class RequestSimple {
    private chunks: Buffer[] = []
    private _codePage = ''
    private url: string
    private _urlParam: any
    private _headers: any = {}
    private _result!: IRequestSimple
    private resultFn!: (data: any) => void
    constructor(url: string) {
        this.onDataData = this.onDataData.bind(this);
        this.onDataEnd = this.onDataEnd.bind(this);
        this.onDataError = this.onDataError.bind(this);
        this.onResult = this.onResult.bind(this);
        this.onError = this.onError.bind(this);

        this.url = url;
    }
    codePage(codePage: string) {
        this._codePage = codePage;
        return this;
    }
    urlParam(param: any) {
        this._urlParam = param;
        return this;
    }
    setCookie(cookie: string) {
        if (cookie) {
            this._headers.Cookie = cookie;
        }
        return this;
    }
    setHeader(name: string, data: string) {
        this._headers[name] = data;
        return this;
    }

    private onDataData(chunk: Buffer) {
        this.chunks.push(chunk);
    }
    private onDataEnd() {
        const result = this._result;
        let buf = Buffer.concat(this.chunks);
        this.chunks = [];

        if (this._codePage) {
            if (this._codePage == bufferName) {
                result.buffer = buf;
            }
            else {
                result.text = iconv.encode(iconv.decode(buf, this._codePage), 'utf8').toString();
            }
        }
        else {
            result.text = buf.toString();
        }
        

        if (result.text) {
            try {
                const tt = result.text.toString();
                if (tt.charAt(0) == '{' || tt.charAt(0) == '[') {
                    result.json = JSON.parse(tt);
                }
            }
            catch (e) { }
        }

        this.resultFn(result);
    }
    private onDataError() {
        this.chunks = [];
    }
    private onResult(res: Http.IncomingMessage) {

        //console.log('++onResult');

        const result = this._result = {} as IRequestSimple;

        if (res.statusCode) result.code = res.statusCode;
        if (res.statusMessage) result.status = res.statusMessage;

        let headersList = res.rawHeaders as string[], headers = {} as any;
        for (let i = 0; i < res.rawHeaders.length; i += 2) {
            let key = headersList[i], val = headersList[i + 1];
            if (key == 'Set-Cookie') {
                val = val.split(';')[0];

                if (!headers['Cookie']) headers['Cookie'] = [];
                headers['Cookie'].push(val);

                if (!result.cookie) result.cookie = {};
                let pos = val.indexOf('=');
                if (pos > -1) {
                    result.cookie[val.substr(0, pos)] = val.substr(pos + 1);
                }
            }
            else {
                headers[key] = val;
            }
        }
        if (headers['Cookie']) {
            headers['Cookie'] = headers['Cookie'].join('; ')
        }
        result.headers = headers;

        switch (res.statusCode) {
            case 200:
                res.on('error', this.onDataError);
                res.on('end', this.onDataEnd);
                res.on('data', this.onDataData);
                break;
            case 301:
            case 302:
            case 303:
                let location = '';
                if (headers['Location']) {
                    location = headers['Location'];
                    if (location && location.indexOf('//') == -1) {
                        let url = urlParse(this.url);
                        if (location.charAt(0) == '/') {
                            location = url.protocol + '//' + url.hostname + location;
                            console.log('\tredirect(1)->', location);
                        }
                        else if (location.startsWith('./')) {
                            let pathname = url.pathname || '';
                            location = url.protocol + '//' + url.hostname + pathname.substr(0, pathname.lastIndexOf('/')) + location.substr(1);
                            console.log('\tredirect(2)->', location, url.hostname, url.pathname);
                        }
                        else {
                            location = url.protocol + '//' + url.hostname + url.pathname + location;
                            console.log('\tredirect(3)->', location, url.hostname, url.pathname);
                        }
                    }
                    location = location.replace(/:(80|443)\//, '/');

                }

                result.location = location;

                this.resultFn(result);

                //this.reject({ code: res.statusCode, message: res.statusMessage, location: location, cookie: headers['Cookie'], res: res });
                break;
            default:
                this.resultFn(result);
                //this.reject({ code: res.statusCode, message: res.statusMessage, res: res });
                break;
        }
    }
    private onError(e: Error) {
        console.error('RequestSimple', this.url, e);
        this.resultFn(null);
    }

    then(fn: (data: IRequestSimple | null) => void) {
        this.resultFn = fn;
        return this;
    }
    get() {

        //this.type = 'GET';
        let url = urlParse(this.url);

        if (this._urlParam) {
            let paramNew: any = {};
            if (url.query) paramNew = queryParse(url.query.toString());
            for (let key in this._urlParam) paramNew[key] = this._urlParam[key];

            let link = url.protocol + '//' + url.host + url.pathname + '?' + queryStringify(paramNew) + (url.hash || '');
            url = urlParse(link);
        }


        const request_options = {
            host: url.hostname,
            port: ~~(url.port || (this.url.startsWith('https://') && 443 || 80)),
            path: url.path,
            method: 'GET',

            //headers: Object.assign({}, {
            //    'User-Agent': userAgents.default,
                //Cookie: this._c
                //'Accept': 'text/html,application/xhtml+xm…plication/xml;q=0.9,*/*;q=0.8',
                //'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3'
            //})
            //, this._headers
            
            headers: Object.assign({}, { 
                'User-Agent': userAgents.default, 
                'Accept': 'text/html,application/xhtml+xm…plication/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3' }, this._headers)
        }

        //if (this._cookie) {
        //    (request_options.headers as any)['Cookie'] = this._cookie;
        //}

        //console.log('++++', this._headers);

        if (this.url.startsWith('https://')) {
            Https.request(request_options, this.onResult).on('error', this.onError).end();
        }
        else {
            Http.request(request_options, this.onResult).on('error', this.onError).end();
        }

        console.log('++++');

        //return this.promise();
        return this;
    }

    postJSON(data?: { [s: string]: any }) {
        this.post(data, 'json');
        return this;
    }
    postMultipart(data?: { [s: string]: any }) {
        this.post(data, 'multipart');
        return this;
    }
    post(data?: { [s: string]: any }, type = 'urlencoded' as 'json' | 'urlencoded' | 'multipart') {
        
        let url = urlParse(this.url);

        if (this._urlParam) {
            let paramNew: any = {};
            if (url.query) paramNew = queryParse(url.query.toString());
            for (let key in this._urlParam) paramNew[key] = this._urlParam[key];
            url.path = url.pathname + '?' + queryStringify(paramNew);
        }

        let headers = Object.assign({ 'User-Agent': userAgents.default }, this._headers);

        if (data) {
            for (let key in data) {
                let val = data[key];
                if (val && val.toString().startsWith(filePref)) type = 'multipart';
            }
        }

        let postData: Buffer;
        switch (type) {
            case 'json': {
                headers['Content-Type'] = 'application/json';
                headers['Accept'] = 'application/json, text/javascript, */*; q=0.01';
                postData = new Buffer(JSON.stringify(data));
                break;
            }
            case 'multipart': {
                let dataPost = multipartData(data);
                headers['Content-Type'] = dataPost.type;
                postData = dataPost.body;
                break;
            }
            default:
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
                postData = new Buffer(queryStringify(data));
                break;
        }

        headers['Content-Length'] = postData.length;

        let post_req: Http.ClientRequest
        let request_options = {
            host: url.hostname,
            port: ~~(url.port || (this.url.startsWith('https://') && 443 || 80)),
            path: url.path,
            method: 'POST',
            headers: headers
        };
        if (this.url.startsWith('https://')) {
            post_req = Https.request(request_options, this.onResult).on('error', this.onError);
        }
        else {
            post_req = Http.request(request_options, this.onResult).on('error', this.onError);
        }
        post_req.end(postData);

        return this;
    }

}

class RequestClass<T>{
    private resolve!: (result: T) => void
    private reject: any
    //private type: string
    private link: string
    private param: any
    private flagJSON!: boolean
    private flagOnlyData!: boolean
    private _codePage = ''
    private flagPostJSON!: boolean
    private flagPostMultipart!: boolean
    private _headers: any = {}
    private chunks: Buffer[] = []
    private res: IRequestResult<T> = {} as any
    constructor(link: string, param?: any) {
        this.onDataData = this.onDataData.bind(this);
        this.onDataEnd = this.onDataEnd.bind(this);
        this.onDataError = this.onDataError.bind(this);
        this.onError = this.onError.bind(this);
        this.onResult = this.onResult.bind(this);
        this.link = link;
        this.param = param;
    }
    codePage(codePage: string) {
        this._codePage = codePage;
        return this;
    }
    isJSON() {
        this.flagJSON = true;
        return this;
    }
    onlyData() {
        this.flagOnlyData = true;
        return this;
    }
    private onDataData(chunk: Buffer) {
        this.chunks.push(chunk);
    }
    private onDataEnd() {
        let result: any = null;
        let buf = Buffer.concat(this.chunks);
        let text: any = '';
        if (this._codePage) {
            if (this._codePage == bufferName) {
                text = buf;
            }
            else {
                text = iconv.encode(iconv.decode(buf, this._codePage), 'utf8').toString();
            }
        }
        else {
            text = buf.toString();
        }
        this.chunks = [];

        result = this.res.text = text;

        if (this.flagJSON) {
            try {
                result = this.res.json = JSON.parse(text);
            }
            catch (e) {
                console.log('Request JSON.parse ERROR', text);
            }
        }

        if (!this.flagOnlyData) result = this.res;

        this.resolve(result);
    }
    private onDataError() {
        this.chunks = [];
        this.reject({ code: 0, message: 'onDataError', res: null });
    }
    private onResult(res: Http.IncomingMessage) {

        if (res.statusCode) this.res.code = res.statusCode;
        if (res.statusMessage) this.res.message = res.statusMessage;

        let headersList = res.rawHeaders as string[], headers = {} as any;
        for (let i = 0; i < res.rawHeaders.length; i += 2) {
            let key = headersList[i], val = headersList[i + 1];
            if (key == 'Set-Cookie') {
                val = val.split(';')[0];

                if (!headers['Cookie']) headers['Cookie'] = [];
                headers['Cookie'].push(val);

                if (!this.res.cookie) this.res.cookie = {};
                let pos = val.indexOf('=');
                if (pos > -1) {
                    this.res.cookie[val.substr(0, pos)] = val.substr(pos + 1);
                }
            }
            else {
                headers[key] = val;
            }
        }
        if (headers['Cookie']) {
            headers['Cookie'] = headers['Cookie'].join('; ')
        }
        this.res.headers = headers;

        switch (res.statusCode) {
            case 200:
                res.on('error', this.onDataError);
                res.on('end', this.onDataEnd);
                res.on('data', this.onDataData);
                break;
            case 301:
            case 302:
            case 303:
                let location = '';
                if (headers['Location']) {
                    location = headers['Location'];
                    if (location && location.indexOf('//') == -1) {
                        let url = urlParse(this.link);
                        if (location.charAt(0) == '/') {
                            location = url.protocol + '//' + url.hostname + location;
                            console.log('\tredirect(1)->', location);
                        }
                        else if (location.startsWith('./')) {
                            let pathname = url.pathname || '';
                            location = url.protocol + '//' + url.hostname + pathname.substr(0, pathname.lastIndexOf('/')) + location.substr(1);
                            console.log('\tredirect(2)->', location, url.hostname, url.pathname);
                        }
                        else {
                            location = url.protocol + '//' + url.hostname + url.pathname + location;
                            console.log('\tredirect(3)->', location, url.hostname, url.pathname);
                        }
                    }
                    location = location.replace(/:(80|443)\//, '/');

                }
                //if (headers['cookieText']) {
                //    cookieList = headers['cookieText'];
                //}

                /*
                for (let i = 0; i < headersList.length; i += 2) {
                    switch (headersList[i]) {
                        case 'Location':
                            location = headersList[i + 1];
                            if (location && location.indexOf('//') == -1) {
                                let url = urlParse(this.link);
                                if (location.charAt(0) == '/') {
                                    location = url.protocol + '//' + url.hostname + location;
                                    console.log('\tredirect(1)->', location);
                                }
                                else if (location.startsWith('./')) {
                                    let pathname = url.pathname || '';
                                    location = url.protocol + '//' + url.hostname + pathname.substr(0, pathname.lastIndexOf('/')) + location.substr(1);
                                    console.log('\tredirect(2)->', location, url.hostname, url.pathname);
                                }
                                else {
                                    location = url.protocol + '//' + url.hostname + url.pathname + location;
                                    console.log('\tredirect(3)->', location, url.hostname, url.pathname);
                                }
                            }
                            location = location.replace(/:(80|443)\//, '/');
                            break;
                        case 'Set-Cookie':
                            cookieList.push(headersList[i + 1].split(';')[0]);
                            break;
                    }
                }
                */
                this.reject({ code: res.statusCode, message: res.statusMessage, location: location, cookie: headers['Cookie'], res: res });
                break;
            default:
                this.reject({ code: res.statusCode, message: res.statusMessage, res: res });
                break;
        }
    }
    private onError(e: Error) {
        this.reject(e);
    }
    private promise(): Promise<[IError | null, T]> {
        return new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        }).then(data => [null, data] as any).catch(err => [err, null]);
    }
    setCookie(cookie: string) {
        if (cookie) this._headers.Cookie = cookie;
        return this;
    }
    setHeader(name: string, data: string) {
        this._headers[name] = data;
        return this;
    }
    get() {

        //this.type = 'GET';
        let url = urlParse(this.link);

        if (this.param) {
            let paramNew: any = {};
            if (url.query) paramNew = queryParse(url.query.toString());
            for (let key in this.param) paramNew[key] = this.param[key];

            let link = url.protocol + '//' + url.host + url.pathname + '?' + queryStringify(paramNew) + (url.hash || '');
            url = urlParse(link);
        }


        const request_options = {
            host: url.hostname,
            port: ~~(url.port || (this.link.startsWith('https://') && 443 || 80)),
            path: url.path,
            method: 'GET',
            headers: Object.assign({}, { 'User-Agent': userAgents.default, 'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3' }, this._headers)
            //headers: {
            //    'User-Agent': userAgents.get(),
            //    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
            //'Cookie': "visid_incap_874594=5AAooxPjS+S7FLsmtwHENnthTlkAAAAAQUIPAAAAAAB7w9czC26qezKbuPeppQT8; incap_ses_586_874594=c146An4c62ufU9MOJOQhCA9sTlkAAAAAJ/PeQR9OzT8ERKsaKrQ4WA==; SERVERID=www801; JSESSIONID=AA67A57073393B49D3B2BADA711BABD5.1-214-5; nlbi_874594=XZ1EAsoBfnY1uxAT/BV1eAAAAADZL5ie5gpd3y7hUNYdUGnb; i18next=ru; scs=%7B%22t%22%3A1%7D; inLanding=http%3A%2F%2Fwww.mytoys.ru%2FBABY-born-Baby-Annabell%2FKID%2Fru-mt.to.br01.46%2F; insdrSV=2; rr-VisitorSegment=2%3A2; rrrbt=; rrpvid=992287288889812; rcuid=594e617f9a1c6b50500d40d0; rrpusid=594e617f9a1c6b50500d40d0; rrlpuid=; __tld__=null; dd__lastEventTimestamp=1498309659999; rees46_session_id=a130c950-4f15-4e43-9b95-e4342eb06137; rees46_ab_testing_group=0; rees46_recommended_by=; spUID=14983089832897e45130539.97003664; MS_USER=d1f2c495-524f-4cbb-8131-6e964e088c1a; MS_AUTH=2c2d6451-d8ac-4b68-ba3f-97f9921ae541; MS_CLIENT=df4d5c34-352e-4fa1-b69b-55c57b00aed2; MS_SESS=08fc66f5-b690-4e61-98b4-8efc18f7e166; flocktory-uuid=d9031c5d-d533-4a29-9aeb-9d04af3738d4-0; shownCampCount=%7B%22camps%22%3A%5B%22224%22%5D%7D"
            //}
        }
        //if (this._cookie) {
        //    (request_options.headers as any)['Cookie'] = this._cookie;
        //}

        if (this.link.startsWith('https://')) {
            Https.request(request_options, this.onResult).on('error', this.onError).end();
        }
        else {
            Http.request(request_options, this.onResult).on('error', this.onError).end();
        }

        return this.promise();
    }
    postJSON() {
        this.flagPostJSON = true;
        return this;
    }
    postMultipart() {
        this.flagPostMultipart = true;
        return this;
    }
    post(data?: { [s: string]: any }) {
        //this.type = 'POST';
        let url = urlParse(this.link);

        if (this.param) {
            let paramNew: any = {};
            if (url.query) paramNew = queryParse(url.query.toString());
            for (let key in this.param) paramNew[key] = this.param[key];
            url.path = url.pathname + '?' + queryStringify(paramNew);
        }

        let headers = Object.assign({ 'User-Agent': userAgents.default }, this._headers);

        let flagMultipart = this.flagPostMultipart, flagJSON = this.flagPostJSON;
        if (data) {
            for (let key in data) {
                let val = data[key];
                if (val && val.toString().startsWith(filePref)) flagMultipart = true;
            }
        }

        let postData: Buffer;
        if (flagMultipart) {
            let dataPost = multipartData(data);
            headers['Content-Type'] = dataPost.type;
            postData = dataPost.body;
        }
        else if (flagJSON) {
            headers['Content-Type'] = 'application/json';
            if (this.flagJSON) headers['Accept'] = 'application/json, text/javascript, */*; q=0.01';
            //postData = new Buffer(JSON.stringify(data));
            postData = new Buffer(JSON.stringify(data));
        }
        else {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            postData = new Buffer(queryStringify(data));
        }
        headers['Content-Length'] = postData.length;

        let post_req: Http.ClientRequest
        let request_options = {
            host: url.hostname,
            port: ~~(url.port || (this.link.startsWith('https://') && 443 || 80)),
            path: url.path,
            method: 'POST',
            headers: headers
        };
        if (this.link.startsWith('https://')) {
            post_req = Https.request(request_options, this.onResult).on('error', this.onError);
        }
        else {
            post_req = Http.request(request_options, this.onResult).on('error', this.onError);
        }
        post_req.end(postData);

        return this.promise();
    }
}

export function ReqJSON<T>(link: string, param?: any) {
    return new RequestClass<T>(link, param).onlyData().isJSON();
}

export function RequestHTML(link: string, param?: any) {
    return new RequestClass<string>(link, param).onlyData();
}
export function ReqBuffer(link: string, param?: any) {
    return new RequestClass<Buffer>(link, param).onlyData().codePage(bufferName);
}
export function Request<T>(link: string, param?: any) {
    return new RequestClass<IRequestResult<T>>(link, param);
}


function fileExt(name: string) {
    return name.substr(name.lastIndexOf('.') + 1).toLowerCase();
}
function multipartData(data: any) {
    let mime: { [s: string]: string } = {
        gif: 'image/gif'
        , jpeg: 'image/jpeg'
        , jpg: 'image/jpeg'
        , png: 'image/png'
    };

    let endl = '\r\n';
    let boundary = 'b' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    let body: Buffer[] = [];

    for (let k in data) {
        let value: string = data[k].toString();
        let contentDisposition = '', contentType = '', contentData: Buffer | undefined;
        if (value.startsWith(filePref)) {
            value = value.substr(filePref.length);
            if (fs.existsSync(value)) {
                let name = value.replace(/\\/g, '/').replace(/.*\//, '');
                let ext = fileExt(value);
                let filetype = mime[ext] ? mime[ext] : 'application/octet-stream';
                contentDisposition = 'form-data; name="' + k + '"; filename="' + name + '"';
                contentType = filetype;
                contentData = fs.readFileSync(value);
            }
        }
        else {
            contentDisposition = 'form-data; name="' + k + '"';
            contentType = 'text/plain';
            contentData = new Buffer(value);
        }

        if (contentDisposition && contentData) {
            body.push(new Buffer('--' + boundary + endl));
            body.push(new Buffer('Content-Disposition: ' + contentDisposition + endl));
            body.push(new Buffer('Content-Type: ' + contentType + endl));
            //body.push(new Buffer('Content-Transfer-Encoding: base64' + endl));
            body.push(new Buffer(endl));
            body.push(contentData);
            body.push(new Buffer(endl));
        }
    }
    body.push(new Buffer('--' + boundary + '--'));

    return { body: Buffer.concat(body), type: 'multipart/form-data; boundary=' + boundary };
}


// /usr/local/bin/node /usr/local/www/app.back/script/request.js "http://www.youtube.com/feeds/videos.xml?channel_id=UCp0H6PoZBUPWFKPECiQxxhQ"
if (!module.parent && process.argv.length == 3 && /^https?:\/\//.test(process.argv[2])) {
    RequestHTML(process.argv[2]).get()
        .then((html) => {
            console.log(html);
            process.exit(0);
        })
        .catch(() => {
            console.log('');
            process.exit(0);
        })
        ;
}