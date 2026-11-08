# A single phone book entry.
class Contact < ApplicationRecord
  # Digits plus the separators people actually type: "+41 79 123 45 67", "(555) 010-0199", "044/123.45.67".
  PHONE_FORMAT = %r{\A\+?[0-9 ()./-]+\z}

  # The side index of the list page: A–Z, plus "#" for groups that don't start with a letter.
  INDEX_LETTERS = [ *"A".."Z", "#" ].freeze

  # How many contacts the list loads at once, per letter section.
  SECTION_CHUNK_SIZE = 100

  normalizes :group_name, :location, :phone_number, with: ->(value) { value.strip.squeeze(" ") }
  before_validation { self.index_letter = self.class.index_letter_for(group_name) }

  validates :group_name, :location, presence: true, length: { maximum: 100 }
  validates :phone_number, presence: true, length: { maximum: 30 },
                           format: { with: PHONE_FORMAT, message: "may only contain digits, spaces, + ( ) . / -" }
  validate :phone_number_has_enough_digits

  # List order. group_name and location are NOCASE columns, so "family" sorts next to "Family".
  # Together with `index_letter` this is exactly index_contacts_on_letter_section_order (+ the row id).
  scope :ordered, -> { order(:group_name, :location, :phone_number, :id) }

  # First letter of the group, accents removed ("Ärzte" => "A"); "#" for digits and symbols.
  # Stored in `index_letter` on every save.
  def self.index_letter_for(group_name)
    letter = I18n.transliterate(group_name.to_s[0].to_s).upcase
    INDEX_LETTERS.include?(letter) ? letter : "#"
  end

  # Number of contacts per side-index letter, in A–Z order with "#" last: { "D" => 2, "F" => 9, "#" => 1 }.
  def self.letter_counts
    group(:index_letter).count.sort_by { |letter, _| INDEX_LETTERS.index(letter) }.to_h
  end

  # One chunk of a letter section in list order, continuing after the contact whose
  # `list_position` is given (nil = from the start). Continuing "after X" rather than
  # "skip N" means deleting a contact never shifts the next chunk and hides someone.
  # Returns [contacts, more?].
  def self.section_chunk(letter, after: nil, limit: SECTION_CHUNK_SIZE)
    contacts = in_section(letter, after:).ordered.limit(limit + 1).to_a
    [ contacts.first(limit), contacts.size > limit ]
  end

  # Contacts of a letter section, optionally only those after a `list_position`.
  def self.in_section(letter, after: nil)
    scope = where(index_letter: letter)
    after ? scope.where("(group_name, location, phone_number, id) > (?, ?, ?, ?)", *after) : scope
  end

  # This contact's place in the list order, for continuing a section after it.
  def list_position
    [ group_name, location, phone_number, id ]
  end

  # How long the "Undo" button after a delete keeps working.
  UNDO_WINDOW = 5.minutes

  # An encrypted, expiring copy of this contact, used by the "Undo" button after deleting it.
  # Encrypted (not just signed) so the contact data isn't readable from the page or the session cookie.
  def undo_token
    self.class.undo_encryptor.encrypt_and_sign(
      attributes.slice("id", "group_name", "location", "phone_number", "created_at"),
      expires_in: UNDO_WINDOW, purpose: :undo_delete
    )
  end

  # Re-creates a deleted contact (same id) from its undo token.
  # Returns nil if the token is invalid or expired, or the contact exists again already.
  def self.restore_from_undo_token(token)
    attributes = undo_encryptor.decrypt_and_verify(token.to_s, purpose: :undo_delete)
    return if attributes.nil? || exists?(attributes["id"])

    create!(attributes)
  rescue ActiveSupport::MessageEncryptor::InvalidMessage
    nil # malformed or tampered token
  end

  def self.undo_encryptor
    key = Rails.application.key_generator.generate_key("contact undo", ActiveSupport::MessageEncryptor.key_len)
    ActiveSupport::MessageEncryptor.new(key)
  end

  private

  def phone_number_has_enough_digits
    return if phone_number.blank? || phone_number.count("0-9") >= 3

    errors.add(:phone_number, "must contain at least 3 digits")
  end
end
