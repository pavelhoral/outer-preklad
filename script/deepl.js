#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const program = require('commander');
const md5 = require('md5');
const xml2js = require('xml2js');
const { MessageParser, MessageWriter } = require('./text/text-factory');

program
    .command('prepare')
    .option('-s, --source <source>', 'source folder with translation files', 'source/cs')
    .option('-t, --target <target>', 'target XML filename', 'work/messages')
    .action(({ source, target }) => {
        const items = {};
        for (const filename of loadFilenames(source)) {
            const content = fs.readFileSync(filename, 'utf8');
            new MessageParser().parse(content).forEach(message => {
                const id = md5(message.msgctxt).substring(0, 10);
                if (items[id]) {
                    throw new Error('Duplicate context hash');
                }
                items[id] = message.msgid;
            });
        }
        let idx = 0;
        let chunk = {};
        let length = 0;
        for (const [id, value] of Object.entries(items)) {
            length += value.length;
            if (length > 990000) {
                writeHtml(`${target}_${idx}.html`, chunk);
                chunk = {};
                length = 0;
                idx++;
            } else {
                chunk[id] = value;
            }
        }
        if (Object.keys(chunk).length) {
            writeHtml(`${target}_${idx}.html`, chunk);
        }
    });

program
    .command('process <filename>')
    .option('-s, --source <source>', 'source folder with translation files', 'source/cs')
    .action(async (filename, { source }) => {
        const loaded = await (new xml2js.Parser().parseStringPromise(fs.readFileSync(filename, 'utf8')));
        const data = loaded.html.body[0].p.reduce((acc, item) => {
            acc[item.$.id] = item._;
            return acc;
        }, {});
        for (const filename of loadFilenames(source)) {
            const messages = new MessageParser().parse(fs.readFileSync(filename, 'utf8'));
            let updated = false;
            for (const message of messages) {
                const id = md5(message.msgctxt).substring(0, 10);
                if (data[id]) {
                    message.msgstr = data[id];
                    updated = true;
                }
            };
            if (updated) {
                const gettext = new MessageWriter().writeMessages(messages);
                fs.writeFileSync(filename, gettext);
            }
        }
    });

program.parse(process.argv);
if (!program.args.length) {
    program.help();
}

function loadFilenames(base) {
    const filenames = [];
    const dirnames = [base];
    while (dirnames.length > 0) {
        const current = dirnames.shift();
        fs.readdirSync(current, { withFileTypes: true }).forEach(entry => {
            if (entry.isDirectory()) {
                dirnames.push(path.join(current, entry.name));
            } else if (entry.name.endsWith('.po')) {
                filenames.push(path.join(current, entry.name));
            }
        });
    }
    return filenames;
}

function writeHtml(filename, items) {
    const content = new xml2js.Builder({
        headless: true,
        renderOpts: {
            pretty: true,
            indent: '',
            newline: '\n'
        }
    }).buildObject({
        html: {
            $: {
                lang: 'en'
            },
            head: {
                meta: {
                    $: {
                        charset: 'utf-8'
                    }
                }
            },
            body: {
                p: Object.entries(items).map(([id, value]) => ({ 
                    $: { id: id },
                    _: value
                }))
            }
        }
    })
    fs.writeFileSync(filename, '<!doctype html>\n' + content);
}
