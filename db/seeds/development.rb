# Fictional sample contacts for local development and manual testing.
# Phone numbers use the 555-01xx range, which is reserved for fiction, and mix
# formats on purpose so search (issue #7) and display can be tried against them.
SAMPLE_CONTACTS = [
  [ "Family",     "Zurich",   "+1 555-0101" ],
  [ "Family",     "Zurich",   "+1 555-0102" ],
  [ "Family",     "Geneva",   "(555) 010-0103" ],
  [ "Family",     "Bern",     "555 0104" ],
  [ "Friends",    "Zurich",   "+1 555 0105" ],
  [ "Friends",    "Basel",    "555-0106" ],
  [ "Friends",    "Basel",    "555.0107" ],
  [ "Friends",    "Lausanne", "+1 (555) 010-0108" ],
  [ "Friends",    "Geneva",   "555/0109" ],
  [ "Work",       "Zurich",   "+1 555-0110" ],
  [ "Work",       "Zurich",   "+1 555-0111" ],
  [ "Work",       "Zurich",   "+1 555-0112" ],
  [ "Work",       "Bern",     "555 0113" ],
  [ "Work",       "Remote",   "+1 555 0114" ],
  [ "Doctors",    "Zurich",   "555-0115" ],
  [ "Doctors",    "Bern",     "(555) 010-0116" ],
  [ "Emergency",  "Zurich",   "+1 555-0117" ],
  [ "Emergency",  "Basel",    "+1 555-0118" ],
  [ "Neighbours", "Zurich",   "555 0119" ],
  [ "Neighbours", "Zurich",   "555-0120" ],
  [ "Services",   "Lausanne", "+1 555 0121" ],
  [ "Services",   "Geneva",   "555.0122" ],
  [ "Services",   "Remote",   "+1 (555) 010-0123" ],
  [ "School",     "Bern",     "555 0124" ],
  [ "School",     "Bern",     "555-0125" ]
].freeze

before = Contact.count
SAMPLE_CONTACTS.each do |group_name, location, phone_number|
  Contact.find_or_create_by!(group_name:, location:, phone_number:)
end
puts "Seeded sample contacts: #{Contact.count - before} new, #{Contact.count} total."
