#!/bin/bash

# Get unix style location of the build.sh script
SCRIPT_BASE=$(dirname "$(readlink -f "$0")")

# Get windows style build root directory
BUILD_ROOT=$(echo $SCRIPT_BASE | sed -r 's|/([a-z])/|\1:/|')

# Import local environment configuration
if [ -f ".env" ]; then
    . .env
fi

if [ -z "UNREALPAK_BIN" ]; then
    UNREALPAK_BIN="UnrealPak.exe"
fi

# Create response file
RESPONSE_FILE="target/repsonse.txt"
cat > $RESPONSE_FILE << EOM
"$BUILD_ROOT/target/Text_en.uasset" "../../../Indiana/Content/Exported/BaseGame/Localized/EN/Text/Text_en.uasset"
"$BUILD_ROOT/target/Text_en.uexp" "../../../Indiana/Content/Exported/BaseGame/Localized/EN/Text/Text_en.uexp"
EOM

$UNREALPAK_BIN "$BUILD_ROOT/target/zzCS-WindowsNoEditor.pak" -Create="$BUILD_ROOT/$RESPONSE_FILE"
