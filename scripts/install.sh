#!/usr/bin/env bash
# Installs everything Xenia needs, on macOS or Linux (including a Raspberry Pi with 64-bit OS).
# Safe to run again at any time: it only installs or updates what is missing.
#
#   scripts/install.sh                     mise + Bun + packages + dev database with sample contacts
#   scripts/install.sh --no-sample-data    the same, but an empty database (e.g. a real installation on the Pi)
#   scripts/install.sh --with-browsers     also Firefox for the browser tests (mise run test:e2e)
#   scripts/install.sh --help
#
# What it does:
#   1. checks for curl and git
#   2. installs mise (https://mise.jdx.dev) into ~/.local/bin if it is missing
#   3. lets mise install the Bun version pinned in mise.toml
#   4. installs the packages (bun install) and creates/migrates the database
#   5. optionally loads the sample contacts and installs Playwright's Firefox
#
# It does not change your shell config; it prints the line to add if mise isn't set up in your shell yet.
# Written for bash 3.2, the version macOS ships.

set -euo pipefail

SAMPLE_DATA=1
BROWSERS=0

usage() {
	sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
	case "$arg" in
		--no-sample-data) SAMPLE_DATA=0 ;;
		--with-browsers) BROWSERS=1 ;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $arg" >&2
			usage >&2
			exit 1
			;;
	esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
fail() {
	printf '\n\033[31mError:\033[0m %s\n' "$*" >&2
	exit 1
}

# Run from the project root, wherever the script is called from.
cd "$(dirname "$0")/.."
if [ ! -f mise.toml ] || [ ! -f package.json ]; then
	fail "Run this inside the Xenia project (mise.toml/package.json not found)."
fi

# --- 1. Basics --------------------------------------------------------------------------------------------
step "Checking basic tools"
os="$(uname -s)"
arch="$(uname -m)"
info "System: $os $arch"
case "$os" in
	Darwin | Linux) ;;
	*) fail "Unsupported system '$os'. Use macOS or Linux (on Windows: WSL)." ;;
esac
if [ "$os" = Linux ] && [ "$arch" != x86_64 ] && [ "$arch" != aarch64 ] && [ "$arch" != arm64 ]; then
	fail "Bun needs a 64-bit system (x86_64 or aarch64), this is '$arch'. On a Raspberry Pi, use 64-bit Raspberry Pi OS."
fi

missing=""
for tool in curl git; do
	command -v "$tool" >/dev/null 2>&1 || missing="$missing $tool"
done
if [ -n "$missing" ]; then
	if [ "$os" = Linux ] && command -v apt-get >/dev/null 2>&1; then
		fail "Missing:$missing. Install with: sudo apt-get update && sudo apt-get install -y$missing"
	elif [ "$os" = Darwin ]; then
		fail "Missing:$missing. Install the Xcode command line tools: xcode-select --install"
	else
		fail "Missing:$missing. Install them with your package manager and run this script again."
	fi
fi
info "curl and git: found"

# --- 2. mise -----------------------------------------------------------------------------------------------
step "Checking mise"
if command -v mise >/dev/null 2>&1; then
	MISE="$(command -v mise)"
	info "Found: $MISE ($("$MISE" --version))"
elif [ -x "$HOME/.local/bin/mise" ]; then
	MISE="$HOME/.local/bin/mise"
	info "Found: $MISE (not in your PATH yet, see the end of this script's output)"
else
	info "Not found, installing it into ~/.local/bin (https://mise.run)"
	curl -fsSL https://mise.run | sh
	MISE="$HOME/.local/bin/mise"
	[ -x "$MISE" ] || fail "mise was not installed to $MISE. See https://mise.jdx.dev/getting-started.html"
fi

# --- 3. Bun ------------------------------------------------------------------------------------------------
step "Installing Bun (version from mise.toml)"
"$MISE" trust --quiet "$PWD/mise.toml"
"$MISE" install
info "Bun $("$MISE" exec -- bun --version)"

# --- 4. Packages and database ------------------------------------------------------------------------------
step "Installing packages"
"$MISE" exec -- bun install --frozen-lockfile

step "Creating / migrating the database"
"$MISE" exec -- bun run db:setup

if [ "$SAMPLE_DATA" = 1 ] && [ -z "${DATABASE_PATH:-}" ]; then
	step "Loading the sample contacts (skip with --no-sample-data)"
	"$MISE" exec -- bun run db:seed
elif [ "$SAMPLE_DATA" = 1 ]; then
	info "DATABASE_PATH is set: not loading sample contacts into $DATABASE_PATH."
fi

# --- 5. Browser-test Firefox -------------------------------------------------------------------------------
if [ "$BROWSERS" = 1 ]; then
	step "Installing Firefox for the browser tests"
	if [ "$os" = Linux ]; then
		info "Also installs the system libraries Firefox needs (asks for your sudo password)."
		"$MISE" exec -- bunx playwright install --with-deps firefox
	else
		"$MISE" exec -- bunx playwright install firefox
	fi
fi

# --- Done ---------------------------------------------------------------------------------------------------
step "Done"
info "Start the app:        $MISE run dev        (http://localhost:5173)"
info "From your phone:      $MISE run dev:lan"
info "All commands:         $MISE tasks"
if ! command -v mise >/dev/null 2>&1; then
	shell_name="$(basename "${SHELL:-bash}")"
	case "$shell_name" in
		zsh) rc="$HOME/.zshrc" ;;
		bash) rc="$HOME/.bashrc" ;;
		*) rc="" ;;
	esac
	echo
	info "mise is not set up in your shell yet. To use plain 'mise ...', run once and open a new terminal:"
	if [ -n "$rc" ]; then
		info "  echo 'eval \"\$($MISE activate $shell_name)\"' >> $rc"
	else
		info "  see https://mise.jdx.dev/getting-started.html (shell: $shell_name)"
	fi
fi
