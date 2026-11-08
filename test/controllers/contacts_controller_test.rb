require "test_helper"

class ContactsControllerTest < ActionDispatch::IntegrationTest
  include ActionView::RecordIdentifier

  test "the list page has a heading and lazy-loading frame per letter, but no rows yet" do
    get root_path

    assert_response :success
    assert_select "h1", "Phonebook"
    assert_select "#contact-count", "4 contacts"
    assert_select("section h2") { |headings| assert_equal %w[A F W #], headings.map(&:text) }
    assert_select "section#letter-F turbo-frame#letter-F-rows[loading=lazy][src='#{section_contacts_path(letter: 'F')}']"
    assert_select "section#letter-other turbo-frame[src='#{section_contacts_path(letter: 'other')}']"
    assert_select "li[id^=contact_]", 0
  end

  test "side index links letters with contacts and greys out the rest" do
    get root_path

    assert_select "nav[aria-label='Jump to letter']" do
      assert_select "a", 4
      assert_select "a[href='#letter-A']", "A"
      assert_select "a[href='#letter-other']", "#"
      assert_select "span", "B"
    end
  end

  test "shows an empty state without contacts" do
    Contact.delete_all

    get root_path

    assert_response :success
    assert_select "nav[aria-label='Jump to letter']", 0
    assert_match "No contacts yet.", response.body
  end

  test "a section chunk renders its rows with the options menu" do
    get section_contacts_path(letter: "F")

    assert_response :success
    assert_select "turbo-frame#letter-F-rows" do
      assert_select "li##{dom_id(contacts(:family_zurich))}" do
        assert_select "a[href='tel:+1555-0101']", "+1 555-0101"
        assert_select "[role=button][aria-label='Options for +1 555-0101']"
        assert_select "li.menu-disabled", text: /Edit/
        assert_select "button.text-error", text: /Delete/
        assert_select "dialog form[action='#{contact_path(contacts(:family_zurich))}'] button.btn-error", "Delete"
      end
    end
  end

  test "a big section loads in chunks, each continuing after the last" do
    Contact.where(index_letter: "F").delete_all
    (Contact::SECTION_CHUNK_SIZE + 5).times do |i|
      Contact.create!(group_name: "Family", location: "City #{i.to_s.rjust(3, '0')}", phone_number: "555 #{1000 + i}")
    end

    get section_contacts_path(letter: "F")
    assert_select "turbo-frame#letter-F-rows > ul > li", Contact::SECTION_CHUNK_SIZE
    next_frame = css_select("turbo-frame#letter-F-rows > turbo-frame[loading=lazy]").first
    assert next_frame, "a lazy frame for the next chunk"
    assert_select "turbo-frame#letter-F-rows > turbo-frame [style='--rows: 5']"

    get next_frame["src"]
    assert_select "turbo-frame##{next_frame['id']} > ul > li", 5
    assert_select "turbo-frame##{next_frame['id']} turbo-frame", 0
  end

  test "a section chunk with a broken position is rejected" do
    get section_contacts_path(letter: "F", after: "not-a-position")

    assert_response :bad_request
  end

  test "destroy removes the row and offers undo (turbo stream)" do
    contact = contacts(:family_zurich)
    Contact.create!(group_name: "Friends", location: "Bern", phone_number: "555 0160") # F stays non-empty

    assert_difference("Contact.count", -1) do
      delete contact_path(contact), as: :turbo_stream
    end

    assert_turbo_stream action: :remove, target: dom_id(contact)
    assert_turbo_stream action: :update, target: "contact-count" do
      assert_select "template", "4 contacts"
    end
    assert_turbo_stream action: :update, target: "flash" do
      assert_select "[role=status]", /Contact deleted./
      assert_select "form[action='#{restore_contacts_path}'] button", "Undo"
    end
  end

  test "destroying the last contact of a letter rebuilds the list without it" do
    delete contact_path(contacts(:family_zurich)), as: :turbo_stream

    assert_turbo_stream action: :replace, target: "phonebook" do
      assert_select("section h2") { |headings| assert_equal %w[A W #], headings.map(&:text) }
    end
  end

  test "destroy without Turbo redirects back to the list with undo" do
    delete contact_path(contacts(:family_zurich))

    assert_redirected_to root_path
    assert_response :see_other
    follow_redirect!
    assert_select "[role=status]", /Contact deleted./
    assert_select "[role=status] form[action='#{restore_contacts_path}'] button", "Undo"
  end

  test "undo brings a deleted contact back (turbo stream)" do
    contact = contacts(:family_zurich)
    delete contact_path(contact), as: :turbo_stream
    token = css_select("input[name=token]").first["value"]

    assert_difference("Contact.count", 1) do
      post restore_contacts_path, params: { token: }, as: :turbo_stream
    end

    assert Contact.exists?(contact.id)
    assert_turbo_stream action: :replace, target: "phonebook" do
      assert_select("section h2") { |headings| assert_equal %w[A F W #], headings.map(&:text) }
    end
    assert_turbo_stream action: :update, target: "flash" do
      assert_select "[role=status]", "Contact restored."
    end
  end

  test "undo reloads only the contact's section when that letter still had contacts" do
    contact = contacts(:family_zurich)
    Contact.create!(group_name: "Friends", location: "Bern", phone_number: "555 0160")
    delete contact_path(contact), as: :turbo_stream
    token = css_select("input[name=token]").first["value"]

    post restore_contacts_path, params: { token: }, as: :turbo_stream

    assert_turbo_stream action: :replace, target: "letter-F" do
      assert_select "turbo-frame#letter-F-rows[src='#{section_contacts_path(letter: 'F')}']"
    end
  end

  test "undo with an invalid token shows a warning" do
    assert_no_difference("Contact.count") do
      post restore_contacts_path, params: { token: "nope" }, as: :turbo_stream
    end

    assert_turbo_stream action: :update, target: "flash" do
      assert_select "[role=alert]", "This contact can no longer be restored."
    end
  end

  test "undo without Turbo redirects back with a notice" do
    delete contact_path(contacts(:family_zurich))
    follow_redirect!
    token = css_select("[role=status] input[name=token]").first["value"]

    post restore_contacts_path, params: { token: }

    assert_redirected_to root_path
    follow_redirect!
    assert_select "[role=status]", /Contact restored./
  end
end
