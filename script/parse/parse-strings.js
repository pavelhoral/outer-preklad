const { 
    AssetReader, 
    AssetWriter 
} = require('./parse-asset');

const TYPES = require('./parse-defs');

const SCHEMAS = {
    StringTableBundleSet: {
        Type: 'StructProperty',
        PropertyTypes: {
            StringTables: {
                Type: 'MapProperty',
                InnerType: { Type: 'StrProperty' },
                ValueType: {
                    Type: 'StructProperty',
                    PropertyTypes: {
                        Name: { Type: 'StrProperty' },
                        StringsWithTokens: {
                            Type: 'SetProperty',
                            InnerType: { Type: 'IntProperty' }
                        },
                        StringsWithFemaleVO: {
                            Type: 'MapProperty',
                            InnerType: { Type: 'StrProperty' },
                            ValueType: {
                                Type: 'StructProperty',
                                PropertyTypes: {
                                    IDs: {
                                        Type: 'SetProperty',
                                        InnerType: { Type: 'IntProperty' }
                                    }
                                }
                            }
                        },
                        Entries: {
                            Type: 'MapProperty',
                            InnerType: { Type: 'IntProperty' },
                            ValueType: {
                                Type: 'StructProperty',
                                PropertyTypes: {
                                    ID: { Type: 'IntProperty' },
                                    DefaultText: { Type: 'StrProperty' },
                                    FemaleText: { Type: 'StrProperty' }
                                }
                            }
                        }
                    }
                }
            },
            Hash: { Type: 'IntProperty' }
        }
    }
};


/**
 * Strings file reader.
 */
class StringsReader {

    readFile(source) {
        return new AssetReader(TYPES).readAsset(source);
    }

}
module.exports.StringsReader = StringsReader;

class StringsWriter {

    writeFile(source, target, strings) {
        const original = new AssetReader(TYPES).readAsset(source);
        const exports = new AssetWriter(TYPES).writeObjects(target, [{
            names: original.Header.NameMap,
            value: strings,
            schema: SCHEMAS.StringTableBundleSet
        }]);
        console.log(JSON.stringify(exports));
    }

}
module.exports.StringsWriter = StringsWriter;