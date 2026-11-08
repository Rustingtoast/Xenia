module ContactsHelper
  # HTML id of a side-index section: "letter-A" … "letter-Z", "letter-other" for "#".
  def index_section_id(letter)
    "letter-#{letter_param(letter)}"
  end

  # The letter as used in URLs and ids ("#" can't be in a path).
  def letter_param(letter)
    letter == "#" ? "other" : letter
  end

  # The turbo-frame a section chunk loads into: the first chunk, or the one continuing after contact `after` (an id).
  def section_frame_id(letter, after: nil)
    after ? "#{index_section_id(letter)}-after-#{after}" : "#{index_section_id(letter)}-rows"
  end

  # A contact's list position as a URL-safe string, for loading the chunk after it.
  def encode_list_position(contact)
    Base64.urlsafe_encode64(contact.list_position.to_json, padding: false)
  end
end
