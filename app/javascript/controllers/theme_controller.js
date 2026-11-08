import { Controller } from "@hotwired/stimulus"

// Light/dark toggle that follows the system theme until the user picks one.
//
// - No saved choice: no data-theme on <html>, so daisyUI follows the OS setting
//   (and switches live when the OS does).
// - Toggling saves "light" or "dark" in localStorage and sets data-theme.
// - Toggling back to whatever the OS currently uses clears the saved choice,
//   so the page follows the system again.
//
// The saved choice is applied before first paint by the inline script in the layout <head>.
const STORAGE_KEY = "theme"

export default class extends Controller {
  static targets = ["lightIcon", "darkIcon"]

  connect() {
    this.media = window.matchMedia("(prefers-color-scheme: dark)")
    this.onSystemChange = () => this.render()
    this.media.addEventListener("change", this.onSystemChange)
    this.render()
  }

  disconnect() {
    this.media.removeEventListener("change", this.onSystemChange)
  }

  toggle() {
    const next = this.current === "dark" ? "light" : "dark"
    if (next === this.system) {
      this.save(null)
      delete document.documentElement.dataset.theme
    } else {
      this.save(next)
      document.documentElement.dataset.theme = next
    }
    this.render()
  }

  // The theme on screen right now: the saved choice, else the system one.
  get current() {
    return document.documentElement.dataset.theme || this.system
  }

  get system() {
    return this.media.matches ? "dark" : "light"
  }

  save(theme) {
    try {
      theme ? localStorage.setItem(STORAGE_KEY, theme) : localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage blocked (private mode, etc.): the toggle still works for this page view.
    }
  }

  render() {
    const dark = this.current === "dark"
    // Show the icon of the theme you'd switch TO.
    // toggleAttribute, not .hidden: SVG elements have no .hidden property.
    this.lightIconTarget.toggleAttribute("hidden", !dark)
    this.darkIconTarget.toggleAttribute("hidden", dark)
    const label = dark ? "Switch to light mode" : "Switch to dark mode"
    this.element.setAttribute("aria-label", label)
    this.element.title = label
  }
}
