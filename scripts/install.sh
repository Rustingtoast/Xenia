#!/usr/bin/env bash
# Installs everything Xenia needs, on macOS or Linux (including a Raspberry Pi with 64-bit OS).
# Safe to run again at any time: it only installs or updates what is missing.
#
# For development (inside a clone of the project):
#   scripts/install.sh                     mise + Bun + packages + dev database with sample contacts
#   scripts/install.sh --no-sample-data    the same, but an empty dev database
#   scripts/install.sh --with-browsers     also Firefox for the browser tests (mise run test:e2e)
#
# As a server (the one-line install in the README runs this, see scripts/get.sh):
#   scripts/install.sh --server            builds the app and runs it on port 3000, started automatically
#                                          with the computer (Linux: systemd, macOS: launchd)
#     --port 8080                          another port
#     --origin http://phonebook.lan:8080   the address people open (default: http://<name>.local:<port>, else the IP)
#     --no-autostart                       no automatic start: run scripts/start.sh yourself
#     --autostart                          the automatic start again
#   Run it again to update: it rebuilds, then restarts. Settings (storage/server.env, including the choices
#   above) and contacts stay.
#
#   scripts/install.sh --help
#
# What it does:
#   1. checks for curl and git
#   2. installs mise (https://mise.jdx.dev) into ~/.local/bin if it is missing
#   3. lets mise install the Bun version pinned in mise.toml
#   4. installs the packages (bun install)
#   5. development: creates/migrates the dev database, loads the sample contacts, optionally installs
#      Playwright's Firefox
#      server: writes storage/server.env once (address, port, a random secret), builds the new version next
#      to the running one, then stops it, migrates the database, switches versions and starts it again
#
# It does not change your shell config; it prints the line to add if mise isn't set up in your shell yet.
# Written for bash 3.2, the version macOS ships.

set -euo pipefail

MODE=dev
SAMPLE_DATA=1
BROWSERS=0
PORT_OPTION=""
ORIGIN_OPTION=""
AUTOSTART_OPTION=""
DEV_OPTIONS=""
SERVER_OPTIONS=""

usage() {
	# This file's header comment, without the "# ".
	awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"
}

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '    \033[33m%s\033[0m\n' "$*"; }
fail() {
	printf '\n\033[31mError:\033[0m %s\n' "$*" >&2
	exit 1
}

while [ $# -gt 0 ]; do
	case "$1" in
		--server) MODE=server ;;
		--no-sample-data)
			SAMPLE_DATA=0
			DEV_OPTIONS="$DEV_OPTIONS $1"
			;;
		--with-browsers)
			BROWSERS=1
			DEV_OPTIONS="$DEV_OPTIONS $1"
			;;
		--port | --origin)
			[ $# -ge 2 ] && [ -n "$2" ] ||
				fail "$1 needs a value, e.g. $1 $([ "$1" = --port ] && echo 8080 || echo http://phonebook.lan:3000)"
			if [ "$1" = --port ]; then PORT_OPTION="$2"; else ORIGIN_OPTION="$2"; fi
			SERVER_OPTIONS="$SERVER_OPTIONS $1"
			shift
			;;
		--port=* | --origin=*)
			[ -n "${1#*=}" ] || fail "${1%%=*} needs a value, e.g. ${1%%=*}=$([ "${1%%=*}" = --port ] && echo 8080 || echo http://phonebook.lan:3000)"
			if [ "${1%%=*}" = --port ]; then PORT_OPTION="${1#*=}"; else ORIGIN_OPTION="${1#*=}"; fi
			SERVER_OPTIONS="$SERVER_OPTIONS ${1%%=*}"
			;;
		--autostart | --no-autostart)
			if [ "$1" = --autostart ]; then AUTOSTART_OPTION=yes; else AUTOSTART_OPTION=no; fi
			SERVER_OPTIONS="$SERVER_OPTIONS $1"
			;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			usage >&2
			exit 1
			;;
	esac
	shift
done

if [ "$MODE" = server ] && [ -n "$DEV_OPTIONS" ]; then
	fail "${DEV_OPTIONS# }: only for development, not with --server."
fi
if [ "$MODE" = dev ] && [ -n "$SERVER_OPTIONS" ]; then
	fail "${SERVER_OPTIONS# }: only with --server."
fi
if [ -n "$PORT_OPTION" ]; then
	case "$PORT_OPTION" in
		*[!0-9]*) fail "--port must be a number, e.g. 8080 (got '$PORT_OPTION')." ;;
	esac
	[ "$PORT_OPTION" -ge 1 ] && [ "$PORT_OPTION" -le 65535 ] || fail "--port must be between 1 and 65535."
fi
if [ -n "$ORIGIN_OPTION" ]; then
	ORIGIN_OPTION="${ORIGIN_OPTION%/}"
	case "$ORIGIN_OPTION" in
		*[[:space:]]*) fail "--origin can't contain spaces (got '$ORIGIN_OPTION')." ;;
		http://?* | https://?*) ;;
		*) fail "--origin must start with http:// or https://, e.g. http://phonebook.lan:3000 (got '$ORIGIN_OPTION')." ;;
	esac
fi

# Run from the project root, wherever the script is called from.
cd "$(dirname "$0")/.."
if [ ! -f mise.toml ] || [ ! -f package.json ]; then
	fail "Run this inside the Xenia project (mise.toml/package.json not found)."
fi
APP_DIR="$PWD"

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
if [ "$MODE" = server ] && [ "$(id -u)" -eq 0 ]; then
	fail "Run this as the user who should run Xenia, not as root (no sudo)."
fi
if [ "$MODE" = server ] && [ -n "$PORT_OPTION" ] && [ "$os" = Linux ]; then
	# Linux keeps the ports below this one (normally 1024) for root.
	lowest="$(cat /proc/sys/net/ipv4/ip_unprivileged_port_start 2>/dev/null || echo 1024)"
	[ "$PORT_OPTION" -ge "$lowest" ] ||
		fail "Port $PORT_OPTION is reserved for root on this system (ports below $lowest). Use e.g. 3000 or 8080."
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

# --- 4. Packages -------------------------------------------------------------------------------------------
step "Installing packages"
"$MISE" exec -- bun install --frozen-lockfile

# --- 5a. Development: database, sample contacts, browser-test Firefox --------------------------------------
setup_development() {
	step "Creating / migrating the database"
	"$MISE" exec -- bun run db:setup

	if [ "$SAMPLE_DATA" = 1 ] && [ -z "${DATABASE_PATH:-}" ]; then
		step "Loading the sample contacts (skip with --no-sample-data)"
		"$MISE" exec -- bun run db:seed
	elif [ "$SAMPLE_DATA" = 1 ]; then
		info "DATABASE_PATH is set: not loading sample contacts into $DATABASE_PATH."
	fi

	if [ "$BROWSERS" = 1 ]; then
		step "Installing Firefox for the browser tests"
		if [ "$os" = Linux ]; then
			info "Also installs the system libraries Firefox needs (asks for your sudo password)."
			"$MISE" exec -- bunx playwright install --with-deps firefox
		else
			"$MISE" exec -- bunx playwright install firefox
		fi
	fi

	step "Done"
	info "Start the app:        $MISE run dev        (http://localhost:5173)"
	info "From your phone:      $MISE run dev:lan"
	info "All commands:         $MISE tasks"
}

# --- 5b. Server: settings, build, database, automatic start -----------------------------------------------
SERVER_ENV="storage/server.env"
START_SCRIPT="$APP_DIR/scripts/start.sh"
SERVICE_NAME="xenia" # Linux: systemd user service
# Where the systemd user manager looks: ~/.config, not this shell's $XDG_CONFIG_HOME (the manager has its own).
SYSTEMD_UNIT="$HOME/.config/systemd/user/$SERVICE_NAME.service"
LAUNCH_AGENT_LABEL="io.github.rustingtoast.xenia" # macOS: launchd agent
LAUNCH_AGENT="$HOME/Library/LaunchAgents/$LAUNCH_AGENT_LABEL.plist"
LAUNCH_DOMAIN="gui/$(id -u)"

# This computer's address in the local network, for the default XENIA_ORIGIN ("" if none found).
local_address() {
	local address="" interface=""
	if [ "$os" = Darwin ]; then
		# The interface of the default route (Wi-Fi, Ethernet, a USB adapter, ...).
		interface="$(route -n get default 2>/dev/null | awk '/interface:/ { print $2; exit }' || true)"
		[ -z "$interface" ] || address="$(ipconfig getifaddr "$interface" 2>/dev/null || true)"
		[ -n "$address" ] || address="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
	else
		# The source address of the default route (sends nothing).
		address="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{ for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit } }' || true)"
		[ -n "$address" ] || address="$(hostname -I 2>/dev/null | awk '{ print $1 }' || true)"
	fi
	echo "$address"
}

# This computer's name on the local network ("devboard.local"), if it announces one (mDNS: Avahi on Linux,
# Bonjour on macOS); "" otherwise. Unlike the IP, the name stays the same when the router hands out another IP.
local_name() {
	local name=""
	if [ "$os" = Darwin ]; then
		name="$(scutil --get LocalHostName 2>/dev/null || true)"
	elif systemctl is-active --quiet avahi-daemon 2>/dev/null || pgrep -x avahi-daemon >/dev/null 2>&1; then
		name="$(hostname 2>/dev/null || true)"
		name="${name%%.*}"
	fi
	case "$name" in
		'' | -* | *[!A-Za-z0-9-]*) echo "" ;; # not usable as a name in an address
		*) echo "$name.local" ;;
	esac
}

random_secret() {
	if command -v openssl >/dev/null 2>&1; then
		openssl rand -hex 32
	else
		od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
	fi
}

# Reads the settings this script uses from storage/server.env into shell variables: KEY=value lines, the
# value taken literally (no quoting needed, nothing expanded), so paths with spaces or $ are fine. Same
# rules as scripts/start.sh, which passes every setting on to the server.
read_settings() {
	local line key value
	while IFS= read -r line || [ -n "$line" ]; do
		case "$line" in '' | '#'*) continue ;; esac
		key="${line%%=*}"
		[ "$key" != "$line" ] || continue
		value="${line#*=}"
		case "$value" in \"*\" | \'*\') value="${value:1:${#value}-2}" ;; esac
		case "$key" in
			XENIA_ORIGIN | PORT | HOST | DATABASE_PATH | XENIA_SECRET | XENIA_AUTOSTART | MISE) printf -v "$key" '%s' "$value" ;;
		esac
	done <"$SERVER_ENV"
}

# Sets one KEY=value line of the settings file (replacing it, or adding it). The file stays yours only.
set_setting() {
	(
		umask 077
		{
			grep -v "^$1=" "$SERVER_ENV" || true
			printf '%s=%s\n' "$1" "$2"
		} >"$SERVER_ENV.new"
		mv "$SERVER_ENV.new" "$SERVER_ENV"
	)
}

write_settings() {
	local port="${PORT_OPTION:-3000}" origin="$ORIGIN_OPTION" address secret
	if [ -z "$origin" ]; then
		address="$(local_name)"
		[ -n "$address" ] || address="$(local_address)"
		if [ -z "$address" ]; then
			warn "Couldn't find this computer's network address, so Xenia will only work on this computer"
			warn "(http://localhost:$port). For other devices, run this again with --origin http://<address>:$port"
			address=localhost
		fi
		origin="http://$address:$port"
	fi
	secret="$(random_secret)" || secret=""
	[ "${#secret}" -ge 32 ] || fail "Couldn't generate a random secret (with openssl or /dev/urandom)."
	(
		umask 077 # holds the secret: readable by you only
		cat >"$SERVER_ENV" <<EOF
# Xenia server settings, read by scripts/start.sh. Keep this file private: it holds the secret.
# One KEY=value per line, no quotes needed. After changing XENIA_ORIGIN or PORT, run
# scripts/install.sh --server again: it rebuilds and restarts.

# The address people open Xenia at. Form posts (log in, save, delete) from any other address are
# rejected as cross-site, so always use this one, also on this computer.
XENIA_ORIGIN=$origin
# The port, and the network to listen on (0.0.0.0: every network of this computer).
PORT=$port
HOST=0.0.0.0
# The contacts. Back them up by copying this file (best while Xenia is stopped).
DATABASE_PATH=$APP_DIR/storage/xenia.sqlite3
# Encrypts undo tokens. Generated once; must stay the same.
XENIA_SECRET=$secret
EOF
	)
}

# A path as one quoted systemd argument: escapes \ and ", and % (systemd's specifiers).
systemd_quote() {
	printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/%/%%/g')"
}

xml_escape() {
	printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

systemd_available() {
	command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1
}

launch_agent_loaded() {
	launchctl print "$LAUNCH_DOMAIN/$LAUNCH_AGENT_LABEL" >/dev/null 2>&1
}

autostart_installed() {
	if [ "$os" = Darwin ]; then [ -f "$LAUNCH_AGENT" ]; else [ -f "$SYSTEMD_UNIT" ]; fi
}

# Whether the installed automatic start runs this folder's Xenia (not one installed elsewhere).
autostart_is_ours() {
	if [ "$os" = Darwin ]; then
		grep -qF "<string>$(xml_escape "$START_SCRIPT")</string>" "$LAUNCH_AGENT" 2>/dev/null
	else
		grep -qF "ExecStart=$(systemd_quote "$START_SCRIPT")" "$SYSTEMD_UNIT" 2>/dev/null
	fi
}

# Stops the automatically started Xenia, if it runs, and waits until it has exited. Never fails.
stop_service() {
	if [ "$os" = Darwin ]; then
		launch_agent_loaded || return 0
		launchctl bootout "$LAUNCH_DOMAIN/$LAUNCH_AGENT_LABEL" >/dev/null 2>&1 || true
		# bootout returns before the server has finished its open requests (up to 30 s).
		local i
		for i in $(seq 1 80); do
			launch_agent_loaded || return 0
			sleep 0.5
		done
		warn "The previous Xenia is still shutting down."
	elif systemd_available; then
		systemctl --user stop "$SERVICE_NAME.service" >/dev/null 2>&1 || true # waits until it has exited
	fi
}

# Loads the launch agent (macOS), retrying while launchd still finishes the previous one.
bootstrap_launch_agent() {
	local attempt
	for attempt in 1 2 3 4 5; do
		launchctl bootstrap "$LAUNCH_DOMAIN" "$LAUNCH_AGENT" 2>/dev/null && return 0
		sleep 2
	done
	warn "launchctl couldn't load $LAUNCH_AGENT. Launch agents need someone logged in to this Mac's desktop."
	return 1
}

# Starts the previous version again, after a failed update (its automatic start is still in place).
restart_previous() {
	if [ "$os" = Darwin ]; then
		bootstrap_launch_agent || true
	elif systemd_available; then
		systemctl --user start "$SERVICE_NAME.service" || true
	fi
}

# Sets up the automatic start of this folder's Xenia and starts it. Returns 1 (after saying why) if a step
# fails. Linux: systemd user service, with the computer if "lingering" is allowed. macOS: launch agent.
start_with_autostart() {
	if [ "$os" = Darwin ]; then
		mkdir -p "$(dirname "$LAUNCH_AGENT")" || return 1
		cat >"$LAUNCH_AGENT" <<EOF || return 1
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Written by Xenia's scripts/install.sh --server. -->
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$LAUNCH_AGENT_LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>$(xml_escape "$START_SCRIPT")</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
	<key>StandardOutPath</key>
	<string>$(xml_escape "$APP_DIR/storage/xenia.log")</string>
	<key>StandardErrorPath</key>
	<string>$(xml_escape "$APP_DIR/storage/xenia.log")</string>
</dict>
</plist>
EOF
		stop_service # an agent still loaded from before
		bootstrap_launch_agent || return 1
		info "launchd agent '$LAUNCH_AGENT_LABEL': $LAUNCH_AGENT"
		info "Starts when you log in."
		return 0
	fi

	if ! systemd_available; then
		warn "No systemd user session here, so no automatic start."
		return 1
	fi
	mkdir -p "$(dirname "$SYSTEMD_UNIT")" || return 1
	cat >"$SYSTEMD_UNIT" <<EOF || return 1
# Written by Xenia's scripts/install.sh --server.
[Unit]
Description=Xenia phone book server

[Service]
ExecStart=$(systemd_quote "$START_SCRIPT")
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF
	systemctl --user daemon-reload || return 1
	systemctl --user enable --quiet "$SERVICE_NAME.service" || return 1
	if ! systemctl --user restart "$SERVICE_NAME.service"; then
		warn "systemd couldn't start it. See: journalctl --user -u $SERVICE_NAME"
		return 1
	fi
	info "systemd user service '$SERVICE_NAME': $SYSTEMD_UNIT"

	# Without "lingering", user services only run while you are logged in.
	local user="${USER:-$(id -un)}"
	if [ "$(loginctl show-user "$user" --property=Linger --value 2>/dev/null || true)" = yes ]; then
		info "Starts when the computer starts."
	elif loginctl enable-linger "$user" 2>/dev/null; then
		info "Starts when the computer starts (enabled lingering for $user)."
	else
		info "Starts when you log in. To start it with the computer instead, run once:"
		info "  sudo loginctl enable-linger $user"
	fi
}

remove_autostart() {
	if [ "$os" = Darwin ]; then
		stop_service
		rm -f "$LAUNCH_AGENT"
	else
		if systemd_available; then systemctl --user disable --now --quiet "$SERVICE_NAME.service" 2>/dev/null || true; fi
		rm -f "$SYSTEMD_UNIT"
		if systemd_available; then systemctl --user daemon-reload || true; fi
	fi
	info "Removed the automatic start (--no-autostart)."
}

# Waits until the server answers on its health check, up to 30 s.
wait_until_up() {
	local i
	for i in $(seq 1 60); do
		curl -fsS -o /dev/null "http://127.0.0.1:$PORT/up" 2>/dev/null && return 0
		sleep 0.5
	done
	return 1
}

setup_server() {
	step "Server settings ($SERVER_ENV)"
	mkdir -p storage
	chmod 700 storage # the settings with the secret, the contacts and the log: yours only
	if [ ! -f "$SERVER_ENV" ]; then
		write_settings
		info "Created, with a new random secret."
	else
		info "Keeping your settings and secret."
		read_settings
		if [ -n "$PORT_OPTION" ] && [ -z "$ORIGIN_OPTION" ]; then
			# Keep the address in step with the new port, if it names the old one.
			case "${XENIA_ORIGIN:-}" in
				*":${PORT:-}") set_setting XENIA_ORIGIN "${XENIA_ORIGIN%":$PORT"}:$PORT_OPTION" ;;
			esac
		fi
		if [ -n "$PORT_OPTION" ]; then set_setting PORT "$PORT_OPTION"; fi
		if [ -n "$ORIGIN_OPTION" ]; then set_setting XENIA_ORIGIN "$ORIGIN_OPTION"; fi
	fi
	if [ -n "$AUTOSTART_OPTION" ]; then set_setting XENIA_AUTOSTART "$AUTOSTART_OPTION"; fi
	# start.sh runs Bun through this mise: a service's short PATH may not find it.
	set_setting MISE "$MISE"
	read_settings
	local name
	for name in XENIA_ORIGIN PORT DATABASE_PATH XENIA_SECRET; do
		[ -n "${!name:-}" ] || fail "$name is missing in $APP_DIR/$SERVER_ENV. Add it, or delete the file to start over."
	done
	local autostart="${XENIA_AUTOSTART:-yes}"
	info "Address:  $XENIA_ORIGIN"
	info "Database: $DATABASE_PATH"

	# Build next to the running version: it keeps serving until the switch below.
	step "Building the app"
	rm -rf build.new
	XENIA_BUILD_DIR=build.new XENIA_ORIGIN="$XENIA_ORIGIN" "$MISE" exec -- bun run build

	# The automatic start that runs the previous version, if any. One that belongs to a Xenia installed in
	# another folder is only stopped if this one takes it over.
	local installed=0 ours=0 stopped=0
	if autostart_installed; then
		installed=1
		if autostart_is_ours; then ours=1; fi
	fi
	if [ "$installed" = 1 ] && { [ "$ours" = 1 ] || [ "$autostart" = yes ]; }; then
		step "Stopping the running version"
		stop_service
		stopped=1
	fi

	step "Creating / migrating the database"
	if ! DATABASE_PATH="$DATABASE_PATH" "$MISE" exec -- bun run db:setup; then
		if [ "$stopped" = 1 ] && [ "$ours" = 1 ]; then
			restart_previous
			if wait_until_up; then
				fail "The database update failed (see above). The previous version runs again: nothing has changed."
			fi
			fail "The database update failed (see above), and the previous version didn't start again. See its logs."
		fi
		fail "The database update failed (see above). Nothing has changed."
	fi

	step "Switching to the new version"
	rm -rf build.old
	if [ -d build ]; then mv build build.old; fi
	mv build.new build
	info "The previous version is in build.old until the new one runs."

	local started=0
	if [ "$autostart" = yes ]; then
		step "Starting Xenia, and with the computer from now on"
		if start_with_autostart; then started=1; fi
	elif [ "$installed" = 1 ] && [ "$ours" = 1 ]; then
		step "Automatic start"
		remove_autostart
	fi

	if [ "$started" = 1 ]; then
		if wait_until_up; then
			info "Running."
			rm -rf build.old
		else
			warn "Not answering after 30 s. See the logs (below)."
		fi
	fi

	step "Done"
	if [ "$started" = 1 ]; then
		info "Open Xenia:  $XENIA_ORIGIN   (register the first account there)"
	else
		info "Start it:    $START_SCRIPT"
		info "             (if you started it before and it still runs: stop it first)"
		info "Then open:   $XENIA_ORIGIN   (register the first account there)"
	fi
	info "Settings:    $APP_DIR/$SERVER_ENV"
	info "Contacts:    $DATABASE_PATH   (back up by copying)"
	info "Update:      run the install command again, or $APP_DIR/scripts/install.sh --server"
	if [ "$started" = 1 ] && [ "$os" = Darwin ]; then
		info "Logs:        $APP_DIR/storage/xenia.log"
		info "Stop:        launchctl bootout $LAUNCH_DOMAIN/$LAUNCH_AGENT_LABEL"
	elif [ "$started" = 1 ]; then
		info "Logs:        journalctl --user -u $SERVICE_NAME -f"
		info "Stop:        systemctl --user stop $SERVICE_NAME   (disable --now: also not at the next start)"
	fi
}

if [ "$MODE" = server ]; then
	setup_server
else
	setup_development
fi

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
