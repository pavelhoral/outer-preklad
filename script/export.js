#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const program = require('commander');
const { StringsReader } = require('./parse/parse-strings');
const { MessageFactory, MessageWriter } = require('./text/text-factory');

BigInt.prototype.toJSON = function() {
    return Number(this);
};

program
    .usage('[options] <file>')
    .description('Export contents of StringTableBundleSet asset file.')
    .option('-r, --raw', 'get raw asset object')
    .option('-t, --table <table>', 'limit to messages from a specific table')
    .option('-a, --auto', 'auto-translate generated messages') 
    .option('-e, --ext <ext>', 'set target file extension')
    .option('-o, --output <output>', 'output as separate files in the specified directory');

program.parse(process.argv);
if (!program.args.length) {
    program.help();
}

const strings = new StringsReader().readFile(program.args[0]);

if (program.raw) {
    console.log(JSON.stringify(strings, null, '  '));
    process.exit();
}

if (program.output && !fs.existsSync(program.output)) {
    console.error(`Invalid output directory ${program.output}`);
    process.exit(1);
}

const messages = new MessageFactory(program.auto).create(strings.Objects[0]);
const tables = program.table ? [ program.table ] : Object.keys(messages);

tables.forEach(table => {
    const gettext = new MessageWriter().writeMessages(messages[table]);
    if (!program.output) {
        console.log(gettext);
        return;
    }
    const directory = path.join(program.output, path.dirname(table));
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(path.join(directory, path.basename(table + (program.ext || '.po'))), gettext);
});
