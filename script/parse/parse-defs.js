class Type {

    constructor(tag) {
        this.tag = tag;
    }

    read(source, decoder) {
        throw new Exception("Missing implementation.");
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

}
module.exports.StrProperty = StrProperty;

class IntProperty extends Type {

    read(source) {
        return source.read(4).readUInt32LE();
    }

}
module.exports.IntProperty = IntProperty;

// https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertySet.cpp
class SetProperty extends Type {

    read(source, decoder) {
        const innerType = decoder.resolveType(this.tag.InnerType);
        return {
            ElementsToRemove: decoder.decodeArray(source, () => decoder.decodeValue(source, innerType)),
            Elements: decoder.decodeArray(source, () => decoder.decodeValue(source, innerType))
        };
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

}
module.exports.StructProperty = StructProperty;
