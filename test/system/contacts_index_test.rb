require "application_system_test_case"

class ContactsIndexTest < ApplicationSystemTestCase
  test "tapping a letter in the side index jumps to the groups starting with it" do
    # Enough contacts before and after W that the page has to scroll for it.
    40.times do |i|
      Contact.create!(group_name: "Club #{i}", location: "Bern", phone_number: "555 #{1000 + i}")
      Contact.create!(group_name: "Zoo #{i}", location: "Bern", phone_number: "555 #{2000 + i}")
    end

    visit root_path
    assert_operator section_top("letter-W"), :>, 1000, "the W section starts far below the fold"

    within("nav[aria-label='Jump to letter']") { click_on "W" }

    assert_selector "##{dom_id(contacts(:work_bern))}", text: "(555) 010-0113" # W loaded once in view
    assert_in_delta 0, section_top("letter-W"), 20, "the W section is at the top of the screen, and stays there"
  end

  test "a long letter loads chunk by chunk while scrolling, without the page jumping" do
    count = Contact::SECTION_CHUNK_SIZE * 2 + 50
    count.times { |i| Contact.create!(group_name: "Family", location: "City #{i.to_s.rjust(3, '0')}", phone_number: "555 #{1000 + i}") }

    visit root_path
    assert_selector "#letter-F-rows > ul > li", count: Contact::SECTION_CHUNK_SIZE
    assert_no_selector "#letter-F li", text: "555 #{1000 + count - 1}"

    last_section_top = section_top("letter-W")
    20.times do
      execute_script("window.scrollBy(0, 2000)")
      sleep 0.1
    end

    assert_selector "#letter-F li[id^=contact_]", count: count + 1 # + the fixture "Family" contact
    assert_selector "#letter-F li", text: "555 #{1000 + count - 1}"
    assert_in_delta last_section_top, section_top("letter-W") + page_scroll_y, 2,
                    "reserved space matched the loaded rows, so later sections didn't move"
  end

  private

  def section_top(id)
    evaluate_script("document.getElementById('#{id}').getBoundingClientRect().top")
  end

  def page_scroll_y
    evaluate_script("window.scrollY")
  end

  def dom_id(record)
    ActionView::RecordIdentifier.dom_id(record)
  end
end
