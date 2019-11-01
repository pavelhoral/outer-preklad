'use strict';
const { FileSource } = require('./parse-source');

/**
 * Asset file signature.
 */
const ASSET_MAGIC = 'C1832A9E';

/**
 * Type tags in StrinTableBundleSet asset file.
 * https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/Class.cpp
 * https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/Obj.cpp
 * https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyStruct.cpp
 * https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyStr.cpp
 * https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/Core/Private/Containers/String.cpp
 */
const TYPE_TAGS = {
    Script_CoreUObject: 0x01,
    Script_Indiana: 0x02,
    Class: 0x03,
    Default__StringTableBundleSet: 0x04,
    DefaultText: 0x05,
    Entries: 0x06,
    FemaleText: 0x07,
    Hash: 0x08,
    ID: 0x09,
    IDs: 0x0A,
    IntProperty: 0x0B,
    MapProperty: 0x0C,
    Name: 0x0D,
    None: 0x0E,
    Package: 0x0F,
    SetProperty: 0x10,
    StringsWithFemaleVO: 0x11,
    StringsWithTokens: 0x12,
    StringTableBundleSet: 0x13,
    StringTables: 0x14,
    StrProperty: 0x15,
    StructProperty: 0x16
};

/**
 * Strings file parser.
 */
class StringsParser {

    constructor(source) {
        this.source = source;
    }

    fail(message) {
        throw new Error(`${message || 'Unexpected value'} at ${this.source.cursor()}`);
    }

    parse() {
        let result = {};

        // StringTables : MapProperty<StrProperty, StructProperty>
        0x14 === this.source.readUInt64LE() || this.fail();
        0x0C === this.source.readUInt64LE() || this.fail();
        result.size = this.source.readUInt64LE();
        0x15 === this.source.readUInt64LE() || this.fail();
        0x16 === this.source.readUInt64LE() ||  this.fail();
        '0000000000' === this.source.readHex(5) || this.fail();
        result.groups = this.parseArray(this.parseGroup);

        // Hash : IntProperty
        0x08 === this.source.readUInt64LE() || this.fail();
        0x0B === this.source.readUInt64LE() || this.fail();
        0x04 === this.source.readUInt64LE() || this.fail(); // width
        0x00 === this.source.readUInt8() || this.fail(); // (un)signed
        result.magic = this.source.readUInt32LE();

        TYPE_TAGS.None === this.source.readUInt64LE() || this.fail();

        // UEXP footer
        0x00 === this.source.readUInt32LE() || this.fail();
        ASSET_MAGIC === this.source.readHex(4) || this.fail();
        return result;
    }

    parseString() {
        let length = this.source.readInt32LE();
        let buffer = this.source.read(length < 0 ? Math.abs(length) * 2 : length);
        return buffer.toString(length < 0 ? 'UTF-16LE' : 'ASCII').slice(0, -1);
    }

    parseGroup() {
        let group = { _: this.source.cursor() };
        group.id = this.parseString();

        // Name : StrProperty
        0x0D === this.source.readUInt64LE() || this.fail();
        0x15 === this.source.readUInt64LE() || this.fail();
        let size = this.source.readUInt64LE();
        0x00 === this.source.readUInt8() || this.fail();
        group.name = this.parseString();

        // StringsWithTokens : SetProperty<IntProperty>
        0x12 === this.source.readUInt64LE() || this.fail();
        0x10 === this.source.readUInt64LE() || this.fail();
        group.unk1 = this.source.readUInt64LE(); // XXX sizeof(vars)
        0x0B === this.source.readUInt64LE() || this.fail();
        '0000000000' === this.source.readHex(5) || this.fail();
        group.vars = this.parseArray(() => this.source.readUInt32LE());

        // StringsWithFemalVO : MapProperty<StrProperty, StructProperty>
        0x11 === this.source.readUInt64LE() || this.fail();
        0x0C === this.source.readUInt64LE() || this.fail();
        group.unk3 = this.source.readUInt64LE(); // XXX sizeof(unk4)
        0x15 === this.source.readUInt64LE() || this.fail();
        0x16 === this.source.readUInt64LE() || this.fail();
        '0000000000' === this.source.readHex(5) || this.fail();
        let unk4 = this.source.readUInt32LE();
        if (unk4 === 1) {
            group.unk4 = {
                lang: this.parseString()
            };
            // IDs : SetProperty<IntProperty>
            0x0A === this.source.readUInt64LE() || this.fail();
            0x10 === this.source.readUInt64LE() || this.fail();
            group.unk4.size = this.source.readUInt64LE(); // XXX sizeof(values)
            0x0B === this.source.readUInt64LE() || this.fail();
            '0000000000' === this.source.readHex(5) || this.fail();
            group.unk4.values = this.parseArray(() => this.source.readUInt32LE());

            TYPE_TAGS.None === this.source.readUInt64LE() || this.fail();
        } else if (unk4 > 1) {
            false, `Illegal flag value ${unk4}` || this.fail();
        }

        // Entries : MapProperty<IntProperty, StructProperty>
        0x06 === this.source.readUInt64LE() || this.fail();
        0x0C === this.source.readUInt64LE() || this.fail();
        group.unk5 = this.source.readUInt64LE(); // XXX sizeof(entries)
        0x0B === this.source.readUInt64LE() || this.fail();
        0x16 === this.source.readUInt64LE() || this.fail();
        '0000000000' === this.source.readHex(5) || this.fail();
        group.entries = this.parseArray(this.parseEntry);

        TYPE_TAGS.None === this.source.readUInt64LE() || this.fail();
        return group;
    }

    parseArray(parseElement) {
        let count = this.source.readUInt32LE();
        let values = []
        for (let i = 0; i < count; i++) {
            values.push(parseElement.call(this, i));
        }
        return values;
    }

    parseEntry() {
        let entry = {};
        entry.id = this.source.readUInt32LE();

        // ID : IntProperty
        0x09 === this.source.readUInt64LE() || this.fail();
        0x0B === this.source.readUInt64LE() || this.fail();
        0x04 === this.source.readUInt64LE() || this.fail();
        0x00 === this.source.readUInt8() || this.fail();
        entry.id === this.source.readUInt32LE() || this.fail();
        
        // DefaultText : StrProperty
        0x05 === this.source.readUInt64LE() || this.fail();
        0x15 === this.source.readUInt64LE() || this.fail();
        let size = this.source.readUInt64LE();
        0x00 === this.source.readUInt8() || this.fail();
        entry.string = this.parseString();

        // FemaleText : StrProperty
        0x07 === this.source.readUInt64LE() || this.fail();
        0x15 === this.source.readUInt64LE() || this.fail();
        let size2 = this.source.readUInt64LE();
        0x00 === this.source.readUInt8() || this.fail();;
        let string2 = this.parseString();
        if (string2) {
            entry.string2 = string2;
        }

        TYPE_TAGS.None === this.source.readUInt64LE() || this.fail();
        return entry;
    }

}
module.exports.StringsParser = StringsParser;

/**
 * Strings file reader.
 */
class StringsReader {

    constructor() {
    }

    readFile(filename) {
        return new StringsParser(new FileSource(filename)).parse();
    }

}
module.exports.StringsReader = StringsReader;
