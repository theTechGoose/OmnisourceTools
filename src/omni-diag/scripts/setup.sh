#!/bin/bash

# ╔═══════════════════════════════════════════════════════════════╗
# ║              OMNISOURCE UNIVERSAL BUILD SYSTEM                ║
# ║                 Forge Your Tools Into Reality                 ║
# ╚═══════════════════════════════════════════════════════════════╝

NAME=${1:-$(basename "$PWD")}
ENTRY=${2:-bootstrap.ts}

echo ""
echo "⚡ === OMNISOURCE TOOL FORGE === ⚡"
echo ""
echo "🔨 Forging: $NAME"
echo "📜 Source: $ENTRY"
echo ""

echo "🔥 Bundling TypeScript into executable..."
(echo '#!/usr/bin/env deno run -A'; deno bundle "$ENTRY") > exe.js

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Check your TypeScript code."
    exit 1
fi

echo "⚙️  Setting execution permissions..."
chmod +x exe.js

echo "🚀 Deploying to ~/.local/bin/$NAME..."
mkdir -p ~/.local/bin
cp ./exe.js ~/.local/bin/$NAME

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  🌟 BUILD SUCCESSFUL! 🌟                      ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Tool Name: $NAME"
echo "║  Installed: ~/.local/bin/$NAME"
echo "║  Entry Point: $ENTRY"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Pro Tips:                                                    ║"
echo "║  • Ensure ~/.local/bin is in your PATH                        ║"
echo "║  • Run '$NAME --help' for usage info                          ║"
echo "║  • Rebuild anytime with: ./setup.sh $NAME                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "💪 Another tool forged in the OmniSource crucible!"
echo ""
