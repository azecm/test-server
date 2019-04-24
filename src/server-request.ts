import * as fs from "fs";
import * as http from "http";
import * as querystring from "querystring";

import {config} from "./config";
import * as fw from "./fw";

const reSCP = /csp\-report/;

const contentTypeDict: { [s: string]: string } = {
    html: "text/html; charset=UTF-8",
    text: "text/plain; charset=UTF-8",
    stream: "application/octet-stream",
    xml: "text/xml; charset=UTF-8",
    json: "application/json; charset=UTF-8",
    javascript: "application/javascript; charset=UTF-8",
    attachment: ""
};

class PostData {
    private chunks: Buffer[] = []
    private resolve!: (res?: any) => void
    private reject!: (err: any) => void
    constructor(request: http.IncomingMessage) {
        this.error = this.error.bind(this);
        this.data = this.data.bind(this);
        this.end = this.end.bind(this);

        request.on("error", this.error);
        request.on("data", this.data);
        request.on("end", this.end);
    }
    then(resolve: (res?: any) => void) {
        this.resolve = resolve;
        return this;
    }
    catch(reject: (err: any) => void) {
        this.reject = reject;
        return this;
    }
    private error(err: Error) {
        this.reject && (this.reject(err));
        this.destroy();
    }
    private data(chunk: Buffer) {
        this.chunks.push(chunk);
    }
    private end() {
        this.resolve && (this.resolve(Buffer.concat(this.chunks).toString()));
        this.destroy();
    }
    private destroy() {
        this.chunks = void(0) as any;
    }
}


export class ServerRequest {
    host: string
    ip: string
    ifModifiedSince: string
    port: number
    path: string
    query: string
    pathlist: string[]
    browser: string
    referrer: string
    browserLine: string
    method: string
    type: string
    body: string
    devnet: boolean
    flagAnswer: boolean
    flagMail: boolean
    //tree: fw.ITree
    //user: fw.IUser
    onKey!: string
    session!: fw.Session
    responce: http.ServerResponse
    request: http.IncomingMessage
    //sessionEnd: () => { }
    maxAge!: number
    modified!: Date
    cookieSet!: string[]
    timeStart: number
    //destroy: () => void

    constructor(req: http.IncomingMessage, res: http.ServerResponse) {
        this.timeStart = new Date().getTime();
        this.responce = res;
        this.request = req;
        this.host = req.headers["host"] as string || "";
        this.ip = req.headers["remote-addr"] as string || "";
        this.ifModifiedSince = req.headers["if-modified-since"] as string || "";
        this.path = req.url||'';
        this.browser = req.headers["user-agent"] as string || "";
        this.referrer = req.headers["referer"] as string || "";
        this.port = 80;
        this.query = "";
        // +"|"+(req.headers["accept-encoding"]||"").replace(/sdch/i, "")
        this.browserLine = ((req.headers["user-agent"] || "") + "|" + (req.headers["accept-language"] || "")).replace(/[^\w|]/g, "").replace(/[\d]/g, "");
        this.method = (req.method||'').toLowerCase()
        this.type = req.headers["content-type"] || "";
        this.body = req.headers["x-file"] as string || "";
        this.devnet = config.adminsubnet.test(req.headers["remote-addr"] as string || "");
        
        //this.tree = null;
        //this.session = null;

        this.flagAnswer = false;
        this.flagMail = false;

        //this.maxAge = null;
        //this.modified = null;
        //this.cookieSet = null;

        let pos = this.host.indexOf(":");
        if (pos > -1) {
            this.port = parseInt(this.host.slice(pos + 1), 10);
            this.host = this.host.substr(0, pos);
        }
        pos = this.path.indexOf("?");
        if (pos > -1) {
            this.query = this.path.slice(pos + 1);
            this.path = this.path.substr(0, pos);

            try { this.query = decodeURIComponent(this.query) }
            catch (e) { }

        }
        let pathlist = this.pathlist = this.path.split("/");

        pos = pathlist.indexOf('on');
        if (pos > -1) {
            if (pathlist[pos + 1]) {
                this.onKey = pathlist[pos + 1];
                pathlist.splice(pos + 1, 1);
            }
        }


        this.dataGet = this.dataGet.bind(this);
        this.dataPost = this.dataPost.bind(this);
        this.end = this.end.bind(this);
        this.endRequest = this.endRequest.bind(this);

        this.end304 = this.end304.bind(this);
        this.end404 = this.end404.bind(this);
        this.endRedirect = this.endRedirect.bind(this);
        this.endText = this.endText.bind(this);
        this.endJson = this.endJson.bind(this);
        this.endHtml = this.endHtml.bind(this);
        this.endFile = this.endFile.bind(this);

    }

    //query?: string | Buffer
    private postData(callback: (s?: string) => void) {
        new PostData(this.request)
            .then(callback)
            .catch((err) => {
                callback();
                fw.err(fw.logDate(), "request postData err", this.method, this.host + this.path, this.query, err);
            });
    }
    //getData(callPostFn?: (query?: any) => void, kind?: string) {
    dataGet(kind?: string) {
        // this.method == 'get'
        let query: any = null;
        if (typeof (kind) == "string") {
            query = this.query;
        }
        else {
            let type = this.type.split(";")[0];
            switch (type) {
                case "application/json":
                    try {
                        query = JSON.parse(this.query);
                    } catch (e) {
                        console.error(fw.logDate(), "ERROR GET: JSON.parse " + this.query);
                    }
                    break;
                case "application/x-www-form-urlencoded":
                    try {
                        query = querystring.parse(this.query);
                    } catch (e) {
                        console.error("ERROR GET: querystring.pars " + this.query);
                    }
                    break;
            }
        }
        return query;
    }
    //IPost
    dataPostType<T>(kind?: string): Promise<[string | null, T]> {
        return this.dataPost(kind);
    }
    dataPost(kind?: string):Promise<[string|null, any]> {
        // this.method == 'post'
        return new Promise((resolve, reject) => {
            // kind = text|file|buffer
            let query: any;
            if (typeof (kind) == "string") {
                switch (kind) {
                    case "text":
                        this.postData((query) => {
                            //query = buffer.toString("utf-8");
                            if (query && !reSCP.test(query)) {
                                try {
                                    query = decodeURIComponent(query);
                                }
                                catch (e) {
                                    reject(e);
                                    //console.error("worker.js request.getData", query, e);
                                }
                            }
                            resolve(query);
                        });
                        break;
                    case "buffer":
                        this.postData((buffer) => {
                            resolve(buffer);
                        });
                        break;
                    default:
                        break;
                }
            }
            else {
                let flagOk: boolean, path: string, writeStream: fs.WriteStream;
                let type = this.type.split(";")[0];
                switch (type) {
                    case "application/json":
                        this.postData((data) => {
                            try {
                                // todo надо единообразить данные
                                if (data) {
                                    if (data.charAt(0) == "%") {
                                        data = decodeURIComponent(data);
                                    }
                                    query = JSON.parse(data);
                                }
                            } catch (e) {
                                reject(e);
                                //console.error("ERROR POST: JSON.parse " + data.length + " " + e + "\n" + data);
                            }
                            resolve(query);
                        });
                        break;
                    case "application/x-www-form-urlencoded":
                        this.postData((data) => {
                            try {
                                if (data) {
                                    if (data.indexOf("=") > -1) {
                                        query = querystring.parse(data);
                                    }
                                    else {
                                        query = decodeURIComponent(data);
                                    }
                                }
                            } catch (e) {
                                reject(e);
                                //console.error("ERROR POST: querystring.parse " + (data.length < 1000 ? data : data.length));
                            }
                            resolve(query);
                        });
                        break;
                    case "multipart/form-data":
                        flagOk = true;
                        path = fw.codeAlpha(fw.now() + this.browser + this.ip);
                        writeStream = fs.createWriteStream(fw.pathType.temp + path + ".tmp", { encoding: "binary" });
                        writeStream.on("error", (err: string) => {
                            //console.error("multipart/form-data", err);
                            flagOk = false;
                            this.endRequest(400, "text", "");
                            reject(err);
                        });
                        this.request.pipe(writeStream);
                        this.request.on("end", () => {
                            if (flagOk) {
                                resolve(path);
                            }
                        });
                        break;
                    default:
                        resolve();
                        break;
                }
            }
        }).then(data => [null, data] as [string | null, any]).catch(err => [err, null] as [string | null, any])
    }
    end304(text?: string) {
        this.endRequest(304, "text", text);
    }
    end404(text?: string) {
        this.endRequest(404, "text", text);
    }
    endRedirect(status: number, location: string) {
        // status == 301 || status == 302 || status == 303 || status == 307
        if (location.indexOf("://") == -1) {
            location = "http://" + location;
        }
        this.endRequest(status, "text", location, { Location: location });
    }
    endText(text?: string) {
        this.endRequest(200, "text", text || "");
    }
    endJson(data: Object) {
        this.endRequest(200, "json", JSON.stringify(data));
    }
    endHtml(textHtml?: string) {
        this.endRequest(200, "html", textHtml || "");
    }
    endFile(path: string, type: string) {
        fs.exists(path, (exists) => {
            if (exists) {
                this.endRequest(200, "stream/" + type, path);
            }
            else {
                this.end404();
            }
        });
    }
    end(status: number, type: string, content: any, header?: IDict<any>) {
        this.endRequest(status, type, content, header);
    }
    endRequest(status: number, type: string, content: any, header?: IDict<any>) {
        if (this.flagAnswer) return;
        this.flagAnswer = true;

        let i: any, responce = this.responce;
        if (header) for (i in header) responce.setHeader(i, header[i]);


        if (type.startsWith("stream/")) {
            type = type.substr(7);
            responce.setHeader("Content-Type", contentTypeDict[type]);
            //скачка mp3
            //Content-Disposition: filename="music.mp3"
            //Content-Disposition: attachment; filename="my_mp3_filename.MP3"
            //Content-Type "application/force-download"
            responce.statusCode = status;
            fs.stat(content, (err, stat) => {
                responce.setHeader("Content-Length", stat.size.toString());
                fs.createReadStream(content).pipe(responce);
            });
        }
        else {
            let buffer = new Buffer(content || "", "utf-8");
            //buffer.write("Hello", "utf-8");
            //buffer.toString("utf-8");
            if (buffer.length) {
                responce.setHeader("Content-Length", buffer.length.toString());
                responce.setHeader("Content-Type", contentTypeDict[type]);
            }
            else {
                responce.setHeader("Content-Length", 0..toString());
                responce.setHeader("Content-Type", contentTypeDict["text"]);
            }

            if (this.maxAge) {
                let date = new Date();
                //, private
                responce.setHeader("Cache-Control", "max-age=" + this.maxAge);
                responce.setHeader("Expires", new Date(date.getTime() + this.maxAge * 1000).toUTCString());
                if (!this.modified) {
                    responce.setHeader("Last-Modified", date.toUTCString());
                }
            }
            if (this.modified) {
                responce.setHeader("Last-Modified", this.modified.toUTCString());
            }


            if (this.cookieSet) {
                i = this.cookieSet.length;
                while (i--) {
                    responce.setHeader("Set-Cookie", this.cookieSet[i]);
                }
            }

            responce.statusCode = status;
            responce.end(buffer);
        }

        let long = new Date().getTime() - this.timeStart;
        console.log(
            fw.logDate()
            , status
            , long
            , this.request.method
            , this.host + this.request.url
            , this.ip
            , (this.session && this.session.data && this.session.data.idu) || "гость"
        );

        if (long > 1000) {
            console.error(fw.logDate(), "долгий запрос", long, this.method, this.host + this.path, this.query);
        }

        //this.destroy();
        //process.send("reload");
    }
    //private destroy() {
        //после ответа еще много чего можно сделать
        //for (let key in this) (this as any)[key] = void(0);
    //}
}