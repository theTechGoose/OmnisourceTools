(echo '#!/usr/bin/env deno run --no-check -A'; deno bundle mod.ts) > exe.js
chmod +x exe.js
FILE_IN_BIN=$(which run-tests)
BIN_DIR=$(dirname "$FILE_IN_BIN")
FULL_PATH="$BIN_DIR/sampler"
echo "Linking $FULL_PATH"
cp ./exe.js "$FULL_PATH"
