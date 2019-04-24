
import * as fw from "../fw";
import * as tracker from "./tracker";

if (!module.parent) {
    new fw.Spawn().data(process.stdin, start);
} 

interface ITestData {
    host: string
    src: string
    v1: number
    v2: number
    idn: number
    //path: string
}
function start(data: ITestData) {
    let dataFile = fw.loadSyncNode(data.host, data.idn);
    if (dataFile) {
        //17-23 (0)
        let reData = new RegExp('>' + data.v1 + '\\-' + data.v2 + '\\s\\((\\d+)\\)');

        let obj: { content: string } | undefined;
        if (data.src) {
            for (let attach of dataFile.attach) {
                if (attach.src == data.src) obj = attach as any;
            }
        }
        else {
            obj = dataFile;
        }

        if (obj) {
            obj.content = obj.content.replace(reData, (a, b) => {
                b = parseInt(b, 10) + 1;
                return '>' + data.v1 + '-' + data.v2 + ' ' + '(' + b + ')';
            });
            fw.saveSyncNode(data.host, dataFile);
            tracker.addMark(data.host, data.idn);
        }
    }
}


