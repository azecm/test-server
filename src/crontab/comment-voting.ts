import * as fw from "../fw";
import * as tracker from "../app-site/tracker";
import { RedisClass } from "../promise/redis";

(async function () {
    // если из командной строки
    if (process.argv.length > 1 && process.argv[1].endsWith('/comment-voting.js'))
        await asyncStart();
})();

export async function asyncStart(isDayEnd?:boolean) {
    for (let host of fw.getHosts()) 
        await asyncStartHost(host, isDayEnd);
}

async function asyncStartHost(host: string, isDayEnd?: boolean) {

    const redis = new RedisClass();
    let [errCon] = await redis.connect('/tmp/redis.sock');
    if (errCon) throw (__filename + '::startHost::redis.connect - ' + errCon);

    let redisKey = fw.redisKeyCommentVoting(host);

    let [err, list] = await redis.smembers(redisKey);
    if (err !== null) throw (__filename + '::startHost::redis.smembers - ' + err);

    [err] = await redis.del(redisKey);
    console.error('comment-voting', redisKey, err, list);
    if (err !== null) throw (__filename + '::startHost::redis.del - ' + err);

    if (isDayEnd) {
        //fw.log('dayEnd', fw.redisKeyCommentDayVoting(host));
        let [err] = await redis.del(fw.redisKeyCommentDayVoting(host));
        if (err !== null) throw (__filename + '::startHost::redis.del(isDayEnd) - ' + err);
    }
        
    await redis.quit();

    if (!list.length) return;

    let data = {} as IDict<IDict<number>>;
    for (let line of list) {
        let lineData = line.split(':');
        let idn = lineData[0], idf = lineData[1];
        if (!data[idn]) data[idn] = {};
        if (!data[idn][idf]) data[idn][idf] = 0;
        data[idn][idf]++;
    }

    //fw.log('voting',data);

    for (let idn in data) {
        let node = fw.loadSyncNode(host, ~~idn);
        if (!node) continue;
        let idfList = Object.keys(data[idn]).map(v => ~~v);
        for (let attach of node.attach) {
            if (idfList.indexOf(attach.idf) == -1) continue;
            attach.like = (attach.like || 0) + data[idn][attach.idf];
        }
        fw.saveSyncNode(host, node);
        tracker.addMark(host, idn);
    }
}