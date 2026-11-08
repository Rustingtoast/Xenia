# Xenia
Flexible Phone Book Server.

A web app usable from both desktop and phone browsers.

## Stack

- Ruby 4.0.9, managed with [mise](https://mise.jdx.dev)
- Rails 8.1 (server-rendered HTML with Hotwire: Turbo + Stimulus via importmap)
- Tailwind CSS v4, mobile-first (unprefixed classes = phone, `md:`/`lg:` = larger screens)
- SQLite (database files live in `storage/`), Solid Cache / Queue / Cable

## Getting started

### 1. Install mise

mise installs and switches the right Ruby version for this project automatically.

```sh
# macOS (Homebrew)
brew install mise

# macOS / Linux (installer script)
curl https://mise.run | sh
```

Then hook it into your shell so the project's Ruby is used whenever you `cd` into it
(restart the terminal afterwards):

```sh
# zsh (macOS default)
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc

# bash
echo 'eval "$(mise activate bash)"' >> ~/.bashrc
```

Other shells and Windows: see the [mise getting started guide](https://mise.jdx.dev/getting-started.html).

> If you also use rbenv/rvm/asdf, make sure mise's activation line comes **after** theirs
> in your shell config, otherwise their Ruby may win. Check with `which ruby` inside the project.

### 2. Clone and set up the project

```sh
git clone https://github.com/Rustingtoast/Xenia.git
cd Xenia
mise trust          # allow mise to use this project's mise.toml (one time)
mise install        # installs Ruby 4.0.9
mise run setup      # installs gems, prepares the database, starts the dev server
```

Open http://localhost:3000.

> `mise install` may compile Ruby from source, which needs a C compiler and a few libraries
> (on macOS: Xcode Command Line Tools + `brew install openssl libyaml`). See the
> [ruby-build build environment](https://github.com/rbenv/ruby-build/wiki#suggested-build-environment)
> if the install fails.

## Everyday commands

| Command              | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `mise run dev`       | Start Rails + Tailwind watcher on http://localhost:3000            |
| `mise run dev:lan`   | Same, but reachable from your phone on the same Wi-Fi (see below)  |
| `mise run test`      | Run the test suite                                                 |
| `mise run test:system` | Run browser tests in headless Firefox (needs Firefox installed)  |
| `mise run lint`      | Run RuboCop (style) and Brakeman (security)                        |
| `mise run setup`     | Re-run setup after pulling changes (`-- --skip-server` to not start the server) |
| `mise tasks`         | List all tasks                                                     |

The tasks are thin wrappers around the standard Rails scripts in `bin/` (`bin/dev`,
`bin/setup`, `bin/rails test`, ...), which also work directly.

### Testing on a phone

Run `mise run dev:lan`, find your computer's local IP
(macOS: `ipconfig getifaddr en0`, Linux: `hostname -I`) and open
`http://<that-ip>:3000` in the phone's browser. Both devices must be on the same network.

## Upgrading Ruby

The Ruby version is set in three places that must stay in sync:
`mise.toml`, `.ruby-version` (used by CI) and `RUBY_VERSION` in the `Dockerfile`.
After changing them, run `mise install` and `bundle install`.
