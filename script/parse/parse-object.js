const { WindowSource } = require('./parse-source');

// https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/Core/Public/UObject/ObjectVersion.h
const PACKAGE_FILE_TAG_SWAPPED = 'C1832A9E';

class ObjectDecoder {

    constructor(names, types) {
        this.names = names;
        this.types = types
    }

    decodeName(source) {
        return this.names[source.read(8).readBigUInt64LE()];
    }

    resolveType(name, tag) {
        const Type = this.types[name];
        if (!Type) {
            throw new Error(`Unknown type ${name}`);
        }
        return new Type(tag);
    }

    decodeBool(source, legacy) {
        return (legacy ? source.read(4).readUInt32LE() : source.read(1).readUInt8()) !== 0;
    }

    decodeString(source) {
        const length = source.read(4).readInt32LE();
        const buffer = source.read(length < 0 ? Math.abs(length) * 2 : length);
        return buffer.toString(length < 0 ? 'UTF-16LE' : 'ASCII').slice(0, -1);
    }

    decodeGuid(source) {
        return source.read(16).toString('hex').toUpperCase();
    }

    decodeArray(source, next) {
        const decoded = [];
        for (let remaining = source.read(4).readUInt32LE(); remaining > 0; remaining--) {
            decoded.push(next(decoded.length));
        }
        return decoded;
    }

    // https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyTag.cpp
    decodeTag(source) {
        const decoded = {
            Name: this.decodeName(source)
        };
        if (decoded.Name === 'None') {
            return decoded;
        }
        decoded.Type = this.decodeName(source);
        decoded.Size = source.read(4).readInt32LE();
        decoded.ArrayIndex = source.read(4).readInt32LE();
        if (decoded.Type === 'SetProperty') {
            decoded.InnerType = this.decodeName(source);
        } else if (decoded.Type === 'MapProperty') {
            decoded.InnerType = this.decodeName(source);
            decoded.ValueType = this.decodeName(source);
        }
        if (this.decodeBool(source)) {
            decoded.PropertyGuid = decodeGuid(source);
        }
        return decoded;
    }

    decodeValue(source, type) {
        // console.log(`Decoding value for ${type.constructor.name} ` + 
        //         `with tag ${JSON.stringify(type.tag) || '{}'} ` + 
        //         `at ${source.cursor()}`);
        if (type.tag && type.tag.Size) {
            source = new WindowSource(source, Number(type.tag.Size));
        }
        return type.read(source, this);
    }

}
module.exports.ObjectDecoder = ObjectDecoder;
