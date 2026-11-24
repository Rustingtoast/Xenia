import { Locale, type Dictionary } from '../i18n/index.js';
import { de } from '../i18n/messages/de.js';
import { en } from '../i18n/messages/en.js';
import { es } from '../i18n/messages/es.js';
import { fi } from '../i18n/messages/fi.js';
import { fr } from '../i18n/messages/fr.js';
import { hi } from '../i18n/messages/hi.js';
import { is } from '../i18n/messages/is.js';
import { it } from '../i18n/messages/it.js';
import { ja } from '../i18n/messages/ja.js';
import { nb } from '../i18n/messages/nb.js';
import { nl } from '../i18n/messages/nl.js';
import { ru } from '../i18n/messages/ru.js';
import { zh } from '../i18n/messages/zh.js';

/**
 * Every language's messages. Server-only on purpose: the root layout sends the browser just the messages
 * of the page's language (see routes/+layout.server.ts), so adding languages doesn't grow the download.
 */
export const MESSAGES: Record<Locale, Dictionary> = {
	[Locale.German]: de,
	[Locale.English]: en,
	[Locale.Spanish]: es,
	[Locale.French]: fr,
	[Locale.Icelandic]: is,
	[Locale.Italian]: it,
	[Locale.Dutch]: nl,
	[Locale.Norwegian]: nb,
	[Locale.Finnish]: fi,
	[Locale.Russian]: ru,
	[Locale.Hindi]: hi,
	[Locale.Chinese]: zh,
	[Locale.Japanese]: ja
};
