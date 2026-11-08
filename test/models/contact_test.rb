require "test_helper"

class ContactTest < ActiveSupport::TestCase
  def contact(**attrs)
    Contact.new({ group_name: "Friends", location: "Basel", phone_number: "+41 79 123 45 67" }.merge(attrs))
  end

  test "valid with group, location and phone number" do
    assert contact.valid?
  end

  test "requires group, location and phone number" do
    record = Contact.new
    assert_not record.valid?
    assert_includes record.errors[:group_name], "can't be blank"
    assert_includes record.errors[:location], "can't be blank"
    assert_includes record.errors[:phone_number], "can't be blank"
  end

  test "accepts common phone number formats" do
    [ "+41 79 123 45 67", "(555) 010-0199", "044/123.45.67", "112" ].each do |number|
      assert contact(phone_number: number).valid?, "expected #{number.inspect} to be valid"
    end
  end

  test "rejects letters and too few digits" do
    [ "call me", "555-CALL", "+1", "--" ].each do |number|
      assert_not contact(phone_number: number).valid?, "expected #{number.inspect} to be invalid"
    end
  end

  test "trims and collapses whitespace" do
    record = contact(group_name: "  Work  ", location: " New  York ", phone_number: " 555   0101 ")
    assert_equal "Work", record.group_name
    assert_equal "New York", record.location
    assert_equal "555 0101", record.phone_number
  end

  test "ordered sorts by group and location ignoring case" do
    lowercase = Contact.create!(group_name: "family", location: "Aarau", phone_number: "555 0140")
    upper_location = Contact.create!(group_name: "Family", location: "BERN", phone_number: "555 0141")

    assert_equal [ lowercase, upper_location, contacts(:family_zurich) ], Contact.where(index_letter: "F").ordered.to_a
  end

  test "index letter is the first letter of the group without accents, stored on save" do
    assert_equal "F", Contact.index_letter_for("family")
    assert_equal "A", Contact.index_letter_for("Ärzte")
    assert_equal "#", Contact.index_letter_for("112 Emergency")

    contact = Contact.create!(group_name: "Ärzte", location: "Bern", phone_number: "555 0150")
    assert_equal "A", contact.index_letter
    contact.update!(group_name: "Work")
    assert_equal "W", contact.reload.index_letter
  end

  test "letter_counts counts contacts per letter in A-Z order with # last" do
    assert_equal({ "A" => 1, "F" => 1, "W" => 1, "#" => 1 }, Contact.letter_counts)
  end

  test "section_chunk pages through a letter in list order" do
    Contact.where(index_letter: "F").delete_all
    family = 7.times.map { |i| Contact.create!(group_name: "Family", location: "City #{i}", phone_number: "555 0#{i}00") }

    first, more = Contact.section_chunk("F", limit: 3)
    assert_equal family.first(3), first
    assert more

    second, more = Contact.section_chunk("F", after: first.last.list_position, limit: 3)
    assert_equal family[3, 3], second
    assert more

    last, more = Contact.section_chunk("F", after: second.last.list_position, limit: 3)
    assert_equal [ family.last ], last
    assert_not more
  end

  test "section_chunk continues correctly when contacts were deleted meanwhile" do
    Contact.where(index_letter: "F").delete_all
    family = 6.times.map { |i| Contact.create!(group_name: "Family", location: "City #{i}", phone_number: "555 0#{i}00") }
    first, = Contact.section_chunk("F", limit: 3)

    family[1].destroy! # a row that is already shown
    family[2].destroy! # the very row the next chunk continues after

    second, = Contact.section_chunk("F", after: first.last.list_position, limit: 3)
    assert_equal family[3, 3], second, "nothing is skipped or repeated"
  end

  test "a deleted contact can be restored from its undo token, with the same id and data" do
    original = contacts(:family_zurich)
    token = original.undo_token
    original.destroy!

    restored = Contact.restore_from_undo_token(token)

    assert_equal original.id, restored.id
    assert_equal [ "Family", "Zurich", "+1 555-0101" ], [ restored.group_name, restored.location, restored.phone_number ]
    assert_equal original.created_at.to_i, restored.created_at.to_i
  end

  test "an undo token works only once" do
    contact = contacts(:family_zurich)
    token = contact.undo_token
    contact.destroy!

    assert Contact.restore_from_undo_token(token)
    assert_no_difference("Contact.count") { assert_nil Contact.restore_from_undo_token(token) }
  end

  test "an undo token expires" do
    contact = contacts(:family_zurich)
    token = contact.undo_token
    contact.destroy!

    travel Contact::UNDO_WINDOW + 1.second do
      assert_nil Contact.restore_from_undo_token(token)
    end
  end

  test "an undo token can't be read or forged" do
    token = contacts(:family_zurich).undo_token

    assert_no_match "555-0101", token
    assert_no_match "555-0101", Base64.decode64(token.split("--").first)
    assert_nil Contact.restore_from_undo_token("forged")
    assert_nil Contact.restore_from_undo_token(nil)
  end
end
