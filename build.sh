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
"$BUILD_ROOT/target/OBSTOW_Family.uasset" "../../../Indiana/Content/UI/Library/Font/OBSTOW_Family.uasset"
"$BUILD_ROOT/target/OBSTOW_Family.uexp" "../../../Indiana/Content/UI/Library/Font/OBSTOW_Family.uext"
"$BUILD_ROOT/target/OBSTOW_Bold.uasset" "../../../Indiana/Content/UI/Library/Font/OBSTOW_Bold.uasset"
"$BUILD_ROOT/target/OBSTOW_Bold.uexp" "../../../Indiana/Content/UI/Library/Font/OBSTOW_Bold.uexp"
"$BUILD_ROOT/target/OBSTOW_Bold.ufont" "../../../Indiana/Content/UI/Library/Font/OBSTOW_Bold.ufont"
"$BUILD_ROOT/target/TCM_Regular.uasset" "../../../Indiana/Content/UI/Library/Font/TCM_Regular.uasset"
"$BUILD_ROOT/target/TCM_Regular.uexp" "../../../Indiana/Content/UI/Library/Font/TCM_Regular.uexp"
"$BUILD_ROOT/target/TCM_Regular.ufont" "../../../Indiana/Content/UI/Library/Font/TCM_Regular.ufont"
EOM

$UNREALPAK_BIN "$BUILD_ROOT/target/zzCS-WindowsNoEditor.pak" -Create="$BUILD_ROOT/$RESPONSE_FILE"
