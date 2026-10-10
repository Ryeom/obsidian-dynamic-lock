import { getLanguage } from 'obsidian';
import english from './locales/en.json';

type TranslationKey = keyof typeof english;
type Messages = Partial<Record<TranslationKey, unknown>>;

function loadMessages(language: string): Messages {
	try {
		// esbuild expands this glob into bundled JSON modules, including new locale files.
		// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- Replaced by esbuild; no runtime Node API.
		const messages: unknown = require(`./locales/${language}.json`);
		return messages && typeof messages === 'object' ? messages as Messages : {};
	} catch {
		return {};
	}
}

export function createTranslator(
	language = typeof getLanguage === 'function' ? getLanguage() : 'en'
): (key: TranslationKey) => string {
	const locale = language.trim().toLowerCase().replace(/_/g, '-');
	const baseLocale = locale.split('-')[0]!;
	const dictionaries = [loadMessages(locale)];
	if (baseLocale !== locale) dictionaries.push(loadMessages(baseLocale));

	return key => {
		for (const messages of dictionaries) {
			const value = messages[key];
			if (typeof value === 'string' && value.trim()) return value;
		}
		return english[key];
	};
}
