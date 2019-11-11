const { WindowSource } = require('./parse-source');

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
            decoded.PropertyGuid = this.decodeGuid(source);
        }
        return decoded;
    }

    decodeValue(source, type) {
        if (type.tag && type.tag.Size) {
            source = new WindowSource(source, Number(type.tag.Size));
        }
        return type.read(source, this);
    }

}
module.exports.ObjectDecoder = ObjectDecoder;

class ObjectEncoder {

    constructor(names, types) {
        this.names = names;
        this.types = types
    }

    resolveType(schema) {
        const Type = this.types[schema.Type];
        if (!Type) {
            throw new Error(`Unknown type ${schema.Type}`);
        }
        return new Type(null, schema);
    }

    encodeName(value) {
        const buffer = Buffer.alloc(8);
        const index = this.names.indexOf(value);
        if (index < 0) {
            throw new Error(`Unknown name ${value}`);
        }
        buffer.writeBigUInt64LE(BigInt(index));
        return buffer;
    }

    encodeBool(value, legacy) {
        const buffer = Buffer.alloc(legacy ? 4 : 1);
        buffer.writeUInt8(value ? 1 : 0);
        return buffer;
    }
    
    encodeInt(value) {
        const buffer = Buffer.alloc(4);
        buffer.writeInt32LE(value);
        return buffer;
    }

    encodeString(value) {
        if (!value.length) {
            return Buffer.alloc(4);
        }
        const ansi = /^[\u0000-\u007F]*$/.test(value);
        const buffer = Buffer.alloc(4 + (value.length + 1) * (ansi ? 1 : 2));
        buffer.writeInt32LE((value.length + 1) * (ansi ? 1 : -1));
        buffer.write(value, 4, ansi ? 'ASCII' : 'UTF-16LE');
        return buffer;
    }

    encodeGuid(value) {
        const buffer = Buffer.alloc(16);
        buffer.write(value, 'hex');
        return buffer;
    }

    encodeArray(values, next) {
        const header = Buffer.alloc(4);
        header.writeUInt32LE(values.length);
        return Buffer.concat([header, ...values.map((value, index) => next(value, index))]);
    }

    encodeTag(name, schema, size) {
        const encoded = [
            this.encodeName(name)
        ];
        if (name === 'None') {
            return Buffer.concat(encoded);
        }
        encoded.push(this.encodeName(schema.Type));
        encoded.push(this.encodeInt(size));
        encoded.push(this.encodeInt(schema.ArrayIndex || 0));
        if (schema.Type === 'SetProperty') {
            encoded.push(this.encodeName(schema.InnerType.Type));
        } else if (schema.Type === 'MapProperty') {
            encoded.push(this.encodeName(schema.InnerType.Type));
            encoded.push(this.encodeName(schema.ValueType.Type));
        }
        encoded.push(this.encodeBool(!!schema.PropertyGuid));
        if (schema.PropertyGuid) {
            encoded.push(this.encodeGuid(schema.PropertyGuid));
        }
        return Buffer.concat(encoded);
    }

    encodeValue(value, type) {
        return type.write(value, this);
    }

}
module.exports.ObjectEncoder = ObjectEncoder;