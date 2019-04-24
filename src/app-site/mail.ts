


// npm install -g nodemailer
// npm install -g nodemailer-smtp-transport

import * as fs from "fs";
import * as fw from "../fw";
//import { execSync } from "child_process";

new fw.Spawn().data(process.stdin, sendForm);

interface IData {
    host: string
    ip: string
    browser: string
    userMessage?: {
        from: string
        email: string
        data: string
    }
    recovery?: {
        pass: string
        email: string
        name: string
    }
    registration?: string[]
    data: any
}

function sendForm(data: IData) {

    function testSpam(data: any) {
        let out: () => any;
        function f1() {
            return data.map(function (line: string) {
                if (typeof (line) == "string") {
                    line = fw.textClean(line, 1).replace(/(content-type:|to:|cc:|bcc:|mime-version:|subject:)/g, "");
                }
                return line;
            });
        }
        function f2() {
            Object.keys(data).forEach(function (key) {
                if (typeof (data[key]) == "string") {
                    data[key] = fw.textClean(data[key], 1).replace(/(content-type:|to:|cc:|bcc:|mime-version:|subject:)/g, "");
                }
            });
            return data;
        }
        if (Array.isArray(data)) {
            out = f1;
        }
        else {
            out = f2;
        }
        return out();
    }

    //fw.err('mailform', data);

    let ini = require("./ini/" + data.host);
    let message: string[] = [], from = "no-reply@" + data.host.replace('www.', ''), toList: string[] = [], subject = "";

    if (data.userMessage) {
        subject = "сообщение с сайта " + data.host + " от " + data.userMessage.from;
        toList = [data.userMessage.email];

        data.userMessage.data = testSpam(data.userMessage.data);

        message.push("");
        message.push("-----------------------------------------");
        message.push("");
        message.push("Для ответа заполните форму на этой странице");
        message.push("http://" + data.host + "/operation/user/" + encodeURIComponent(data.userMessage.from));
        message.push("");
        message.push("Если вы просто ответите на это письмо, отправитель его не получит.");
        message.push("");
        message.push("-----------------------------------------");
        message.push("");
        message.push("От пользователя: " + data.userMessage.from);
        message.push("Browser: " + data.browser);
        message.push("ip: " + data.ip);
        message.push("");
        message.push("Сообщение:");
        message.push(data.userMessage.data);
        message.push("");
        message.push("-----------------------------------------");
        message.push("");
        message.push("http://" + data.host + "/");
        message.push("");

    }
    else if (data.recovery) {
        message.push("");
        message.push("Здравствуйте!");
        message.push("");
        message.push("Ваш пароль на сайте " + data.host + ":");
        message.push(data.recovery.pass);
        message.push("имя пользователя:");
        message.push(data.recovery.name);
        message.push("");
        message.push("-----");
        message.push("http://" + data.host);

        subject = "восстановление пароля на сайте " + data.host;
        toList = [data.recovery.email];
    }
    else if (data.registration) {
        let registration = data.registration;
        registration = testSpam(registration);

        let regData = <fw.IRegistration>{
            key: fw.codeAlpha(fw.now() + data.browser + data.ip),
            browser: data.browser,
            ip: data.ip,
            data: {
                name: registration[0]
                , password: registration[1]
                , email: registration[2]
            }
        };

        fw.saveSyncJson(fw.pathType.memory + data.host + "/registration/" + regData.key + fw.extJson, regData);

        message.push("");
        message.push("Здравствуйте!");
        message.push("");
        message.push("Вы запросили регистрацию на сайте " + data.host + ":");
        message.push("Для завершения процесса регистрации пройдите по ссылке");
        message.push("http://" + data.host + "/registration/" + regData.key);
        message.push("");
        message.push("-----");
        message.push("http://" + data.host);


        subject = "регистрация на сайте " + data.host;
        toList = [registration[2]];
    }
    else {
        //console.log(data);
        if (Array.isArray(data.data) && data.data.length == 3) {
            // почтовая форма
            // [name,email,message]
            data.data = testSpam(data.data);

            message.push("Browser: " + data.browser);
            message.push("ip: " + data.ip);
            message.push("");

            message.push("Имя: " + data.data[0]);
            if (data.data[1].indexOf("@") > -1 && /^([a-z_0-9\.\-]+)\@([a-z_0-9\.\-]+)\.([a-z]+)/i.test(data.data[1])) {
                message.push("Email: " + data.data[1]);
                //from = fw.toMimeUTF(data.data[0]) + " <" + data.data[1] + ">";
            }
            else {
                message.push("Контактные данные: " + data.data[1]);
            }

            message.push("");
            message.push("Сообщение:\n" + data.data[2]);
            message.push("");
            message.push("---");
            message.push(data.host);

            subject = "сообщение с сайта " + data.host;
            toList = ini.admin.email;
        }
        else {
            if (data.data.data) {
                let dataKeys = data.data.data;
                delete (data.data.data);
                data.data = testSpam(data.data);

                message.push("Browser: " + data.browser);
                message.push("ip: " + data.ip);
                message.push("");

                Object.keys(dataKeys).forEach(function (name) {
                    if (data.data[name].length > 200) {
                        message.push("");
                        message.push(dataKeys[name] + ": " + data.data[name]);
                        message.push("");
                    }
                    else {
                        message.push(dataKeys[name] + ": " + data.data[name]);
                    }
                });
                message.push("");
                message.push("---");
                message.push(data.host);

                subject = "сообщение с сайта " + data.host;
                toList = ini.admin.email;

            }
        }
    }

    //message = ["11","22"];
    //toList.forEach(function (to) {
    //	let res = <string> execSync("/usr/local/bin/sendEmail -f "" + from + "" -t " + to + " -o message-charset=utf-8 -u "" + fw.toMimeUTF(subject) + "" -m "" + message.join("\n").replace(/"/g, "\\\"") + """, { timeout: 5000, encoding: "utf8"});
    //	if (res.indexOf("sent successfully!") == -1) {
    //		console.error("ERR mail.js::sendEmail", res);
    //	}
    //});
    
    let pathToText = fw.pathType.cache + "mail/" + fw.now() + Math.floor(Math.random() * 100) + ".txt";
    fs.writeFileSync(pathToText, message.join("\n"), { encoding: "utf8" });
    toList.forEach(function (to) {

        let cmd = ["/usr/local/bin/smtp-cli"];
        // --hello-host=<string>
        cmd.push("--missing-modules-ok");
        //cmd.push("--print-only");
        cmd.push("--server=localhost");
        cmd.push("--remove-header=X-Mailer");
        cmd.push("--charset=utf-8");
        cmd.push("--text-encoding=8bit");
        cmd.push(`--from "${from}"`);
        cmd.push(`--to "${to}"`);
        cmd.push(`--add-header="From2: ${from}"`);
        cmd.push(`--add-header="To2: ${to}"`);
        cmd.push(`--subject "${fw.toMimeUTF(subject)}"`);
        cmd.push("--body-plain " + pathToText);
        //cmd.push("--body-html " + pathToHtml);

        // /usr/local/bin/smtp-cli --missing-modules-ok --server=localhost --remove-header=X-Mailer --charset=utf-8 --text-encoding=8bit --from no@bbb.hnh.ru --to mr@xlab.ru  --subject 67687 --body-plain jkjhjkhkjh

        let log = fw.execSync(cmd.join(" "));
        if (log) {
            fw.err("app-mail send\n---\n");
            fw.err("app-mail send\n---\n", log);
        }
    });
    fs.unlinkSync(pathToText);

    /*let attachPost: string[][] = [];
    if (post.message.attachments) {
        message.attachments = [];
        post.message.attachments.forEach(function (line, i) {
            let src = fw.pathType.cache + "mail/temp/" + mesID + "-" + line.id + ".tmp";
            let dst = fw.pathType.cache + "mail/" + post.box + "/file/" + mesID + "-" + (i + 1) + ".tmp";
            let sym = fw.pathType.cache + "mail/temp/" + fw.toMimeUTF(line.name);

            fs.renameSync(src, sym);
            cmd.push("--attach "" + sym + """);
            attachPost.push([sym, dst]);

            message.attachments.push({
                name: line.name,
                length: line.length,
                id: i + 1
            });
        });
    }
    */


    fw.Spawn.msg("ok");
    process.exit(0);
}

