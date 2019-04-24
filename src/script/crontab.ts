

//import * as fs from "fs";
//import { spawnSync, execSync } from "child_process";
import * as fw from "../fw";
//import { asyncStart as votingAsyncStart } from '../crontab/comment-voting';

//import { cronTaskNginx } from './nginx/main';

(async function () {
	//fw.log('crontab');
	fw.onError();
	//await asyncStart();
	fw.cmdJava().viewStdout().crontab();
	process.exit(0);
})()

