require "test_helper"

class ApplicationSystemTestCase < ActionDispatch::SystemTestCase
  driven_by :selenium, using: :headless_firefox, screen_size: [ 1400, 1400 ] do |options|
    # Report a light system theme on every machine (a Mac in dark mode would otherwise leak into tests).
    options.add_preference("layout.css.prefers-color-scheme.content-override", 1)
  end
end
