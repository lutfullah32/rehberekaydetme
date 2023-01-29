
const {
    v1: uuidv1,
    v4: uuidv4,
} = require('uuid');
const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const request = require('request');
const fs = require('fs');
const https = require('https');
var FormData = require('form-data');
var quotedPrintable = require('quoted-printable');
var utf8 = require('utf8');

var XLSX = require('xlsx')
const FSDB = require("file-system-db");
const db = new FSDB("db/database.json", false); 


var token = "";

var baseURL = "https://api.telegram.org/bot";
var baseURLfile = "https://api.telegram.org/file/bot";

const bot = new Telegraf(token);
var startNote = "Not: Rehberde karışıklık yaşamamak için '/ek önek' komutunu çalıştırarak isimlerin önüne ön ek getirebilirsiniz.\nÖrnek '/ek OSMNLC'\nOSMNLC Ali Ak";
bot.start((ctx) => ctx.reply('Merhaba,\nBu bot ile elinizdeki ilk sütunu isim ve sonraki satırı numaralardan oluşan exceli rehberinize kaydedecek formata dönüştürebilirsiniz.\nTek yapmanız gereken exceli paylaşmak..\n\n'+ startNote));

bot.on(message('sticker'), (ctx) => ctx.reply('👍'));
var _body;
var _file_path;
bot.on(message('document'), (ctx) => {
    //console.log(ctx.message.document.file_id);
    var uuid = uuidv4();

    const istek = https.get(baseURL + token + "/getFile?file_id=" + ctx.message.document.file_id, function (response) {
        var body = '';
        response.on('data', (data) => {
            body += data;
            //_file_path = data.result.file_path
        })
        response.on('end', function () {
            var fbResponse = JSON.parse(body);
            //console.log(body)
            _file_path = fbResponse.result.file_path
            var fileExtension = _file_path.split('.').slice(-1)[0].toLowerCase()
            if (fileExtension != 'xlsx' && fileExtension != 'xls' && fileExtension != 'csv') {
                ctx.reply("Lütfen bir excel dosyası gönderiniz.")
                return
            }
            //console.log(_file_path)
            getRemoteFile(uuid + ".xlsx", baseURLfile + token + "/" + _file_path, ctx.message.chat.id);
        });

        // https://api.telegram.org/file/bot" + token + "/" + _file_path
    });
});

bot.command('ek', ctx => {
    //console.log(ctx.from, ctx.message)
/*     bot.telegram.sendMessage(ctx.chat.id, 'hello there! Welcome to my new telegram bot.', {})
 */    
    db.set(ctx.chat.id.toString(), ctx.message.text.split(' ')[1]);
    //console.log(db.get(ctx.chat.id.toString()))
    var prefix = db.get(ctx.chat.id.toString())
    //ctx.reply("Rehbere kaydedilecek isimlerin ön eki _"+prefix+"_ olarak belirlenmiştir.", {reply_markup: 'markdown'})
    ctx.replyWithMarkdownV2("Rehbere kaydedilecek isimlerin ön eki *"+prefix+"* olarak belirlenmiştir")
})

bot.launch();

function excelToJSON(filename) {
    var workbook = XLSX.readFile(filename);
    var sheet_name_list = workbook.SheetNames;
    //console.log(sheet_name_list[0])
    var xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
    return xlData;
}

function getRemoteFile(filename, url, chat_id) {
    let localFile = fs.createWriteStream(filename);
    //console.log(url)
    const request = https.get(url, function (response) {
        var len = parseInt(response.headers['content-length'], 10);
        var cur = 0;
        var total = len / 1048576; //1048576 - bytes in 1 Megabyte

        response.on('data', function (chunk) {
            cur += chunk.length;
            //showProgress(filename, cur, len, total);
        });

        response.on('end', function () {
            //console.log("Download complete");
            localFile.close()
            var jsonrehber = excelToJSON(filename)
            //console.log(jsonrehber)
            jsonToVCF(jsonrehber, chat_id);
            try {
                fs.unlinkSync(filename);
                //console.log(filename+ " Delete File successfully.");
            } catch (error) {
                console.log(error);
            }
        });

        response.pipe(localFile);
    });
}

function jsonToVCF(json, chat_id) {
    //console.log(json)
    var vcffile = "";
    var vcfformat = fs.readFileSync('vcfformat.txt', 'utf8');
    var writestatu = true;
    console.log(json)
    if(JSON.stringify(json) === JSON.stringify([]) || JSON.stringify(json) === JSON.stringify({})){
        bot.telegram.sendMessage(chat_id, "Excelde dönüştürülecek satır bulunamadı.")
        //console.log("excel boş")
        return;
    }
    json.forEach((repo) => {
        var line = vcfformat;
        Object.entries(repo).forEach(([key, value]) => {
            if (writestatu) {
                var prefix = db.get(chat_id.toString())
                line = line.replace("$name$", quotedPrintable.encode(utf8.encode(prefix +" "+ value)))
                //line = line.replace("$name$", value)
            } else {
                line = line.replace("$tel$", value)
            }
            writestatu = !writestatu;
        });
        vcffile = vcffile + line;
    });
    //console.log(vcffile)
    var vcffilename = uuidv4() + ".vcf";
    fs.writeFileSync(vcffilename, vcffile);
    //console.log(vcffilename)
    //file send
    bot.telegram.sendDocument(chat_id, {
        source: vcffilename,
        filename: vcffilename
    }).catch(function (error) { console.log(error) })
    setTimeout(function() {
        try {
            fs.unlinkSync(vcffilename);
            //console.log(vcffilename + " Delete File successfully.");
        } catch (error) {
            console.log(error);
        }
    }, 1000);
}

function deleteFile(filename){
    try {
        fs.unlinkSync(filename);
        //console.log(filename + " Delete File successfully.");
    } catch (error) {
        console.log(error);
    }
}

function showProgress(file, cur, len, total) {
    console.log("Downloading " + file + " - " + (100.0 * cur / len).toFixed(2)
        + "% (" + (cur / 1048576).toFixed(2) + " MB) of total size: "
        + total.toFixed(2) + " MB");
}


// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));