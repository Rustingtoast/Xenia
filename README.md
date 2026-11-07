# Xenia
Flexible Phone Book Server.

A web app usable from both desktop and phone browsers.

## Stack

- Ruby 4.0.9 (pinned in `.ruby-version` and `mise.toml`)
- Rails 8.1 (server-rendered HTML with Hotwire: Turbo + Stimulus via importmap)
- Tailwind CSS v4, mobile-first (unprefixed classes = phone, `md:`/`lg:` = larger screens)
- SQLite (database files live in `storage/`), Solid Cache / Queue / Cable

## Setup

```sh
mise install        # installs the pinned Ruby
bin/setup           # installs gems, prepares the database, starts the dev server
```

## Common commands

```sh
bin/dev             # start the web server + Tailwind watcher on http://localhost:3000
bin/rails test      # run the test suite
bin/rubocop         # lint
bin/brakeman        # security scan
```

To test on a phone on the same network, bind to all interfaces:
`BINDING=0.0.0.0 bin/dev`, then open `http://<your-computer-ip>:3000` on the phone.
