import * as fw from "../../fw";

module.exports = <fw.IIni>{
	idnLabel: -1,
	flagAutoUpdate: true,
	flagBodyURL: true,
	//'outlet-parket@yandex.ru', 'mr@x-lab.ru'
	admin: {email: []},
	html: {
		content:{body: true, catalog: true},
		js: ['login', 'gallery'],
		css: ['common', 'font', 'dialog']
	}//,
	//menu: {
	//	section: menuSection
	//}
};

/*
function menuSection(data: string[][]) {
	var ind = [8,16,16,0];
	var i1=data.length;
	while(i1--){
		data[i1][1] = '<b>'+data[i1][1]+'</b>';
		var i2=data[i1][2].length;
		while (i2--) {
			data[i1][2][i2][1] = data[i1][2][i2][1].substr(ind[i1]);
		}
	}
	return data;
}
*/