class Type {

    constructor(tag, schema) {
        this.tag = tag;
        this.schema = schema; 
    }

    read(source, decoder) {
        throw new Exception('Missing implementation.');
    };

    write(value, encoder) {
        throw new Exception('Missing implementation.');
    };

}
module.exports.Type = Type;

class None extends Type {
}
module.exports.None = None;

class StrProperty extends Type {

    read(source, decoder) {
        return decoder.decodeString(source);
    }

    write(value, encoder) {
        return encoder.encodeString(value);
    }

}
module.exports.StrProperty = StrProperty;

class IntProperty extends Type {

    read(source) {
        return source.read(4).readUInt32LE();
    }

    write(value) {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(value);
        return buffer;
    }

}
module.exports.IntProperty = IntProperty;

class EnumProperty extends Type {

    read(source, decoder) {
        return decoder.decodeName(source);
    }

}
module.exports.EnumProperty = EnumProperty;

// https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertySet.cpp
class SetProperty extends Type {

    read(source, decoder) {
        const innerType = decoder.resolveType(this.tag.InnerType);
        return {
            ElementsToRemove: decoder.decodeArray(source, () => decoder.decodeValue(source, innerType)),
            Elements: decoder.decodeArray(source, () => decoder.decodeValue(source, innerType))
        };
    }

    write(value, encoder) {
        const innerType = encoder.resolveType(this.schema.InnerType);
        return Buffer.concat([
            encoder.encodeArray(value.ElementsToRemove || [], item => encoder.encodeValue(item, innerType)),
            encoder.encodeArray(value.Elements || [], item => encoder.encodeValue(item, innerType)),
        ]);
    }

}
module.exports.SetProperty = SetProperty;

// https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyMap.cpp
class MapProperty extends Type {

    read(source, decoder) {
        const innerType = decoder.resolveType(this.tag.InnerType);
        const valueType = decoder.resolveType(this.tag.ValueType);
        return {
            KeysToRemove: decoder.decodeArray(source, () => decoder.decodeValue(source, innerType)),
            Entries: decoder.decodeArray(source, () => {
                return {
                    Key: decoder.decodeValue(source, innerType),
                    Value: decoder.decodeValue(source, valueType)
                };
            })
        };
    }

    write(value, encoder) {
        const innerType = encoder.resolveType(this.schema.InnerType);
        const valueType = encoder.resolveType(this.schema.ValueType);
        return Buffer.concat([
            encoder.encodeArray(value.KeysToRemove || [], item => encoder.encodeValue(item, innerType)),
            encoder.encodeArray(value.Entries || [], item => {
                return Buffer.concat([
                    encoder.encodeValue(item.Key, innerType),
                    encoder.encodeValue(item.Value, valueType)
                ]);
            })
        ]);
    }

}
module.exports.MapProperty = MapProperty;

// https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/Class.cpp#L1184
class StructProperty extends Type {

    read(source, decoder) {
        const result = {};
        while (true) {
            const tag = decoder.decodeTag(source);
            if (tag.Name  === 'None') {
                break;
            }
            const type = decoder.resolveType(tag.Type, tag);
            result[tag.Name] = decoder.decodeValue(source, type);
        }
        return result;
    }

    write(value, encoder) {
        const result = Object.keys(value).map(name => {
            const propertyType = encoder.resolveType(this.schema.PropertyTypes[name]);
            const propertyData = encoder.encodeValue(value[name], propertyType);
            return Buffer.concat([encoder.encodeTag(name, propertyType.schema, propertyData.length), propertyData]);
        });
        return Buffer.concat([...result, encoder.encodeTag('None')]);
    }

}
module.exports.StructProperty = StructProperty;

// https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/PackageFileSummary.cpp
// https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Public/UObject/ObjectMacros.h#L102
class PackageFileSummary extends Type {

    read(source, decoder) {
        const result = {};
        result.Tag = source.read(4).toString('hex').toUpperCase();
        result.LegacyFileVersion = source.read(4).readInt32LE();
        result.LegacyUE3Version = source.read(4).readInt32LE();
        result.FileVersionUE4 = source.read(4).readInt32LE();
        result.FileVersionLicenseeUE4 = source.read(4).readInt32LE();
        result.CustomVersion = source.read(4).readInt32LE();
        if (result.CustomVersion !== 0) {
            throw new Error('Unsupported CustomVersion value');
        }
        result.TotalHeaderSize = source.read(4).readInt32LE();
        result.FolderName = decoder.decodeString(source);
        result.PackageFlags = source.read(4).readUInt32LE();
        result.NameCount = source.read(4).readInt32LE();
        result.NameOffset = source.read(4).readInt32LE();
        result.GatherableTextDataCount = source.read(4).readInt32LE();
        result.GatherableTextDataOffset = source.read(4).readInt32LE();
        result.ExportCount = source.read(4).readInt32LE();
        result.ExportOffset = source.read(4).readInt32LE();
        result.ImportCount = source.read(4).readInt32LE();
        result.ImportOffset = source.read(4).readInt32LE();
        result.DependsOffset = source.read(4).readInt32LE();
        result.SoftPackageReferencesCount = source.read(4).readInt32LE();
        result.SoftPackageReferencesOffset = source.read(4).readInt32LE();
        result.SearchableNamesOffset = source.read(4).readInt32LE();
        result.ThumbnailTableOffset = source.read(4).readInt32LE();
        result.Guid = decoder.decodeGuid(source);
        result.GenerationCount = source.read(4).readInt32LE() ;
        result.Generations = [];
        while (result.Generations.length < result.GenerationCount) {
            result.Generations.push(this.readGenerationInfo(source, decoder));
        }
        result.SavedByEngineVersion = this.readVersion(source, decoder);
        result.CompatibleWithEngineVersion = this.readVersion(source, decoder);
        result.CompressionFlags = source.read(4).readUInt32LE();
        result.CompressedChunks = decoder.decodeArray(source, () => {
            throw new Error('Unsupported CompressedChunk value')
        });
        // XXX Value that is used to determine if the package was saved by Epic (or licensee) or by a modder, etc
        result.PackageSource = source.read(4).readUInt32LE();
        result.AdditionalPackagesToCook = decoder.decodeArray(source, () => {
            throw new Error('Unsupported AdditionalPackagesToCook value')
        });
        result.AssetRegistryDataOffset = source.read(4).readInt32LE();
        result.BulkDataStartOffset = Number(source.read(8).readBigInt64LE());
        result.WorldTileInfoDataOffset = source.read(4).readInt32LE();
        result.ChunkIDs = decoder.decodeArray(source, () => source.read(4).readInt32LE());
        result.PreloadDependencyCount = source.read(4).readInt32LE();
        result.PreloadDependencyOffset = source.read(4).readInt32LE();
        return result;
    }

    readGenerationInfo(source, decoder) {
        const result = {};
        result.ExportCount = source.read(4).readInt32LE();
        result.NameCount = source.read(4).readInt32LE();
        return result;
    }

    readVersion(source, decoder) {
        const result = {};
        result.Major = source.read(2).readUInt16LE();
        result.Minor = source.read(2).readUInt16LE();
        result.Patch = source.read(2).readUInt16LE();
        result.Changelist = source.read(4).readUInt32LE();
        result.Branch = decoder.decodeString(source);
        return result;
    }

}
module.exports.PackageFileSummary = PackageFileSummary;

class FNameEntrySerialized extends Type {

    read(source, decoder) {
        const result = {};
        result.Name = decoder.decodeString(source);
        result.NonCasePreservingHash = source.read(2).readUInt16LE();
        result.CasePreservingHash = source.read(2).readUInt16LE();
        return result;
    }

}
module.exports.FNameEntrySerialized = FNameEntrySerialized;

class FObjectImport extends Type {

    read(source, decoder) {
        const result = {};
        result.ClassPackage = decoder.decodeName(source);
        result.ClassName = decoder.decodeName(source);
        result.OuterIndex = source.read(4).readInt32LE();
        result.ObjectName = decoder.decodeName(source);
        return result;
    }

}
module.exports.FObjectImport = FObjectImport;

class FObjectExport extends Type {

    read(source, decoder) {
        const result = {};
        result.ClassIndex = source.read(4).readInt32LE();
        result.SuperIndex = source.read(4).readInt32LE();
        result.TemplateIndex = source.read(4).readInt32LE();
        result.OuterIndex = source.read(4).readInt32LE();
        result.ObjectName = decoder.decodeName(source);
        result.ObjectFlags = source.read(4).readUInt32LE();
        result.SerialSize = source.read(8).readBigInt64LE();
        result.SerialOffset = source.read(8).readBigInt64LE();
        result.bForcedExport = decoder.decodeBool(source, true);
        result.bNotForClient = decoder.decodeBool(source, true);
        result.bNotForServer = decoder.decodeBool(source, true);
        result.PackageGuid = decoder.decodeGuid(source);
        result.PackageFlags = source.read(4).readUInt32LE();
        result.bNotAlwaysLoadedForEditorGame = decoder.decodeBool(source, true);
        result.bIsAsset = decoder.decodeBool(source, true);
        result.FirstExportDependency = source.read(4).readInt32LE();
        result.SerializationBeforeSerializationDependencies = source.read(4).readInt32LE();
        result.CreateBeforeSerializationDependencies = source.read(4).readInt32LE();
        result.SerializationBeforeCreateDependencies = source.read(4).readInt32LE();
        result.CreateBeforeCreateDependencies = source.read(4).readInt32LE();
        return result;
    }

}
module.exports.FObjectExport = FObjectExport;
