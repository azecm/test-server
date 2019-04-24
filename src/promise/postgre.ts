
import { Client, Pool, PoolClient, QueryResult } from 'pg';

// https://www.npmjs.com/package/pg
// https://node-postgres.com/


/*
CREATE SCHEMA name
CREATE DATABASE "имя_базы"
  WITH OWNER "postgres"
  ENCODING 'UTF8'
  LC_COLLATE = 'ru_RU.UTF-8'
  LC_CTYPE = 'ru_RU.UTF-8';

CREATE DATABASE mydbname ENCODING 'UTF-8' LC_COLLATE 'ru_RU.UTF-8' LC_CTYPE 'ru_RU.UTF-8'
*/

//interface IBoolean extends Array<any> {
//    [0]: null | string
//    [1]: boolean
//}
//interface IType<T> extends Array<any> {
//    [0]: null | string
//    [1]: T
//}

//db.query('DROP SCHEMA IF EXISTS ' + db.schema + ' CASCADE;');
//db.query('CREATE SCHEMA ' + db.schema + ';');

//https://en.wikipedia.org/wiki/Relational_operator
const signDict = { eq: '=', ne: '!=', gt: '>', lt: '<', ge: '>=', le: '<=' } as { [s: string]: string };
function getWhere(main: { _counter: number, _value: string[] }, o: any) {
    let condition = function (out: string[], key: string, sign: string, val: string) {
        if (/number|boolean/.test(typeof (val))) {
            out.push(colName(key) + sign + val);
        }
        else {
            main._value.push(val);
            out.push(colName(key) + sign + ('$' + (++main._counter)));
        }
    };
    let where = function (o: any, joiner?: string) {
        !(joiner) && (joiner = '');
        let out = [] as string[];
        for (let key in o) {
            if (/and|or/i.test(key)) {
                out.push(where(o[key], ' ' + key.toUpperCase() + ' '));
            }
            else {
                let obj = o[key];
                if (typeof (obj) == 'object') {
                    for (let sign of Object.keys(obj)) {
                        if (sign == 'in') {
                            if (typeof (obj.in[0]) == 'number') {
                                out.push(`${colName(key)} in (${obj.in.join(',')})`);
                            }
                        }
                        else {
                            condition(out, key, signDict[sign], obj[sign]);
                        }
                    }
                }
                else {
                    condition(out, key, '=', obj);
                }
            }
        }
        return joiner ? ('(' + out.join(joiner) + ')') : out.join(joiner);
    }
    return where(o);
}


const reUpperCase = /[A-Z]/;
function colName(name: string) {
    if (name == 'count') name = 'COUNT(*)';
    else name = reUpperCase.test(name) ? '"' + name + '"' : name;
    return name;
}

class Select<T>{
    protected postgre: PostgreSQL
    protected _value: string[]
    private _from!: string
    private _select: string
    private _where: any
    private _order!: string
    private _limit!: number
    private _offset!: number
    //private _counter: number
    constructor(postgre: PostgreSQL, data: T) {
        this.postgre = postgre;

        const keysGet = Object.keys(data), keys = [] as string[];
        if (keysGet.length)
            for (let name of keysGet) keys.push(colName(name));
        else
            keys.push('*');
        this._select = keys.join(',')

        //this._counter = 0;
        this._value = [];
    }
    fromTree() {
        this._from = 'tree';
        return this;
    }
    from(table: string) {
        this._from = table;
        return this;
    }
    where(data: any) {
        this._where = data;
        return this;
    }
    order(data: any) {
        let key = Object.keys(data)[0];
        this._order = colName(key) + ' ' + (data[key] == -1 ? 'DESC' : 'ASC');
        return this;
    }
    limit(val: number) {
        this._limit = val;
        return this;
    }
    offset(val: number) {
        this._offset = val;
        return this;
    }
    //abstract __exec(query: string):any
    protected get(flagPrint?: boolean) {
        let line = ['SELECT'] as string[];
        line.push(this._select);
        line.push('FROM');
        line.push(this.postgre.schemaDot + this._from);
        if (this._where) {
            line.push('WHERE');
            line.push(getWhere(this as any, this._where));
        }
        if (this._order) {
            line.push('ORDER', 'BY', this._order);
        }
        if (this._limit) {
            line.push('LIMIT', this._limit.toString());
        }
        if (this._offset) {
            line.push('OFFSET', this._offset.toString());
        }
        let query = line.join(' ') + ';';
        if (flagPrint) console.log(query);
        return query;
    }
    exec(flagPrint?: boolean) {
        let query = this.get(flagPrint);
        return this.postgre.query<T>(query, this._value);
    }
}

class Create {
    private postgre: PostgreSQL
    private _name: string
    private lineList: string[] = []
    private current!: string[]
    constructor(postgre: PostgreSQL, name: string) {
        this.postgre = postgre;
        this._name = name;
    }
    private addLine() {
        if (this.current) this.lineList.push(this.current.join(' '));
    }
    exec(flagPrint?: boolean) {
        this.addLine();
        let lines = this.lineList.join(',\n');
        let query = [`CREATE TABLE ${this.postgre.schemaDot}${this._name}(`, lines, ');'].join('\n');
        if (flagPrint) console.log(query);
        return this.postgre.query(query);
    }
    col(name: string) {
        this.addLine();
        //this.current = ["'"+name+"'"];
        this.current = [colName(name)];
        //this.current = [name];
        return this;
    }
    primaryKey() {
        this.current.push('PRIMARY KEY');
        return this;
    }
    notNull() {
        this.current.push('NOT NULL');
        return this;
    }
    default(val: string | number | boolean) {
        if (typeof (val) == 'string') {
            this.current.push("DEFAULT '" + (val) + "'");
        }
        else {
            this.current.push('DEFAULT ' + val);
            //this._value.push(val.toString());
        }
        return this;
    }

    // type
    integer() {
        this.current.push('integer');
        return this;
    }
    bigint() {
        this.current.push('bigint');
        return this;
    }
    boolean() {
        this.current.push('boolean');
        return this;
    }
    varchar(length: number) {
        this.current.push(`varchar(${length})`);
        return this;
    }
}

class Update {
    // https://www.postgresql.org/docs/9.6/static/sql-update.html
    private postgre: PostgreSQL
    private name: string
    private _counter = 0
    private _value: string[] = []
    private _set = ''
    private _where = ''
    private _return = ''
    constructor(postgre: PostgreSQL, name: string) {
        this.postgre = postgre, this.name = name;
    }
    set(data: any) {
        let names = [] as string[], ind = [] as string[];
        for (let name in data) {
            let val = data[name].toString() as string;
            names.push(colName(name));
            ind.push('$' + (++this._counter));
            this._value.push(val);
        }
        this._set = `SET (${names.join(',')}) = (${ind.join(',')})`;
        return this;
    }
    where(data: any) {
        this._where = 'WHERE ' + getWhere(this as any, data);
        return this;
    }
    return(keys: string[]) {
        this._return = 'RETURNING ' + keys.join(',');
        return this;
    }
    exec(flagPrint?: boolean) {
        // UPDATE products SET price = 10 WHERE price = 5;
        let list = ['UPDATE', this.postgre.schemaDot + this.name, this._set];
        if (this._where) list.push(this._where);
        if (this._return) list.push(this._return);
        let query = list.join(' ').trim() + ';';
        if (flagPrint) console.log(query);
        return this.postgre.query(query, this._value);
    }
}

/*
interface IPostgreField {
    name: string
    tableID: number
    columnID: number
    dataTypeID: number
    dataTypeSize: number
    dataTypeModifier: number
    format: string
}
*/
interface IPostgreResult<T> extends QueryResult {
    //command: string //'SELECT'
    //rowCount: number
    rows: T[]
    //oid: number
    //fields: IPostgreField[]
}
//interface IQuery<T> {
////    err: null | string
//    result: IPostgreResult<T>
//////    rows: T[]
//}

export class PostgreSQL {
    async = true
    private client!: Client | Pool
    schema: string
    schemaDot: string

    private poolClient!: PoolClient;
    private connectMark!: string;
    private connectState!: string;

    private config = { user: 'former', password: 'yeqer6', host: 'localhost', database: 'form', port: 5432 }

    constructor(schema?: string) {
        this.error = this.error.bind(this);
        this.queryErr = this.queryErr.bind(this);
        if (schema) {
            schema = schema.replace(/[^\w]/g, '');
            this.schema = schema;
            this.schemaDot = schema + '.';
        }
        else {
            this.schema = this.schemaDot = '';
        }
    }
    private errorMessage(e: Error){
        console.error(`postgre [${this.connectMark}:${this.connectState}]`, (this.poolClient ? 'poolClient' : ''), this.schema, e);
    }
    private error(e: Error) {
        this.errorMessage(e);
        return false;
    }
    private queryErr(e: Error): IPostgreResult<any> {
        this.errorMessage(e);
        return { command: '', fields: [], oid: 0, rowCount: 0, rows: [] };
    }
    /*
    pool(): Promise<null | Error> {
        //https://node-postgres.com/api/pool

        this.connectState = 'pool';

        const pool = this.client = new Pool(this.config);
        pool.on('error', this.error);

        return pool.connect().then((poolClient) => {
            this.poolClient = poolClient;
            return null;
        }).catch(this.error);
    }
    */
    connect(msg = ''): Promise<boolean> {
        this.connectState = 'connect';
        this.connectMark = msg;
        this.client = new Client(this.config);
        this.client.on('error', this.error);
        return this.client.connect().then((d: any) => true).catch(this.error);
    }
    end(): Promise<boolean> {
        this.connectState = 'end';
        if (this.poolClient) {
            this.poolClient.release();
        }
        return this.client.end().then((d: any) => true).catch(this.error);
    }
    begin(): Promise<boolean> {
        this.connectState = 'begin';
        //https://node-postgres.com/features/transactions
        //Do not use transactions with pool.query. 
        return this.client.query('BEGIN;').then((d: any) => true).catch(this.error);
    }
    commit(): Promise<boolean> {
        this.connectState = 'commit';
        return this.client.query('COMMIT;').then((d: any) => true).catch(this.error);
    }
    query<T>(text: string, values?: any): Promise<IPostgreResult<T>> {
        if (text.slice(-1) != ';') text += ';';
        this.connectState = text + (values? '[' + values.join(', ') + ']':'');

        //console.log(this.connectState);

        return this.client.query(text, values).then(result => result).catch(this.queryErr);
        //return this.client.query(text, values)
        //    .then((result: IPostgreResult<T>) => result)
        //    .catch((err: any) => ({ err, result: null as any, rows: [] }))
        //    ;
    }
    select<T>(data: T) {
        return new Select<T>(this, data);
    }
    createTable(name: string) {
        return new Create(this, name);
    }
    update(table: string) {
        return new Update(this, table);
    }
    insert(table: string, data: any) {
        let names = [] as string[], values = [] as any[], ind = [] as string[], count = 0;;
        for (let key in data) {
            ind.push('$' + (++count));
            names.push(colName(key));
            values.push(data[key]);
        }
        return this.query('INSERT INTO ' + this.schemaDot + table + ' (' + names.join(',') + ') VALUES (' + ind.join(',') + ');', values);
    }
    delete(table: string, where: any) {
        // https://www.postgresql.org/docs/9.6/static/sql-delete.html
        // DELETE FROM films WHERE kind <> 'Musical';
        let data = { _counter: 0, _value: [] as string[] };
        let list = ['DELETE', 'FROM', this.schemaDot + table, 'WHERE', getWhere(data, where)];
        //console.log(list);
        let sql = list.join(' ');
        return this.query(sql, data._value);
    }
    dropTable(name: string) {
        return this.query('DROP TABLE IF EXISTS ' + this.schemaDot + name + ' CASCADE;')
    }
}