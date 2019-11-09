#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const program = require('commander');
const { StringsReader, StringsWriter } = require('./parse/parse-strings');
const { MessageParser } = require('./text/text-factory');

program
    .usage('[options] <file>')
    .description('Build StringTableBundleSet asset file with translation overrides.')
    .option('-s, --source <source>', 'source folder with translations', 'source/cs')
    .option('-o, --output <output>', 'output folder for compiled asset', 'target');

program.parse(process.argv);
if (!program.args.length) {
    program.help();
}

const filenames = [];
const dirnames = [program.source];
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

const dictionary = filenames.reduce((dictionary, filename) => {
    const content = fs.readFileSync(filename, 'utf8');
    new MessageParser().parse(content).filter(message => message.msgstr).forEach(message => {
        dictionary[message.msgctxt] = message.msgstr;
    });
    return dictionary;
}, {})

const source = program.args[0];
const target = path.join(program.output, path.basename(source));
const strings = new StringsReader().readFile(source);

strings.Objects[0].StringTables.Entries.forEach(({ Value: table }) => {
    table.Entries.Entries.forEach(({ Value: entry }) => {
        ['DefaultText', 'FemaleText'].forEach(type => {
            const key = `${table.Name}:${entry.ID}:${type}`;
            if (dictionary[key]) {
                entry[type] = dictionary[key];
            }
        });
    });
});

const info = new StringsWriter().writeFile(source, target, strings.Objects[0]);

const header = fs.readFileSync(source);
// BulkDataStartOffset
header.writeUInt32LE(info.TotalSize + strings.Header.PackageFileSummary.TotalHeaderSize, 169)
// Object[0].SerialSize
header.writeUInt32LE(info.ExportMap[0].SerialSize, 823)
fs.writeFileSync(target, header);
