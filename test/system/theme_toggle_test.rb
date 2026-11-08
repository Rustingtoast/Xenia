require "application_system_test_case"

# ApplicationSystemTestCase makes the browser report a light system theme, so "system" means light here.
class ThemeToggleTest < ApplicationSystemTestCase
  test "follows the system theme until toggled, remembers the choice, and can go back to the system theme" do
    visit root_path
    assert_nil html_theme, "without a saved choice the page follows the system"
    assert_selector "button[aria-label='Switch to dark mode']"

    click_on "Switch to dark mode"
    assert_selector "button[aria-label='Switch to light mode']"
    assert_equal "dark", html_theme
    assert_equal "dark", saved_theme

    visit root_path
    assert_equal "dark", html_theme, "the choice survives a reload"

    click_on "Switch to light mode"
    assert_selector "button[aria-label='Switch to dark mode']"
    assert_nil html_theme, "switching back to the system theme follows the system again"
    assert_nil saved_theme
  end

  private

  def html_theme
    evaluate_script("document.documentElement.dataset.theme || null")
  end

  def saved_theme
    evaluate_script("localStorage.getItem('theme')")
  end
end
