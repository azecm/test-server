


import * as fs from "fs";
import * as fw from "../../fw";
import { HTMLDoc } from "../../fw-dom";

import * as socialAdd from "./add";

// https://www.npmjs.com/package/twitter


const OAuth = require('oauth').OAuth;

const consumer_key = ''
const consumer_secret = ''

const access_token = ''
const access_token_secret = ''


const cache_file = fw.pathType.memory + '';

export const data = dataObj;
export const send = send_data;


if (process.argv.length == 3) {
    switch (process.argv[2]) {
        case 'send':
            send_data();
            break;
        default: break;
    }
}


function send_data() {

    if (fs.existsSync(cache_file)) {
        let data = fw.loadSyncJson(cache_file, []);
        if (data.length) {
            let dataSend = data.shift();
            if (data.length) {
                fw.saveSyncJson(cache_file, data);
            }
            else {
                fs.unlinkSync(cache_file);
            }
            prepare(dataSend.host, dataSend.text, dataSend.src);
        }
    }


    function prepare(host: string, text: string, media: string) {
        // https://github.com/ciaranj/node-oauth
        let oauth = new OAuth(
            'https://api.twitter.com/oauth/request_token',
            'https://api.twitter.com/oauth/access_token',
            consumer_key,
            consumer_secret,
            '1.0A',
            null,
            'HMAC-SHA1');


        if (media) {
            // https://dev.twitter.com/rest/reference/post/media/upload

            let url = 'https://upload.twitter.com/1.1/media/upload.json';
            let postData = socialAdd.multipartData2({ media_data: fw.pathType.file + host + '/file/' + media.replace('/', '/600/') });
            oauth.post(url, access_token, access_token_secret, postData.body, postData.type, function (e: any, data: any, res: any) {
                if (e) console.error(e);
                data = fw.jsonObj(data);
                if (data && data.media_id) {
                    update({ status: text, media_ids: [data.media_id_string] });
                }
                else {
                    console.error('error twitter Media', text, media);
                }
            });

        }
        else {
            update({ status: text });
        }

        function update(post_body: any) {
            // https://dev.twitter.com/rest/reference/post/statuses/update
            let post_content_type: any = null;
            let url = 'https://api.twitter.com/1.1/statuses/update.json';
            oauth.post(url, access_token, access_token_secret, post_body, post_content_type, function (e: any, data: any, res: any) {
                if (e) console.error(e);
                data = fw.jsonObj(data);
                if (data && data.created_at) {
                    //console.log(data);
                }
                else {
                    console.error('error twitter Update', host, text, media);
                }
                //console.log(require('util').inspect(data));
            });
        }
    }
}


function dataObj(host: string, tree: fw.ITree, wordRepl: socialAdd.IWordReplLine[], keywords: socialAdd.IWordReplLine[], node: fw.INode, outFile: socialAdd.IDataFileLine[]) {

    let len_full = 140;
    let len_link = 22;
    let len_media = 23;

    let len_message_with_media = len_full + 1 - len_media;
    let len_message_with_link_nl = len_full + 1 - len_link - 1;
    let len_message_with_link_media = len_full + 1 - len_link - len_media;
    let len_message_with_link_media_nl = len_full + 1 - len_link - len_media - 1;

    let idn = node.head.idn;

    // { text: string, link?: string, src?: string, weight?: number, host?:string}
    let testAdd: socialAdd.IDataFileLine[] = [];
    let h1 = new HTMLDoc(node.content).firstByTag('h1');
    if (h1) {
        let text = fw.textClean(h1.toText());
        if (text.length < len_full) {
            if (text.length < len_message_with_link_nl) {
                let link = '\nhttp://' + host + fw.getNodePath(tree, idn, 'twitter-1');
                if (text.length < len_message_with_link_media_nl) {
                    let img = new HTMLDoc(node.descr).firstByTag('img');
                    if (img) {
                        testAdd.push({ text: text, link: link, src: fw.imgKey(img.get('src')||'').key });
                    }
                    else {
                        testAdd.push({ text: text, link: link });
                    }
                }
                else {
                    testAdd.push({ text: text, link: link });
                }
            }
            else {
                testAdd.push({ text: text });
            }
        }
    }


    node.attach.forEach(function (attach) {
        if (Array.isArray(attach.src) && !attach.flagComment && attach.content) {
            let text = fw.textClean(fw.textOnly(attach.content));
            if (text.length > 20 && text.length < len_message_with_media) {
                let link: string | undefined;
                if (text.length < len_message_with_link_media) {
                    link = 'http://' + host + fw.getNodePath(tree, idn, 'twitter-2');
                    if (text.length < len_message_with_link_media_nl) {
                        link = '\n' + link;
                    }
                }
                if (link)
                    testAdd.push({ src: attach.src, text: text, link: link });
            }
        }
    });



    for (let i = 0; i < testAdd.length; i++) {
        let counter = 0;
        // keywords
        wordRepl.forEach(function (kw) {
            let text = testAdd[i].text;
            if (text)
                counter += text.search(kw.r) > -1 ? 1 : 0;
        });
        if (testAdd[i].src) {
            counter++;
        }
        let text = testAdd[i].text;
        if (text)
            testAdd[i].weight = text.length + counter * 100;
    }


    testAdd.sort(function (a, b) {
        return (b.weight || 0) - (a.weight || 0);
    });

    testAdd.slice(0, 2).forEach(function (data) {
        delete (data.weight);
        wordRepl.forEach(function (kw) {
            if (data.text && data.text.search(kw.r) > -1) {
                data.text = data.text.replace(kw.r, '$1' + kw.s + '$2');
            }
        });
        keywords.forEach(function (kw) {
            if (data.text && data.text.indexOf(kw.s) == -1 && (kw.s + ' ' + data.text).length < len_message_with_link_media_nl) {
                data.text = kw.s + ' ' + data.text;
            }
        });
        if (data.link) {
            data.text += data.link;
            delete (data.link);
        }

        data.host = host;
        outFile.push(data);
    });
}
