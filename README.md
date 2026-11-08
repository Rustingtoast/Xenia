# Xenia
Flexible Phone Book Server.

A web app usable from both desktop and phone browsers.

## Stack

- [Bun](https://bun.sh) 1.4 (runtime, package manager, unit tests), managed with [mise](https://mise.jdx.dev)
- [SvelteKit](https://svelte.dev/docs/kit) 3 with Svelte 5, TypeScript, built as a standalone Bun server (`@sveltejs/adapter-bun`)
- SQLite through Bun's built-in `bun:sqlite` (plain SQL, migrations in `src/lib/server/migrations.ts`)
- Tailwind CSS v4 + [daisyUI](https://daisyui.com) 5, mobile-first (unprefixed classes = phone, `md:`/`lg:` = larger screens)
- Playwright for browser tests, in headless Firefox

## Getting started

### 1. Install mise

mise installs the right Bun version for this project automatically.

```sh
# macOS (Homebrew)
brew install mise

# macOS / Linux (installer script)
curl https://mise.run | sh
```

Then hook it into your shell (restart the terminal afterwards):

```sh
# zsh (macOS default)
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc

# bash
echo 'eval "$(mise activate bash)"' >> ~/.bashrc
```

Other shells and Windows: see the [mise getting started guide](https://mise.jdx.dev/getting-started.html).

### 2. Clone and set up the project

```sh
git clone https://github.com/Rustingtoast/Xenia.git
cd Xenia
mise trust          # allow mise to use this project's mise.toml (one time)
mise install        # installs Bun
mise run setup      # installs packages, creates the dev database, loads 25 sample contacts
mise run dev        # http://localhost:5173
```

## Everyday commands

| Command                | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `mise run dev`         | Start the dev server on http://localhost:5173                         |
| `mise run dev:lan`     | Same, but reachable from your phone on the same Wi-Fi (see below)     |
| `mise run test`        | Run the unit tests (`bun test`)                                       |
| `mise run test:e2e`    | Run the browser tests in headless Firefox (builds the app first)      |
| `mise run check`       | Type-check everything (`svelte-check`)                                |
| `mise run setup`       | Re-run setup after pulling changes                                    |
| `mise run db:setup`    | Create / migrate the dev database                                     |
| `mise run db:seed`     | Add the sample contacts (skips ones that exist)                       |
| `mise run db:reset`    | **Delete** the dev database, recreate it and load the sample contacts |
| `mise tasks`           | List all tasks                                                        |

The tasks are thin wrappers around the `package.json` scripts, which also work directly (`bun run dev`, ...).

The first `mise run test:e2e` needs Playwright's Firefox: `bunx playwright install firefox`.

### Testing on a phone

Run `mise run dev:lan`, find your computer's local IP
(macOS: `ipconfig getifaddr en0`, Linux: `hostname -I`) and open
`http://<that-ip>:5173` in the phone's browser. Both devices must be on the same network.

## Running in production

```sh
XENIA_ORIGIN=http://<host>:3000 bun run build   # once per release
XENIA_SECRET=<secret> DATABASE_PATH=storage/xenia.sqlite3 PORT=3000 bun ./build
```

- `XENIA_ORIGIN` (build time): the URL people open the app at. Needed for plain `http://`, otherwise
  form posts (delete, undo) are rejected as cross-site.
- `XENIA_SECRET`: a long random string, e.g. `openssl rand -hex 32`. Keep it the same across restarts.
- `DATABASE_PATH`: the SQLite file. It is created and migrated on start. Back it up by copying it.

## Project layout

| Path                       | What's there                                                   |
| -------------------------- | -------------------------------------------------------------- |
| `src/routes/`              | Pages, form actions and JSON endpoints                         |
| `src/lib/components/`      | Svelte components (list sections, rows, side index, theme toggle) |
| `src/lib/server/`          | Server-only code: database, migrations, contact queries, undo  |
| `src/lib/contacts.ts`      | Contact types and rules shared by server and browser           |
| `scripts/db.ts`            | The `db:*` commands and the sample contacts                    |
| `e2e/`                     | Playwright browser tests                                       |
| `storage/`                 | SQLite databases (git-ignored)                                 |
