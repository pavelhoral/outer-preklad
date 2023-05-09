#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const program = require('commander');
const md5 = require('md5');
const { xml2json, json2xml, xml2js } = require('xml-js');
const { MessageParser, MessageWriter } = require('./text/text-factory');

program
    .command('prepare')
    .option('-s, --source <source>', 'source folder with translation files', 'source/cs')
    .option('-g, --grep <pattern>', 'filter only messages matching the pattern', value => new RegExp(value))
    .option('-t, --target <target>', 'target XML filename', 'work/messages')
    .action(({ source, target, grep }) => {
        const items = {};
        for (const filename of loadFilenames(source)) {
            const content = fs.readFileSync(filename, 'utf8');
            new MessageParser().parse(content).forEach(message => {
                const id = md5(message.msgctxt).substring(0, 10);
                if (items[id]) {
                    throw new Error('Duplicate context hash');
                }
                if (!grep || grep.test(message.msgid)) {
                    items[id] = message.msgid;
                }
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
    .command('process <target>')
    .option('-s, --source <source>', 'source folder with translation files', 'source/cs')
    .action(async (target, { source }) => {
        const data = readHtml(target);
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

function tokenizeString(string) {
    const matcher = /(\{[a-z0-9_]+\})/ig;
    return string.split(matcher).map(value => {
        const content = { type: 'text', text: value };
        if (matcher.test(value)) {
            return {
                type: 'element',
                name: 'i',
                attributes: { id: value }
            };
        } else {
            return content;
        }
    });
}

function writeHtml(filename, items) {
    const model = {
        elements: [{
            type: 'element',
            name: 'html',
            attributes: { lang: 'en' },
            elements: [{
                type: 'element',
                name: 'head',
                elements: [{
                    type: 'element',
                    name: 'meta',
                    attributes: { charset: 'utf-8' }
                }]
            }, {
                type: 'element',
                name: 'body',
                elements: Object.entries(items).map(([id, value]) => ({
                    type: 'element',
                    name: 'p',
                    attributes: { id },
                    elements: tokenizeString(value)
                }))
            }]
        }]
    };
    const content = json2xml(model).replaceAll(/<p/g, '\n<p');
    fs.writeFileSync(filename, '<!doctype html>\n' + content);
}

function readHtml(filename) {
    const content = xml2js(fs.readFileSync(filename, 'utf8'), {
        ignoreDeclaration: true,
        ignoreInstruction: true,
        ignoreDoctype: true
    });
    const entries = {};
    for (const element of content.elements[0].elements[1].elements) {
        entries[element.attributes.id] = element.elements.map(node => {
            if (node.type === 'text') {
                return node.text;
            }
            if (node.type === 'element' && node.name === 'i') {
                return node.attributes.id;
            }
            throw new Error(`Invalid element ${node.type}`);
        }).join('');
    }
    return entries;
}
