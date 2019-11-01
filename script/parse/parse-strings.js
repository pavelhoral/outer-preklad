const { FileSource } = require('./parse-source');
const { ObjectDecoder } = require('./parse-object');

const TYPES = require('./parse-defs');
const NAMES = [
    '/Script/CoreUObject',
    '/Script/Indiana',
    'Class',
    'Default__StringTableBundleSet',
    'DefaultText',
    'Entries',
    'FemaleText',
    'Hash',
    'ID',
    'IDs',
    'IntProperty',
    'MapProperty',
    'Name',
    'None',
    'Package',
    'SetProperty',
    'StringsWithFemaleVO',
    'StringsWithTokens',
    'StringTableBundleSet',
    'StringTables',
    'StrProperty',
    'StructProperty'
];

/**
 * Strings file reader.
 */
class StringsReader {

    constructor() {
    }

    readFile(filename) { 
        const names = [null, ...NAMES];
        const decoder = new ObjectDecoder(names, TYPES);
        const source = new FileSource(filename);
        return decoder.decodeValue(source, decoder.resolveType('StructProperty'));
    }

}
module.exports.StringsReader = StringsReader;
