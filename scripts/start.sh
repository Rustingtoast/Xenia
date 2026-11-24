#!/usr/bin/env bash
# Runs the Xenia server set up by `scripts/install.sh --server`, with the settings in storage/server.env.
# The automatic start (systemd on Linux, launchd on macOS) runs this; you can also run it yourself.
set -euo pipefail

cd "$(dirname "$0")/.."
SERVER_ENV="storage/server.env"
[ -f "$SERVER_ENV" ] || {
	echo "No $SERVER_ENV: set up the server first with scripts/install.sh --server" >&2
	exit 1
}
[ -f build/index.js ] || {
	echo "No build/: run scripts/install.sh --server to build the app." >&2
	exit 1
}

# Every setting becomes an environment variable for the server (PORT, HOST, DATABASE_PATH, XENIA_SECRET, ...).
# KEY=value lines, the value taken literally (no quoting needed, nothing expanded): paths with spaces work.
while IFS= read -r line || [ -n "$line" ]; do
	case "$line" in '' | '#'*) continue ;; esac
	key="${line%%=*}"
	[ "$key" != "$line" ] || continue
	case "$key" in '' | [0-9]* | *[!A-Za-z0-9_]*) continue ;; esac
	value="${line#*=}"
	case "$value" in \"*\" | \'*\') value="${value:1:${#value}-2}" ;; esac
	export "$key=$value"
done <"$SERVER_ENV"

# mise runs the Bun version pinned in mise.toml. The installer saves the mise it used (MISE): a service's
# short PATH may not find it. The usual install places are the fallback.
for mise in "${MISE:-}" "$(command -v mise 2>/dev/null || true)" "$HOME/.local/bin/mise" /opt/homebrew/bin/mise /usr/local/bin/mise /usr/bin/mise; do
	if [ -n "$mise" ] && [ -x "$mise" ]; then
		exec "$mise" exec -- bun ./build
	fi
done
echo "mise not found: run scripts/install.sh --server again." >&2
exit 1
