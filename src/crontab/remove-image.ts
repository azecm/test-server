
import * as fs from 'fs';
import * as fw from '../fw';

// node /usr/local/www/app.back/crontab/remove-image.js

function start() {
    let fullSize = 0;
    for (let hostname of fs.readdirSync(fw.pathType.file)) {
        let pathHost = fw.pathType.file + hostname + '/file/';
        for (let dirname of fs.readdirSync(pathHost)) {
            if (!(/^\d{4}$/.test(dirname))) continue;
            let pathDir = pathHost + dirname + '/';
            for (let filename of fs.readdirSync(pathDir)) {
                if (/^(150|250|600)$/.test(filename)) continue;
                let pathFile = pathDir + filename;
                let stat = fs.lstatSync(pathFile);
                if (stat.isFile()) {
                    fullSize += stat.size;
                    fs.unlinkSync(pathFile);
                }
                else {
                    console.log('ERROR - is not file');
                }
            }
        }
    }

    console.log(Math.round(fullSize/(1024*1024*1024)*10)/10)
    
}
start();