const { FileSource } = require('./parse-source');
const { ObjectDecoder } = require('./parse-object');
const { AssetReader } = require('./parse-asset');

const TYPES = require('./parse-defs');

BigInt.prototype.toJSON = function() {
    return Number(this);
};

/**
 * Strings file reader.
 */
class StringsReader {

    readFile(filename) { 
        return new AssetReader(TYPES).readHeader(filename);
    }

}
module.exports.StringsReader = StringsReader;
