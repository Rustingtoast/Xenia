import type { Message } from '../index.js';

/**
 * English: the reference language. Every key here must exist in every other language (the type checker
 * enforces it). {name} is a placeholder; plural messages pick their form by `count`.
 * To add a text: add it here, then to each file next to this one.
 */
export const en = {
	// Shared buttons
	'common.cancel': 'Cancel',
	'common.close': 'Close',
	'common.save': 'Save',
	'common.add': 'Add',
	'common.edit': 'Edit',
	'common.delete': 'Delete',
	'common.comingSoon': 'Coming soon',

	// Top bar
	'header.account': 'Account',
	'header.logOut': 'Log out',
	'theme.toggle': 'Toggle dark mode',
	'theme.switchToLight': 'Switch to light mode',
	'theme.switchToDark': 'Switch to dark mode',

	// Group list
	'groupList.title': 'Group list',
	'groupList.open': 'Open group list',
	'groupList.close': 'Close group list',
	'groupList.empty': 'No groups yet.',
	'groupList.noMatches': 'No matching groups.',
	'groupList.export': 'Export',
	'groupList.settings': 'Settings',

	// Phonebook page
	'phonebook.title': 'Phonebook',
	'phonebook.count': { one: '{count} contact', other: '{count} contacts' },
	'phonebook.matchCount': { one: '{matches} of {count} contact', other: '{matches} of {count} contacts' },
	'phonebook.new': '+ New',
	'phonebook.search': 'Search contacts',
	'phonebook.clearSearch': 'Clear search',
	'phonebook.empty': 'No contacts yet.',
	'phonebook.noMatches': 'No contacts match “{search}”.',
	'phonebook.options': 'Options',
	'notice.deleted': 'Contact deleted.',
	'notice.undo': 'Undo',
	'notice.restored': 'Contact restored.',
	'notice.restoreFailed': 'This contact can no longer be restored.',
	'notice.created': 'Contact added.',
	'notice.view': 'View',
	'notice.updated': 'Contact saved.',

	// Contact fields (list columns, form labels, details)
	'field.phoneNumber': 'Phone number',
	'field.group': 'Group',
	'field.location': 'Location',
	'field.description': 'Description',
	'field.added': 'Added',

	// Group sections, rows and the contact dialogs
	'section.loadFailed': "Couldn't load contacts. Retry",
	'section.loading': 'Loading contacts…',
	'contact.noDescription': 'No description',
	'contact.detailsFor': 'Details for {phoneNumber}: {description}',
	'contact.showDetails': 'Show all details',
	'contact.optionsFor': 'Options for {phoneNumber}',
	'contact.deleteTitle': 'Delete this contact?',
	'contact.deleteWarning': "This can't be undone.",
	'contact.detailsTitle': 'Contact details',
	'contact.editNumber': 'Edit {phoneNumber}',
	'contactForm.newTitle': 'New contact',
	'contactForm.editTitle': 'Edit contact',
	'contactForm.groupPlaceholder': 'e.g. Family',
	'contactForm.locationPlaceholder': 'e.g. Zurich',
	'contactForm.phonePlaceholder': 'e.g. +41 79 123 45 67',
	'contactForm.descriptionPlaceholder': 'Optional',

	// Contact validation: shown below the field's label, so they continue it ("Group: can't be blank")
	'validation.blank': "can't be blank",
	'validation.tooLong': 'is too long (maximum is {max} characters)',
	'validation.phoneCharacters': 'may only contain digits, spaces, + ( ) . / -',
	'validation.phoneDigits': 'must contain at least {min} digits',

	// Export dialog
	'export.title': 'Export',
	'export.intro': 'Save all contacts as a file.',
	'export.format': 'Format',
	'export.saveTo': 'Save to',
	'export.downloads': 'Downloads',
	'export.saveLocation': 'Save location',
	'export.choose': 'Choose…',
	'export.chooseLater': 'Choosing a folder comes with the export feature.',
	'export.notAvailable': 'Export is not available yet. Coming soon.',
	'export.submit': 'Export {format}',

	// Settings dialog
	'settings.title': 'Settings',
	'settings.darkMode': 'Dark mode',
	'settings.darkModeHint': 'For now: the sun/moon button in the top bar.',
	'settings.language': 'Language',

	// Cookie notice (bottom of every page until dismissed)
	'cookies.title': 'Cookies',
	'cookies.notice':
		'Xenia only uses functional cookies: one keeps you signed in, one remembers your language and one remembers that you have seen this notice. They are purely there for the app to work and for your convenience. No tracking, no advertising.',
	'cookies.dismiss': 'OK',

	// Error page (routes/+error.svelte)
	'error.notFound': "This page doesn't exist.",
	'error.generic': 'Something went wrong. Please try again.',
	'error.backHome': 'Back to Xenia',

	// Log in and register
	'auth.email': 'Email',
	'auth.password': 'Password',
	'login.pageTitle': 'Log in',
	'login.heading': 'Log in to Xenia',
	'login.submit': 'Log in',
	'login.noAccount': 'No account?',
	'login.registerLink': 'Register',
	'login.incorrect': 'Incorrect email or password.',
	'login.tooManyAttempts': 'Too many attempts. Try again later.',
	'register.pageTitle': 'Register',
	'register.heading': 'Create your account',
	'register.intro': 'Each account has its own phone book.',
	'register.confirmPassword': 'Confirm password',
	'register.submit': 'Register',
	'register.haveAccount': 'Already have an account?',
	'register.loginLink': 'Log in',
	'register.invalidEmail': 'Enter a valid email address.',
	'register.emailTaken': 'That email is already registered.',
	'register.passwordTooShort': 'Use at least {min} characters.',
	'register.passwordMismatch': 'Passwords do not match.',
	'register.tooMany': 'Too many registrations. Try again later.'
} satisfies Record<string, Message>;
