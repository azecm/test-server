// https://www.npmjs.com/package/htmlparser2
// https://www.npmjs.com/package/cheerio


// https://www.npmjs.com/package/parse5
import * as parse5 from 'parse5';


// ===============
// parse5/lib/serializer/index.js
//
// AMP_REGEX = /&(?!(\w+|#\d+|#x[\da-f]+);)/g
//
// Serializer.escapeString = function (str, attrMode) {
//  str = str.toString();
// 




const winRoot = '';
// C:\Users\admin\AppData\Roaming\npm\node_modules\parse5\lib\common
//const winRoot = process.platform == 'win32' ? 'C:/Users/admin/AppData/Roaming/npm/node_modules/' : '';

//Escaping regexes
var AMP_REGEX = /&(?!(\w+|#\d+|#x[\da-f]+);)/g,
    NBSP_REGEX = /\u00a0/g,
    DOUBLE_QUOTE_REGEX = /"/g,
    LT_REGEX = /</g,
    GT_REGEX = />/g;


const Serializer = require(winRoot + 'parse5/lib/serializer') as any;
Serializer.escapeString = function (str: string, attrMode: boolean) {
    str = str.toString();
    str = str
        .replace(AMP_REGEX, '&amp;')
        .replace(NBSP_REGEX, '&nbsp;');

    if (attrMode) {
        str = str.replace(DOUBLE_QUOTE_REGEX, '&quot;');
    }
    else {
        str = str
            .replace(LT_REGEX, '&lt;')
            .replace(GT_REGEX, '&gt;');
    }
    return str;
};

// ===============


function dateDate(date: string | Date) {
    if (typeof (date) == 'string') date = new Date(<string>date);
    return (<Date>date).toISOString().substr(0, 19).replace('T', ' ');
}



interface INameSpace {
    HTML: string
    MATHML: string
    SVG: string
    XLINK: string
    XML: string
    XMLNS: string
}

interface IElement extends parse5.AST.Default.Element { }
export interface IBaseElem { el: IElement }


const docFn = parse5.treeAdapters.default;
const docNS: INameSpace = require(winRoot + 'parse5/lib/common/html.js').NAMESPACES;
function findEls(root: IElement, nameFind: string | null, attrName: string | null, attrContent: string | null, many: boolean) {
    let isClassName = attrName == 'class';
    let res = [] as Elem[];
    let iter = (parent: IElement) => {
        if (!parent.childNodes) return;
        for (let node of parent.childNodes) {
            let el = node as IElement;
            if (!many && res.length) break;
            let flAttrName = !attrName, flAttrVal = !attrContent;
            let flNodeName = (nameFind && el.nodeName == nameFind) || !nameFind;
            if (attrName && el.attrs) {
                for (let at of el.attrs) {
                    if (at.name == attrName) {
                        flAttrName = true;
                        if (attrContent) {
                            if (isClassName) {
                                let classList = at.value.split(' '), count = 0, classFind = attrContent.split(' ').filter(a => !!a);
                                for (let v of classFind) {
                                    if (classList.indexOf(v) > -1) count++;
                                }
                                if (classFind.length == count) flAttrVal = true;
                            }
                            else {
                                if (at.value == attrContent) {
                                    flAttrVal = true;
                                }
                            }
                        }
                    }
                }
            }
            if (flNodeName && flAttrName && flAttrVal) {
                res.push(new Elem(el));
            }

            if (!many && res.length) break;
            if (el.childNodes && el.childNodes.length) iter(el);
        }
    };
    iter(root);
    return res;
}


export class Elem {
    el: IElement
    constructor(el: IElement | string) {
        if (typeof (el) == 'string') {
            this.el = docFn.createElement(el, docNS.HTML, []) as IElement;
        }
        else {
            this.el = el;
        }
    }
    set(name: string, value: string | number) {
        if (value !== null && value !== void (0)) {
            let updated = false;
            for (let attr of this.el.attrs) {
                if (attr.name == name) {
                    attr.value = value.toString();
                    updated = true;
                    break;
                }
            }
            if (!updated) {
                this.el.attrs.push({ name: name, value: value.toString() });
            }
        }
        return this;
    }
    attr(dict: any) {
        for (let name in dict) {
            this.set(name, dict[name]);
        }
        return this;
    }
    get(name: string) {
        let res = null as null | string;
        for (let attr of this.el.attrs) {
            if (attr.name == name) {
                res = attr.value;
                break;
            }
        }
        return res;
    }
    id(value: string | null) {
        if (value) this.set('id', value);
        return this;
    }
    data(name: string, value: string | number | null) {
        if (value !== null) this.set('data-' + name, value);
        return this;
    }
    htmlAppend(html: string | null) {
        if (html) {
            let doc = parse5.parseFragment(this.el, html) as parse5.AST.Default.DocumentFragment;
            for (let elChild of doc.childNodes) docFn.appendChild(this.el, elChild);
        }
        return this;
    }
    text(text: string | number | null) {
        if (text) docFn.insertText(this.el, text.toString());
        return this;
    }
    itemprop(value: string) {
        this.set('itemprop', value);
        return this;
    }
    itemscope(value: string) {
        this.set('itemscope', value);
        return this;
    }
    itemtype(value: string) {
        this.set('itemtype', value);
        return this;
    }
    as(value: string | null) {
        if (value) {
            let val = [] as string[], attrClass: parse5.AST.Default.Attribute | undefined, attrs = this.el.attrs;
            for (let el of attrs) {
                if (el.name == 'class') {
                    val = el.value.split(' ');
                    attrClass = el;
                    break;
                }
            }
            for (let name of value.split(' ')) {
                if (name && val.indexOf(name) == -1) val.push(name);
            }
            if (val.length) {
                if (attrClass) {
                    attrClass.value = val.join(' ');
                }
                else {
                    attrs.push({ name: 'class', value: val.join(' ') })
                }
            }
        }
        return this;
    }

    append(...els: (IBaseElem | string | null)[]) {
        for (let el of els) {
            if (el === null || el === void (0)) continue;
            if (typeof (el) == 'string') {
                docFn.insertText(this.el, el);
            }
            else {
                docFn.appendChild(this.el, el.el);
            }
        }
        return this;
    }
    last(parent: IBaseElem) {
        docFn.appendChild(parent.el, this.el);
        return this;
    }
    replace(el: IBaseElem) {
        let parent = this.el.parentNode;
        docFn.insertBefore(parent, el.el, this.el);
        docFn.detachNode(this.el);
    }
    insertBefore(el: IBaseElem) {
        docFn.insertBefore(this.el.parentNode, el.el, this.el);
        return this;
    }
    addNextSibling(el: IBaseElem) {
        let parent = this.el.parentNode;
        let pos = parent.childNodes.indexOf(this.el);
        if (pos == parent.childNodes.length - 1) {
            docFn.appendChild(parent, el.el);
        }
        else {
            docFn.insertBefore(parent, el.el, parent.childNodes[pos + 1]);
        }
    }
    drop() {
        if (this.el.childNodes && this.el.childNodes.length) {
            let parent = this.el.parentNode;
            for (let el of this.el.childNodes) {
                docFn.insertBefore(parent, el, this.el);
            }
        }
        docFn.detachNode(this.el);
    }



    childLen() {
        return this.el.childNodes && this.el.childNodes.length || 0;
    }
    childNodes() {
        let res = [] as Elem[];
        for (let el of this.el.childNodes) res.push(new Elem(el as IElement));
        return res;
    }

    getName() {
        return this.el.nodeName;
    }
    setName(name: string) {
        if (name) {
            this.el.nodeName = this.el.tagName = name;
        }
        return this;
    }

    toText() {
        let textList = [] as string[];
        let getText = (el: any) => el.value;
        let iter = (parent: IElement) => {
            if (!parent.childNodes) return;
            for (let el of parent.childNodes) {
                if (el.nodeName == '#text') {
                    textList.push(getText(el));
                }
                else {
                    iter(el as IElement);
                }
            }
        };
        if (this.el.nodeName == '#text') {
            textList.push(getText(this.el));
        }
        else {
            iter(this.el);
        }
        return textList.join('');
    }
    toHtml(onlyContent?: boolean) {
        let pre = '', post = '';
        if (this.isElem() && !onlyContent) {
            let attrs = [this.el.nodeName] as string[];
            for (let at of this.el.attrs) {
                attrs.push(`${at.name}="${at.value}"`);
            }
            pre = '<' + attrs.join(' ') + '>';
            post = '</' + this.el.nodeName + '>';
        }
        return pre + parse5.serialize(this.el).trim() + post;
    }

    isText() {
        return docFn.isTextNode(this.el);
    }
    isElem() {
        return docFn.isElementNode(this.el);
    }

    find(tagName: string | null, attrName: string | null, attrContent: string | null, many: boolean) {
        return findEls(this.el, tagName, attrName, attrContent, many);
    }
    findByClass(className: string, tagName?: string) {
        return this.find(tagName || null, 'class', className, true);
    }
    firstByClass(className: string, tagName?: string) {
        let els = this.find(tagName || null, 'class', className, false);
        return els.length ? els[0] : null;
    }
    findByTag(tagName: string) {
        return this.find(tagName, null, null, true);
    }
    firstByTag(tagName: string) {
        let els = this.find(tagName, null, null, false);
        return els.length ? els[0] : null;
    }


    parentIndex() {
        let parent = this.el.parentNode;
        return parent.childNodes.indexOf(this.el);
    }
    parentFind(tagName: string) {
        let parentFind: Elem | null = null;
        let parent = this.el.parentNode as IElement;
        while (parent && parent.tagName) {
            if (parent.tagName == tagName) {
                parentFind = new Elem(parent);
                break;
            }
            parent = parent.parentNode as IElement;
        }
        return parentFind;
    }
    parent() {
        return new Elem(this.el.parentNode as IElement);
    }


    remove() {
        docFn.detachNode(this.el);
    }
    removeAttrs() {
        this.el.attrs = [];
        return this;
    }
    removeChild() {
        while (this.el.childNodes.length)
            docFn.detachNode(this.el.childNodes[0]);
        return this;
    }
    removeAttr(name: string) {
        let attrs = this.el.attrs;
        for (let i = 0; i < attrs.length; i++) {
            if (attrs[i].name == name) {
                attrs.splice(i, 1);
                break;
            }
        }
        return this;
    }

}
class ElemLink extends Elem {
    href(value: string) {
        this.set('href', value);
        return this;
    }
    rel(value: string) {
        this.set('rel', value);
        return this;
    }
    type(value: string) {
        this.set('type', value);
        return this;
    }
    sizes(value: string) {
        this.set('sizes', value);
        return this;
    }
}
class ElemMeta extends Elem {
    content(value: string | number) {
        this.set('content', value);
        return this;
    }
    name(value: string) {
        this.set('name', value);
        return this;
    }
    property(value: string) {
        this.set('name', value);
        return this;
    }
}
class ElemScript extends Elem {
    isTemplate() {
        this.set('type', 'html/template');
        return this;
    }
}
class ElemA extends Elem {
    href(value: string | number) {
        this.set('href', value);
        return this;
    }
    blank() {
        this.set('target', '_blank');
        return this;
    }
    relNoFollow() {
        this.set('rel', 'nofollow');
        return this;
    }
    dataLink(value: string) {
        this.set('data-link', value.replace(/\//g, ' '));
        this.as('external');
        return this;
    }
}
class ElemTime extends Elem {
    datetime(value: string | Date) {
        this.set('datetime', dateDate(value));
        return this;
    }
}
class ElemImg extends Elem {
    src(value: string) {
        this.set('src', value);
        return this;
    }
    srcset(value: string, size = 2) {
        this.set('srcset', value + ' ' + size + 'x');
        return this;
    }
    alt(value: string) {
        this.set('alt', value);
        return this;
    }
    width(value: string | number) {
        this.set('width', value.toString());
        return this;
    }
    height(value: string | number) {
        this.set('height', value.toString());
        return this;
    }
}
class ElemCanvas extends Elem {
    dataSrc(value: string) {
        this.set('data-src', value);
        return this;
    }
    width(value: string | number) {
        if (value) this.set('width', value.toString());
        return this;
    }
    height(value: string | number) {
        if (value) this.set('height', value.toString());
        return this;
    }
}
class ElemCell extends Elem {
    col(value: string | number) {
        this.set('colspan', value);
        return this;
    }
    row(value: string | number) {
        this.set('rowspan', value);
        return this;
    }
}

export function E(name: string) {
    return new Elem(name);
}
export function Img() {
    return new ElemImg('img');
}
export function Canvas() {
    return new ElemCanvas('canvas');
}
export function Div() {
    return new Elem('div');
}
export function P() {
    return new Elem('p');
}
export function Span() {
    return new Elem('span');
}
export function Time() {
    return new ElemTime('time');
}
export function UL() {
    return new Elem('ul');
}
export function OL() {
    return new Elem('ol');
}
export function LI() {
    return new Elem('li');
}
export function Figure() {
    return new Elem('figure');
}
export function Figcaption() {
    return new Elem('figcaption');
}
export function Table() {
    return new Elem('table');
}
export function TBody() {
    return new Elem('tbody');
}
export function TR() {
    return new Elem('tr');
}
export function TD() {
    return new ElemCell('td');
}
export function TH() {
    return new ElemCell('th');
}
export function BR() {
    return new Elem('br');
}
export function Meta() {
    return new ElemMeta('meta');
}
export function Link() {
    return new ElemLink('link');
}
export function A() {
    return new ElemA('a');
}
export function Script() {
    return new ElemScript('script');
}
export function Comment(text: string) {
    return new Elem(docFn.createCommentNode(text) as any)
}

export class HTMLDoc {
    doc: parse5.AST.Default.Document
    private _body!: Elem
    private _head!: Elem
    constructor(html: string) {
        this.doc = parse5.parse(html) as parse5.AST.Default.Document;
    }
    comment(text: string) {
        return new Elem(docFn.createCommentNode(text) as any);
    }
    findByClass(className: string, tagName?: string) {
        return this.find(tagName || null, 'class', className, true);
    }
    findByTag(tagName: string) {
        return this.find(tagName, null, null, true);
    }
    firstByTag(tagName: string) {
        let els = this.find(tagName, null, null, false);
        return els.length ? els[0] : null;
    }
    firstByClass(className: string, tagName?: string) {
        let els = this.find(tagName || null, 'class', className, false);
        return els.length ? els[0] : null;
    }
    find(nameFind: string | null, attrName: string | null, attrContent: string | null, many: boolean) {
        return findEls(this.doc as any, nameFind, attrName, attrContent, many);
    }
    body() {
        if (!this._body) {
            let els = this.find('body', null, null, false);
            if (els.length) this._body = els[0];
        }
        return this._body;
    }
    head() {
        if (!this._head) {
            let els = this.find('head', null, null, false);
            if (els.length) this._head = els[0];
        }
        return this._head;
    }
    html() {
        return parse5.serialize(this.doc);
    }
    htmlBody() {
        return parse5.serialize(this.body().el);
    }
}
