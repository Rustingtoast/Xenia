#!/usr/bin/env bash
# One-line install of Xenia as a server, into your home folder (macOS or Linux, also a Raspberry Pi):
#
#   curl -fsSL https://raw.githubusercontent.com/Rustingtoast/Xenia/main/scripts/get.sh | bash
#
# Downloads Xenia into ~/xenia (or updates it there), then runs `scripts/install.sh --server`: installs Bun,
# builds the app and starts it, now and with the computer. Run the same line again to update; the folder
# (--dir) and the settings are remembered. Options go after `bash -s --`, e.g.:
#
#   curl -fsSL https://raw.githubusercontent.com/Rustingtoast/Xenia/main/scripts/get.sh | bash -s -- --port 8080
#
# Written for bash 3.2 (macOS). Everything runs in main(), called on the last line: a partly downloaded
# script does nothing.

set -euo pipefail

# Marks a folder this script installed, so it never takes over a clone made by hand (a development copy).
MARKER="storage/.installed-by-get-sh"
# Remembers the install folder, so updating without --dir finds an install made with --dir.
REMEMBERED_DIR="$HOME/.config/xenia/install-dir"

usage() {
	cat <<'EOF'
Installs (or updates) Xenia as a server in ~/xenia, started automatically with the computer.

  curl -fsSL https://raw.githubusercontent.com/Rustingtoast/Xenia/main/scripts/get.sh | bash -s -- [options]

  --dir PATH                          install into PATH instead of ~/xenia (remembered for updates)
  --branch NAME                       another branch than main
  --port 8080                         another port than 3000
  --origin http://phonebook.lan:3000  the address people open (default: http://<name>.local:<port>, else the IP)
  --no-autostart                      no automatic start: run <dir>/scripts/start.sh yourself (remembered)
  --autostart                         the automatic start again
EOF
}

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() {
	printf '\n\033[31mError:\033[0m %s\n' "$*" >&2
	exit 1
}

# An absolute path, with a leading ~ expanded (bash doesn't expand it in --dir=~/...).
absolute_path() {
	local path="$1"
	case "$path" in
		"~") path="$HOME" ;;
		"~/"*) path="$HOME/${path#"~/"}" ;;
	esac
	case "$path" in
		/*) ;;
		*) path="$PWD/$path" ;;
	esac
	printf '%s' "${path%/}"
}

main() {
	local dir=""
	local branch="main"
	local repo="${XENIA_REPO:-https://github.com/Rustingtoast/Xenia.git}"
	local install_options=()

	while [ $# -gt 0 ]; do
		case "$1" in
			--dir | --branch)
				[ $# -ge 2 ] && [ -n "$2" ] || fail "$1 needs a value."
				if [ "$1" = --dir ]; then dir="$(absolute_path "$2")"; else branch="$2"; fi
				shift
				;;
			--dir=*)
				[ -n "${1#*=}" ] || fail "--dir needs a value."
				dir="$(absolute_path "${1#*=}")"
				;;
			--branch=*)
				[ -n "${1#*=}" ] || fail "--branch needs a value."
				branch="${1#*=}"
				;;
			-h | --help)
				usage
				return 0
				;;
			*) install_options+=("$1") ;; # for scripts/install.sh --server, which checks them
		esac
		shift
	done

	[ "$(id -u)" -ne 0 ] || fail "Run this as the user who should run Xenia, not as root (no sudo)."
	command -v git >/dev/null 2>&1 || fail "git is missing. Install it (macOS: xcode-select --install) and run this again."

	if [ -z "$dir" ]; then
		dir="$HOME/xenia"
		# An earlier install with --dir.
		if [ -f "$REMEMBERED_DIR" ]; then
			local remembered
			remembered="$(cat "$REMEMBERED_DIR")"
			if [ -n "$remembered" ] && [ -f "$remembered/$MARKER" ]; then dir="$remembered"; fi
		fi
	fi

	if [ -f "$dir/$MARKER" ] && [ -d "$dir/.git" ]; then
		step "Updating Xenia in $dir"
		git -C "$dir" fetch --quiet origin "$branch"
		git -C "$dir" checkout --quiet "$branch" ||
			fail "Couldn't switch $dir to $branch: it has changes of its own (git -C \"$dir\" status)."
		git -C "$dir" merge --ff-only --quiet "origin/$branch" ||
			fail "Couldn't update $dir: it has changes of its own (git -C \"$dir\" status). Undo them and run this again."
	elif [ -d "$dir/.git" ]; then
		fail "$dir is a copy of Xenia that this installer didn't make (a development clone?). Choose another folder with --dir, or update it yourself: git pull, then scripts/install.sh --server."
	elif [ -e "$dir" ]; then
		fail "$dir already exists and is not a Xenia install. Move it away, or choose another folder with --dir."
	else
		step "Downloading Xenia into $dir"
		git clone --quiet --branch "$branch" "$repo" "$dir"
		mkdir -p "$dir/storage"
		: >"$dir/$MARKER"
	fi

	mkdir -p "$(dirname "$REMEMBERED_DIR")"
	printf '%s\n' "$dir" >"$REMEMBERED_DIR"

	# The rest is versioned with the app: installing a release uses that release's installer.
	exec "$dir/scripts/install.sh" --server ${install_options[@]+"${install_options[@]}"}
}

main "$@"
