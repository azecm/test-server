import { execSync } from "child_process";

// node D:/nginx/html/ts-2018/server/es6/script/git-commit.js git
// node D:/nginx/html/ts-2018/server/es6/script/git-commit.js sync

function startGit() {
    const pathList = [
        'E:/backup.web/yaray.ru',
        'E:/backup.web/data/domain'
    ];

    for (const pathDir of pathList) {
        const execOpt = { cwd: pathDir, encoding: 'utf8' };
        const gitStatus = execSync('git status -s', execOpt);
        if (!gitStatus) continue;
        //const execOpt2 = { cwd: pathDir, encoding: 'utf8', stdio: [0, 1, 2] };
        execSync('git add .', execOpt);
        execSync(`git commit -m ${new Date().toJSON().substr(0, 10)}`, execOpt);
    }
}

class WinSCP {
    private commands = [] as string[];
    open(name: string) {
        this.commands.push(`open ${name}`);
        return this;
    }
    close() {
        this.commands.push(`close`);
        return this;
    }
    exit() {
        this.commands.push(`exit`);

        const cmd = ['/command'];
        for (const line of this.commands) cmd.push('"' + line.replace(/"/g, '""') + '"');
        return cmd.join(' ');;
    }
    synchronize(filemask: string, localDir: string, remoteDir: string) {
        // https://winscp.net/eng/docs/scriptcommand_synchronize
        const cmd = ['synchronize', 'local', '-delete', '-criteria=time', '-transfer=binary'];
        if (filemask) cmd.push('-filemask=' + filemask);
        cmd.push(localDir, remoteDir);
        this.commands.push(cmd.join(' '));
        return this;
    }
}

function startSync() {
    const param = new WinSCP()
        .open('ecoweb.ru')
        .synchronize('|arch-node.tar.gz;arch-user.tar.gz;.git*;.git/', 'E:/backup.web/data/domain', '/usr/local/www/data/domain')
        .synchronize('|domain/', 'E:/backup.web/data/statistic', '/usr/local/www/data/statistic')
        .synchronize('', 'E:/backup.web/stat', '/usr/local/www/stat')
        .synchronize('|.git*;.git/', 'E:/backup.web/', '/usr/local/www/')
        .close()
        .exit()
        ;

    // [process.stdin, process.stdout, process.stderr] === [0, 1, 2]
    execSync('WinSCP.com ' + param, { cwd: 'D:/program/net/winscp', encoding: 'utf8', stdio: [0, 1, 2] });
    //execSync('WinSCP.com ' + param, { cwd: 'D:/program/net/winscp', encoding: 'utf8' });
}

(function () {
    switch (process.argv[2]) {
        case 'git':
            startGit();
            break;
        case 'sync':
            startSync();
            break;
    }
})();

