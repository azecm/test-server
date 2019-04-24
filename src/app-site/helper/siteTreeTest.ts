import * as fw from "../../fw";

// node --use_strict /usr/local/www/app.back/app-site/helper/siteTreeTest.js
(async function () {
    let tree: fw.ITree, counter = 0;
    function iter1(idp: number, level:number) {
        if (!idp) counter = 0;
        let idn = tree[idp].first;
        let idnPrev: number|undefined;
        while (idn) {
            if (tree[idn]) {
                if (tree[idn].first) {
                    iter1(idn, level+1);
                }
                counter++;
                idnPrev = idn;
                idn = tree[idn].next;
            }
            else {
                console.log(level, idn, idnPrev, 'break');
                break;
            }
        }
    }
    function iter2(idp: number) {
        if (!idp) counter = 0;
        let idn = tree[idp].last;
        while (idn) {
            if (tree[idn]) {
                if (tree[idn].last) {
                    iter2(idn);
                }
                counter++;
                idn = tree[idn].prev;
            }
            else {
                console.log(idn, 'break');
                break;
            }
        }
    }

    for (let host of fw.getHosts()) {
        console.log(host);
        tree = await fw.asyncTreeSyncLoad(host);
        iter1(0, 0);
        if (Object.keys(tree).length != counter + 1)
            console.log('first-next', Object.keys(tree).length == counter+1);
        iter2(0);
        if (Object.keys(tree).length != counter + 1)
            console.log('last-prev', Object.keys(tree).length == counter+1);
    }
})();