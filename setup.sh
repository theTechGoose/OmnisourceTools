last_colon_field() {
  s=${1%:}                # drop one trailing ":" if present
  printf '%s\n' "${s##*:}"
}

# Usage:
#   slash_field PATH [INDEX]
# INDEX:
#   -1 -> last, -2 -> second from last, ...
#    0 -> last, 1 -> second from last (backwards-compatible)

slash_field() {
  [ $# -ge 1 ] || { printf 'usage: slash_field PATH [INDEX]\n' >&2; return 2; }

  p=$1
  idx=${2:-0}

  # Validate integer (allows optional leading '-')
  case $idx in
    ''|'-'|*[!0-9-]*) printf 'index must be an integer\n' >&2; return 2;;
  esac

  # Map negative indices to "from-end" offset:
  #  -1 -> 0, -2 -> 1, etc.
  if [ "$idx" -lt 0 ]; then
    idx=$(( -idx - 1 ))
  fi

  # Strip trailing slashes (unless the path is just "/")
  while [ "$p" != "/" ] && [ "${p%/}" != "$p" ]; do p=${p%/}; done
  [ -z "$p" ] && p="."

  i=0
  while :; do
    comp=${p##*/}                # last component
    [ -z "$comp" ] && comp="/"   # handle "/"

    if [ "$i" -eq "$idx" ]; then
      printf '%s\n' "$comp"
      return 0
    fi

    parent=${p%/*}
    [ "$parent" = "$p" ] && break
    p=$parent
    i=$((i+1))
  done
  printf 'index out of range\n' >&2
  return 1
}
BIN_PATH="$(pwd)/$(dirname -- $1)/exe.js"
(echo '#!/usr/bin/env deno run --no-check -A'; deno bundle $1) > "$BIN_PATH"
chmod +x "$BIN_PATH"
BIN_DIR=$(last_colon_field $PATH)
FULL_PATH="$BIN_DIR/$(slash_field $1 -2)"
echo "Linking $BIN_PATH to $FULL_PATH"
cp "$BIN_PATH"  "$FULL_PATH"
