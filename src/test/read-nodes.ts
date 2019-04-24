
import * as fw from '../fw';
import * as fs from 'fs';

// node /usr/local/www/app.back/test/read-nodes.js


function start() {

    const dirDom = '/usr/local/www/data/domain/';
    
    for (const hostName of fs.readdirSync(dirDom)) {
        if (hostName == 'bbb.hnh.ru') continue;
        for (const n of fw.loadDirNodeGen(hostName)) {
            if (!n) continue;
            const h = n.head;
            let f = true;
            if (h) {

                if (h.flagBlock && typeof (h.flagBlock) != 'boolean') f = false;
                if (h.flagFolder && typeof (h.flagFolder) != 'boolean') f = false;
                if (h.flagValid && typeof (h.flagValid) != 'boolean') f = false;
                if (h.flagOpenLink && typeof (h.flagOpenLink) != 'boolean') f = false;

                if (h.flagBlock) h.flagBlock = true as any;
                if (h.flagFolder) h.flagFolder = true as any;
                if (h.flagValid) h.flagValid = true as any;
                if (h.flagOpenLink) h.flagOpenLink = true as any;

                if (h.flagBlock === 0 as any) delete (h.flagBlock);
                if (h.flagFolder === 0 as any) delete (h.flagFolder);
                if (h.flagValid === 0 as any) delete (h.flagValid);
                if (h.flagOpenLink === 0 as any) delete (h.flagOpenLink);

            }
            const at = n.attach;
            if (at) {
                for (const a of at) {
                    if (a.flagCatalog && typeof (a.flagCatalog) != 'boolean') f = false;
                    if (a.flagComment && typeof (a.flagComment) != 'boolean') f = false;
                    if (a.flagMark && typeof (a.flagMark) != 'boolean') f = false;
                    if (a.flagNode && typeof (a.flagNode) != 'boolean') f = false;

                    if (a.flagCatalog) a.flagCatalog = true as any;
                    if (a.flagComment) a.flagComment = true as any;
                    if (a.flagMark) a.flagMark = true as any;
                    if (a.flagNode) a.flagNode = true as any;

                    if (a.flagCatalog === 0 as any) delete (a.flagCatalog);
                    if (a.flagComment === 0 as any) delete (a.flagComment);
                    if (a.flagMark === 0 as any) delete (a.flagMark);
                    if (a.flagNode === 0 as any) delete (a.flagNode);
                }
            }
            if(!f){
                console.log(hostName, n.head.idn);
            }
            //fw.saveSyncNode(hostName, n);
        }
    }


}

start();