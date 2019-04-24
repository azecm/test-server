
import * as fw from "../../fw";
import { RedisClass } from "../../promise/redis";

// node /usr/local/www/app.back/app-site/helper/user.js update www.toybytoy.com

(async function () {
    if (process.argv.length < 3) return;
    const cmd = process.argv[2], host = process.argv[3];
    switch (cmd) {
        case 'update': await asyncUpdate(host); break;
        case 'updateAll': await asyncUpdateAll(); break;
        case 'test': await asyncTest(host, process.argv[4]); break;
    }
})();

async function asyncTest(host:string, param:string) {
    fw.redisConnect();
    console.log(await fw.redisUserId(host, param), await fw.redisUserId(host, param, true));
    fw.redisQuit();

    //const redis = new RedisClass();
    //await redis.connect('/tmp/redis.sock');
    //console.log(await redis.hgetall(fw.redisKeyUser(host)))
    //await redis.quit();
}

async function asyncUpdateAll() {
    let timer = new Date().getTime();
    for (let host of fw.getHosts()) {
        await asyncUpdate(host);
    }
    console.log('site all:', (new Date().getTime() - timer) / 1000, 'sec');
}
async function asyncUpdate(host: string) {

    const userKey = fw.redisKeyUser(host), userKeyNew = userKey+':new';
    const redis = new RedisClass();
    let [err] = await redis.connect('/tmp/redis.sock');
    if (err) throw (__filename + '::update::redis.connect - ' + err);

    for (let data of fw.loadDirUserGen(host)) {
        fw.redisUserAdd(data, userKeyNew, redis);
    }

    [err] = await redis.rename(userKeyNew, userKey);
    if (err !== null) throw (__filename + '::update::redis.rename - ' + err);

    await redis.quit();
}