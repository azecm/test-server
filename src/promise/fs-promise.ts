import * as fs from "fs";

export async function asyncReadDir(path: string) {
    return new Promise<string[]>(function (resolve) {
        fs.readdir(path, function (err, list = []) {
            if (err) console.error([__filename, 'readDir::fs.readdir', err].join('\n'));
            resolve(list);
        });
    });
}
export function stats(path: string) {
    return new Promise<fs.Stats|undefined>(function (resolve) {
        fs.stat(path, function (err, stats) {
            if (err) console.error([__filename, 'stats::fs.stat', err].join('\n'));
            resolve(stats);
        })
    });
}
export function writeFile(filename: string, data: any, options?: { encoding?: string; mode?: number; flag?: string; }) {
    return new Promise<void>(function (resolve) {
        if (options) {
            fs.writeFile(filename, data, options, function (err) {
                if (err) console.error([__filename, 'writeFile(1)', err, filename].join('\n'));
                resolve();
            });
        }
        else {
            fs.writeFile(filename, data, function (err) {
                if (err) console.error([__filename, 'writeFile(2)', err, filename].join('\n'));
                resolve();
            });
        }
    });
}
export function readFile(filename: string) {
    return new Promise<string>(function (resolve) {
        fs.readFile(filename, 'utf8', function (err, data='') {
            if (err) console.error([__filename, 'readFile', err, filename].join('\n'));
            resolve(data);
        })
    });
}
export function appendFile(filename: string, data: any, options?: { encoding?: string; mode?: number; flag?: string; }) {
    return new Promise<void>(function (resolve) {
        // export function appendFile(filename: string, data: any, options: { encoding?: string; mode?: number; flag?: string; }, callback?: (err: NodeJS.ErrnoException) => void): void;
        if (options)
            fs.appendFile(filename, data, options, function (err) {
                if (err) console.error([__filename, 'appendFile(1)', err, filename].join('\n'));
                resolve()
            })
        else
            fs.appendFile(filename, data, function (err) {
                if (err) console.error([__filename, 'appendFile(2)', err, filename].join('\n'));
                resolve();
            })

    });
}

export function exists(filename: string) {
    return new Promise<boolean>(function (resolve) {
        fs.exists(filename, function (exists) {
            resolve(exists);
        });
    });
}
export function mkdir(path: string, mode = 0o755) {
    return new Promise<void>(function (resolve) {
        fs.mkdir(path, mode, function (err) {
            if (err) console.error([__filename, 'mkdir', err, path].join('\n'));
            resolve();
        })
    });
}
export function chmod(path: string, mode: number) {
    return new Promise<void>(function (resolve, reject) {
        fs.chmod(path, mode, function (err) {
            if (err) console.error([__filename, 'chmod', err, path].join('\n'));
            resolve();
        })
    });
}