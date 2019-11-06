#!/usr/bin/env node
const program = require('commander');
const output = require('./utils/program-output')(program);
const path = require('path');
const { StringsReader, StringsWriter } = require('./parse/parse-strings');
const { MessageFactory, MessageWriter } = require('./text/text-factory');

BigInt.prototype.toJSON = function() {
    return Number(this);
};

program.
    option('-o --output <file>', 'write output to the specified file');

program.
    command('export <file>').
    description('Export contents of StringTableBundleSet asset file.').
    option('-r, --raw', 'get raw asset object').
    option('-t, --table <table>', 'get table messages').
    action((file, options) => {
        const strings = new StringsReader().readFile(file);
        if (options.raw) {
            output.write(JSON.stringify(strings, null, '  '));
        } else if (options.table) {
            const messages = new MessageFactory().create(strings.Objects[0]);
            output.write(new MessageWriter().writeMessages(messages[options.table]));
        }
    });

program.parse(process.argv);
output.close();
if (!program.args.length) {
    program.help();
}
