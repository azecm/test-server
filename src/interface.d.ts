interface IDict<T> { [str: string]: T }

interface ISession {
    ip: string
    start: number
    browser: string
    idu?: number
    email?: string[]
    name?: string
}

interface IUser {
    idu: number
    name: string
    password: string
    status: number
    visits: number
    dateAdd: string
    dateLast: string
    dateLastPM: string
    email: string
    last?: number
    subnet?: string | number
    webpage?: string
    description?: string
}


interface IRedisTree {
    idp: number
    path: string
    text: string
    first: number
    next: number
}
interface IDBTree {
    idn: number
    idp: number
    idu: number
    text: string
    path: string
    prev: number
    next: number
    first: number
    last: number
    flagFolder: boolean
    flagValid: boolean
    flagBlock: boolean
    dateAdd: number
    commentAll: number
    commentLast: number
}


//interface IRequest extends ServerRequest { }
//export interface IElement extends libxmljs.Element { }
//export interface IHTMLDocument extends libxmljs.HTMLDocument { }