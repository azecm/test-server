import * as fs from "fs";
import * as fw from "../../fw";


// node --use_strict /usr/local/www/app.back/app-site/helper/rename.js
(function () {

    scanDirAndRename(fw.pathType.memory);

    function scanDirAndRename(path: string) {
        for (let name of fs.readdirSync(path)) {
            let pathName = path + name;
            if (fs.statSync(pathName).isDirectory()) {
                scanDirAndRename(pathName + '/');
            }
            else {
                if (pathName.endsWith('.js')) {
                    fs.renameSync(pathName, pathName + 'on');
                    console.log(pathName);
                }
            }
        }
    }
})();