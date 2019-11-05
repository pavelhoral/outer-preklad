#!/usr/bin/env node
const program = require('commander');
const output = require('./utils/program-output')(program);
const path = require('path');
const { StringsReader, StringsWriter } = require('./parse/parse-strings');

BigInt.prototype.toJSON = function() {
    return Number(this);
};

program.
    option('-o --output <file>', 'write output to the specified file');

program.
    command('export <file...>').
    description('Export contents of StringTableBundleSet asset file.').
    action((files, options) => {
        files.forEach(source => {
            const strings = new StringsReader().readFile(source);
            const target = 'target/' + path.basename(source);
            new StringsWriter().writeFile(source, target, strings.Objects[0]);
        });
    });

program.parse(process.argv);
output.close();
if (!program.args.length) {
    program.help();
}
