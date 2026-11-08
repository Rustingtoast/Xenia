# One row per phone book entry (issue #4: Group, Location, Phone number).
# Users come later (issue #8): that migration adds `t.references :user` here,
# so every contact belongs to exactly one user's phone book.
class CreateContacts < ActiveRecord::Migration[8.1]
  def change
    create_table :contacts do |t|
      t.string :group_name, null: false
      t.string :location, null: false
      t.string :phone_number, null: false

      t.timestamps
    end
    # Search/filter by group and location (issues #7/#9).
    add_index :contacts, :group_name
    add_index :contacts, :location
  end
end
