
import * as fw from "./fw";


// node /usr/local/www/app.back/pbl-css.js /usr/local/www/editor.css csstest-out.css

if (!module.parent && process.argv.length > 3) {
	let pathIn = process.argv[2];
	let cssSrc = fw.loadSync(pathIn);
	if (cssSrc) {
		let sep = require('path').sep;
		let outData = make(cssSrc);
		let pathOut = process.argv[3];
		if (pathOut.indexOf(sep) == -1) {
			pathOut = pathIn.substr(0, pathIn.lastIndexOf(sep) + 1) + pathOut;
		}
		fw.saveSync(pathOut, outData);
	}
}


export function make(cssSrc: string) {

	let cssDict: IDict<any> = {};
	
	// удаляем лишние знаки
	cssSrc = cssSrc.replace(/[\t\n\r]/gi, '');
	
	// удаляем комментарии
	cssSrc = cssSrc.replace(/(\/\*((?!\*\/).)*\*\/)/gi, '');
	
	// запоминаем переменные
	//let reValueGet = /(%[\w]+%)\s*\{([^\{\}]+)\}/gi;
	//cssSrc = cssSrc.replace(reValueGet, fnValueGet).trim();
	//function fnValueGet(){
	//	cssDict[arguments[1]] = {name: '', text: arguments[2].trim()};
	//	return '';
	//}
	let cssVar: IDict<string> = {};
	let reValueGet = /(var\-[\w\-]+)\s*\{([^\{\}]+)\}/gi;
	cssSrc = cssSrc.replace(reValueGet, fnValueGet).trim();
	function fnValueGet() {
		cssVar[arguments[1]] = arguments[2].trim();
		return '';
	}


	let reParse = /([^\{\};й]+)\{([^\{\}]+)\}/gi;
	while (reParse.test(cssSrc)) {
		cssSrc = cssSrc.replace(reParse, fnParse).trim();
	}
	function fnParse() {
		let key = 'й' + Object.keys(cssDict).length + 'й';
		let name = arguments[1].trim();
		let text = arguments[2].trim();
		if (name) {
			cssDict[key] = { name: name, text: text };
		}
		return name ? key : '';
	}
	
	//console.log(cssDict);
	//console.log(cssVar);
	
	let reGroup = /й\d+й/gi;
	let noSpace = ['>', ':'];
	function fnCssMake(nameParent: string, textParent: string) {
		let out: string[] = [];
		function fnGroup() {
			let key = arguments[0];
			let text = cssDict[key].text.replace(reGroup, '').trim();
			if (cssDict[key].name.charAt(0) == '@') {
				if (cssDict[key].text.search(reGroup) > -1) {
					text += fnCssMake('', cssDict[key]['text']).join('\n');
				}
				if (text) {
					out.push(cssDict[key].name + '{' + text + '}');
				}
			}
			else {
				(nameParent ? cssDict[key].name.split(',') : [cssDict[key].name]).forEach(function (nameCur: string) {
					let name = nameParent.split(',').map(function (name) {
						let sep = noSpace.indexOf(nameCur.charAt(0)) == -1 ? ' ' : '';
						return (name + sep + nameCur).trim();
					}).join(',');
					//console.log(name, '{',  text, '}', cssDict[key].text);
					if (text) {
						out.push(name + '{' + text + '}');
					}
					if (cssDict[key].text.search(reGroup) > -1) {
						out = out.concat(fnCssMake(name, cssDict[key].text));
					}
				});
			}
			return '';
		}
		textParent.replace(reGroup, fnGroup);
		return out;
	}
	
	//fw.iter(cssDict).forEach(function(key){
	//	console.log(key, '{',  cssDict[key].text, '}', cssDict[key].name);
	//});
	
	let cssOut = fnCssMake('', cssSrc).join('\n');
	
	// переменные
	//cssOut = cssOut.replace(/\%[\w]+\%/gi, fnValueSet);
	//function fnValueSet() {
	//	let key = arguments[0];
	//	return cssDict[key] ? cssDict[key].text : '';
	//}
	
	cssOut = cssOut.replace(/var\-[\w\-]+/gi, fnValueSet);
	function fnValueSet() {
		let out = cssVar[arguments[0]] || '';
		if (!out) {
			console.error('css var not found', arguments[0]);
		}
		return out;
	}

	let reChange = /change\(([^)]+)\)/gi;
	cssOut = cssOut.replace(reChange, fnChange);
	function fnChange() {
		let
			args: string[] = arguments[1].trim().split(',')
			, color = args[0].trim()
			, cmdText = args[1].trim()
			, alpha: number|undefined
			;
		if (args[2]) {
			alpha = clamp(parseFloat(args[2]));
		}
		let flagPound = false;
		if (color.charAt(0) == '#') {
			flagPound = true;
			color = color.substr(1);
		}
		let rgb: number[]|undefined;
		if (color.length == 3 || color.length == 6) {
			rgb = toRGB(color);
		}
		//else{
		//	if (color.startsWith('rgba(')) {
		//		color = color.slice(5,-1).split(',').map(function(){
		//			
		//		});
		//	}
		//}
		
		if (rgb) {
			let cmd = (/([a-z]+)(\-?\d+)/gi).exec(cmdText);
			if (cmd && cmd.length == 3) {
				let
					value = parseInt(cmd[2], 10)
					, gray: number
					, sat: number
					, hue: number
					, hsl: IHSLFace
					;
				switch (cmd[1]) {
					case 'alpha':
						alpha = clamp(value / 100);
						break;
					case 'grey':
						gray = rgb[0] * 0.3086 + rgb[1] * 0.6094 + rgb[2] * 0.0820;
						sat = value / 100;
						for (let i = 0; i < 3; i++)rgb[i] = Math.round(rgb[i] * sat + gray * (1 - sat));
						break;
					case 'l':
						hsl = toHSL(rgb);
						hsl.l += value / 100;
						hsl.l = clamp(hsl.l);
						rgb = hslToRGB(hsl);
						break;
					case 'h':
						hsl = toHSL(rgb);
						hue = (hsl.h + value) % 360;
						hsl.h = hue < 0 ? 360 + hue : hue;
						rgb = hslToRGB(hsl);
						break;
					case 's':
						hsl = toHSL(rgb);
						hsl.s += value / 100;
						hsl.s = clamp(hsl.s);
						rgb = hslToRGB(hsl);
						break;
					default:
						break;
				}
			}
			for (let i = 0; i < 3; i++)rgb[i] = clamp(rgb[i], 255);
			color = '';

			if (alpha && alpha == 1) {
				alpha = void (0);
			}
			if (alpha) {
				color = 'rgba(' + (rgb.concat([alpha]).join(',')) + ')';
			}
			else {
				for (let i = 0; i < 3; i++)color += ('00' + rgb[i].toString(16)).slice(-2);
			}
		}
		if (alpha== void (0) && flagPound) {
			color = '#' + color;
		}
		return color;
	}

	return cssOut;
}


function toHSL(color: number[] | string) {
	// http://en.wikipedia.org/wiki/HSL_and_HSV
	// http://htmlbook.ru/css/value/color
	// HSL (hue-saturation-lightness)
	// HSV (hue-saturation-value)
    let c = typeof (color) == 'string' ? toRGB(<string>color) : color,
        r = c[0] / 255,
		g = c[1] / 255,
		b = c[2] / 255;
	//a = alpha||0;
	let max = Math.max(r, g, b), min = Math.min(r, g, b);
	let h = 0, s: number, l = (max + min) / 2, d = max - min;
	if (max === min) {
		h = s = 0;
	} else {
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
			default: break;
		}
		h /= 6;
	}
	//, a: a 
	return <IHSLFace>{ h: h * 360, s: s, l: l };
}
function toRGB(val: string) {
	let color = [0, 0, 0];
	if (val.charAt(0) == '#') {
		val = val.substr(1);
	}
	if (val.length == 3) {
		color = [parseInt(val.charAt(0) + val.charAt(0), 16), parseInt(val.charAt(1) + val.charAt(1), 16), parseInt(val.charAt(2) + val.charAt(2), 16)];
	}
	else if (val.length == 6) {
		color = [parseInt(val.substr(0, 2), 16), parseInt(val.substr(2, 2), 16), parseInt(val.substr(4, 2), 16)];
	}
	if (isNaN(color[0])) color[0] = 0;
	if (isNaN(color[1])) color[1] = 0;
	if (isNaN(color[2])) color[2] = 0;
	return color;
}
function clamp(v: number, max?: number, flag?: boolean) {
	if (flag) {
		v = Math.round(v);
	}
	return Math.min(Math.max(v, 0), max || 1);
}
function hslToRGB(hsl: IHSLFace) {
	function hue(h: number) {
		h = h < 0 ? h + 1 : (h > 1 ? h - 1 : h);
		if (h * 6 < 1) { return m1 + (m2 - m1) * h * 6; }
		else if (h * 2 < 1) { return m2; }
		else if (h * 3 < 2) { return m1 + (m2 - m1) * (2 / 3 - h) * 6; }
		else { return m1; }
	}

	let h = (hsl.h % 360) / 360, s = hsl.s, l = hsl.l;

	let m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
	let m1 = l * 2 - m2;

	let rgb = [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
	for (let i = 0; i < 3; i++)rgb[i] = clamp(rgb[i], 255, true);
	return rgb;
}
interface IHSLFace {
	h: number
	s: number
	l: number
}
