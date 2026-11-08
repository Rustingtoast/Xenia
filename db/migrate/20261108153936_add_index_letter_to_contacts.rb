# Lets the list load one A–Z letter at a time, in chunks, straight from a database index
# (instead of reading and sorting the whole table on every request):
# - group_name and location become case-insensitive (NOCASE), so "family" sorts and matches like "Family",
#   and every index on them is in that order too;
# - index_letter stores each contact's side-index letter;
# - one index matches the list order exactly. SQLite indexes always end with the row id, the final tie-breaker.
class AddIndexLetterToContacts < ActiveRecord::Migration[8.1]
  # Frozen copy of the rule in Contact.index_letter_for, so this migration keeps working if the model changes.
  LETTERS = [ *"A".."Z" ].freeze

  class MigrationContact < ActiveRecord::Base
    self.table_name = "contacts"
  end

  def up
    change_column :contacts, :group_name, :string, null: false, collation: "NOCASE"
    change_column :contacts, :location, :string, null: false, collation: "NOCASE"
    add_column :contacts, :index_letter, :string, limit: 1, null: false, default: "#"

    MigrationContact.reset_column_information
    MigrationContact.find_each do |contact|
      letter = I18n.transliterate(contact.group_name.to_s[0].to_s).upcase
      contact.update_columns(index_letter: LETTERS.include?(letter) ? letter : "#")
    end

    add_index :contacts, %i[index_letter group_name location phone_number], name: "index_contacts_on_letter_section_order"
  end

  def down
    remove_index :contacts, name: "index_contacts_on_letter_section_order"
    remove_column :contacts, :index_letter
    change_column :contacts, :group_name, :string, null: false, collation: nil
    change_column :contacts, :location, :string, null: false, collation: nil
  end
end
