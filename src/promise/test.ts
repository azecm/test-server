
import { PostgreSQL } from "./postgre";

// node /usr/local/www/app.back/promise/test.js

const host = 'toy';

(async function () {
    const db = new PostgreSQL(host);
    await db.connect('test::function');
    
    const select1 = await db.select({ idn: 0 }).fromTree()
            .where({
                and: {
                    idn: { gt: 0 }, flagFolder: false, flagValid: false
                }
            })
            .order({ idn: 1 }).exec(true);
    console.log(select1.rows.length);
    await db.end();
})();
