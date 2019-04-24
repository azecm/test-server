
import * as fw from "../fw";

let host: string, code: number, idnDoc: number, idnPath:string;

if (!module.parent)
    new fw.Spawn().data(process.stdin, function (data: any) {
		host = data.host;
		code = data.code;
		idnDoc = data.idn;
		idnPath = data.path;
		start();
	});

function start() {
    let dataFile = fw.loadSyncNode(host, idnDoc, true);
    if (!dataFile) return;
	if (!dataFile.head.rating || !Array.isArray(dataFile.head.rating)) {
		dataFile.head.rating = getDefaultValue();
	}
	dataFile.head.rating[code-1]++;
	let data = getData(dataFile.head.rating);
	fw.Spawn.msg(data.value+' '+data.count);
	fw.saveSyncNode(host, dataFile);
	let text = fw.fileCacheHtml(host, idnPath);
	if (text) {
		text = text.replace(/(ratingValue">)([^<]+)(<)/gi, '$1'+data.value+'$3');
		text = text.replace(/(ratingCount">)([^<]+)(<)/gi, '$1'+data.count+'$3');
		fw.fileCacheHtml(host, idnPath, text);
	}
	else{
		fw.err('app-site/node-rating.js: not read - ', idnPath);
	}
}

export function getDefaultValue() {
	return [0, 0, 0, 0, 1]
}

export function getData(rating?:number[]) {
	let count = 0;
	let value = 0;
	if (rating && Array.isArray(rating) && rating.length==5) {
		count = rating.reduce(function(a, b) {return a + b;});
		value = rating.map(function(v,i) {return v*(i+1);}).reduce(function(a, b) {return a + b;});
	}
	return {count: count, value: count ? Math.floor(value/count*100)/100 : 0, bestRating: 5};
}



