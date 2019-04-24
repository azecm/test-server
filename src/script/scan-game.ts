import * as fw from "../fw";
import { HTMLDoc } from "../fw-dom";

// node /usr/local/www/app.back/script/scan-game.js

function scanner(host: string) {
    //game-find-diff
    console.log('++');
    const key = 'game-crossing';
    for (let node of fw.loadDirNodeGen(host)) {

        if (node.content.indexOf(key) > -1) {
            console.log('++');
            let doc = new HTMLDoc(node.content);
            for (let el of doc.find('p', 'class', 'shop', true)) {
                let oldText = el.toText().trim();
                if (oldText.startsWith(key)) {
                    console.log('');
                    console.log(el.toHtml());

                    el.removeAttrs();
                    el.attr({ class: 'command' });

                    let html = ['funny(crossing'];
                    /*
                    html.push(',');
                    html.push(
                        'data=' + oldText.substr(key.length).replace(/\,/g, ' ').replace(/\+\+/g, '+<br>+')
                    );
                    */
                    html.push(')');

                    el.removeChild();
                    //el.htmlAppend(html.join('<br>'));
                    el.htmlAppend(html.join(''));

                    console.log('=');
                    console.log(el.toHtml());

                    //node.content = doc.htmlBody();
                    //fw.saveSyncNode(host, node);
                    console.log(node.head.idn);
                }
            }

        }
    }
}


scanner('toy');