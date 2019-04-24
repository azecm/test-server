import * as fw from "../../fw";
import { HTMLDoc } from '../../fw-dom';
// import { HTMLDoc, Elem, E, IBaseElem, P, Div, Span, Meta, Link, OL, UL, LI, A, BR, Time, Img, Canvas, Figure, Figcaption } from "../fw-dom";

// node /usr/local/www/app.back/app-site/helper/find-data.js

function getList() {
    const hosts = fw.getHosts();
    const hostGet = process.argv[2];
    return hosts.indexOf(hostGet) > -1 ? [hostGet] : hosts;
}

function find(host:string) {
    for (let data of fw.loadDirNodeGen(host)) {
        if (!data.content) continue;
        let flag = false;
        const doc = new HTMLDoc(data.content);
        for (let el of doc.find(null, 'data-type', 'slideshow', true)) {
            el.removeAttr('data-param');
            console.log(data.head.idn, el.toHtml());
            flag = true;
        }
        if (flag) {
            data.content = doc.htmlBody();
            //fw.saveSyncNode(host, data);
        }
    }
}

function start() {
    for (let host of getList()) {
        console.log(host);
        find(host);
    }
}

start();