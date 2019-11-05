const { 
    FileSource,
    FileSink
} = require('./parse-source');
const { 
    ObjectDecoder,
    ObjectEncoder
} = require('./parse-object');
const {
    PackageFileSummary,
    FNameEntrySerialized,
    FObjectImport,
    FObjectExport,
    StructProperty
} = require('./parse-defs');

// https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/Core/Public/UObject/ObjectVersion.h
const PACKAGE_FILE_TAG_SWAPPED = 'C1832A9E';

class AssetReader {

    constructor(types) {
        this.types = types;
    }

    withFile(filename, task) {
        const source = new FileSource(filename);
        try {
            return task(source);
        } finally {
            source.close();
        }
    }

    readAsset(filename) {
        const header = this.readHeader(filename);
        const objects = this.readObjects(filename, header);
        return {
            Header: header,
            Objects: objects
        };
    }

    readHeader(filename) {
        const summary = this.withFile(filename, source => this.readSummary(source));
        const names = this.withFile(filename, source => {
            source.skip(summary.NameOffset);
            return this.readNames(source, summary)
        });
        const decoder = new ObjectDecoder(names, this.types);
        const imports = this.withFile(filename, source => {
            source.skip(summary.ImportOffset);
            this.readImports(source, summary, decoder);
        });
        const exports = this.withFile(filename, source => {
            source.skip(summary.ExportOffset);
            return this.readExports(source, summary, decoder)
        });
        return {
            PackageFileSummary: summary,
            NameMap: names,
            ImportMap: imports,
            ExportMap: exports
            // DependsOffset
            // PreloadDependencyOffset
        };
    }

    readObjects(filename, header) {
        const decoder = new ObjectDecoder(header.NameMap, this.types);
        return header.ExportMap.map(object => {
            const offset = object.SerialOffset - BigInt(header.PackageFileSummary.TotalHeaderSize);
            return this.withFile(filename.replace(/\.uasset$/, '.uexp'), source => {
                source.skip(Number(offset));
                return decoder.decodeValue(source, new StructProperty());
            });
        });
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


class AssetWriter {

    constructor(types) {
        this.types = types;
    }

    withFile(filename, task) {
        const sink = new FileSink(filename);
        try {
            return task(sink);
        } finally {
            sink.close();
        }
    }

    writeObjects(filename, objects) {
        return this.withFile(filename.replace(/\.uasset$/, '.uexp'), sink => {
            const ExportMap = objects.map(object => {
                const encoder = new ObjectEncoder(object.names, this.types);
                const encoded = encoder.encodeValue(object.value, encoder.resolveType(object.schema));
                return {
                    SerialOffset: sink.cursor(),
                    SerialSize: sink.write(encoded) + sink.write(Buffer.alloc(4))
                }
            });
            sink.write(Buffer.from(PACKAGE_FILE_TAG_SWAPPED, 'hex'));
            return {
                ExportMap,
                TotalSize: sink.cursor()
            };
        });
    }

}
module.exports.AssetWriter = AssetWriter;