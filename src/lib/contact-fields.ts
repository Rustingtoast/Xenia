import type { Contact } from './contacts.js';
import type { Locale, MessageKey } from './i18n/index.js';

/**
 * The fields shown in a contact's details dialog, in order. To show a new contact field later:
 * add it here, give it a label below, and (if it needs special display) a case in ContactDetailsDialog.
 */
export enum ContactField {
	PhoneNumber = 'phone-number',
	Group = 'group',
	Location = 'location',
	Description = 'description',
	Added = 'added'
}

/** Each field's label, as a message (see #lib/i18n). */
export const CONTACT_FIELD_LABELS: Record<ContactField, MessageKey> = {
	[ContactField.PhoneNumber]: 'field.phoneNumber',
	[ContactField.Group]: 'field.group',
	[ContactField.Location]: 'field.location',
	[ContactField.Description]: 'field.description',
	[ContactField.Added]: 'field.added'
};

/** The value of a field as plain text ("" when empty). Dates are written the way `locale` writes them. */
export function contactFieldText(contact: Contact, field: ContactField, locale: Locale): string {
	switch (field) {
		case ContactField.PhoneNumber:
			return contact.phoneNumber;
		case ContactField.Group:
			return contact.groupName;
		case ContactField.Location:
			return contact.location;
		case ContactField.Description:
			return contact.description;
		case ContactField.Added:
			return new Date(contact.createdAt).toLocaleDateString(locale, { dateStyle: 'long' });
	}
}
