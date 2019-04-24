
// node --use_strict /usr/local/www/app.back/script/social/facebook.js send
// https://www.facebook.com/com.toybytoy

import * as fs from "fs";
import { HTMLDoc } from "../../fw-dom";
import * as fw from "../../fw";
import * as socialAdd from "./add";


//let app_id = '297726960358614'
//let app_secret = '16468ca1318e917e423d26733731bb26'
//Client Token: c7799deaf575e7b3618c5e4e003c75f7
//let access_token_app  = '297726960358614|tAxo5p9SbslpsDDOMXX1cJFs9Ds'



// получаем доступ
// https://developers.facebook.com/tools/explorer/
// выбрав приложение -> getAccessToken
// действует в течении часа
// меняем на более длинный
// app_user_access_token_extend()
// выдает новый на 60 дней
// User & Friend Permissions:
// user_about_me user_notes user_photos friends_about_me publish_actions user_actions.news
// Extended Permissions:
// manage_pages publish_stream read_stream offline_access status_update photo_upload create_note
// access_token_user = 'BAAEOxZCW2VNYBABhNPprdIObYktC0H2kWysPKhuRuO11IfGtFE4f6fpHvXnx5ghg9XP5ZBawhikZB5HMaCxpCRpEZAecyxdNq5iZBI4a0Gb1nnQ2elsLVDvxf96xFANyeq1ntmKZBUtGvNWfjwY5eKp0eu5k3E6ZBezN09G7tAoVxk6r5bWzZCwiyTowDNWiMTTCoZBPWpUu19lRAzonoKeU0CByktSmMczcZD'
//let access_token_user = 'BAAEOxZCW2VNYBAChxsWJiXrSvcT3VMZBK4GMeVjbNvBiLZAPkPh6glwKWYRgWHZCj0G6NeZCNcLtupERqwMNRObdzDo29jZAdE7EyPOHbR0YlRaJ1hyurIuTR6HZBL2guvcYiSwEcBgmAfTvzXamxqwWUzexULthQrguvgyEobSWhHEqHDZCtuoNUnQUQe4L53vQM1i3iWVzACiOmz4FOaPF'



const page_id = ''
const access_token_page = ''


const request_uri ='https://graph.facebook.com/'



const cache_file = fw.pathType.memory+'toy/social_facebook.json';

export const data = dataObj;
export const send = send_data;

if (process.argv.length==3) {
	switch (process.argv[2]) {
		case 'send':
			send_data();
			break;
		default: break;
	}
}

function send_data() {
	if (!fs.existsSync(cache_file)) {
		return;
	}
	
	let data:any;
	let dataCache = fw.loadSyncJson(cache_file, []);
	if (dataCache.length) {
		data = dataCache.shift();
	}
	if (!data) {
		return;
	}
	

	interface IDataParam {
		message: string
		name: string
		link: string
		access_token: string
		picture?: string
		description?: string 
	}
	let param: IDataParam = {
		message: data.content
		,name: data.name
		,link: data.link
		,access_token: access_token_page
	};
	if (data.img) {
		param.picture = 'http://'+data.host + '/file/' + data.img.replace('/', '/600/')
	}
	if (data.imgDescr) {
		param.description = data.imgDescr;
	}
	else{
		param.description = data.name;
	}
	
	socialAdd.post(request_uri + '/' + page_id + '/feed', param, false, function(code, data){
		if (code==200 && data.indexOf('"id"')>-1) {
			
			if (dataCache.length) {
				fw.saveSyncJson(cache_file, dataCache);
			}
			else{
				fs.unlinkSync(cache_file);
			}
			
		}
		else{
			console.error('facebook publish err', code, data);
		}
	});
	
}


function dataObj(host: string, tree: fw.ITree, wordRepl: socialAdd.IWordReplLine[], keywords:any, node: fw.INode, outFile: socialAdd.IDataFileLine[]) {
	
	let data = {
		link: 'http://' + host + fw.getNodePath(tree, node.head.idn, 'facebook-1'),
		name: node.head.title,
		content: fw.textClean(fw.textOnly(node.descr)),
		host: host,
		img: '',
		imgDescr: ''
	};
	
    let img = new HTMLDoc(node.descr).firstByTag('img');
    if (img) {
		data.img = fw.imgKey(img.get('src')||'').key;
		node.attach.forEach(function (line) {
			if (line.src && line.src == data.img && line.content) {
				data.imgDescr = fw.textClean(fw.textOnly(line.content));
				if (!data.imgDescr) {
					delete (data.imgDescr);
				}
			}
		});
	}
	else {
		delete (data.imgDescr);
		delete (data.img);
	}
	
	outFile.push(data);
}

