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

  test "ordered sorts by group, then location" do
    assert_equal [ contacts(:family_zurich), contacts(:work_bern) ], Contact.ordered.to_a
  end
end
