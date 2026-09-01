import { PALETTES } from '@/lib/logo-icons';

/**
 * Background presets for the logo maker.
 *
 * Includes authentic, real-world brand gradients and color palettes
 * (Instagram, Facebook, Spotify, Stripe, Linear, Supabase, Raycast, Discord, Apple, etc.)
 */

export type SwatchGroup = 'brand' | 'soft' | 'bold' | 'depth' | 'basic';

export type Swatch = {
	colors: string[];
	group: SwatchGroup;
	name?: string;
	label?: string;
};

export interface BrandPreset {
	id: string;
	name: string;
	category: 'social' | 'tech' | 'creative' | 'commerce' | 'entertainment';
	bgType: 'solid' | 'gradient' | 'radial';
	solidColor: string;
	gradientColors: string[];
	gradientDirection: string;
	shape: 'rectangle' | 'circle' | 'squircle';
	borderRadius: number;
	pattern:
		| 'none'
		| 'grid'
		| 'dots'
		| 'checker'
		| 'lines'
		| 'diagonal'
		| 'circles'
		| 'zigzag';
	patternColor: string;
	patternOpacity: number;
	defaultIcon: string;
	iconFill: string;
	iconStroke?: string;
	shadowColor: string;
	shadowBlur: number;
	shadowOffsetY: number;
	shadowOpacity: number;
}

export const BRAND_PRESETS: Record<string, BrandPreset> = {
	instagram: {
		id: 'instagram',
		name: 'Instagram Sunset',
		category: 'social',
		bgType: 'gradient',
		solidColor: '#e1306c',
		gradientColors: ['#833ab4', '#fd1d1d', '#fcb045'],
		gradientDirection: 'to top right',
		shape: 'squircle',
		borderRadius: 60,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'ri:instagram-fill',
		iconFill: '#ffffff',
		shadowColor: '#833ab4',
		shadowBlur: 20,
		shadowOffsetY: 8,
		shadowOpacity: 0.35,
	},
	facebook: {
		id: 'facebook',
		name: 'Facebook Blue',
		category: 'social',
		bgType: 'gradient',
		solidColor: '#1877f2',
		gradientColors: ['#1877f2', '#0866ff'],
		gradientDirection: 'to bottom',
		shape: 'circle',
		borderRadius: 100,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'ri:facebook-fill',
		iconFill: '#ffffff',
		shadowColor: '#000000',
		shadowBlur: 16,
		shadowOffsetY: 6,
		shadowOpacity: 0.25,
	},
	spotify: {
		id: 'spotify',
		name: 'Spotify Midnight Neon',
		category: 'entertainment',
		bgType: 'gradient',
		solidColor: '#121212',
		gradientColors: ['#191414', '#121212'],
		gradientDirection: 'to bottom',
		shape: 'circle',
		borderRadius: 100,
		pattern: 'none',
		patternColor: '#1ed760',
		patternOpacity: 0.1,
		defaultIcon: 'ri:spotify-fill',
		iconFill: '#1ed760',
		shadowColor: '#1ed760',
		shadowBlur: 24,
		shadowOffsetY: 0,
		shadowOpacity: 0.45,
	},
	duolingo: {
		id: 'duolingo',
		name: 'Duolingo Lime',
		category: 'entertainment',
		bgType: 'gradient',
		solidColor: '#58cc02',
		gradientColors: ['#58cc02', '#46a302'],
		gradientDirection: 'to bottom',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'simple-icons:duolingo',
		iconFill: '#ffffff',
		shadowColor: '#46a302',
		shadowBlur: 18,
		shadowOffsetY: 6,
		shadowOpacity: 0.35,
	},
	netflix: {
		id: 'netflix',
		name: 'Netflix Red & Dark',
		category: 'entertainment',
		bgType: 'gradient',
		solidColor: '#000000',
		gradientColors: ['#141414', '#000000'],
		gradientDirection: 'to bottom',
		shape: 'rectangle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#e50914',
		patternOpacity: 0.1,
		defaultIcon: 'ri:netflix-fill',
		iconFill: '#e50914',
		shadowColor: '#e50914',
		shadowBlur: 26,
		shadowOffsetY: 0,
		shadowOpacity: 0.45,
	},
	youtube: {
		id: 'youtube',
		name: 'YouTube Crimson',
		category: 'entertainment',
		bgType: 'gradient',
		solidColor: '#ff0000',
		gradientColors: ['#ff0000', '#cc0000'],
		gradientDirection: 'to bottom right',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#000000',
		patternOpacity: 0.1,
		defaultIcon: 'ri:youtube-fill',
		iconFill: '#ffffff',
		shadowColor: '#ff0000',
		shadowBlur: 20,
		shadowOffsetY: 6,
		shadowOpacity: 0.35,
	},
	whatsapp: {
		id: 'whatsapp',
		name: 'WhatsApp Emerald',
		category: 'social',
		bgType: 'gradient',
		solidColor: '#25d366',
		gradientColors: ['#25d366', '#128c7e'],
		gradientDirection: 'to bottom right',
		shape: 'circle',
		borderRadius: 100,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'ri:whatsapp-fill',
		iconFill: '#ffffff',
		shadowColor: '#128c7e',
		shadowBlur: 18,
		shadowOffsetY: 6,
		shadowOpacity: 0.3,
	},
	discord: {
		id: 'discord',
		name: 'Discord Blurple',
		category: 'social',
		bgType: 'gradient',
		solidColor: '#5865f2',
		gradientColors: ['#5865f2', '#4752c4'],
		gradientDirection: 'to bottom right',
		shape: 'squircle',
		borderRadius: 60,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'ri:discord-fill',
		iconFill: '#ffffff',
		shadowColor: '#4752c4',
		shadowBlur: 20,
		shadowOffsetY: 8,
		shadowOpacity: 0.4,
	},
	stripe: {
		id: 'stripe',
		name: 'Stripe Indigo',
		category: 'tech',
		bgType: 'gradient',
		solidColor: '#635bff',
		gradientColors: ['#635bff', '#7a73ff', '#0a2540'],
		gradientDirection: 'to bottom right',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'simple-icons:stripe',
		iconFill: '#ffffff',
		shadowColor: '#635bff',
		shadowBlur: 22,
		shadowOffsetY: 8,
		shadowOpacity: 0.35,
	},
	linear: {
		id: 'linear',
		name: 'Linear Obsidian Violet',
		category: 'tech',
		bgType: 'gradient',
		solidColor: '#181924',
		gradientColors: ['#1c1d2d', '#0f1017'],
		gradientDirection: 'to bottom',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'grid',
		patternColor: '#5e6ad2',
		patternOpacity: 0.15,
		defaultIcon: 'simple-icons:linear',
		iconFill: '#5e6ad2',
		shadowColor: '#5e6ad2',
		shadowBlur: 22,
		shadowOffsetY: 4,
		shadowOpacity: 0.4,
	},
	supabase: {
		id: 'supabase',
		name: 'Supabase Emerald Glow',
		category: 'tech',
		bgType: 'gradient',
		solidColor: '#1c1c1c',
		gradientColors: ['#242424', '#121212'],
		gradientDirection: 'to bottom right',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#3ecf8e',
		patternOpacity: 0.1,
		defaultIcon: 'simple-icons:supabase',
		iconFill: '#3ecf8e',
		shadowColor: '#3ecf8e',
		shadowBlur: 24,
		shadowOffsetY: 0,
		shadowOpacity: 0.5,
	},
	raycast: {
		id: 'raycast',
		name: 'Raycast Fire Coral',
		category: 'tech',
		bgType: 'gradient',
		solidColor: '#ff6363',
		gradientColors: ['#ff6363', '#ff9068'],
		gradientDirection: 'to bottom right',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'simple-icons:raycast',
		iconFill: '#ffffff',
		shadowColor: '#ff6363',
		shadowBlur: 20,
		shadowOffsetY: 6,
		shadowOpacity: 0.35,
	},
	apple: {
		id: 'apple',
		name: 'Apple Space Black',
		category: 'tech',
		bgType: 'gradient',
		solidColor: '#000000',
		gradientColors: ['#1c1c1e', '#000000'],
		gradientDirection: 'to bottom',
		shape: 'squircle',
		borderRadius: 60,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.05,
		defaultIcon: 'ri:apple-fill',
		iconFill: '#ffffff',
		shadowColor: '#ffffff',
		shadowBlur: 20,
		shadowOffsetY: 0,
		shadowOpacity: 0.15,
	},
	github: {
		id: 'github',
		name: 'GitHub Dark Mode',
		category: 'tech',
		bgType: 'gradient',
		solidColor: '#0d1117',
		gradientColors: ['#161b22', '#0d1117'],
		gradientDirection: 'to bottom right',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'ri:github-fill',
		iconFill: '#ffffff',
		shadowColor: '#000000',
		shadowBlur: 16,
		shadowOffsetY: 6,
		shadowOpacity: 0.4,
	},
	slack: {
		id: 'slack',
		name: 'Slack Deep Aubergine',
		category: 'tech',
		bgType: 'gradient',
		solidColor: '#4a154b',
		gradientColors: ['#4a154b', '#350d36'],
		gradientDirection: 'to bottom right',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'ri:slack-fill',
		iconFill: '#ecb22e',
		shadowColor: '#ecb22e',
		shadowBlur: 20,
		shadowOffsetY: 6,
		shadowOpacity: 0.35,
	},
	google: {
		id: 'google',
		name: 'Google Cloud Clean',
		category: 'tech',
		bgType: 'gradient',
		solidColor: '#ffffff',
		gradientColors: ['#ffffff', '#f1f3f4'],
		gradientDirection: 'to bottom',
		shape: 'circle',
		borderRadius: 100,
		pattern: 'none',
		patternColor: '#4285f4',
		patternOpacity: 0.1,
		defaultIcon: 'ri:google-fill',
		iconFill: '#4285f4',
		shadowColor: '#4285f4',
		shadowBlur: 18,
		shadowOffsetY: 4,
		shadowOpacity: 0.25,
	},
	figma: {
		id: 'figma',
		name: 'Figma Dark Studio',
		category: 'creative',
		bgType: 'gradient',
		solidColor: '#1e1e1e',
		gradientColors: ['#2c2c2c', '#181818'],
		gradientDirection: 'to bottom right',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'simple-icons:figma',
		iconFill: '#ffffff',
		shadowColor: '#a259ff',
		shadowBlur: 20,
		shadowOffsetY: 6,
		shadowOpacity: 0.35,
	},
	airbnb: {
		id: 'airbnb',
		name: 'Airbnb Rausch',
		category: 'commerce',
		bgType: 'gradient',
		solidColor: '#ff5a5f',
		gradientColors: ['#ff5a5f', '#ff385c'],
		gradientDirection: 'to bottom right',
		shape: 'circle',
		borderRadius: 100,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'simple-icons:airbnb',
		iconFill: '#ffffff',
		shadowColor: '#ff385c',
		shadowBlur: 18,
		shadowOffsetY: 6,
		shadowOpacity: 0.35,
	},
	twitch: {
		id: 'twitch',
		name: 'Twitch Purple',
		category: 'entertainment',
		bgType: 'gradient',
		solidColor: '#9146ff',
		gradientColors: ['#9146ff', '#772ce8'],
		gradientDirection: 'to bottom right',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.1,
		defaultIcon: 'ri:twitch-fill',
		iconFill: '#ffffff',
		shadowColor: '#772ce8',
		shadowBlur: 22,
		shadowOffsetY: 6,
		shadowOpacity: 0.4,
	},
	twitter: {
		id: 'twitter',
		name: 'X Dark Obsidian',
		category: 'social',
		bgType: 'gradient',
		solidColor: '#000000',
		gradientColors: ['#14171a', '#000000'],
		gradientDirection: 'to bottom',
		shape: 'squircle',
		borderRadius: 50,
		pattern: 'none',
		patternColor: '#ffffff',
		patternOpacity: 0.08,
		defaultIcon: 'ri:twitter-x-fill',
		iconFill: '#ffffff',
		shadowColor: '#ffffff',
		shadowBlur: 14,
		shadowOffsetY: 0,
		shadowOpacity: 0.25,
	},
};

const palette = (name: string): string[] =>
	PALETTES.find((p) => p.name === name)?.bg ?? ['#000000'];

/** Palette stops read outward-in for radial fills: light centre, dark edge. */
const radialPalette = (name: string): string[] => {
	const stops = palette(name);
	return stops.length > 1 ? [stops[1], stops[0]] : [stops[0], stops[0]];
};

const BRAND_PALETTES: { name: string; label: string }[] = [
	{ name: 'Instagram Sunset', label: 'Instagram Sunset' },
	{ name: 'Facebook Blue', label: 'Facebook' },
	{ name: 'Spotify Neon', label: 'Spotify' },
	{ name: 'Duolingo Lime', label: 'Duolingo' },
	{ name: 'Stripe Indigo', label: 'Stripe' },
	{ name: 'Linear Obsidian', label: 'Linear' },
	{ name: 'Supabase Emerald', label: 'Supabase' },
	{ name: 'Raycast Coral', label: 'Raycast' },
	{ name: 'WhatsApp Green', label: 'WhatsApp' },
	{ name: 'Discord Blurple', label: 'Discord' },
	{ name: 'YouTube Crimson', label: 'YouTube' },
	{ name: 'Netflix Red', label: 'Netflix' },
	{ name: 'X Dark', label: 'X (Twitter)' },
	{ name: 'Google Cloud', label: 'Google Cloud' },
	{ name: 'Apple Space Black', label: 'Apple' },
	{ name: 'GitHub Dark', label: 'GitHub' },
	{ name: 'Slack Aubergine', label: 'Slack' },
];

const SOFT_PALETTES: { name: string; label: string }[] = [
	{ name: 'Deep Navy', label: 'Deep Navy' },
	{ name: 'Charcoal Amber', label: 'Charcoal' },
	{ name: 'Forest Cream', label: 'Forest' },
	{ name: 'Slate Blue', label: 'Slate' },
	{ name: 'Plum Blush', label: 'Plum' },
	{ name: 'Warm Sand', label: 'Sand' },
];

const DEPTH_PALETTES: { name: string; label: string }[] = [
	{ name: 'Terracotta Ivory', label: 'Terracotta' },
	{ name: 'Teal', label: 'Teal Depth' },
	{ name: 'Coral', label: 'Coral Flame' },
	{ name: 'Midnight Mint', label: 'Midnight Mint' },
];

/* ------------------------------------------------------------------ dedupe */

const rgb = (hex: string): [number, number, number] => {
	const value = hex.replace('#', '');
	const full =
		value.length === 3
			? value
					.split('')
					.map((c) => c + c)
					.join('')
			: value;
	const int = Number.parseInt(full, 16);
	return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

/** Two stops are "near-identical" when every channel is within 6/255. */
const nearColor = (a: string, b: string): boolean => {
	const [r1, g1, b1] = rgb(a);
	const [r2, g2, b2] = rgb(b);
	return (
		Math.abs(r1 - r2) <= 6 && Math.abs(g1 - g2) <= 6 && Math.abs(b1 - b2) <= 6
	);
};

const nearSwatch = (a: string[], b: string[]): boolean =>
	a.length === b.length && a.every((stop, i) => nearColor(stop, b[i]));

/** Keeps the first occurrence, so the curated order decides which one wins. */
const dedupe = (swatches: Swatch[]): Swatch[] =>
	swatches.filter(
		(swatch, index) =>
			!swatches
				.slice(0, index)
				.some((earlier) => nearSwatch(earlier.colors, swatch.colors)),
	);

/* ------------------------------------------------------------------ solid */

export const SOLID_SWATCHES: Swatch[] = dedupe([
	// Authentic real-world brand flats
	{ colors: ['#1877f2'], group: 'brand', label: 'Facebook' },
	{ colors: ['#1ed760'], group: 'brand', label: 'Spotify' },
	{ colors: ['#58cc02'], group: 'brand', label: 'Duolingo' },
	{ colors: ['#25d366'], group: 'brand', label: 'WhatsApp' },
	{ colors: ['#5865f2'], group: 'brand', label: 'Discord' },
	{ colors: ['#635bff'], group: 'brand', label: 'Stripe' },
	{ colors: ['#ff0000'], group: 'brand', label: 'YouTube' },
	{ colors: ['#3ecf8e'], group: 'brand', label: 'Supabase' },
	{ colors: ['#ff5a5f'], group: 'brand', label: 'Airbnb' },
	{ colors: ['#9146ff'], group: 'brand', label: 'Twitch' },
	{ colors: ['#e50914'], group: 'brand', label: 'Netflix' },
	{ colors: ['#4a154b'], group: 'brand', label: 'Slack' },
	{ colors: ['#0d1117'], group: 'brand', label: 'GitHub' },
	{ colors: ['#181924'], group: 'brand', label: 'Linear' },
	{ colors: ['#ff6363'], group: 'brand', label: 'Raycast' },
	{ colors: ['#4285f4'], group: 'brand', label: 'Google' },

	// Soft, low-chroma flats
	{ colors: [palette('Off-white Ink')[0]], group: 'soft', label: 'Off-white' },
	{ colors: ['#d9c7a6'], group: 'soft', label: 'Sand' },
	{ colors: ['#b98a8a'], group: 'soft', label: 'Dusty Rose' },
	{ colors: ['#8a9a80'], group: 'soft', label: 'Sage' },
	{ colors: ['#8b7a92'], group: 'soft', label: 'Mauve' },
	{ colors: ['#a4715a'], group: 'soft', label: 'Clay' },
	{ colors: ['#5b6b7c'], group: 'soft', label: 'Slate' },
	{ colors: ['#6b7248'], group: 'soft', label: 'Olive' },

	// Bold vibrant flats
	{ colors: ['#2563eb'], group: 'bold', label: 'Electric Blue' },
	{ colors: ['#06b6d4'], group: 'bold', label: 'Teal' },
	{ colors: ['#10b981'], group: 'bold', label: 'Emerald' },
	{ colors: ['#f59e0b'], group: 'bold', label: 'Amber' },
	{ colors: ['#fb6107'], group: 'bold', label: 'Tangerine' },
	{ colors: ['#ff5a4d'], group: 'bold', label: 'Coral' },
	{ colors: ['#e6007e'], group: 'bold', label: 'Magenta' },
	{ colors: ['#7c3aed'], group: 'bold', label: 'Violet' },

	// Depth jewel flats
	{ colors: ['#1e3a8a'], group: 'depth', label: 'Lapis Blue' },
	{ colors: ['#0e7490'], group: 'depth', label: 'Deep Teal' },
	{ colors: ['#046a4e'], group: 'depth', label: 'Deep Emerald' },
	{ colors: ['#a97b1f'], group: 'depth', label: 'Gold' },
	{ colors: ['#7c2d12'], group: 'depth', label: 'Mahogany' },
	{ colors: ['#9b1c31'], group: 'depth', label: 'Ruby' },
	{ colors: ['#5b21b6'], group: 'depth', label: 'Amethyst' },
	{ colors: ['#16161d'], group: 'depth', label: 'Onyx' },

	// Basics
	{ colors: ['#ffffff'], group: 'basic', label: 'Pure White' },
	{ colors: ['#000000'], group: 'basic', label: 'Pure Black' },
	{ colors: ['#6b7280'], group: 'basic', label: 'Neutral Gray' },
	{ colors: ['#ef4444'], group: 'basic', label: 'Signal Red' },
]);

/* ----------------------------------------------------------------- linear */

export const LINEAR_SWATCHES: Swatch[] = dedupe([
	// Authentic real-world brand gradients
	...BRAND_PALETTES.map(({ name, label }) => ({
		colors: palette(name),
		group: 'brand' as SwatchGroup,
		label,
	})),

	// Soft gradients
	...SOFT_PALETTES.map(({ name, label }) => ({
		colors: palette(name),
		group: 'soft' as SwatchGroup,
		label,
	})),
	{ colors: ['#d6d3cd', '#a9a49b'], group: 'soft', label: 'Stone' },

	// High energy bold gradients
	{ colors: ['#2563eb', '#06b6d4'], group: 'bold', label: 'Electric Blue' },
	{ colors: ['#ff5a4d', '#f59e0b'], group: 'bold', label: 'Sunset Glow' },
	{ colors: ['#10b981', '#84cc16'], group: 'bold', label: 'Emerald Pop' },
	{ colors: ['#e6007e', '#7c3aed'], group: 'bold', label: 'Magenta Violet' },
	{ colors: ['#fb6107', '#ffd166'], group: 'bold', label: 'Tangerine Sun' },
	{ colors: ['#dc2626', '#e6007e'], group: 'bold', label: 'Crimson Magenta' },
	{
		colors: ['#06b6d4', '#3b82f6', '#8b5cf6'],
		group: 'bold',
		label: 'Cyberpunk Aurora',
	},

	// Depth 3-stop lit gradients
	{
		colors: ['#1e3a8a', '#3b82f6', '#93c5fd'],
		group: 'depth',
		label: 'Royal Blue Lit',
	},
	{
		colors: ['#8a5a12', '#b7791f', '#f6d365'],
		group: 'depth',
		label: 'Gold Metallic',
	},
	{
		colors: ['#9ca3af', '#f3f4f6', '#6b7280'],
		group: 'depth',
		label: 'Silver Chrome',
	},
	{
		colors: ['#8c4a3f', '#c98276', '#f3d3c7'],
		group: 'depth',
		label: 'Rose Gold',
	},
	{
		colors: ['#1f2225', '#3a3f45', '#75808a'],
		group: 'depth',
		label: 'Graphite Metal',
	},
	{
		colors: ['#064e3b', '#10b981', '#a7f3d0'],
		group: 'depth',
		label: 'Emerald Glass',
	},
	{
		colors: ['#7c3a12', '#c2703a', '#f0b183'],
		group: 'depth',
		label: 'Copper Bronze',
	},
	{
		colors: ['#3b1e6e', '#7c3aed', '#c4b5fd'],
		group: 'depth',
		label: 'Amethyst Crystal',
	},
	...DEPTH_PALETTES.map(({ name, label }) => ({
		colors: palette(name),
		group: 'depth' as SwatchGroup,
		label,
	})),

	// Basics
	{ colors: ['#bfdbfe', '#3b82f6'], group: 'basic', label: 'Sky Blue' },
	{ colors: ['#ffffff', '#e5e7eb'], group: 'basic', label: 'Clean White' },
	{ colors: ['#000000', '#374151'], group: 'basic', label: 'Dark Slate' },
]);

/* ----------------------------------------------------------------- radial */

export const RADIAL_SWATCHES: Swatch[] = dedupe([
	// Authentic real-world brand radials
	...BRAND_PALETTES.map(({ name, label }) => ({
		colors: radialPalette(name),
		group: 'brand' as SwatchGroup,
		label,
	})),

	// Soft vignettes
	...SOFT_PALETTES.map(({ name, label }) => ({
		colors: radialPalette(name),
		group: 'soft' as SwatchGroup,
		label,
	})),
	{ colors: ['#e6e3dd', '#a9a49b'], group: 'soft', label: 'Stone Vignette' },

	// Saturated spotlights
	{ colors: ['#60a5fa', '#1d4ed8'], group: 'bold', label: 'Blue Spotlight' },
	{ colors: ['#67e8f9', '#0e7490'], group: 'bold', label: 'Cyan Core' },
	{ colors: ['#6ee7b7', '#047857'], group: 'bold', label: 'Emerald Glow' },
	{ colors: ['#fcd34d', '#b45309'], group: 'bold', label: 'Amber Sun' },
	{ colors: ['#fdba74', '#c2410c'], group: 'bold', label: 'Orange Flare' },
	{ colors: ['#fca5a5', '#dc2626'], group: 'bold', label: 'Crimson Glow' },
	{ colors: ['#f0abfc', '#86198f'], group: 'bold', label: 'Magenta Nova' },

	// Depth specular domed
	{ colors: ['#ffffff', '#d1d5db'], group: 'depth', label: 'Pearl Dome' },
	{ colors: ['#f6d365', '#8a5a12'], group: 'depth', label: 'Gold Dome' },
	{ colors: ['#f3f4f6', '#6b7280'], group: 'depth', label: 'Silver Dome' },
	{ colors: ['#f3d3c7', '#8c4a3f'], group: 'depth', label: 'Rose Gold Dome' },
	{ colors: ['#75808a', '#1f2225'], group: 'depth', label: 'Graphite Dome' },
	{
		colors: ['#a7f3d0', '#065f46'],
		group: 'depth',
		label: 'Emerald Glass Dome',
	},
	{ colors: ['#f0b183', '#7c3a12'], group: 'depth', label: 'Copper Dome' },
	{ colors: ['#c4b5fd', '#4c1d95'], group: 'depth', label: 'Amethyst Dome' },
	...DEPTH_PALETTES.map(({ name, label }) => ({
		colors: radialPalette(name),
		group: 'depth' as SwatchGroup,
		label,
	})),

	// Basics
	{ colors: ['#93c5fd', '#3b82f6'], group: 'basic', label: 'Sky Radial' },
	{ colors: ['#ffffff', '#e5e7eb'], group: 'basic', label: 'Light Radial' },
	{ colors: ['#374151', '#000000'], group: 'basic', label: 'Dark Radial' },
]);
