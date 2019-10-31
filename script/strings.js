#!/usr/bin/env node
'use strict';
var parseStrings = require('./parse/parse-strings'),
    renderStringId = require('./utils/render-stringId'),
    program = require('commander'),
    output = require('./utils/program-output')(program);

program.
    option('-o --output <file>', 'write output to the specified file');

function readStrings(filePath) {
    return new parseStrings.StringsReader().readFile(filePath);
}

program.
    command('export <file...>').
    description('Export contents of STRINGS file.').
    option('-t, --text', 'generate text output').
    option('-s, --stats', 'compute text statistics').
    action((files, options) => {
        files.forEach(file => {
            var strings = readStrings(file);
            if (options.text) {
                strings.groups.forEach(group => {
                    group.entries.forEach(entry => {
                        output.write(JSON.stringify(Object.assign({ group: group.id }, entry)) + "\n");
                    });
                });
            } else if (options.stats) {
                let stats = {
                    groups: strings.groups.length,
                    words: 0,
                    chars: 0
                };
                strings.groups.forEach(group => {
                    group.entries.forEach(entry => {
                        stats.chars += entry.string.length;
                        stats.words += entry.string.split(/\s+/).length;
                        if (entry.string2) {
                            stats.chars += entry.string2.length;
                            stats.words += entry.string2.split(/\s+/).length;
                        }
                    });
                });
                output.write(JSON.stringify(stats, null, '  '));
            } else {
                output.write(JSON.stringify(strings, null, '  '));
            }
        });
    });

program.parse(process.argv);
output.close();
if (!program.args.length) {
    program.help();
}
