# Runs with `bin/rails db:seed`, `db:setup`, `db:reset`, and `db:prepare` on a fresh database.
# Must stay idempotent: running it twice must not create duplicates.
#
# Sample data is for development only; production starts empty.
load Rails.root.join("db/seeds/development.rb") if Rails.env.development?
