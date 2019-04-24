import * as fs from "fs";


export function fileCopySync(srcFile: string, destFile: string) {
    // https://www.npmjs.com/package/fs.extra

    let BUF_LENGTH = 64 * 1024
    let _buff = new Buffer(BUF_LENGTH)

    let fdr = fs.openSync(srcFile, 'r', 0)
    let stat = fs.fstatSync(fdr)
    let fdw = fs.openSync(destFile, 'w', stat.mode)
    let bytesRead = 1
    let pos = 0

    while (bytesRead > 0) {
        bytesRead = fs.readSync(fdr, _buff, 0, BUF_LENGTH, pos)
        fs.writeSync(fdw, _buff, 0, bytesRead)
        pos += bytesRead
    }

    fs.closeSync(fdr)
    fs.closeSync(fdw)
}


export function readJSON(path: string) {
    let text = '';
    if (fs.existsSync(path)) {
        text = fs.readFileSync(path, { encoding: 'utf8' });

        // utf8-sig
        if (text.charAt(0) === '\uFEFF') text = text.substr(1);

        // комментарии
        const reComment = /\n\s*\/\/[^\n]*(\n)/;
        while (reComment.test(text)) {
            text = text.replace(/\n\s*\/\/[^\n]*(\n)/g, '$1');
        }
    }

    return text ? JSON.parse(text) : null;
}