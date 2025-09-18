(echo '#!/usr/bin/env deno run -A'; deno bundle bootstrap.ts) > exe.js
chmod +x exe.js
cp ./exe.js $(which run-tests)
