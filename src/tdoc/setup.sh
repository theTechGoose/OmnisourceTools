(echo '#!/usr/bin/env deno run --no-check -A'; deno bundle mod.ts) > exe.js
chmod +x exe.js
FILE_IN_BIN=$(which run-tests)
BIN_DIR="/Users/adam/.local/bin"
FULL_PATH="$BIN_DIR/tdoc"
echo "Linking $FULL_PATH"
cp ./exe.js "$FULL_PATH"
