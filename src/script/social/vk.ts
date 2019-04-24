

import * as fs from "fs";

import * as fw from "../../fw";
import * as socialAdd from "./add";
import { ReqJSON } from "../request";

const cache_file = fw.pathType.memory + 'toy/social_vk.json';

export const data = dataObj;
export const send = asyncSendData;

const request_uri = 'https://api.vk.com/method/';
const access_token = '';


const album_id = 0;
const group_id = 0;


if (process.argv.length == 3) {
    switch (process.argv[2]) {
        case 'send':
            asyncSendData();
            break;
        case 'sendTest':
            //send_data_test();
            break;
        default: break;
    }
}




interface IFileLine {
    src: string
    title: string
}

interface IFileSave {
    server: number
    photos_list: { photo: string }[]
    aid: number
    hash: string
    access_token: string
    caption: string
}

interface IFilePost {
    response: {
        upload_url: string
        aid: number
        mid: number
    }
    error: {
        error_code: number
        error_msg: string
        request_params: any
    }
}

function onFinish() {
    process.exit(0);
}

async function asyncSendPhoto(dataVK: socialAdd.IDataFileLine) {
    let photos: string[] = [];
    if (dataVK.files) {
        for (let line of dataVK.files) {
            let pathToFile = fw.pathType.file + dataVK.host + '/file/' + line.src.replace('/', '/600/');
            if (!fs.existsSync(pathToFile)) {
                continue;
            }

            let fileCaption = line.title;


            // https://vk.com/dev/photos.getUploadServer
            let [err1, resUplServ] = await ReqJSON<IFilePost>(request_uri + 'photos.getUploadServer', { access_token: access_token, album_id: album_id }).get();
            if (err1) console.error('ERROR photos.getUploadServer', pathToFile, err1);
            
            if (!resUplServ || !resUplServ.response) continue;
    
            // https://new.vk.com/dev/upload_files
            let [err2, resFileUpload] = await ReqJSON<IFileSave>(resUplServ.response.upload_url).post({ file1: 'file:' + pathToFile });
            if (err2) console.error('ERROR fileSave', pathToFile, err2);
            if (!resFileUpload) continue;
    
            // https://vk.com/dev/photos.save
            resFileUpload.access_token = access_token;
            resFileUpload.caption = fileCaption.length > 500 ? (fileCaption.substr(0, 500) + '...') : fileCaption;

            let [err3, resFileFinish] = await ReqJSON<any>(request_uri + 'photos.save', resFileUpload).get();
            if (err3) console.error('ERROR photos.save', pathToFile, err3);
            if (resFileFinish.response && resFileFinish.response[0]) {
                photos.push(resFileFinish.response[0].id);
            }
            
        }
    }
    return photos;
}


async function asyncSendData() {

    if (!fs.existsSync(cache_file)) {
        onFinish();
        return;
    }
    let dataCache = fw.loadSyncJson(cache_file, []);
    let dataVK: socialAdd.IDataFileLine = dataCache.length ? dataCache.shift() : null;
    if (dataVK === null || !dataVK.files) {
        onFinish();
        return;
    }

    let photos = await asyncSendPhoto(dataVK);

    interface IwallPost {
        [s:string]:string|number
        owner_id: number
        friends_only: number
        attachments: any
        message: string
        access_token: string
    }
    let dataWall = {
        owner_id: group_id,
        message: dataVK.content + '\n' + dataVK.link,
        access_token: access_token
    } as IwallPost;
    if (photos.length && dataVK.link) {
        photos.push(dataVK.link);
        dataWall.attachments = photos.join(',');
    }

    // https://vk.com/dev/wall.post
    let [err, resWallPost] = await ReqJSON<any>(request_uri + 'wall.post').post(dataWall);
    if (err) console.error('ERR wall.post', err);
    if (resWallPost && resWallPost.response && resWallPost.response.post_id) {
        if (dataCache.length) {
            fw.saveSyncJson(cache_file, dataCache);
        }
        else {
            fs.unlinkSync(cache_file);
        }
    }
    
    onFinish();
}


function dataObj(host: string, tree: fw.ITree, wordRepl: socialAdd.IWordReplLine[], keywords: any, node: fw.INode, outFile: socialAdd.IDataFileLine[]) {

    let fileList: IFileLine[] = [];
    node.attach.forEach(function (line) {
        if (line.src && line.w && line.h && line.content && !line.flagComment && (line.flagCatalog || line.flagNode)) {
            fileList.push({ src: line.src, title: fw.textClean(fw.textOnly(line.content)) });
        }
    });
    if (!fileList.length) {
        node.attach.forEach(function (line) {
            if (line.src && line.w && line.h && !line.flagComment && (line.flagCatalog || line.flagNode)) {
                fileList.push({ src: line.src, title: '' });
            }
        });
    }
    fileList.sort(function (a, b) { return b.title.length - a.title.length });
    fileList = fileList.slice(0, 4);
    fileList.forEach(function (line) {
        if (line.title) {
            wordRepl.forEach(function (kw) {
                if (line.title.search(kw.r) > -1) {
                    line.title = line.title.replace(kw.r, function (a0, a1, a2) {
                        return (a1.replace('#', '')) + kw.s + (a2.replace('®', ''));
                    });
                }
            });
        }
    });

    let data = {
        host: host,
        content: fw.textClean(fw.textOnly(node.descr)),
        link: 'http://' + host + fw.getNodePath(tree, node.head.idn, 'vk-1'),
        files: fileList
    };

    outFile.push(data);
}