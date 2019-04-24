import * as redis from "redis";

// https://github.com/NodeRedis/node_redis

export interface RedisError extends Error{
    command: string
    args: (string | number)[]
    code: string
}

interface IBoolean extends Array<any> {
    [0]: null | string
    [1]: boolean
}
interface IType<T> extends Array<any> {
    [0]: null | string
    [1]: T
}

export class RedisClass {
    client!: redis.RedisClient
    isConnected = false
    private connectResolve: any
    private connectReject: any
    constructor() {
        this.connectPromise = this.connectPromise.bind(this);
        this.connected = this.connected.bind(this);
        this.error = this.error.bind(this);
    }
    private fnMany<T>(fn: any, args: any[]): Promise<IType<T>> {
        return new Promise<T>((resolve, reject) => {
            args.push((err: any, res: any) => {
                if (err) reject(err)
                else resolve(res);
            });
            fn.apply(this.client, args);
        }).then(data => [null, data] as IType<T>).catch(err => [err, null as any] as IType<T>);
    }
    private fnType<T>(fn: any, ...args: any[]): Promise<IType<T>> {
        return new Promise<T>((resolve, reject) => {
            args.push((err: any, res: any) => {
                if (err) reject(err)
                else resolve(res);
            });
            fn.apply(this.client, args);
        }).then(data => [null, data] as IType<T>).catch(err => [err, null as any] as IType<T>);
    }
    private fnBoolean(fn: any, strTrue: string | number, ...args: any[]): Promise<IBoolean> {
        return new Promise<boolean>((resolve, reject) => {
            args.push((err: any, res: any) => {
                if (err) reject(err)
                else resolve(res == strTrue);
            });
            fn.apply(this.client, args);
        }).then(data => [null, data] as IBoolean).catch(err => [err, null as any] as IBoolean);
    }
    private connectPromise(resolve: any, reject: any) {
        this.connectReject = reject;
        this.connectResolve = resolve;
    }
    private connected() {
        this.isConnected = true;
        this.connectResolve(true);
    }
    private error(err: any) {
        console.error("Redis Error: " + Object.keys(err), err);
        this.connectReject();
    }
    connect(path: string): Promise<IBoolean> {
        this.client = redis.createClient(path);
        this.client.on('error', this.error);
        this.client.on('connect', this.connected);
        return new Promise<boolean>(this.connectPromise).then(data => [null, true] as IBoolean).catch(err => [err, null as any] as IBoolean);
    }
    quit(): Promise<IBoolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.client.quit(() => {
                this.isConnected = false;
                resolve(true);
            });
        }).then(data => [null, data] as IBoolean).catch(err => [err, null as any] as IBoolean);
    }
    info() {
        return this.fnType<string>(this.client.info);
    }

    del(...keys: string[]) {
        return this.fnMany<boolean>(this.client.del, keys);
    }
    exists(...keys: string[]) {
        return this.fnMany<boolean>(this.client.exists, keys);
    }
    expire(key: string, sec: number): Promise<IBoolean> {
        return this.fnBoolean(this.client.expire, 1, key, sec);
    }
    expireat(key: string, secAbs: number) {
        return this.fnBoolean(this.client.expireat, 1, key, secAbs);
    }
    keys(pattern: string) {
        return this.fnType<string[]>(this.client.keys, pattern);
    }
    rename(key: string, newkey: string) {
        return this.fnBoolean(this.client.rename, 'OK', key, newkey);
    }
    ttl(key: string) {
        return this.fnType<number>(this.client.ttl, key);
    }

    set(key: string, val: string|number) {
        return this.fnBoolean(this.client.set, 'OK', key, val.toString());
    }
    get(...keys: string[]) {
        return this.fnMany<string[]>(this.client.get, keys);
    }

    sadd(key: string, val: string | number) {
        return this.fnBoolean(this.client.sadd, 1, key, val.toString());
    }
    scard(key: string) {
        return this.fnType<number>(this.client.scard, key);
    }
    sismember(key: string, val: string | number) {
        return this.fnBoolean(this.client.sismember, 1, key, val.toString());
    }
    smembers(key: string) {
        return this.fnType<string[]>(this.client.smembers, key);
    }

    lindex(key: string, index: number) {
        return this.fnType<string | null>(this.client.lindex, key, index);
    }
    linsAfter(key: string, valTarget: string, val: string) {
        return this.fnType<number>(this.client.linsert, key, 'AFTER', valTarget, val);
    }
    linsBefore(key: string, valTarget: string, val: string) {
        return this.fnType<number>(this.client.linsert, key, 'BEFORE', valTarget, val);
    }
    llen(key: string) {
        return this.fnType<number>(this.client.llen, key);
    }
    lpop(key: string) {
        return this.fnType<string>(this.client.lpop, key);
    }
    lpush(key: string, val: string | number) {
        return this.fnType<number>(this.client.lpush, key, val.toString());
    }
    lpushx(key: string, val: string | number) {
        return this.fnType<number>(this.client.lpushx, key, val.toString());
    }
    lrange(key: string, start: number, stop: number) {
        return this.fnType<string[]>(this.client.lrange, key, start, stop);
    }
    lrem(key: string, count: number, val: string | number) {
        return this.fnType<number>(this.client.lrem, key, count, val);
    }
    lset(key: string, ind: number, val:string|number) {
        return this.fnBoolean(this.client.lset, 'OK', key, ind, val.toString());
    }
    ltrim(key: string, start: number, stop: number) {
        return this.fnBoolean(this.client.ltrim, 'OK', key, start, stop);
    }
    rpop(key: string) {
        return this.fnType<string>(this.client.rpop, key);
    }
    rpoplpush(keyFrom: string, keyTo: string) {
        return this.fnType<string>(this.client.rpoplpush, keyFrom, keyTo);
    }
    rpush(key: string, val: string | number) {
        return this.fnType<number>(this.client.rpush, key, val.toString());
    }
    rpushx(key: string, val: string | number) {
        return this.fnType<number>(this.client.rpushx, key, val.toString());
    }

    hset(hashName: string, field: string, val: string) {
        return this.fnBoolean(this.client.hset, 1, hashName, field, val);
    }
    hsetnx(hashName: string, field: string, val: string) {
        return this.fnBoolean(this.client.hsetnx, 1, hashName, field, val);
    }
    hget(hashName: string, field: string) {
        return this.fnType<string>(this.client.hget, hashName, field);
    }
    hdel(hashName: string, field: string) {
        return this.fnType<boolean>(this.client.hdel, hashName, field);
    }
    hexists(hashName: string, field: string) {
        return this.fnType<boolean>(this.client.hexists, hashName, field);
    }
    hgetall<T>(hashName: string) {
        return this.fnType<T | null>(this.client.hgetall, hashName);
    }
    hkeys(hashName: string) {
        return this.fnType<string[]>(this.client.hkeys, hashName);
    }
    hlen(hashName: string) {
        return this.fnType<number>(this.client.hlen, hashName);
    }
    hvals(hashName: string) {
        return this.fnType<string[]>(this.client.hvals, hashName);
    }
    hstrlen(hashName: string, field: string) {
        return this.fnType<number>(this.client.hstrlen, hashName, field);
    }
    hincrby(hashName: string, field: string, num: number) {
        return this.fnType<number>(this.client.hincrby, hashName, field, num);
    }
    hincrbyfloat(hashName: string, field: string, num: number) {
        // https://redis.io/commands/hincrbyfloat
        return this.fnType<number>(this.client.hincrbyfloat, hashName, field, num);
    }
    hmset(hashName: string, hash: any) {
        return this.fnType<boolean>(this.client.hmset, hashName, hash);
    }
    hmget<T>(hashName: string, ...argsGet: (string[] | string)[]): Promise<IType<T>> {
        return new Promise<T>((resolve, reject) => {
            let args = (argsGet.length == 1 && Array.isArray(argsGet[0]) ? argsGet[0] : argsGet) as string[];
            let fnArgs = args.map(a=>a) as any[];
            fnArgs.splice(0, 0, hashName);
            fnArgs.push((err: any, res: any) => {
                if (err) reject(err)
                else {
                    let result = {} as any;
                    for (let i = 0, im = args.length; i < im;i++) {
                        result[args[i]] = res[i];
                    }
                    resolve(result);
                }
            });
            this.client.hmget.apply(this.client, fnArgs);
        }).then(data => [null, data] as IType<T>).catch(err => [err, null as any] as IType<T>);
    }
    hmatch<T>(hashName: string, find?: string): Promise<IType<T>> {
        // node_redis-master/examples/scan.js
        return new Promise<T|null>((resolve, reject) => {
            let cursor = '0';
            let args = [hashName, cursor] as any[];
            if (find) {
                args.push('MATCH', find);
            }
            args.push((err: any, res: any) => {
                if (err) reject(err)
                else {
                    let result = null as any;
                    if (res[0] == '0' && Array.isArray(res[1])) {
                        let list = res[1];
                        if (list.length) {
                            result = {};
                            for (let i = 0, im = list.length; i < im; i += 2) {
                                result[list[i]] = list[i + 1];
                            }
                        }
                    }
                    resolve(result);
                }
            });
            this.client.hscan.apply(this.client, args);
        }).then(data => [null, data] as IType<T>).catch(err => [err, null as any] as IType<T>);
    }
}
