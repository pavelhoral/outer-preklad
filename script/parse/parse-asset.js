const { FileSource } = require('./parse-source');
const { ObjectDecoder } = require('./parse-object');
const { PackageFileSummary, FNameEntrySerialized, FObjectImport, FObjectExport } = require('./parse-defs');

class AssetReader {

    constructor(types) {
        this.types = types;
    }

    open(filename, seek) {
        const source = new FileSource(filename);
        source.skip(seek || 0);
        return source;
    }

    readHeader(filename) {
        const summary = this.readSummary(this.open(filename, 0));
        const names = this.readNames(this.open(filename, summary.NameOffset), summary);
        const decoder = new ObjectDecoder(names, this.types);
        const imports = this.readImports(this.open(filename, summary.ImportOffset), summary, decoder);
        const exports = this.readExports(this.open(filename, summary.ExportOffset), summary, decoder);
        return {
            PackageFileSummary: summary,
            NameMap: names,
            ImportMap: imports,
            ExportMap: exports
            // DependsOffset
            // PreloadDependencyOffset
        };
    }

    readSummary(source) {
        return new ObjectDecoder().decodeValue(source, new PackageFileSummary());
    }

    readNames(source, summary) {
        const result = [];
        while (result.length < summary.NameCount) {
            result.push(new ObjectDecoder().decodeValue(source, new FNameEntrySerialized()).Name);
        }
        return result;
    }

    readImports(source, summary, decoder) {
        const result = [];
        while (result.length < summary.ImportCount) {
            result.push(decoder.decodeValue(source, new FObjectImport()));
        }
        return result;
    }

    readExports(source, summary, decoder) {
        const result = [];
        while (result.length < summary.ExportCount) {
            result.push(decoder.decodeValue(source, new FObjectExport()));
        }
        return result;
    }

}
module.exports.AssetReader = AssetReader;