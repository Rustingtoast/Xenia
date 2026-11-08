import type { Contact } from './contacts.js';

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

export const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
	[ContactField.PhoneNumber]: 'Phone number',
	[ContactField.Group]: 'Group',
	[ContactField.Location]: 'Location',
	[ContactField.Description]: 'Description',
	[ContactField.Added]: 'Added'
};

/** The value of a field as plain text ("" when empty). */
export function contactFieldText(contact: Contact, field: ContactField): string {
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
			return new Date(contact.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' });
	}
}
