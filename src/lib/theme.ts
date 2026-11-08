/** Light or dark appearance. The values are what's stored in localStorage and in <html data-theme>. */
export enum Theme {
	Light = 'light',
	Dark = 'dark'
}

export function isTheme(value: unknown): value is Theme {
	return value === Theme.Light || value === Theme.Dark;
}
