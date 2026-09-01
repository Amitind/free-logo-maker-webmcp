/**
 * "My logos": the logos a visitor downloads or saves, kept in this browser
 * only. Each entry stores the share code (the source of truth, see
 * `logo-share.ts`) plus a small SVG thumbnail so the panel can render a grid
 * without refetching every icon.
 */

const STORAGE_KEY = 'asl:my-logos';
const MAX_LOGOS = 24;
/** Thumbnails above this size are dropped: localStorage is a small budget. */
const MAX_THUMB_BYTES = 20 * 1024;

export const SAVED_LOGOS_EVENT = 'logo:saved';

export interface SavedLogo {
	id: string;
	code: string;
	/** `data:image/svg+xml;base64,...`, omitted when the SVG is too large. */
	thumb?: string;
	savedAt: number;
	iconName: string;
}

export type NewLogo = Omit<SavedLogo, 'id' | 'savedAt'>;

const isSavedLogo = (value: unknown): value is SavedLogo => {
	const logo = value as SavedLogo;
	return (
		!!logo &&
		typeof logo.id === 'string' &&
		typeof logo.code === 'string' &&
		typeof logo.savedAt === 'number' &&
		typeof logo.iconName === 'string'
	);
};

export function listLogos(): SavedLogo[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isSavedLogo).slice(0, MAX_LOGOS);
	} catch {
		return [];
	}
}

function write(logos: SavedLogo[]): SavedLogo[] {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(logos));
	} catch {
		// Quota or a blocked store: the session keeps working without history.
	}
	try {
		window.dispatchEvent(new CustomEvent(SAVED_LOGOS_EVENT));
	} catch {
		// No window (SSR): nothing listens anyway.
	}
	return logos;
}

/**
 * Store one logo at the top of the list. The same code is never stored twice:
 * saving it again only moves it back to the front.
 */
export function saveLogo(entry: NewLogo): SavedLogo[] {
	if (!entry.code) return listLogos();
	const thumb =
		entry.thumb && entry.thumb.length <= MAX_THUMB_BYTES
			? entry.thumb
			: undefined;
	const next: SavedLogo = {
		id: crypto.randomUUID(),
		code: entry.code,
		iconName: entry.iconName,
		savedAt: Date.now(),
		...(thumb ? { thumb } : {}),
	};
	const rest = listLogos().filter((logo) => logo.code !== entry.code);
	return write([next, ...rest].slice(0, MAX_LOGOS));
}

export function removeLogo(id: string): SavedLogo[] {
	return write(listLogos().filter((logo) => logo.id !== id));
}

/** Encode an SVG string as a data URI a plain `<img>` can render. */
export function svgToDataUri(svg: string): string | undefined {
	try {
		const bytes = new TextEncoder().encode(svg);
		let binary = '';
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return `data:image/svg+xml;base64,${btoa(binary)}`;
	} catch {
		return undefined;
	}
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short relative age, e.g. "just now", "2h ago", "3d ago". */
export function relativeTime(timestamp: number, now = Date.now()): string {
	const diff = Math.max(0, now - timestamp);
	if (diff < MINUTE) return 'just now';
	if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
	if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
	if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d ago`;
	return `${Math.floor(diff / (30 * DAY))}mo ago`;
}
