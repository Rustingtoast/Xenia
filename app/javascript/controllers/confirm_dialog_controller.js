import { Controller } from "@hotwired/stimulus"

// Opens a <dialog> as a modal. Closing is native: <form method="dialog">, Esc, or the backdrop.
export default class extends Controller {
  static targets = ["dialog"]

  open() {
    // Drop focus from the ⋮ menu first, so the focus-based dropdown closes behind the dialog.
    document.activeElement?.blur()
    this.dialogTarget.showModal()
  }
}
