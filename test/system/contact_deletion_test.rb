require "application_system_test_case"

class ContactDeletionTest < ApplicationSystemTestCase
  test "delete a contact from its options menu after confirming, then undo it" do
    contact = contacts(:family_zurich)
    visit root_path

    open_options_for(contact)
    within(row(contact)) do
      assert_selector "li.menu-disabled", text: "Edit"
      click_on "Delete"
    end
    within("dialog[open]") do
      assert_text "Delete this contact?"
      click_on "Cancel"
    end
    assert_no_selector "dialog[open]"
    assert_selector row(contact)

    open_options_for(contact)
    within(row(contact)) { click_on "Delete" }
    within("dialog[open]") { click_on "Delete" }

    assert_selector "[role=status]", text: "Contact deleted."
    assert_no_selector row(contact)
    assert_not Contact.exists?(contact.id)

    within("[role=status]") { click_on "Undo" }

    assert_selector "[role=status]", text: "Contact restored."
    assert_selector row(contact)
    assert Contact.exists?(contact.id)
  end

  private

  def row(contact)
    "##{ActionView::RecordIdentifier.dom_id(contact)}"
  end

  def open_options_for(contact)
    find("#{row(contact)} [aria-label='Options for #{contact.phone_number}']").click
  end
end
