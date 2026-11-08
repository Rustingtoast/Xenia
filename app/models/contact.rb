# A single phone book entry.
class Contact < ApplicationRecord
  # Digits plus the separators people actually type: "+41 79 123 45 67", "(555) 010-0199", "044/123.45.67".
  PHONE_FORMAT = %r{\A\+?[0-9 ()./-]+\z}

  normalizes :group_name, :location, :phone_number, with: ->(value) { value.strip.squeeze(" ") }

  validates :group_name, :location, presence: true, length: { maximum: 100 }
  validates :phone_number, presence: true, length: { maximum: 30 },
                           format: { with: PHONE_FORMAT, message: "may only contain digits, spaces, + ( ) . / -" }
  validate :phone_number_has_enough_digits

  scope :ordered, -> { order(:group_name, :location, :phone_number) }

  private

  def phone_number_has_enough_digits
    return if phone_number.blank? || phone_number.count("0-9") >= 3

    errors.add(:phone_number, "must contain at least 3 digits")
  end
end
