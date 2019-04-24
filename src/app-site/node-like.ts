
import * as fw from "../fw";

new fw.Spawn().data(process.stdin, start);

interface ILikeData {
    host: string
    likeNum: number
    idn: number
    idnPath: string
    flagIdf: boolean
}
function start(data: ILikeData) {
    let reLike = /<p[^>]+class=\"like\"[^>]*>/gi;
    //let reIdfLike = /<figure[^>]+data\-idf=\"like\"[^>]*>/gi;
    let reLikeData = /data-like=\"(\d+)\"/i;

    let dataFile = fw.loadSyncNode(data.host, data.idn);

    if (!dataFile) return;

    if (data.flagIdf) {
        let resLike = 0;
        for(const attachData of dataFile.attach){
            if (attachData.idf == data.likeNum) {
                !attachData.like && (attachData.like = 0);
                resLike = ++attachData.like;
            }
        }
        fw.saveSyncNode(data.host, dataFile);
        let text = fw.fileCacheHtml(data.host, data.idnPath);
        if (text && resLike) {
            let reIdfLike = new RegExp('<figure[^>]+data\-idf=\"' + data.likeNum + '\"[^>]*>');
            text = text.replace(reIdfLike, '<figure data-idf="' + data.likeNum + '" data-like="' + resLike + '"' + '>');
            fw.fileCacheHtml(data.host, data.idnPath, text);
        }
    }
    else {

        let counter = 0;
        let i = 0;
        dataFile.content = dataFile.content.replace(reLike, function (line) {
            if (i == data.likeNum) {
                let lineData = line.match(reLikeData);
                if (lineData) {
                    counter = parseInt(lineData[1], 10);
                }
                counter++;
                line = '<p class="like" data-like="' + counter + '">';
            }
            i++;
            return line;
        });

        fw.saveSyncNode(data.host, dataFile);
        if (counter) {
            let text = fw.fileCacheHtml(data.host, data.idnPath);
            if (text) {
                let i = 0;
                text = text.replace(reLike, function (line) {
                    if (i == data.likeNum) {
                        line = '<p class="like" data-like="' + counter + '">';
                    }
                    i++;
                    return line;
                });
                fw.fileCacheHtml(data.host, data.idnPath, text);
            }
            else {
                fw.err('app-site/node-like.js: not read - ', data.idnPath);
            }
        }
    }
}
