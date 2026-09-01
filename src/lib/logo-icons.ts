import { useEffect } from 'react';
import type { BackgroundConfig, LogoLayer } from '@/components/LogoMaker';
import { splitCss } from '@/lib/svg-utils';

/**
 * Packs that read well as logo marks: filled / bold / geometric first,
 * thin outline sets last. Every prefix here is verified against
 * src/data/collections.json.
 */
export const LOGO_PACKS = [
	'solar',
	'mingcute',
	'ph',
	'tabler',
	'lucide',
	'hugeicons',
	'fluent',
	'material-symbols',
	'mdi',
	'iconoir',
	'ri',
	'bi',
	'heroicons',
	'fa6-solid',
	'streamline',
] as const;

const PACK_RANK = new Map<string, number>(
	LOGO_PACKS.map((prefix, index) => [prefix, index]),
);

const UNKNOWN_PACK_RANK = LOGO_PACKS.length;

/** Style words that only mark a variant of the same underlying icon. */
const VARIANT_TOKENS = new Set([
	'outline',
	'outlined',
	'filled',
	'fill',
	'solid',
	'bold',
	'linear',
	'line',
	'duotone',
	'duo',
	'twotone',
	'rounded',
	'round',
	'sharp',
	'light',
	'regular',
	'thin',
	'baseline',
	'broken',
	'bulk',
	'stroke',
]);

const isNoiseToken = (token: string) =>
	VARIANT_TOKENS.has(token) || /^\d{1,3}$/.test(token);

export function packOf(iconName: string): string {
	const separator = iconName.indexOf(':');
	return separator === -1 ? '' : iconName.slice(0, separator);
}

export function packRank(iconName: string): number {
	return PACK_RANK.get(packOf(iconName)) ?? UNKNOWN_PACK_RANK;
}

/**
 * Strip the pack prefix plus variant prefixes/suffixes so that
 * `ic:baseline-coffee`, `mdi:coffee-outline` and `ph:coffee-fill`
 * all collapse to `coffee`.
 */
export function baseName(iconName: string): string {
	const separator = iconName.indexOf(':');
	const raw = separator === -1 ? iconName : iconName.slice(separator + 1);
	let parts = raw.split('-').filter(Boolean);
	while (parts.length > 1 && isNoiseToken(parts[0])) parts = parts.slice(1);
	while (parts.length > 1 && isNoiseToken(parts[parts.length - 1]))
		parts = parts.slice(0, -1);
	return parts.join('-') || raw;
}

/** Stable sort that puts preferred logo packs first, unknown packs last. */
export function sortByLogoPack(icons: string[]): string[] {
	return icons
		.map((icon, index) => ({ icon, index, rank: packRank(icon) }))
		.sort((a, b) => a.rank - b.rank || a.index - b.index)
		.map((entry) => entry.icon);
}

/**
 * Pick the best icons for logo use: prefer bold packs, drop duplicate
 * variants of the same base name, then spread the result across packs so
 * one pack cannot fill the whole grid.
 */
export function rankLogoIcons(icons: string[], limit = 6): string[] {
	const best = new Map<string, { icon: string; rank: number; order: number }>();

	// Negation glyphs ("coffee-off") never work as a brand mark.
	const pool = icons.filter((icon) => !/-off$/.test(baseName(icon)));

	pool.forEach((icon, order) => {
		const key = baseName(icon);
		const rank = packRank(icon);
		const current = best.get(key);
		if (!current || rank < current.rank) best.set(key, { icon, rank, order });
	});

	const byPack = new Map<string, string[]>();
	for (const entry of [...best.values()].sort(
		(a, b) => a.rank - b.rank || a.order - b.order,
	)) {
		const pack = packOf(entry.icon);
		const bucket = byPack.get(pack);
		if (bucket) bucket.push(entry.icon);
		else byPack.set(pack, [entry.icon]);
	}

	const buckets = [...byPack.values()];
	const spread: string[] = [];
	for (let round = 0; spread.length < limit; round++) {
		let added = false;
		for (const bucket of buckets) {
			if (round >= bucket.length) continue;
			spread.push(bucket[round]);
			added = true;
			if (spread.length >= limit) break;
		}
		if (!added) break;
	}

	return spread;
}

export const ICON_API_URL = 'https://i.allsvgicons.com';

export function iconUrl(iconName: string): string {
	const prefix = packOf(iconName);
	return `${ICON_API_URL}/${prefix}/${iconName.slice(prefix.length + 1)}.svg`;
}

/**
 * Search the icon API for a keyword and return ranked logo candidates.
 * The API honours `prefixes`, so the pack filter runs server side and
 * costs no extra bytes. A prefixed search that returns nothing falls back
 * to an unfiltered search.
 */
export async function fetchLogoIcons(
	keyword: string,
	signal?: AbortSignal,
	limit = 6,
): Promise<string[]> {
	const query = encodeURIComponent(keyword.trim());
	if (!query) return [];

	const search = async (usePrefixes: boolean): Promise<string[]> => {
		const prefixes = usePrefixes ? `&prefixes=${LOGO_PACKS.join(',')}` : '';
		const res = await fetch(
			`${ICON_API_URL}/search?query=${query}&limit=200${prefixes}`,
			{ signal },
		);
		if (!res.ok) throw new Error(`Icon search failed (${res.status})`);
		const data = await res.json();
		return Array.isArray(data.icons) ? (data.icons as string[]) : [];
	};

	let icons = await search(true);
	if (icons.length === 0) icons = await search(false);
	return rankLogoIcons(icons, limit);
}

/** Per-keyword cache of the ranked candidate pool. */
const candidatePools = new Map<string, string[]>();

const poolKey = (keyword: string) => keyword.trim().toLowerCase();

/**
 * Ranked icons for a keyword, fetched once and cached for the session.
 * The pool is wider than a candidate grid so repeat clicks can show
 * different icons for the same keyword.
 */
export async function getCandidatePool(
	keyword: string,
	signal?: AbortSignal,
): Promise<string[]> {
	const key = poolKey(keyword);
	if (!key) return [];
	const cached = candidatePools.get(key);
	if (cached) return cached;
	const icons = await fetchLogoIcons(keyword, signal, 30);
	candidatePools.set(key, icons);
	return icons;
}

export function shuffle<T>(array: readonly T[]): T[] {
	const copy = [...array];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export interface CuratedIconCategory {
	id: string;
	label: string;
	icons: string[];
}

export const CURATED_ICON_CATEGORIES: CuratedIconCategory[] = [
	{
		id: 'tech',
		label: 'Tech & AI',
		icons: [
			'solar:shield-bold',
			'solar:code-square-bold',
			'solar:bolt-bold',
			'solar:cpu-bold',
			'solar:cloud-bold',
			'solar:atom-bold-duotone',
			'solar:database-bold',
			'solar:satellite-bold',
			'lucide:rocket',
			'lucide:bot',
			'lucide:zap',
			'lucide:layers',
			'lucide:sparkles',
			'solar:server-square-bold',
			'solar:radar-2-bold',
			'solar:command-bold',
			'solar:qr-code-bold',
			'solar:box-minimalistic-bold-duotone',
			'tabler:terminal-2',
			'solar:smart-home-bold',
		],
	},
	{
		id: 'creative',
		label: 'Creative',
		icons: [
			'solar:palette-round-bold',
			'solar:camera-bold',
			'solar:pen-bold',
			'solar:music-note-bold',
			'solar:play-bold',
			'solar:magic-wand-bold',
			'lucide:gem',
			'lucide:shapes',
			'lucide:feather',
			'lucide:hexagon',
			'solar:gallery-bold',
			'solar:compass-bold',
			'solar:star-bold',
			'solar:clapperboard-play-bold',
			'solar:soundwave-bold',
			'solar:filters-bold',
		],
	},
	{
		id: 'business',
		label: 'Business',
		icons: [
			'solar:chart-square-bold',
			'solar:card-bold-duotone',
			'solar:buildings-bold',
			'solar:case-bold',
			'solar:target-bold',
			'solar:crown-line-duotone',
			'solar:key-bold',
			'solar:wallet-money-bold',
			'solar:bag-bold',
			'lucide:award',
			'lucide:crown',
			'lucide:badge-check',
			'solar:safe-square-bold',
			'solar:hand-money-bold',
			'solar:scale-bold',
			'solar:shield-check-bold',
		],
	},
	{
		id: 'hospitality',
		label: 'Hospitality',
		icons: [
			'ph:coffee-fill',
			'ph:bread-fill',
			'solar:cup-hot-bold',
			'solar:flame-bold',
			'solar:chef-hat-bold',
			'solar:wineglass-triangle-bold',
			'lucide:coffee',
			'lucide:utensils',
			'lucide:pizza',
			'solar:donut-bold',
			'solar:cup-bold',
			'solar:bottle-bold',
			'solar:cup-paper-bold',
			'solar:tea-cup-bold',
		],
	},
	{
		id: 'nature',
		label: 'Nature & Health',
		icons: [
			'solar:leaf-bold',
			'solar:heart-bold',
			'solar:paw-bold',
			'solar:sun-bold',
			'solar:moon-bold',
			'solar:star-fall-bold',
			'solar:medical-kit-bold',
			'solar:planet-bold',
			'lucide:droplet',
			'lucide:mountain',
			'solar:waterdrops-bold',
			'solar:health-bold',
			'lucide:flower-2',
			'solar:snowflake-bold',
		],
	},
	{
		id: 'fitness',
		label: 'Fitness & Travel',
		icons: [
			'tabler:barbell-filled',
			'solar:compass-bold',
			'solar:bicycling-bold',
			'solar:flag-bold',
			'solar:running-bold',
			'lucide:anchor',
			'solar:medal-star-circle-bold',
			'lucide:mountain',
			'lucide:activity',
			'solar:fire-bold',
			'solar:dumbbell-large-bold',
		],
	},
];

export const CURATED_ALL_SUGGESTED_ICONS: string[] = Array.from(
	new Set(CURATED_ICON_CATEGORIES.flatMap((c) => c.icons)),
);

/**
 * A fresh random slice of the keyword pool. Each call shuffles, so the same
 * keyword gives a different set of icons. Returns the whole pool if it is
 * smaller than `count`.
 */
export async function pickCandidates(
	keyword: string,
	count = 6,
	signal?: AbortSignal,
): Promise<string[]> {
	const pool = await getCandidatePool(keyword, signal);
	if (pool.length <= count) return [...pool];
	return shuffle(pool).slice(0, count);
}

const SHAPES: BackgroundConfig['shape'][] = ['squircle', 'circle', 'rectangle'];

/** Bag of palette indices, refilled and reshuffled when it runs out. */
let paletteBag: number[] = [];

/**
 * A random palette index plus a random shape. Consecutive calls do not repeat
 * a palette until every palette has been used once.
 */
export function randomCandidateStyle(): {
	paletteIndex: number;
	shape: BackgroundConfig['shape'];
} {
	if (paletteBag.length === 0) {
		paletteBag = shuffle(PALETTES.map((_, index) => index));
	}
	return {
		paletteIndex: paletteBag.pop() ?? 0,
		shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
	};
}

/**
 * Curated brand-grade palettes. Each entry pairs one or two same-hue
 * background stops with an icon colour. Every icon/stop pair clears
 * WCAG AA (4.5:1); the lowest ratio in the set is 4.81:1 (Coral).
 */
export const PALETTES = [
	// Authentic real-world brand gradients & palettes
	{
		name: 'Instagram Sunset',
		bg: ['#833ab4', '#fd1d1d', '#fcb045'],
		icon: '#ffffff',
	},
	{ name: 'Facebook Blue', bg: ['#1877f2', '#0866ff'], icon: '#ffffff' },
	{ name: 'Spotify Neon', bg: ['#191414', '#121212'], icon: '#1ed760' },
	{
		name: 'Stripe Indigo',
		bg: ['#635bff', '#7a73ff', '#0a2540'],
		icon: '#ffffff',
	},
	{ name: 'Linear Obsidian', bg: ['#1c1d2d', '#0f1017'], icon: '#5e6ad2' },
	{ name: 'Supabase Emerald', bg: ['#242424', '#121212'], icon: '#3ecf8e' },
	{ name: 'Raycast Coral', bg: ['#ff6363', '#ff9068'], icon: '#ffffff' },
	{ name: 'WhatsApp Green', bg: ['#25d366', '#128c7e'], icon: '#ffffff' },
	{ name: 'Discord Blurple', bg: ['#5865f2', '#4752c4'], icon: '#ffffff' },
	{ name: 'YouTube Crimson', bg: ['#ff0000', '#cc0000'], icon: '#ffffff' },
	{ name: 'Apple Space Black', bg: ['#1c1c1e', '#000000'], icon: '#ffffff' },
	{ name: 'GitHub Dark', bg: ['#161b22', '#0d1117'], icon: '#ffffff' },
	{ name: 'Duolingo Lime', bg: ['#58cc02', '#46a302'], icon: '#ffffff' },
	{ name: 'Netflix Red', bg: ['#141414', '#000000'], icon: '#e50914' },
	{ name: 'X Dark', bg: ['#14171a', '#000000'], icon: '#ffffff' },
	{ name: 'Google Cloud', bg: ['#4285f4', '#34a853'], icon: '#ffffff' },
	{ name: 'Slack Aubergine', bg: ['#4a154b', '#350d36'], icon: '#ffffff' },
	// High-contrast design palettes
	{ name: 'Deep Navy', bg: ['#0b1f3a', '#14345c'], icon: '#ffffff' },
	{ name: 'Charcoal Amber', bg: ['#1c1c1c', '#2e2e2e'], icon: '#f5b324' },
	{ name: 'Forest Cream', bg: ['#12372a', '#1d5741'], icon: '#f4efe3' },
	{ name: 'Terracotta Ivory', bg: ['#8f3a21', '#a84829'], icon: '#fbf3e7' },
	{ name: 'Slate Blue', bg: ['#39496a', '#4b5e85'], icon: '#ffffff' },
	{ name: 'Plum Blush', bg: ['#3e1b3b', '#5a2a55'], icon: '#f3cde4' },
	{ name: 'Teal', bg: ['#04585e', '#077178'], icon: '#ffffff' },
	{ name: 'Warm Sand', bg: ['#e8d9c0', '#f1e6d4'], icon: '#3a2a1b' },
	{ name: 'Off-white Ink', bg: ['#f7f6f3'], icon: '#111111' },
	{ name: 'Coral', bg: ['#b8382b', '#c94436'], icon: '#ffffff' },
	{ name: 'Midnight Mint', bg: ['#0a0f1c', '#18213a'], icon: '#8fe3c4' },
];

const GRADIENT_DIRECTIONS = [
	'to right',
	'to left',
	'to bottom',
	'to top',
	'to bottom right',
	'to bottom left',
	'to top right',
	'to top left',
];

export interface LogoCandidate {
	layers: LogoLayer[];
	background: BackgroundConfig;
	palette: string;
	/** Set only by shared logo codes, which carry their own canvas size. */
	canvasSize?: { width: number; height: number };
}

/**
 * Build one ready-to-apply logo: a single icon layer on a palette background.
 * Shape defaults to a cycle over the palette index so a candidate grid varies.
 */
export function buildCandidate(
	iconName: string,
	canvasSize: { width: number; height: number },
	paletteIndex = 0,
	shape: BackgroundConfig['shape'] = 'squircle',
): LogoCandidate {
	const palette = PALETTES[paletteIndex % PALETTES.length];
	const isGradient = palette.bg.length > 1;

	const background: BackgroundConfig = {
		type: isGradient ? 'gradient' : 'solid',
		solidColor: palette.bg[0],
		gradientColors: isGradient ? palette.bg : [],
		gradientDirection:
			GRADIENT_DIRECTIONS[paletteIndex % GRADIENT_DIRECTIONS.length],
		noise: 0,
		shape,
		borderRadius: shape === 'circle' ? 100 : shape === 'squircle' ? 0 : 24,
		pattern: 'none',
		patternColor: palette.icon,
		patternOpacity: 0.1,
		radialCenterX: 50,
		radialCenterY: 50,
		radialRadius: 50,
	};

	const layer: LogoLayer = {
		id: crypto.randomUUID(),
		iconName,
		url: iconUrl(iconName),
		x: canvasSize.width / 2,
		y: canvasSize.height / 2,
		scale: 1.2,
		rotation: 0,
		fill: palette.icon,
		// Both paints carry the palette colour, which matches what the API
		// `?color=` preview does. `mutateSvgDocument` only repaints the paints
		// an icon already uses, so a stroke icon keeps its stroke and a filled
		// icon never gains an outline.
		stroke: palette.icon,
		overwriteFill: true,
		overwriteStroke: true,
		opacity: 1,
		blendMode: 'normal',
		visible: true,
		locked: false,
		shadowColor: '#000000',
		shadowBlur: 16,
		shadowOffsetX: 0,
		shadowOffsetY: 6,
		shadowOpacity: 0.18,
	};

	return { layers: [layer], background, palette: palette.name };
}

/** CSS background for a candidate preview tile. */
export function candidateBackgroundCss(background: BackgroundConfig): string {
	if (background.type === 'gradient' && background.gradientColors.length > 1) {
		return `linear-gradient(${background.gradientDirection}, ${background.gradientColors.join(', ')})`;
	}
	if (background.type === 'split') {
		return splitCss(background);
	}
	return background.solidColor;
}

export const APPLY_CANDIDATE_EVENT = 'logo:apply-candidate';

/**
 * ponytail: IconSearchPanel's props are fixed, so GeneratePanel hands a whole
 * candidate (layers + background) to LogoMaker through a window event.
 * LogoMaker consumes it with `useApplyCandidate(apply)`. Applying replaces
 * the canvas; it does not append a layer.
 */
export function emitCandidate(candidate: LogoCandidate): void {
	window.dispatchEvent(
		new CustomEvent(APPLY_CANDIDATE_EVENT, { detail: candidate }),
	);
}

export function useApplyCandidate(
	apply: (
		layers: LogoLayer[],
		background: BackgroundConfig,
		canvasSize?: { width: number; height: number },
	) => void,
): void {
	useEffect(() => {
		const onApply = (event: Event) => {
			const { layers, background, canvasSize } = (
				event as CustomEvent<LogoCandidate>
			).detail;
			apply(
				layers.map((layer) => ({ ...layer, id: crypto.randomUUID() })),
				background,
				canvasSize,
			);
		};
		window.addEventListener(APPLY_CANDIDATE_EVENT, onApply);
		return () => window.removeEventListener(APPLY_CANDIDATE_EVENT, onApply);
	}, [apply]);
}
