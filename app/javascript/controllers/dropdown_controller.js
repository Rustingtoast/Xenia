import { Controller } from "@hotwired/stimulus"

// Opens a daisyUI focus dropdown upward when there isn't room for it below
// (e.g. the last rows on screen), so the menu never ends up off-screen.
export default class extends Controller {
  static targets = ["menu"]

  place() {
    const below = window.innerHeight - this.element.getBoundingClientRect().bottom
    this.element.classList.toggle("dropdown-top", below < this.menuTarget.offsetHeight + 16)
  }
}
