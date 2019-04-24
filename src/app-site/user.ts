import * as fw from "../fw";
import { PostgreSQL } from "../promise/postgre";


if (!module.parent) {
    new fw.Spawn().data(process.stdin, async function (data) {
        await fw.redisConnect();
        switch (data.route) {
            case 'add': asyncUserAdd(data); break;
            //case 'nodeList': await userNodeList(data); break;
            case 'pageAbout': asyncUserPageAbout(data); break;
            case 'pageAboutSave': userPostAboutSave(data); break;
            case 'pageAboutSend': asyncUserPostAboutSend(data); break;
            default:
                fw.err('user.js::route', data);
                break;
        }
        await fw.redisQuit();
        fw.Spawn.end();
    });
}

interface IUserAdd {
    host: string
    data: {
        name: string
        password: string
        email: string
    }
}
async function asyncUserAdd(data: IUserAdd) {
    let dirList = fw.spawnSync('/usr/bin/find', [fw.pathType.data + data.host + '/user/', '-name', '*.json']).split('\n');
    let iduLast = 0;
    for(const path of dirList) {
        let idu = parseInt(path.substr(path.lastIndexOf('/') + 1), 10);
        iduLast = Math.max(iduLast, idu);
    }
    let date = fw.dateJSON();
    let user = {
        idu: iduLast + 1,
        name: data.data.name,
        password: data.data.password,
        email: data.data.email,
        status: 1,
        visits: 0,
        dateAdd: date,
        dateLast: date,
        dateLastPM: date
    } as IUser;

    fw.saveSyncUser(data.host, user);
    await fw.redisUserAdd(user, fw.redisKeyUser(data.host));
}


interface IDataPageAbout {
    host: string
    idu: number
    name: string
}
async function asyncUserPageAbout(dataGet: IDataPageAbout) {
    let host = dataGet.host;

    let user = await fw.userByName(host, dataGet.name);
    if (!user) {
        fw.Spawn.msg('ok');
        return;
    }

    let me = fw.loadSyncUser(host, dataGet.idu);
    let flagSelf = user.idu == me.idu;

    let where = {
        and: { flagFolder: false, flagBlock: false, idu: user.idu } as IDBTree
    };
    const db = new PostgreSQL(host);
    await db.connect('user::asyncUserPageAbout');
    const select1 = await db.select({count:0}).fromTree().where(where).exec();
    await db.end();
    let all = select1.rows[0].count;

    if (flagSelf) {
        fw.Spawn.msg({
            all: all,
            add: user.dateAdd.substr(0, 10),
            last: user.dateLast.substr(0, 10),
            data: [user.name, user.email.replace('@', '&&'), user.password],
            page: user.webpage || '',
            descr: user.description || ''
        });
    }
    else {
        fw.Spawn.msg({
            all: all,
            add: user.dateAdd.substr(0, 10),
            last: user.dateLast.substr(0, 10),
            from: me.name,
            page: user.webpage || '',
            descr: user.description || ''
        });
    }
}


interface IDataPostSend {
    host: string
    idu: number
    browser: string
    ip: string
    data: string[]
}
async function asyncUserPostAboutSend(data: IDataPostSend) {
    let host = data.host;

    let userTo = await fw.userByName(host, data.data[0]);
    if (!userTo) {
        fw.Spawn.msg('ok');
        return;
    }
    let userFrom = fw.loadSyncUser(host, data.idu);
    if (userTo && userFrom) {
        let message = fw.textClean(data.data[1]);
        let flag = true;
        if (userFrom.status < 3) {
            let delta = Math.ceil((new Date().getTime() - new Date(userFrom.dateLastPM).getTime()) / 1000)
            flag = delta > 300;
        }

        if (flag) {
            userFrom.dateLastPM = fw.dateJSON();
            fw.saveSyncUser(host, userFrom);
            let mailData = { host: host, browser: data.browser, ip: data.ip, userMessage: { email: userTo.email, from: userFrom.name, data: [message] } };
            // из второго по вложенности spawn
            // не ясно как вернуть fw.msg('ok');
            // поэтому отвечаем сразу
            new fw.Spawn().spawn(null, 5, ['app-site/mail.js'], mailData);
            fw.Spawn.msg('ok');
        }
        else {
            fw.Spawn.msg('msg:Отправлять сообщения можно каждые 5 минут.');
        }
    }
    else {
        fw.Spawn.msg('ok');
    }
}


interface IDataPostSave {
    host: string
    idu: number
    data: string[]
}
function userPostAboutSave(data: IDataPostSave) {
    let user = fw.loadSyncUser(data.host, data.idu);
    if (user) {
        let val: string;
        val = fw.textClean(data.data[1]);
        if (user.password != val) {
            user.password = val;
        }
        val = fw.textClean(data.data[2]);
        if (user.webpage != val) {
            if (val) user.webpage = val;
            else delete (user.webpage);
        }
        val = fw.textClean(data.data[3]);
        if (user.description != val) {
            if (val) user.description = val;
            else delete (user.description);
        }
        fw.saveSyncUser(data.host, user);
    }
    fw.Spawn.msg('ok');
}
