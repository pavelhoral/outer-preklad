'use strict';
var fs = require('fs'),
    path = require('path');

class BufferReader {

    constructor(buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }

    readUInt32LE() {
        let value = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return value;
    }

    readUInt64LE() {
        let value = this.buffer.readUInt32LE(this.offset)
                + (this.buffer.readUInt32LE(this.offset + 4) << 8);
        this.offset += 8;
        return value;
    }

    readBuffer(length) {
        let value = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    skip(length) {
        this.offset += length;
    }

    isEof() {
        return this.buffer.length <= this.offset;
    }

}

const OBJECT_CLOSE = Buffer.from('0E00000000000000', 'hex');

/**
 * Strings file parser.
 */
class StringsParser {

    constructor(buffer) {
        this.reader = new BufferReader(buffer);
    }

    parse(handler) {
        let result = {};
        // UEXP header
        this.parseConstant(Buffer.from('1400000000000000', 'hex'));
        this.parseConstant(Buffer.from('0C00000000000000', 'hex'));
        result.size = this.reader.readUInt64LE();
        this.parseConstant(Buffer.from('1500000000000000', 'hex'));
        // Strings header
        this.parseConstant(Buffer.from('16000000000000000000000000', 'hex'));
        let count = this.reader.readUInt32LE();
        result.groups = [];
        while (result.groups.length < count) {
            result.groups.push(this.parseGroup());
        }
        // Footer
        this.parseConstant(Buffer.from('08000000000000000B00000000000000', 'hex'));
        this.parseConstant(Buffer.from('040000000000000000', 'hex'));
        result.magic = this.reader.readUInt32LE();
        this.parseConstant(Buffer.from('0E0000000000000000000000C1832A9E', 'hex'));
        return result;
    }

    parseString() {
        let length = this.reader.readUInt32LE();
        let wide = length > 0xFF000000;
        let buffer = this.reader.readBuffer(wide ? (0xFFFFFFFF - length + 1) * 2 : length);
        return buffer.slice(0, wide ? -2 : -1).toString(wide ? 'UTF-16LE' : 'UTF-8');
    }

    parseConstant(check) {
        let value = this.reader.readBuffer(check.length);
        if (check.compare(value) !== 0) {
            throw new Error(`Illegal sequence ${value.toString('hex')} at offset ${this.reader.offset}`);
        }
    }

    parseGroup() {
        let group = {
            _: this.reader.offset,
            id: this.parseString()
        };
        this.parseConstant(Buffer.from('0D000000000000001500000000000000', 'hex'));
        group.size = this.reader.readUInt64LE();
        this.parseConstant(Buffer.from('00', 'hex'))
        group.name = this.parseString();
        this.parseConstant(Buffer.from('12000000000000001000000000000000', 'hex'));
        group.unk1 = this.reader.readUInt64LE();
        this.parseConstant(Buffer.from('0B000000000000000000000000', 'hex'));
        group.unk2 = this.parseUInt32Array();
        this.parseConstant(Buffer.from('11000000000000000C00000000000000', 'hex'));
        group.unk3 = this.reader.readUInt64LE();
        this.parseConstant(Buffer.from('1500000000000000', 'hex'));
        this.parseConstant(Buffer.from('16000000000000000000000000', 'hex'));
        let unk4 = this.reader.readUInt32LE();
        if (unk4 === 1) {
            group.unk4 = {
                lang: this.parseString()
            };
            this.parseConstant(Buffer.from('0A000000000000001000000000000000', 'hex'));
            group.unk4.flags = this.reader.readUInt64LE();
            this.parseConstant(Buffer.from('0B000000000000000000000000', 'hex'));
            group.unk4.values = this.parseUInt32Array();
            this.parseConstant(OBJECT_CLOSE);
        } else if (unk4 > 1) {
            throw new Error(`Illegal flag value ${unk4} at offset ${this.reader.offset}`);
        }
        this.parseConstant(Buffer.from('06000000000000000C00000000000000', 'hex'));
        group.unk5 = this.reader.readUInt64LE();
        this.parseConstant(Buffer.from('0B0000000000000016000000000000000000000000', 'hex'));
        group.count = this.reader.readUInt32LE();
        group.entries = this.parseEntries(group);
        this.parseConstant(OBJECT_CLOSE);
        return group;
    }

    parseUInt32Array() {
        let count = this.reader.readUInt32LE();
        let values = []
        for (let i = 0; i < count; i++) {
            values.push(this.reader.readUInt32LE());
        }
        return values;
    }

    parseEntries(group) {
        let entries = [];
        for (let i = 0; i < group.count; i++) {
            entries.push(this.parseEntry());
        }
        return entries;
    }

    parseEntry() {
        let entry = {
            id: this.reader.readUInt32LE()
        };
        this.parseConstant(Buffer.from('09000000000000000B00000000000000040000000000000000', 'hex'));
        if (entry.id !== this.reader.readUInt32LE()) {
            throw new Error(`String ID mismatch ${string.id}`);
        }
        this.parseConstant(Buffer.from('05000000000000001500000000000000', 'hex'));
        this.reader.readUInt64LE(); // size
        this.parseConstant(Buffer.from('00', 'hex'));
        entry.string = this.parseString();
        this.parseConstant(Buffer.from('07000000000000001500000000000000', 'hex'));
        this.reader.readUInt64LE(); // size2
        this.parseConstant(Buffer.from('00', 'hex'));
        let string2 = this.parseString();
        if (string2) {
            entry.string2 = string2;
        }
        this.parseConstant(OBJECT_CLOSE);
        return entry;
    }

    // Parse something that seems like array or object end
    parseClose() {
        this.parseConstant(Buffer.from('0E00000000000000', 'hex'));
    }

}
module.exports.StringsParser = StringsParser;

/**
 * Strings file reader.
 */
class StringsReader {

    constructor() {
    }

    readBuffer(buffer) {
        return new StringsParser(buffer).parse();
    }

    readFile(filename) {
        var buffer = fs.readFileSync(filename);
        return this.readBuffer(buffer);
    }

}
module.exports.StringsReader = StringsReader;
