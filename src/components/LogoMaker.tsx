import {
	Copy,
	Grid2x2,
	Loader2,
	PanelLeftClose,
	PanelLeftOpen,
	ShieldCheck,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	emitAgentSearch,
	IconSearchPanel,
} from '@/components/logo-maker/IconSearchPanel';
import { LogoCanvas } from '@/components/logo-maker/LogoCanvas';
import { MyLogosPanel } from '@/components/logo-maker/MyLogosPanel';
import { RandomizeControl } from '@/components/logo-maker/RandomizeControl';
import { RightSidebar } from '@/components/logo-maker/RightSidebar';
import { TemplatesPanel } from '@/components/logo-maker/TemplatesPanel';
import { logoTemplates } from '@/components/logo-maker/templates';
import { WebMcpDebugPanel } from '@/components/logo-maker/WebMcpDebugPanel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { copyLayerToClipboard, getClipboardLayer } from '@/lib/layer-clipboard';
import {
	buildCandidate,
	fetchLogoIcons,
	ICON_API_URL,
	iconUrl,
	LOGO_PACKS,
	PALETTES,
	packOf,
	sortByLogoPack,
	useApplyCandidate,
} from '@/lib/logo-icons';
import { BRAND_PRESETS } from '@/lib/logo-presets';
import { buildShareUrl, decodeLogo, encodeLogo } from '@/lib/logo-share';
import { listLogos, saveLogo, svgToDataUri } from '@/lib/my-logos';
import type {
	AnimationType,
	BackgroundConfig,
	BlendMode,
	LogoLayer,
	SplitLayout,
} from '@/lib/svg-utils';
import {
	ANIMATION_TYPES,
	BLEND_MODES,
	contrastRatio,
	generateLogoSvg,
	svgToPngDataUri,
} from '@/lib/svg-utils';
import { copyToClipboard } from '@/lib/utils';
import { withWebMcpLogging } from '@/lib/webmcp-debug';

// LogoLayer/BackgroundConfig/BLEND_MODES/ANIMATION_TYPES and their types live
// in svg-utils.ts (the lower-level module); re-exported here so existing
// consumers importing from '@/components/LogoMaker' keep working.
export { ANIMATION_TYPES, BLEND_MODES };
export type {
	AnimationType,
	BackgroundConfig,
	BlendMode,
	LogoLayer,
	SplitLayout,
};

type WebMcpTool = {
	name: string;
	title?: string;
	description: string;
	inputSchema?: Record<string, unknown>;
	annotations?: { readOnlyHint?: boolean };
	execute: (args?: Record<string, unknown>) => unknown | Promise<unknown>;
};

type ModelContext = {
	registerTool: (
		tool: WebMcpTool,
		options?: { signal?: AbortSignal },
	) => Promise<unknown>;
};

declare global {
	interface Document {
		modelContext?: ModelContext;
	}

	interface Navigator {
		modelContext?: ModelContext;
	}
}

const DEFAULT_CANVAS_SIZE = { width: 512, height: 512 };

const buildAgentPrompt = (pageUrl: string) => `I want a logo. Before you design anything, ask me a few short questions: the brand or product name, what it does, the mood (minimal, playful, bold, corporate), colors I like or must avoid, and any symbol I already have in mind.

Then open ${pageUrl} in the browser. Find its WebMCP tools with document.modelContext.getRegisteredTools() and use them:
1. Call get_logo_maker_state first. It returns the canvas, the brand presets and the layer fields.
2. Search the icon library with search_logo_icons before drawing anything custom. Only fall back to customSvg when no icon fits.
3. Build with update_logo_maker_state, then check safeZoneViolations and lowContrastLayers in the response and fix them.
4. Make three clearly different variants (different symbol, shape or palette, not the same logo recoloured). After each one, preview it with get_logo_preview (format: "svg") and save it as a checkpoint with manage_saved_logos (action: "save") so I can click between them in the My logos panel.
5. Tell me which variant you would pick and why, with the shareUrl from get_logo_maker_state for each.

Avoid generic choices unless I ask for them: no rocket, lightning bolt, brain, sparkles, infinity loop or abstract swoosh, no purple-to-blue gradient, one strong idea instead of a busy composition.`;

const DEFAULT_BACKGROUND: BackgroundConfig = {
	type: 'solid',
	splitLayout: 'halves',
	solidColor: '#1DB954',
	gradientColors: ['#ff9a9e', '#fad0c4'],
	gradientPositions: [0, 100],
	gradientDirection: 'to right',
	noise: 0,
	borderRadius: 60,
	pattern: 'none',
	patternColor: '#000000',
	patternOpacity: 0.1,
	shape: 'rectangle',
	radialCenterX: 50,
	radialCenterY: 50,
	radialRadius: 50,
	borderWidth: 0,
	borderColor: '#ffffff',
	borderStyle: 'solid',
};

const layerItemSchema = {
	type: 'object',
	description: 'Logo layer object.',
	properties: {
		id: {
			type: 'string',
			description: 'Optional layer ID (UUID generated if omitted).',
		},
		iconName: {
			type: 'string',
			description:
				'Icon identifier in pack:name format (e.g. "lucide:sparkles", "solar:shield-bold", "ph:coffee-fill").',
		},
		url: {
			type: 'string',
			description: 'Direct SVG URL. If omitted, resolved from iconName.',
		},
		customSvg: {
			type: 'string',
			description:
				'Raw SVG markup for a custom shape layer. When set, this overrides icon-based rendering for the layer: iconName still doubles as a label/identity. Pass an empty string to clear it back to icon-based rendering.',
		},
		x: {
			type: 'number',
			description:
				'Canvas horizontal position in pixels, from the left edge. Canvas center is canvasSize.width / 2 (256 for the default 512x512 canvas), not a percentage.',
		},
		y: {
			type: 'number',
			description:
				'Canvas vertical position in pixels, from the top edge. Canvas center is canvasSize.height / 2 (256 for the default 512x512 canvas), not a percentage.',
		},
		scale: {
			type: 'number',
			description:
				'Scale multiplier: 1 draws the icon in a 200 px box on the canvas (default 1.6 = 320 px, canvas is 512 px). Check bounds in get_logo_maker_state after setting it.',
		},
		scaleY: {
			type: 'number',
			description:
				'Vertical scale multiplier. Omit for a square box (same as scale). Use scale 3 and scaleY 0.4 for a colour band, for example. Pass null to go back to square.',
		},
		rotation: {
			type: 'number',
			description: 'Rotation angle in degrees (-180 to 180).',
		},
		fill: { type: 'string', description: 'Fill hex/CSS color or "none".' },
		fillType: {
			type: 'string',
			enum: ['solid', 'linear', 'radial'],
			description:
				'Fill paint type. "linear" or "radial" use fillStops and ignore fill. Needs overwriteFill: true. Use this instead of customSvg for a gradient icon.',
		},
		fillStops: {
			type: 'array',
			items: { type: 'string' },
			description:
				'Gradient colours in order (2 or more), e.g. ["#ff6b6b", "#feca57"].',
		},
		fillPositions: {
			type: 'array',
			items: { type: 'number' },
			description:
				'Stop offsets in percent, one per colour. Omit for evenly spaced.',
		},
		fillAngle: {
			type: 'number',
			description:
				'Linear gradient angle in degrees, CSS convention: 0 = to top, 90 = to right (default).',
		},
		stroke: { type: 'string', description: 'Stroke hex/CSS color or "none".' },
		strokeWidth: {
			type: 'number',
			description: 'Stroke width override in pixels.',
		},
		strokeDasharray: {
			type: 'string',
			description: 'Stroke dash pattern, e.g. "none", "6 4", "2 4".',
		},
		overwriteFill: {
			type: 'boolean',
			description:
				"Force overwrite icon original fill. Only visible if the icon itself uses a fill paint: many icon packs (e.g. Lucide) are stroke-only outline icons where a fill override has no visible effect; if the color doesn't seem to apply, try overwriteStroke instead.",
		},
		overwriteStroke: {
			type: 'boolean',
			description:
				"Force overwrite icon original stroke. Only visible if the icon itself uses a stroke paint: many icon packs are solid fill-only icons with no stroke where a stroke override has no visible effect; if the color doesn't seem to apply, try overwriteFill instead.",
		},
		opacity: { type: 'number', description: 'Layer opacity from 0 to 1.' },
		blendMode: {
			type: 'string',
			enum: BLEND_MODES,
			description:
				"CSS mix-blend-mode for how this layer's pixels combine with what's beneath it.",
		},
		animationType: {
			type: 'string',
			enum: ANIMATION_TYPES,
			description:
				'[Experimental] Looping CSS animation for this layer. Niche feature, most logos should stay static: only set this when the user explicitly asks for motion.',
		},
		animationDuration: {
			type: 'number',
			description: 'Animation duration in seconds.',
		},
		animationTarget: {
			type: 'string',
			description:
				'CSS selector matched against the icon\'s own SVG children (e.g. "path:nth-of-type(2)", "circle") to animate only that part instead of the whole icon. Omit to animate the whole icon.',
		},
		animationCustomKeyframes: {
			type: 'string',
			description:
				'Raw CSS @keyframes stops body, without the @keyframes wrapper. Only used when animationType is "custom" (e.g. "0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); }").',
		},
		visible: { type: 'boolean', description: 'Layer visibility.' },
		locked: {
			type: 'boolean',
			description: 'Lock layer from canvas drag/selection.',
		},
		shadowColor: { type: 'string', description: 'Drop shadow color.' },
		shadowBlur: {
			type: 'number',
			description: 'Drop shadow blur radius in pixels (0 for hard shadow).',
		},
		shadowOffsetX: {
			type: 'number',
			description: 'Drop shadow horizontal offset.',
		},
		shadowOffsetY: {
			type: 'number',
			description: 'Drop shadow vertical offset.',
		},
		shadowOpacity: {
			type: 'number',
			description: 'Drop shadow opacity from 0 to 1.',
		},
	},
	required: ['iconName'],
} as const;

const backgroundSchema = {
	type: 'object',
	description:
		'Logo background configuration. Supported types: solid, gradient, radial, split.',
	properties: {
		type: { type: 'string', enum: ['solid', 'gradient', 'radial', 'split'] },
		splitLayout: {
			type: 'string',
			enum: ['halves', 'thirds', 'quadrant', 'pinwheel'],
			description:
				'Hard-edged colour blocks, used when type is "split". Colours come from gradientColors (halves 2, thirds 3, quadrant and pinwheel 4, cycled if fewer). halves and thirds run left to right, or top to bottom when gradientDirection is "to bottom". quadrant order: top-left, top-right, bottom-right, bottom-left. pinwheel order: top, right, bottom, left. Use this instead of stacking oversized square layers.',
		},
		solidColor: {
			type: 'string',
			description: 'Hex or CSS color for solid background.',
		},
		gradientColors: {
			type: 'array',
			items: { type: 'string' },
			description: 'Array of colors for gradient/radial background.',
		},
		gradientPositions: {
			type: 'array',
			items: { type: 'number' },
			description: 'Array of stop percentages (0 to 100) for each color.',
		},
		gradientDirection: {
			type: 'string',
			description:
				'CSS gradient direction, e.g. "to right", "to bottom right", "to top".',
		},
		noise: {
			type: 'number',
			description: 'Noise texture intensity from 0 to 1.',
		},
		borderRadius: {
			type: 'number',
			description: 'Corner radius in pixels.',
		},
		pattern: {
			type: 'string',
			enum: [
				'none',
				'grid',
				'dots',
				'checker',
				'lines',
				'diagonal',
				'circles',
				'zigzag',
			],
			description: 'Pattern texture overlay.',
		},
		patternColor: { type: 'string', description: 'Pattern overlay color.' },
		patternOpacity: {
			type: 'number',
			description: 'Pattern overlay opacity (0 to 1).',
		},
		shape: {
			type: 'string',
			enum: ['rectangle', 'circle', 'squircle'],
			description: 'Canvas clipping shape.',
		},
		radialCenterX: {
			type: 'number',
			description: 'Radial gradient center X % (0 to 100).',
		},
		radialCenterY: {
			type: 'number',
			description: 'Radial gradient center Y % (0 to 100).',
		},
		radialRadius: {
			type: 'number',
			description: 'Radial gradient radius % (0 to 100).',
		},
		borderWidth: {
			type: 'number',
			description: 'Border outline width in pixels (0 to 24).',
		},
		borderColor: {
			type: 'string',
			description: 'Border outline hex/CSS color.',
		},
		borderStyle: {
			type: 'string',
			enum: ['solid', 'dashed', 'dotted', 'double'],
			description: 'Border outline style.',
		},
	},
} as const;

const getLogoStateSchema = {
	type: 'object',
	properties: {
		includeSvg: {
			type: 'boolean',
			description: 'Return exported SVG markup string in svg field.',
		},
		includeBrands: {
			type: 'boolean',
			description:
				'Include the full brand presets catalog (id, name, category, colors, shape, defaultIcon) in a brands field. availableBrands (just the keys) is always included regardless.',
		},
		brandsQuery: {
			type: 'string',
			description:
				'Optional keyword filter applied to the brands list when includeBrands is true (matches id, name, category, or defaultIcon).',
		},
		brandsCategory: {
			type: 'string',
			description:
				'Optional category filter applied to the brands list when includeBrands is true (e.g. "social", "tech", "creative", "commerce", "entertainment").',
		},
		includeTemplates: {
			type: 'boolean',
			description:
				'Include the built-in templates catalog (id, name, layerCount, shape, backgroundType) in a templates field.',
		},
		showDesignGrid: {
			type: 'boolean',
			description:
				'Show/hide the Apple/iOS icon keyline alignment grid overlay.',
		},
	},
} as const;

const replaceLogoStateSchema = {
	type: 'object',
	properties: {
		canvasSize: {
			type: 'object',
			properties: {
				width: { type: 'number', description: 'Canvas width in pixels.' },
				height: { type: 'number', description: 'Canvas height in pixels.' },
			},
		},
		background: backgroundSchema,
		layers: {
			type: 'array',
			description: 'Logo layers, bottom layer first.',
			items: layerItemSchema,
		},
		showSafeZone: {
			type: 'boolean',
			description:
				'Show/hide Android & iOS app icon safe zone keyline overlay.',
		},
		showDesignGrid: {
			type: 'boolean',
			description:
				'Show/hide the Apple/iOS icon keyline alignment grid overlay.',
		},
		safeZoneRatio: {
			type: 'number',
			description:
				'Inner safe-zone circle diameter ratio: the area critical icon details must stay within to survive any launcher mask (default 0.611, Android adaptive icons strict spec). A fixed outer guide at 75% (practical logo extent) is always shown alongside it.',
		},
		includeSvg: {
			type: 'boolean',
			description: 'Return exported SVG markup in response.',
		},
	},
	required: ['layers'],
} as const;

const updateLayerItemSchema = {
	type: 'object',
	description:
		'Partial layer updates. Match the target layer by id or 0-based index.',
	properties: {
		id: { type: 'string', description: 'Target layer ID.' },
		index: {
			type: 'number',
			description: 'Target layer 0-based index (0 = bottom-most layer).',
		},
		iconName: {
			type: 'string',
			description: 'Replace icon with a new pack:icon name.',
		},
		url: { type: 'string', description: 'Direct SVG URL override.' },
		customSvg: {
			type: 'string',
			description:
				'Raw SVG markup for a custom shape layer. When set, this overrides icon-based rendering for the layer: iconName still doubles as a label/identity. Pass an empty string to clear it back to icon-based rendering.',
		},
		x: {
			type: 'number',
			description:
				'Canvas horizontal position in pixels, from the left edge. Canvas center is canvasSize.width / 2 (256 for the default 512x512 canvas), not a percentage.',
		},
		y: {
			type: 'number',
			description:
				'Canvas vertical position in pixels, from the top edge. Canvas center is canvasSize.height / 2 (256 for the default 512x512 canvas), not a percentage.',
		},
		scale: {
			type: 'number',
			description:
				'Scale multiplier: 1 draws the icon in a 200 px box on the canvas (canvas is 512 px).',
		},
		scaleY: {
			type: 'number',
			description:
				'Vertical scale multiplier. Omit for a square box (same as scale). Use scale 3 and scaleY 0.4 for a colour band, for example. Pass null to go back to square.',
		},
		rotation: { type: 'number', description: 'Rotation angle in degrees.' },
		fill: { type: 'string', description: 'Fill hex/CSS color or "none".' },
		fillType: {
			type: 'string',
			enum: ['solid', 'linear', 'radial'],
			description:
				'Fill paint type. "linear" or "radial" use fillStops and ignore fill. Needs overwriteFill: true. Use this instead of customSvg for a gradient icon.',
		},
		fillStops: {
			type: 'array',
			items: { type: 'string' },
			description:
				'Gradient colours in order (2 or more), e.g. ["#ff6b6b", "#feca57"].',
		},
		fillPositions: {
			type: 'array',
			items: { type: 'number' },
			description:
				'Stop offsets in percent, one per colour. Omit for evenly spaced.',
		},
		fillAngle: {
			type: 'number',
			description:
				'Linear gradient angle in degrees, CSS convention: 0 = to top, 90 = to right (default).',
		},
		stroke: { type: 'string', description: 'Stroke hex/CSS color or "none".' },
		strokeWidth: { type: 'number', description: 'Stroke width in pixels.' },
		strokeDasharray: {
			type: 'string',
			description: 'Stroke dash pattern, e.g. "none", "6 4", "2 4".',
		},
		overwriteFill: {
			type: 'boolean',
			description:
				"Force overwrite fill. Only visible if the icon itself uses a fill paint: many icon packs (e.g. Lucide) are stroke-only outline icons where a fill override has no visible effect; if the color doesn't seem to apply, try overwriteStroke instead.",
		},
		overwriteStroke: {
			type: 'boolean',
			description:
				"Force overwrite stroke. Only visible if the icon itself uses a stroke paint: many icon packs are solid fill-only icons with no stroke where a stroke override has no visible effect; if the color doesn't seem to apply, try overwriteFill instead.",
		},
		opacity: { type: 'number', description: 'Opacity from 0 to 1.' },
		blendMode: {
			type: 'string',
			enum: BLEND_MODES,
			description:
				"CSS mix-blend-mode for how this layer's pixels combine with what's beneath it.",
		},
		animationType: {
			type: 'string',
			enum: ANIMATION_TYPES,
			description:
				'[Experimental] Looping CSS animation for this layer. Niche feature, most logos should stay static: only set this when the user explicitly asks for motion.',
		},
		animationDuration: {
			type: 'number',
			description: 'Animation duration in seconds.',
		},
		animationTarget: {
			type: 'string',
			description:
				'CSS selector matched against the icon\'s own SVG children (e.g. "path:nth-of-type(2)", "circle") to animate only that part instead of the whole icon. Omit to animate the whole icon.',
		},
		animationCustomKeyframes: {
			type: 'string',
			description:
				'Raw CSS @keyframes stops body, without the @keyframes wrapper. Only used when animationType is "custom" (e.g. "0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); }"). Pass an empty string to clear it.',
		},
		visible: { type: 'boolean', description: 'Layer visibility.' },
		locked: { type: 'boolean', description: 'Layer lock status.' },
		shadowColor: { type: 'string', description: 'Drop shadow color.' },
		shadowBlur: {
			type: 'number',
			description: 'Drop shadow blur radius (0 for hard shadow).',
		},
		shadowOffsetX: { type: 'number', description: 'Drop shadow X offset.' },
		shadowOffsetY: { type: 'number', description: 'Drop shadow Y offset.' },
		shadowOpacity: {
			type: 'number',
			description: 'Drop shadow opacity from 0 to 1.',
		},
	},
} as const;

const updateLogoStateSchema = {
	type: 'object',
	properties: {
		canvasSize: {
			type: 'object',
			description: 'Partial canvas size update.',
			properties: {
				width: { type: 'number', description: 'Canvas width in pixels.' },
				height: { type: 'number', description: 'Canvas height in pixels.' },
			},
		},
		background: backgroundSchema,
		applyBrand: {
			type: 'string',
			description:
				'Apply an authentic real-world brand preset style (e.g. "instagram", "facebook", "spotify", "duolingo", "youtube", "whatsapp", "discord", "stripe", "linear", "supabase", "raycast", "netflix", "apple", "github", "google", "figma", "airbnb", "twitch", "slack").',
		},
		showSafeZone: {
			type: 'boolean',
			description: 'Toggle Android & iOS app icon safe zone keylines overlay.',
		},
		showDesignGrid: {
			type: 'boolean',
			description:
				'Show/hide the Apple/iOS icon keyline alignment grid overlay.',
		},
		safeZoneRatio: {
			type: 'number',
			description:
				'Inner safe-zone circle diameter ratio (default 0.611, Android adaptive icons strict spec). Fixed outer guide at 75% is always shown alongside it.',
		},
		addLayers: {
			type: 'array',
			description:
				'New layers to append on top of existing layers. Missing fields default to centered position and standard styles.',
			items: layerItemSchema,
		},
		updateLayers: {
			type: 'array',
			description:
				'Modifications to existing layers (targeted by id or 0-based index).',
			items: updateLayerItemSchema,
		},
		removeLayers: {
			type: 'array',
			description: 'Array of layer IDs or 0-based index strings to remove.',
			items: { type: 'string' },
		},
		clearLayers: {
			type: 'boolean',
			description:
				'If true, clears all current layers before applying addLayers.',
		},
		selectedLayerId: {
			type: 'string',
			description:
				'Layer ID to select, or empty string / null to deselect all layers.',
		},
		randomize: {
			type: 'boolean',
			description:
				'If true, replaces the current layers and background with a freshly randomized design (matched icon, palette, and shape). Overrides addLayers/updateLayers/removeLayers/clearLayers when both are present. Canvas size is left as-is.',
		},
		randomKeyword: {
			type: 'string',
			description:
				'Optional theme keyword for randomize (e.g. "tech", "nature", "star", "animal", "code"). Ignored unless randomize is true.',
		},
		includeSvg: {
			type: 'boolean',
			description: 'If true, returns rendered SVG string in response.',
		},
	},
} as const;

const searchIconsSchema = {
	type: 'object',
	properties: {
		query: {
			type: 'string',
			description:
				'Keyword to search for icons (e.g. "rocket", "shield", "leaf", "sparkles", "bolt").',
		},
		pack: {
			type: 'string',
			description:
				'Optional Iconify pack prefix filter (e.g. "lucide", "solar", "tabler", "mingcute", "ph", "material-symbols").',
		},
		limit: {
			type: 'number',
			description:
				'Maximum number of icon names to return (default 24, max 100).',
		},
	},
	required: ['query'],
} as const;

const loadShareSchema = {
	type: 'object',
	properties: {
		logo: {
			type: 'string',
			description: 'An asl1. share code or a URL containing ?logo=asl1...',
		},
		brand: {
			type: 'string',
			description:
				'Load an authentic brand preset starting point (e.g. "instagram", "facebook", "spotify", "duolingo", "youtube", "whatsapp", "discord", "stripe", "linear", "supabase", "raycast", "netflix", "apple", "github", "google", "figma", "airbnb", "twitch", "slack").',
		},
		templateId: {
			type: 'string',
			description:
				'Built-in template ID to load (e.g. "instagram-sunset", "facebook-brand", "spotify-neon", "supabase-emerald", "stripe-violet", "linear-obsidian", "modern-lightning", "blueprint-grid", "app-icon-squircle", "eco-friendly").',
		},
		includeSvg: {
			type: 'boolean',
			description: 'If true, returns rendered SVG string in response.',
		},
	},
} as const;

const getLogoPreviewSchema = {
	type: 'object',
	properties: {
		format: {
			type: 'string',
			enum: ['svg', 'png'],
			description:
				'"svg" returns the rendered SVG markup. "png" rasterizes it client-side to a small (max 256px) PNG data URI: a cheap "see your own work" check, not a hi-res export (use the human Export panel for that).',
		},
	},
	required: ['format'],
} as const;

const manageSavedLogosSchema = {
	type: 'object',
	properties: {
		action: {
			type: 'string',
			enum: ['list', 'load', 'save'],
			description:
				'"list" returns the saved logos in this browser\'s "My logos" panel. "load" replaces the current editor state with a saved logo by id (requires id). "save" saves the current editor state as a new saved logo, visible in the human "My logos" panel too.',
		},
		id: {
			type: 'string',
			description: 'Saved logo ID. Required for action "load".',
		},
	},
	required: ['action'],
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const asNumber = (value: unknown, fallback: number) =>
	typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asString = (value: unknown, fallback: string) =>
	typeof value === 'string' ? value : fallback;

const asBoolean = (value: unknown, fallback: boolean) =>
	typeof value === 'boolean' ? value : fallback;

// Mirrors LogoCanvas.tsx's layer box (width: 200 * layer.scale, height: 200 * (layer.scaleY ?? layer.scale), centered on x/y): keep in sync.
const LAYER_BASE_SIZE = 200;

const computeLayerBounds = (
	layer: Pick<LogoLayer, 'x' | 'y' | 'scale' | 'scaleY' | 'rotation'>,
) => {
	const width = LAYER_BASE_SIZE * layer.scale;
	const height = LAYER_BASE_SIZE * (layer.scaleY ?? layer.scale);
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	return {
		width,
		height,
		left: layer.x - halfWidth,
		top: layer.y - halfHeight,
		right: layer.x + halfWidth,
		bottom: layer.y + halfHeight,
		centerX: layer.x,
		centerY: layer.y,
		rotation: layer.rotation,
	};
};

const toSharedLayer = ({ id: _id, url: _url, ...layer }: LogoLayer) => ({
	...layer,
	bounds: computeLayerBounds(layer),
});

const patchCanvas = (
	current: { width: number; height: number },
	patch: unknown,
): { width: number; height: number } => {
	if (!isRecord(patch)) return current;
	return {
		width:
			typeof patch.width === 'number' &&
			Number.isFinite(patch.width) &&
			patch.width > 0
				? Math.round(patch.width)
				: current.width,
		height:
			typeof patch.height === 'number' &&
			Number.isFinite(patch.height) &&
			patch.height > 0
				? Math.round(patch.height)
				: current.height,
	};
};

const patchBackground = (
	current: BackgroundConfig,
	patch: unknown,
): BackgroundConfig => {
	if (!isRecord(patch)) return current;
	const next = { ...current };
	if (
		typeof patch.type === 'string' &&
		['solid', 'gradient', 'radial', 'split'].includes(patch.type)
	) {
		next.type = patch.type as BackgroundConfig['type'];
	}
	if (
		typeof patch.splitLayout === 'string' &&
		['halves', 'thirds', 'quadrant', 'pinwheel'].includes(patch.splitLayout)
	) {
		next.splitLayout = patch.splitLayout as BackgroundConfig['splitLayout'];
	}
	if (typeof patch.solidColor === 'string' && patch.solidColor) {
		next.solidColor = patch.solidColor;
	}
	if (Array.isArray(patch.gradientColors)) {
		const validColors = patch.gradientColors.filter(
			(c): c is string => typeof c === 'string' && !!c,
		);
		if (validColors.length > 0) next.gradientColors = validColors;
	}
	if (Array.isArray(patch.gradientPositions)) {
		const validPositions = patch.gradientPositions
			.map((p) => Number(p))
			.filter((p) => Number.isFinite(p) && p >= 0 && p <= 100);
		if (validPositions.length === next.gradientColors.length) {
			next.gradientPositions = validPositions;
		}
	}
	if (typeof patch.gradientDirection === 'string' && patch.gradientDirection) {
		next.gradientDirection = patch.gradientDirection;
	}
	if (typeof patch.noise === 'number' && Number.isFinite(patch.noise)) {
		next.noise = Math.max(0, Math.min(1, patch.noise));
	}
	if (
		typeof patch.borderRadius === 'number' &&
		Number.isFinite(patch.borderRadius)
	) {
		next.borderRadius = Math.max(0, patch.borderRadius);
	}
	if (
		typeof patch.borderWidth === 'number' &&
		Number.isFinite(patch.borderWidth)
	) {
		next.borderWidth = Math.max(0, Math.min(24, patch.borderWidth));
	}
	if (typeof patch.borderColor === 'string' && patch.borderColor) {
		next.borderColor = patch.borderColor;
	}
	if (
		typeof patch.borderStyle === 'string' &&
		['solid', 'dashed', 'dotted', 'double'].includes(patch.borderStyle)
	) {
		next.borderStyle = patch.borderStyle as BackgroundConfig['borderStyle'];
	}
	if (
		typeof patch.pattern === 'string' &&
		[
			'none',
			'grid',
			'dots',
			'checker',
			'lines',
			'diagonal',
			'circles',
			'zigzag',
		].includes(patch.pattern)
	) {
		next.pattern = patch.pattern as BackgroundConfig['pattern'];
	}
	if (typeof patch.patternColor === 'string' && patch.patternColor) {
		next.patternColor = patch.patternColor;
	}
	if (
		typeof patch.patternOpacity === 'number' &&
		Number.isFinite(patch.patternOpacity)
	) {
		next.patternOpacity = Math.max(0, Math.min(1, patch.patternOpacity));
	}
	if (
		typeof patch.shape === 'string' &&
		['rectangle', 'circle', 'squircle'].includes(patch.shape)
	) {
		next.shape = patch.shape as BackgroundConfig['shape'];
	}
	if (
		typeof patch.radialCenterX === 'number' &&
		Number.isFinite(patch.radialCenterX)
	) {
		next.radialCenterX = Math.max(0, Math.min(100, patch.radialCenterX));
	}
	if (
		typeof patch.radialCenterY === 'number' &&
		Number.isFinite(patch.radialCenterY)
	) {
		next.radialCenterY = Math.max(0, Math.min(100, patch.radialCenterY));
	}
	if (
		typeof patch.radialRadius === 'number' &&
		Number.isFinite(patch.radialRadius)
	) {
		next.radialRadius = Math.max(0, Math.min(100, patch.radialRadius));
	}
	return next;
};

const createLayer = (
	rawLayer: Record<string, unknown>,
	canvasSize: { width: number; height: number },
): LogoLayer => {
	const iconName = asString(rawLayer.iconName, 'lucide:sparkles');
	const rawId =
		typeof rawLayer.id === 'string' && rawLayer.id.trim()
			? rawLayer.id.trim()
			: '';
	return {
		id: rawId || crypto.randomUUID(),
		iconName,
		url:
			typeof rawLayer.url === 'string' && rawLayer.url.startsWith('http')
				? rawLayer.url
				: iconUrl(iconName),
		customSvg:
			typeof rawLayer.customSvg === 'string' && rawLayer.customSvg.trim()
				? rawLayer.customSvg.trim()
				: undefined,
		x: asNumber(rawLayer.x, canvasSize.width / 2),
		y: asNumber(rawLayer.y, canvasSize.height / 2),
		scale: asNumber(rawLayer.scale, 1.6),
		scaleY:
			typeof rawLayer.scaleY === 'number' &&
			Number.isFinite(rawLayer.scaleY) &&
			rawLayer.scaleY > 0
				? rawLayer.scaleY
				: undefined,
		rotation: asNumber(rawLayer.rotation, 0),
		fill: asString(rawLayer.fill, '#ffffff'),
		fillType: ['solid', 'linear', 'radial'].includes(String(rawLayer.fillType))
			? (rawLayer.fillType as 'solid' | 'linear' | 'radial')
			: 'solid',
		fillStops:
			Array.isArray(rawLayer.fillStops) &&
			rawLayer.fillStops.length >= 2 &&
			rawLayer.fillStops.every((s) => typeof s === 'string' && s.trim())
				? rawLayer.fillStops.map((s) => String(s).trim())
				: undefined,
		fillPositions:
			Array.isArray(rawLayer.fillPositions) &&
			Array.isArray(rawLayer.fillStops) &&
			rawLayer.fillStops.length >= 2 &&
			rawLayer.fillPositions.length === rawLayer.fillStops.length &&
			rawLayer.fillPositions.every(
				(p) => typeof p === 'number' && Number.isFinite(p),
			)
				? rawLayer.fillPositions
				: undefined,
		fillAngle: asNumber(rawLayer.fillAngle, 90),
		stroke: asString(rawLayer.stroke, '#0a0a0a'),
		strokeWidth: asNumber(rawLayer.strokeWidth, 0),
		strokeDasharray: asString(rawLayer.strokeDasharray, 'none'),
		strokeLinecap: ['round', 'butt', 'square'].includes(
			String(rawLayer.strokeLinecap),
		)
			? (rawLayer.strokeLinecap as LogoLayer['strokeLinecap'])
			: 'round',
		strokeLinejoin: ['round', 'bevel', 'miter'].includes(
			String(rawLayer.strokeLinejoin),
		)
			? (rawLayer.strokeLinejoin as LogoLayer['strokeLinejoin'])
			: 'round',
		overwriteFill: asBoolean(rawLayer.overwriteFill, false),
		overwriteStroke: asBoolean(rawLayer.overwriteStroke, false),
		opacity: asNumber(rawLayer.opacity, 1),
		blendMode: (BLEND_MODES as readonly string[]).includes(
			String(rawLayer.blendMode),
		)
			? (rawLayer.blendMode as BlendMode)
			: 'normal',
		animationType: (ANIMATION_TYPES as readonly string[]).includes(
			String(rawLayer.animationType),
		)
			? (rawLayer.animationType as AnimationType)
			: 'none',
		animationDuration: asNumber(rawLayer.animationDuration, 2),
		animationTarget:
			typeof rawLayer.animationTarget === 'string' &&
			rawLayer.animationTarget.trim()
				? rawLayer.animationTarget.trim()
				: undefined,
		animationCustomKeyframes:
			typeof rawLayer.animationCustomKeyframes === 'string' &&
			rawLayer.animationCustomKeyframes.trim()
				? rawLayer.animationCustomKeyframes.trim()
				: undefined,
		visible: asBoolean(rawLayer.visible, true),
		locked: asBoolean(rawLayer.locked, false),
		shadowColor: asString(rawLayer.shadowColor, '#0a0a0a'),
		shadowBlur: asNumber(rawLayer.shadowBlur, 0),
		shadowOffsetX: asNumber(rawLayer.shadowOffsetX, 5),
		shadowOffsetY: asNumber(rawLayer.shadowOffsetY, 5),
		shadowOpacity: asNumber(rawLayer.shadowOpacity, 0),
	};
};

const patchLayer = (
	layer: LogoLayer,
	patch: Record<string, unknown>,
): LogoLayer => {
	const next = { ...layer };
	if (
		typeof patch.iconName === 'string' &&
		patch.iconName.trim() &&
		patch.iconName !== layer.iconName
	) {
		next.iconName = patch.iconName.trim();
		next.url =
			typeof patch.url === 'string' && patch.url.startsWith('http')
				? patch.url
				: iconUrl(next.iconName);
	} else if (typeof patch.url === 'string' && patch.url.startsWith('http')) {
		next.url = patch.url;
	}
	if (typeof patch.customSvg === 'string') {
		next.customSvg = patch.customSvg.trim() ? patch.customSvg : undefined;
	}
	if (typeof patch.x === 'number' && Number.isFinite(patch.x)) next.x = patch.x;
	if (typeof patch.y === 'number' && Number.isFinite(patch.y)) next.y = patch.y;
	if (typeof patch.scale === 'number' && Number.isFinite(patch.scale))
		next.scale = patch.scale;
	if (patch.scaleY === null) {
		next.scaleY = undefined;
	} else if (
		typeof patch.scaleY === 'number' &&
		Number.isFinite(patch.scaleY) &&
		patch.scaleY > 0
	) {
		next.scaleY = patch.scaleY;
	}
	if (typeof patch.rotation === 'number' && Number.isFinite(patch.rotation))
		next.rotation = patch.rotation;
	if (typeof patch.fill === 'string') next.fill = patch.fill;
	if ('fillType' in patch) {
		next.fillType =
			typeof patch.fillType === 'string' &&
			['solid', 'linear', 'radial'].includes(patch.fillType)
				? (patch.fillType as 'solid' | 'linear' | 'radial')
				: 'solid';
	}
	if ('fillStops' in patch) {
		next.fillStops =
			Array.isArray(patch.fillStops) &&
			patch.fillStops.length >= 2 &&
			patch.fillStops.every((s) => typeof s === 'string' && s.trim())
				? patch.fillStops.map((s) => String(s).trim())
				: undefined;
		if (
			!('fillPositions' in patch) &&
			next.fillPositions &&
			(!next.fillStops || next.fillPositions.length !== next.fillStops.length)
		) {
			next.fillPositions = undefined;
		}
	}
	if ('fillPositions' in patch) {
		const stops = next.fillStops;
		next.fillPositions =
			Array.isArray(patch.fillPositions) &&
			Array.isArray(stops) &&
			stops.length >= 2 &&
			patch.fillPositions.length === stops.length &&
			patch.fillPositions.every(
				(p) => typeof p === 'number' && Number.isFinite(p),
			)
				? patch.fillPositions
				: undefined;
	}
	if ('fillAngle' in patch) {
		next.fillAngle =
			typeof patch.fillAngle === 'number' && Number.isFinite(patch.fillAngle)
				? patch.fillAngle
				: 90;
	}
	if (typeof patch.stroke === 'string') next.stroke = patch.stroke;
	if (
		typeof patch.strokeWidth === 'number' &&
		Number.isFinite(patch.strokeWidth)
	)
		next.strokeWidth = patch.strokeWidth;
	if (typeof patch.strokeDasharray === 'string')
		next.strokeDasharray = patch.strokeDasharray;
	if (
		typeof patch.strokeLinecap === 'string' &&
		['round', 'butt', 'square'].includes(patch.strokeLinecap)
	)
		next.strokeLinecap = patch.strokeLinecap as LogoLayer['strokeLinecap'];
	if (
		typeof patch.strokeLinejoin === 'string' &&
		['round', 'bevel', 'miter'].includes(patch.strokeLinejoin)
	)
		next.strokeLinejoin = patch.strokeLinejoin as LogoLayer['strokeLinejoin'];
	if (typeof patch.overwriteFill === 'boolean')
		next.overwriteFill = patch.overwriteFill;
	if (typeof patch.overwriteStroke === 'boolean')
		next.overwriteStroke = patch.overwriteStroke;
	if (typeof patch.opacity === 'number' && Number.isFinite(patch.opacity))
		next.opacity = Math.max(0, Math.min(1, patch.opacity));
	if (
		typeof patch.blendMode === 'string' &&
		(BLEND_MODES as readonly string[]).includes(patch.blendMode)
	)
		next.blendMode = patch.blendMode as BlendMode;
	if (
		typeof patch.animationType === 'string' &&
		(ANIMATION_TYPES as readonly string[]).includes(patch.animationType)
	)
		next.animationType = patch.animationType as AnimationType;
	if (
		typeof patch.animationDuration === 'number' &&
		Number.isFinite(patch.animationDuration)
	)
		next.animationDuration = Math.max(0.1, patch.animationDuration);
	if (typeof patch.animationTarget === 'string')
		next.animationTarget = patch.animationTarget.trim() || undefined;
	if (typeof patch.animationCustomKeyframes === 'string') {
		next.animationCustomKeyframes =
			patch.animationCustomKeyframes.trim() || undefined;
	}
	if (typeof patch.visible === 'boolean') next.visible = patch.visible;
	if (typeof patch.locked === 'boolean') next.locked = patch.locked;
	if (typeof patch.shadowColor === 'string')
		next.shadowColor = patch.shadowColor;
	if (typeof patch.shadowBlur === 'number' && Number.isFinite(patch.shadowBlur))
		next.shadowBlur = Math.max(0, patch.shadowBlur);
	if (
		typeof patch.shadowOffsetX === 'number' &&
		Number.isFinite(patch.shadowOffsetX)
	)
		next.shadowOffsetX = patch.shadowOffsetX;
	if (
		typeof patch.shadowOffsetY === 'number' &&
		Number.isFinite(patch.shadowOffsetY)
	)
		next.shadowOffsetY = patch.shadowOffsetY;
	if (
		typeof patch.shadowOpacity === 'number' &&
		Number.isFinite(patch.shadowOpacity)
	)
		next.shadowOpacity = Math.max(0, Math.min(1, patch.shadowOpacity));
	return next;
};

// Keyword pool for update_logo_maker_state's randomize flag when no
// randomKeyword is given.
const RANDOM_SEARCH_TERMS = [
	'tech',
	'nature',
	'animal',
	'abstract',
	'geometry',
	'business',
	'minimal',
	'food',
	'star',
	'shield',
	'crown',
	'rocket',
	'coffee',
	'bolt',
	'fire',
	'wave',
	'leaf',
];

/**
 * Which layers currently extend past the safe-zone circle (see
 * LogoCanvas.tsx's keyline overlay for the visual version of this same
 * check). A layer's on-canvas box is `200 * scale` wide by `200 * (scaleY ?? scale)`
 * high, centered at (x, y) (matching LogoCanvas's and generateLogoSvg's
 * layout math) so its farthest possible point from its own center, at any
 * rotation, is the half-diagonal `Math.hypot(100 * scale, 100 * (scaleY ?? scale))`.
 */
const computeSafeZoneViolations = (
	layers: LogoLayer[],
	canvasSize: { width: number; height: number },
	safeZoneRatio: number,
): { layerId: string; iconName: string }[] => {
	const safeRadius = (canvasSize.width * (safeZoneRatio || 0.611)) / 2;
	const centerX = canvasSize.width / 2;
	const centerY = canvasSize.height / 2;
	const violations: { layerId: string; iconName: string }[] = [];
	for (const layer of layers) {
		if (!layer.visible) continue;
		const halfDiagonal = Math.hypot(
			100 * layer.scale,
			100 * (layer.scaleY ?? layer.scale),
		);
		const distFromCenter = Math.hypot(layer.x - centerX, layer.y - centerY);
		if (distFromCenter + halfDiagonal > safeRadius) {
			violations.push({ layerId: layer.id, iconName: layer.iconName });
		}
	}
	return violations;
};

/** Background color directly behind the canvas center: the solid color, or
 * the first gradient/radial stop: a deliberately simple stand-in rather
 * than resolving each layer's exact position along the gradient axis. */
const backgroundBaseColor = (background: BackgroundConfig): string =>
	background.type === 'solid'
		? background.solidColor
		: (background.gradientColors[0] ?? background.solidColor);

/**
 * Layers whose paint color is too close to the background to read clearly
 * (WCAG-style contrast below 3:1: a loose bar for icon-on-background
 * legibility, not full text-contrast AA). Since we can't tell from here
 * whether an icon is fill-only or stroke-only (see the overwriteFill/
 * overwriteStroke schema notes), a layer with neither paint overridden is
 * assumed to render at the documented default of black (`svg-utils.ts`'s
 * mutateSvgDocument). Once the fill is overridden, only overridden channels
 * are checked: the assumed-black stroke otherwise pins the ratio to
 * black-vs-background no matter which fill the agent picks (cold-agent test,
 * 2026-08-31), which made the number unactionable.
 */
const computeLowContrastLayers = (
	layers: LogoLayer[],
	background: BackgroundConfig,
): {
	layerId: string;
	iconName: string;
	contrastRatio: number;
	channel: 'fill' | 'stroke';
	against: string;
}[] => {
	const bg = backgroundBaseColor(background);
	const results: ReturnType<typeof computeLowContrastLayers> = [];
	for (const layer of layers) {
		if (!layer.visible) continue;
		const channels: { channel: 'fill' | 'stroke'; color: string }[] = [];
		if (layer.overwriteFill) {
			channels.push({
				channel: 'fill',
				color:
					(layer.fillType &&
						layer.fillType !== 'solid' &&
						layer.fillStops?.[0]) ||
					layer.fill,
			});
		}
		if (layer.overwriteStroke)
			channels.push({ channel: 'stroke', color: layer.stroke });
		if (channels.length === 0)
			channels.push({ channel: 'fill', color: '#000000' });
		let worst: { ratio: number; channel: 'fill' | 'stroke' } | null = null;
		for (const { channel, color } of channels) {
			if (!color || color.toLowerCase() === 'none') continue;
			const ratio = contrastRatio(color, bg);
			if (ratio !== null && (worst === null || ratio < worst.ratio))
				worst = { ratio, channel };
		}
		if (worst !== null && worst.ratio < 3) {
			results.push({
				layerId: layer.id,
				iconName: layer.iconName,
				contrastRatio: Math.round(worst.ratio * 100) / 100,
				channel: worst.channel,
				against: bg,
			});
		}
	}
	return results;
};

const normalizeBackground = (value: unknown): BackgroundConfig => {
	if (!isRecord(value)) return { ...DEFAULT_BACKGROUND };
	return {
		...DEFAULT_BACKGROUND,
		...value,
		type: ['solid', 'gradient', 'radial', 'split'].includes(String(value.type))
			? (value.type as BackgroundConfig['type'])
			: DEFAULT_BACKGROUND.type,
		splitLayout: ['halves', 'thirds', 'quadrant', 'pinwheel'].includes(
			String(value.splitLayout),
		)
			? (value.splitLayout as BackgroundConfig['splitLayout'])
			: DEFAULT_BACKGROUND.splitLayout,
		gradientColors: Array.isArray(value.gradientColors)
			? value.gradientColors.filter(
					(color): color is string => typeof color === 'string' && !!color,
				)
			: DEFAULT_BACKGROUND.gradientColors,
		gradientPositions: Array.isArray(value.gradientPositions)
			? value.gradientPositions
					.map((p) => Number(p))
					.filter((p) => Number.isFinite(p) && p >= 0 && p <= 100)
			: DEFAULT_BACKGROUND.gradientPositions,
		pattern: [
			'none',
			'grid',
			'dots',
			'checker',
			'lines',
			'diagonal',
			'circles',
			'zigzag',
		].includes(String(value.pattern))
			? (value.pattern as BackgroundConfig['pattern'])
			: DEFAULT_BACKGROUND.pattern,
		shape: ['rectangle', 'circle', 'squircle'].includes(String(value.shape))
			? (value.shape as BackgroundConfig['shape'])
			: DEFAULT_BACKGROUND.shape,
		borderWidth:
			typeof value.borderWidth === 'number' &&
			Number.isFinite(value.borderWidth)
				? Math.max(0, Math.min(24, value.borderWidth))
				: DEFAULT_BACKGROUND.borderWidth,
		borderColor:
			typeof value.borderColor === 'string'
				? value.borderColor
				: DEFAULT_BACKGROUND.borderColor,
		borderStyle: ['solid', 'dashed', 'dotted', 'double'].includes(
			String(value.borderStyle),
		)
			? (value.borderStyle as BackgroundConfig['borderStyle'])
			: DEFAULT_BACKGROUND.borderStyle,
	};
};

const normalizeLogoState = (value: unknown) => {
	if (!isRecord(value)) throw new Error('Logo state must be an object.');
	const rawCanvas = isRecord(value.canvasSize) ? value.canvasSize : {};
	const canvasSize = {
		width: asNumber(rawCanvas.width, DEFAULT_CANVAS_SIZE.width),
		height: asNumber(rawCanvas.height, DEFAULT_CANVAS_SIZE.height),
	};
	const rawLayers = Array.isArray(value.layers) ? value.layers : [];
	const layers = rawLayers.map((rawLayer): LogoLayer => {
		if (!isRecord(rawLayer) || typeof rawLayer.iconName !== 'string') {
			throw new Error('Every layer needs an iconName.');
		}
		return createLayer(rawLayer, canvasSize);
	});

	return {
		canvasSize,
		background: normalizeBackground(value.background),
		layers,
	};
};

// Workspace background behind the canvas: fixed, not user-configurable.
// Dots is the Figma-style default that distinguishes canvas from empty
// space; it never indicated anything about the logo itself (the canvas
// background is always opaque, never transparent), so there's no need to
// offer alternatives.
const CANVAS_WORKSPACE_STYLE: React.CSSProperties = {
	backgroundImage:
		'radial-gradient(circle, var(--muted-foreground)/20% 1.5px, transparent 1.5px)',
	backgroundSize: '20px 20px',
	backgroundColor: 'var(--background)',
};

interface LogoMakerProps {
	/**
	 * Live icon total, from siteStats via free-logo-maker.astro. Required on
	 * purpose: siteStats imports collections.json (~136KB) so it cannot be read
	 * from the client, and a default here would be a hardcoded number that goes
	 * stale. Forgetting to pass it is a type error instead.
	 */
	totalIconsLabel: string;
}

export function LogoMaker({ totalIconsLabel }: LogoMakerProps) {
	const shouldReduceMotion = useReducedMotion();
	const [layers, setLayers] = useState<LogoLayer[]>([]);
	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
	const [replacingLayerId, setReplacingLayerId] = useState<string | null>(null);
	const [canvasSize, setCanvasSize] = useState(DEFAULT_CANVAS_SIZE);
	const [background, setBackground] =
		useState<BackgroundConfig>(DEFAULT_BACKGROUND);
	const [showSafeZone, setShowSafeZone] = useState(false);
	const [showDesignGrid, setShowDesignGrid] = useState(false);
	const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
	// 0.611 = Android's strict adaptive-icon safe zone (66dp circle on a
	// 108dp canvas): the innermost area guaranteed to survive every
	// launcher mask. See LogoCanvas's safe-zone overlay for the paired
	// 75% "practical logo extent" guide (storelit.co/blog/app-icon-safe-zones-practical-guide).
	const [safeZoneRatio, setSafeZoneRatio] = useState(0.611);
	const [leftTab, setLeftTab] = useState<'icons' | 'templates' | 'saved'>(
		'icons',
	);

	const [importState, setImportState] = useState<{
		loading: boolean;
		title: string;
	} | null>(null);

	// Ref to hold latest state for stable WebMCP callbacks
	const stateRef = useRef({
		layers,
		canvasSize,
		background,
		selectedLayerId,
		showSafeZone,
		showDesignGrid,
		safeZoneRatio,
	});
	stateRef.current = {
		layers,
		canvasSize,
		background,
		selectedLayerId,
		showSafeZone,
		showDesignGrid,
		safeZoneRatio,
	};

	const handleAddIcon = (iconName: string, url: string) => {
		// If we're replacing an existing layer
		if (replacingLayerId) {
			setLayers((prev) =>
				prev.map((layer) =>
					layer.id === replacingLayerId ? { ...layer, iconName, url } : layer,
				),
			);
			setReplacingLayerId(null);
			return;
		}

		// Otherwise, add a new layer
		const newLayer: LogoLayer = {
			id: crypto.randomUUID(),
			iconName: iconName,
			url: url,
			x: canvasSize.width / 2,
			y: canvasSize.height / 2,
			scale: 1.6,
			rotation: 0,
			fill: '#ffffff',
			fillType: 'solid',
			stroke: '#0a0a0a',
			strokeWidth: 0,
			overwriteFill: false,
			overwriteStroke: false,
			opacity: 1,
			blendMode: 'normal',
			animationType: 'none',
			animationDuration: 2,
			visible: true,
			locked: false,
			shadowColor: '#0a0a0a',
			shadowBlur: 0,
			shadowOffsetX: 5,
			shadowOffsetY: 5,
			shadowOpacity: 0,
		};
		// The new layer is not auto-selected: the frame appears only after the
		// user clicks a layer.
		setLayers((prev) => [...prev, newLayer]);
	};

	const handleUpdateLayer = useCallback(
		(id: string, updates: Partial<LogoLayer>) => {
			setLayers((prev) =>
				prev.map((layer) =>
					layer.id === id ? { ...layer, ...updates } : layer,
				),
			);
		},
		[],
	);

	const handleDeleteLayer = useCallback(
		(id: string) => {
			setLayers((prev) => prev.filter((layer) => layer.id !== id));
			if (selectedLayerId === id) setSelectedLayerId(null);
		},
		[selectedLayerId],
	);

	const handleDuplicateLayer = (id: string) => {
		const layer = layers.find((l) => l.id === id);
		if (!layer) return;

		const duplicatedLayer: LogoLayer = {
			...layer,
			id: crypto.randomUUID(),
			x: layer.x + 20,
			y: layer.y + 20,
		};
		setLayers((prev) => [...prev, duplicatedLayer]);
		setSelectedLayerId(duplicatedLayer.id);
	};

	const handleCopyLayer = useCallback(
		(id: string) => {
			const layer = layers.find((l) => l.id === id);
			if (!layer) return;

			copyLayerToClipboard(layer);
		},
		[layers],
	);

	const handlePasteLayer = useCallback(
		(id: string) => {
			const clipboardData = getClipboardLayer();
			if (!clipboardData) return;

			handleUpdateLayer(id, clipboardData);
		},
		[handleUpdateLayer],
	);

	const handleRandomize = (
		newLayers: LogoLayer[],
		newBg: BackgroundConfig,
		newCanvasSize?: { width: number; height: number },
	) => {
		setLayers(newLayers);
		setBackground(newBg);
		if (newCanvasSize) setCanvasSize(newCanvasSize);
		setSelectedLayerId(null);
	};
	useApplyCandidate(handleRandomize);

	// Load a shared logo from `?logo=<code>`, `?brand=<name>`, or `?template=<id>` on mount.
	// Cleans the URL query parameters after importing for a clean address bar.
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const code = params.get('logo');
		const brandKey = params.get('brand');
		const templateId = params.get('template');

		if (!code && !brandKey && !templateId) return;

		let cancelled = false;

		const runImport = async () => {
			setImportState({
				loading: true,
				title: brandKey
					? `Loading ${brandKey} brand style...`
					: templateId
						? 'Loading template design...'
						: 'Importing logo design...',
			});

			try {
				let stateToApply: {
					canvasSize: { width: number; height: number };
					background: BackgroundConfig;
					layers: LogoLayer[];
				} | null = null;

				if (code) {
					stateToApply = await decodeLogo(code);
				} else if (brandKey && BRAND_PRESETS[brandKey.toLowerCase()]) {
					const preset = BRAND_PRESETS[brandKey.toLowerCase()];
					const bg = normalizeBackground({
						type: preset.bgType,
						solidColor: preset.solidColor,
						gradientColors:
							preset.gradientColors.length > 0
								? preset.gradientColors
								: [preset.solidColor, preset.solidColor],
						gradientDirection: preset.gradientDirection || 'to right',
						shape: preset.shape || 'squircle',
						borderRadius: preset.borderRadius || 60,
						pattern: preset.pattern || 'none',
						patternColor: preset.patternColor || '#ffffff',
						patternOpacity: preset.patternOpacity ?? 0.1,
					});

					const layer = createLayer(
						{
							iconName: preset.defaultIcon,
							fill: preset.iconFill,
							stroke: preset.iconStroke || preset.iconFill,
							overwriteFill: true,
							overwriteStroke: false,
							shadowColor: preset.shadowColor,
							shadowBlur: preset.shadowBlur,
							shadowOffsetY: preset.shadowOffsetY,
							shadowOpacity: preset.shadowOpacity,
							scale: 1.3,
						},
						DEFAULT_CANVAS_SIZE,
					);

					stateToApply = {
						canvasSize: DEFAULT_CANVAS_SIZE,
						background: bg,
						layers: [layer],
					};
				} else if (templateId) {
					const template = logoTemplates.find((t) => t.id === templateId);
					if (template) {
						stateToApply = {
							canvasSize: DEFAULT_CANVAS_SIZE,
							background: { ...template.background },
							layers: template.layers.map((l) => ({
								...l,
								id: crypto.randomUUID(),
							})),
						};
					}
				}

				if (cancelled || !stateToApply) return;

				// Pre-fetch layer SVG contents in parallel so they render instantly
				await Promise.allSettled(
					stateToApply.layers.map((l) =>
						fetch(l.url)
							.then((r) => r.text())
							.catch(() => null),
					),
				);

				if (cancelled) return;

				setCanvasSize(stateToApply.canvasSize);
				setBackground(stateToApply.background);
				setLayers(stateToApply.layers);
				setSelectedLayerId(stateToApply.layers[0]?.id ?? null);

				// Clean the URL query parameters without reloading
				try {
					const url = new URL(window.location.href);
					url.searchParams.delete('logo');
					url.searchParams.delete('brand');
					url.searchParams.delete('template');
					const cleanUrl =
						url.pathname +
						(url.searchParams.toString()
							? `?${url.searchParams.toString()}`
							: '') +
						url.hash;
					window.history.replaceState({}, '', cleanUrl);
				} catch (err) {
					console.warn('Could not clean URL query:', err);
				}
			} catch (err) {
				console.warn('Logo import from URL failed:', err);
			} finally {
				if (!cancelled) {
					setImportState(null);
				}
			}
		};

		runImport();

		return () => {
			cancelled = true;
		};
	}, []);

	// WebMCP Tool Registration. Mount-only by design (tools register once,
	// see CLAUDE.md); totalIconsLabel is a static prop set once at mount,
	// not a reason to re-register.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
	useEffect(() => {
		if (typeof window === 'undefined') return;

		// document.modelContext is polyfilled site-wide by WebMcp.astro
		// (registered before this effect runs), which also owns send_feedback.
		const modelContext = navigator.modelContext || document.modelContext;

		if (!modelContext?.registerTool) return;

		const controller = new AbortController();

		const rawRegisterTool = modelContext.registerTool;
		const registerTool = (
			def: WebMcpTool,
			opts: { signal?: AbortSignal } | undefined,
		) => rawRegisterTool.call(modelContext, withWebMcpLogging(def), opts);

		const registerTools = async () => {
			try {
				await Promise.all([
					registerTool(
						{
							name: 'get_logo_maker_state',
							title: 'Get logo maker state',
							description:
								'Start here. Before designing, ask the human what they want: brand or product name, preferred colors, style (minimal, playful, bold, corporate), and any icon or symbol in mind. Do not guess these from nothing, and do not interrogate with a long fixed questionnaire either, just enough to design with intent. Then call this tool to read the current logo-maker canvas size, background, layers (with IDs and indices), selected layer, safe zone settings, available brands list, safeZoneViolations, lowContrastLayers, share code, and share URL. Each layer includes a computed bounds field (width, height, left, top, right, bottom, centerX, centerY, rotation, all in canvas pixels) so you can check overlap or alignment against other layers or the canvas edges without guessing from x/y/scale. Pass includeSvg: true to also receive the rendered SVG string, includeBrands: true for the full brand presets catalog (optionally narrowed with brandsQuery/brandsCategory), or includeTemplates: true for the built-in templates catalog.',
							annotations: { readOnlyHint: true },
							inputSchema: getLogoStateSchema,
							async execute(args: Record<string, unknown> = {}) {
								const current = stateRef.current;
								const code = await encodeLogo({
									canvasSize: current.canvasSize,
									background: current.background,
									layers: current.layers,
								});

								let brands: Array<Record<string, unknown>> | undefined;
								if (args.includeBrands) {
									const query = asString(args.brandsQuery, '')
										.trim()
										.toLowerCase();
									const category = asString(args.brandsCategory, '')
										.trim()
										.toLowerCase();
									let presets = Object.values(BRAND_PRESETS);
									if (category) {
										presets = presets.filter((p) => p.category === category);
									}
									if (query) {
										presets = presets.filter(
											(p) =>
												p.id.includes(query) ||
												p.name.toLowerCase().includes(query) ||
												p.category.includes(query) ||
												p.defaultIcon.toLowerCase().includes(query),
										);
									}
									brands = presets.map((b) => ({
										id: b.id,
										name: b.name,
										category: b.category,
										bgType: b.bgType,
										colors:
											b.bgType === 'solid' ? [b.solidColor] : b.gradientColors,
										gradientDirection: b.gradientDirection,
										shape: b.shape,
										defaultIcon: b.defaultIcon,
										iconFill: b.iconFill,
									}));
								}

								return {
									canvasSize: current.canvasSize,
									background: current.background,
									layers: current.layers.map((l, index) => ({
										id: l.id,
										index,
										...toSharedLayer(l),
									})),
									selectedLayerId: current.selectedLayerId,
									showSafeZone: current.showSafeZone,
									showDesignGrid: current.showDesignGrid,
									safeZoneRatio: current.safeZoneRatio,
									layerCount: current.layers.length,
									availableBrands: Object.keys(BRAND_PRESETS),
									brands,
									templates: args.includeTemplates
										? logoTemplates.map((t) => ({
												id: t.id,
												name: t.name,
												layerCount: t.layers.length,
												shape: t.background.shape,
												backgroundType: t.background.type,
											}))
										: undefined,
									safeZoneViolations: computeSafeZoneViolations(
										current.layers,
										current.canvasSize,
										current.safeZoneRatio,
									),
									lowContrastLayers: computeLowContrastLayers(
										current.layers,
										current.background,
									),
									shareCode: code,
									shareUrl: buildShareUrl(code),
									svg: args.includeSvg
										? await generateLogoSvg(
												current.layers,
												current.canvasSize,
												current.background,
											)
										: undefined,
								};
							},
						},
						{ signal: controller.signal },
					),

					registerTool(
						{
							name: 'update_logo_maker_state',
							title: 'Update logo maker state',
							description:
								'Smart partial editor updates: modifies background, applies authentic brand presets (e.g. "instagram", "facebook", "spotify", "stripe", "linear", "supabase"), toggles safe zone keylines, adds new layers, updates existing layers (by ID or 0-based index), removes layers, clears layers, randomizes the whole design, or updates selection without needing to re-send the whole state. updateLayers patches only the fields you send on the targeted layer: every other field, including fill/stroke colors, is left untouched; if a targeted update doesn\'t match any layer, it\'s listed in the response\'s unmatchedUpdates field instead of silently doing nothing. This is the tool to use for toggling overwriteFill/overwriteStroke on or off without losing a previously set color, or any other incremental tweak; use replace_logo_maker_state only when loading a complete logo from scratch. For a gradient icon set fillType: "linear" or "radial" with fillStops (and overwriteFill: true) rather than writing customSvg. For a non-square shape (a band, a bar, a stretched mark) set scaleY on the layer instead of composing several layers. For a two-tone or four-colour block background set background.type: "split" with splitLayout and gradientColors.',
							inputSchema: updateLogoStateSchema,
							async execute(args: Record<string, unknown> = {}) {
								const current = stateRef.current;
								const nextCanvas = patchCanvas(
									current.canvasSize,
									args.canvasSize,
								);
								let nextBg = patchBackground(
									current.background,
									args.background,
								);

								// Handle applyBrand preset
								if (
									typeof args.applyBrand === 'string' &&
									args.applyBrand.trim()
								) {
									const brandKey = args.applyBrand.trim().toLowerCase();
									const brand = BRAND_PRESETS[brandKey];
									if (!brand) {
										throw new Error(
											`Brand "${args.applyBrand}" not found. Available brands: ${Object.keys(BRAND_PRESETS).join(', ')}`,
										);
									}
									nextBg = {
										type: brand.bgType,
										solidColor: brand.solidColor,
										gradientColors: brand.gradientColors,
										gradientDirection: brand.gradientDirection,
										noise: 0,
										borderRadius: brand.borderRadius,
										pattern: brand.pattern,
										patternColor: brand.patternColor,
										patternOpacity: brand.patternOpacity,
										shape: brand.shape,
										radialCenterX: 50,
										radialCenterY: 50,
										radialRadius: 50,
									};
								}

								// Handle safeZone toggles
								if (typeof args.showSafeZone === 'boolean') {
									setShowSafeZone(args.showSafeZone);
								}
								if (typeof args.showDesignGrid === 'boolean') {
									setShowDesignGrid(args.showDesignGrid);
								}
								if (
									typeof args.safeZoneRatio === 'number' &&
									Number.isFinite(args.safeZoneRatio)
								) {
									setSafeZoneRatio(
										Math.max(0.2, Math.min(0.98, args.safeZoneRatio)),
									);
								}

								let nextLayers = args.clearLayers ? [] : [...current.layers];
								const touchedLayerIds: string[] = [];

								// Handle removeLayers
								if (
									Array.isArray(args.removeLayers) &&
									args.removeLayers.length > 0
								) {
									const removeSet = new Set(
										args.removeLayers.map((v) => String(v).trim()),
									);
									nextLayers = nextLayers.filter((layer, index) => {
										return (
											!removeSet.has(layer.id) && !removeSet.has(String(index))
										);
									});
								}

								// Handle updateLayers. Anything that doesn't match a layer is
								// recorded in unmatchedUpdates rather than silently dropped :
								// a batch update should stay non-fatal, but a no-op must be
								// visible in the response.
								const unmatchedUpdates: (string | number)[] = [];
								if (
									Array.isArray(args.updateLayers) &&
									args.updateLayers.length > 0
								) {
									const updates = args.updateLayers;
									updates.forEach((update, updateIndex) => {
										if (!isRecord(update)) {
											unmatchedUpdates.push(updateIndex);
											return;
										}
										const targetId =
											typeof update.id === 'string' ? update.id : undefined;
										const targetIndex =
											typeof update.index === 'number'
												? update.index
												: undefined;

										let foundIdx = -1;
										if (targetId) {
											foundIdx = nextLayers.findIndex((l) => l.id === targetId);
										}
										if (
											foundIdx === -1 &&
											targetIndex !== undefined &&
											targetIndex >= 0 &&
											targetIndex < nextLayers.length
										) {
											foundIdx = targetIndex;
										}
										if (
											foundIdx === -1 &&
											updates.length === 1 &&
											nextLayers.length === 1
										) {
											foundIdx = 0;
										}
										if (foundIdx === -1 && current.selectedLayerId) {
											foundIdx = nextLayers.findIndex(
												(l) => l.id === current.selectedLayerId,
											);
										}

										if (foundIdx !== -1) {
											nextLayers[foundIdx] = patchLayer(
												nextLayers[foundIdx],
												update,
											);
											touchedLayerIds.push(nextLayers[foundIdx].id);
										} else {
											unmatchedUpdates.push(
												targetId ?? targetIndex ?? updateIndex,
											);
										}
									});
								}

								// Handle addLayers
								if (
									Array.isArray(args.addLayers) &&
									args.addLayers.length > 0
								) {
									for (const add of args.addLayers) {
										if (isRecord(add)) {
											const created = createLayer(add, nextCanvas);
											nextLayers.push(created);
											touchedLayerIds.push(created.id);
										}
									}
								}

								let randomKeyword: string | undefined;
								let randomPalette: string | undefined;

								// Handle randomize: replaces layers/background wholesale, so it
								// runs last and overrides whatever add/update/remove/clear did
								// above (combining randomize with targeted edits isn't a
								// meaningful request).
								if (args.randomize) {
									const term =
										asString(args.randomKeyword, '').trim() ||
										RANDOM_SEARCH_TERMS[
											Math.floor(Math.random() * RANDOM_SEARCH_TERMS.length)
										];
									const icons = await fetchLogoIcons(
										term,
										controller.signal,
										12,
									);
									if (icons.length === 0) {
										throw new Error(`No icons found for keyword "${term}".`);
									}
									const pickedIcon =
										icons[Math.floor(Math.random() * icons.length)];
									const shapes: BackgroundConfig['shape'][] = [
										'rectangle',
										'circle',
										'squircle',
									];
									const pickedShape =
										shapes[Math.floor(Math.random() * shapes.length)];
									const candidate = buildCandidate(
										pickedIcon,
										nextCanvas,
										Math.floor(Math.random() * PALETTES.length),
										pickedShape,
									);
									nextBg = candidate.background;
									nextLayers = candidate.layers;
									randomKeyword = term;
									randomPalette = candidate.palette;
									touchedLayerIds.length = 0;
									if (nextLayers.length > 0) {
										touchedLayerIds.push(nextLayers[0].id);
									}
								}

								// Apply state updates
								setCanvasSize(nextCanvas);
								setBackground(nextBg);
								setLayers(nextLayers);
								if (args.selectedLayerId === undefined) {
									if (touchedLayerIds.length > 0) {
										setSelectedLayerId(
											touchedLayerIds[touchedLayerIds.length - 1],
										);
									} else if (
										args.background !== undefined ||
										(typeof args.applyBrand === 'string' &&
											args.applyBrand.trim())
									) {
										setSelectedLayerId(null);
									}
								} else {
									setSelectedLayerId(
										typeof args.selectedLayerId === 'string' &&
											args.selectedLayerId
											? args.selectedLayerId
											: null,
									);
								}

								const code = await encodeLogo({
									canvasSize: nextCanvas,
									background: nextBg,
									layers: nextLayers,
								});

								return {
									ok: true,
									canvasSize: nextCanvas,
									background: nextBg,
									layers: nextLayers.map((l, index) => ({
										id: l.id,
										index,
										...toSharedLayer(l),
									})),
									layerCount: nextLayers.length,
									unmatchedUpdates:
										unmatchedUpdates.length > 0 ? unmatchedUpdates : undefined,
									randomKeyword,
									palette: randomPalette,
									shareCode: code,
									shareUrl: buildShareUrl(code),
									svg: args.includeSvg
										? await generateLogoSvg(nextLayers, nextCanvas, nextBg)
										: undefined,
								};
							},
						},
						{ signal: controller.signal },
					),

					registerTool(
						{
							name: 'replace_logo_maker_state',
							title: 'Replace logo maker state',
							description:
								'Replaces the entire editor contents with a structured logo state (canvasSize, background, and layers array) and returns a share code, share URL, and optional SVG. Full replace: any layer field you omit reverts to its default, it does not carry over from the current state. For any incremental edit (including toggling overwriteFill/overwriteStroke without losing the stored color) use update_logo_maker_state\'s updateLayers instead, which patches only the fields you send. Reserve this tool for loading a complete, fully-specified logo from scratch. For a gradient icon set fillType: "linear" or "radial" with fillStops (and overwriteFill: true) rather than writing customSvg.',
							inputSchema: replaceLogoStateSchema,
							async execute(args: Record<string, unknown> = {}) {
								const nextState = normalizeLogoState(args);
								setCanvasSize(nextState.canvasSize);
								setBackground(nextState.background);
								setLayers(nextState.layers);
								setSelectedLayerId(null);
								if (typeof args.showSafeZone === 'boolean') {
									setShowSafeZone(args.showSafeZone);
								}
								if (typeof args.showDesignGrid === 'boolean') {
									setShowDesignGrid(args.showDesignGrid);
								}
								if (
									typeof args.safeZoneRatio === 'number' &&
									Number.isFinite(args.safeZoneRatio)
								) {
									setSafeZoneRatio(
										Math.max(0.2, Math.min(0.98, args.safeZoneRatio)),
									);
								}
								const code = await encodeLogo(nextState);
								return {
									ok: true,
									layerCount: nextState.layers.length,
									shareCode: code,
									shareUrl: buildShareUrl(code),
									svg: args.includeSvg
										? await generateLogoSvg(
												nextState.layers,
												nextState.canvasSize,
												nextState.background,
											)
										: undefined,
								};
							},
						},
						{ signal: controller.signal },
					),

					registerTool(
						{
							name: 'search_logo_icons',
							title: 'Search logo icons',
							description: `Searches across ${totalIconsLabel} SVG icons for keywords to find valid icon names (in pack:name format) suitable for logo marks.`,
							annotations: { readOnlyHint: true },
							inputSchema: searchIconsSchema,
							async execute(args: Record<string, unknown> = {}) {
								const query = asString(args.query, '').trim();
								if (!query) throw new Error('Search query is required.');
								const limit = Math.min(
									Math.max(asNumber(args.limit, 24), 1),
									100,
								);
								const pack = asString(args.pack, '').trim();

								const apiUrl = ICON_API_URL;
								const prefixesParam = pack
									? `&prefixes=${encodeURIComponent(pack)}`
									: `&prefixes=${LOGO_PACKS.join(',')}`;

								let iconList: string[] = [];
								try {
									const res = await fetch(
										`${apiUrl}/search?query=${encodeURIComponent(query)}&limit=${Math.max(limit * 2, 50)}${prefixesParam}`,
										{ signal: controller.signal },
									);
									if (res.ok) {
										const data = await res.json();
										if (Array.isArray(data.icons)) {
											iconList = pack ? data.icons : sortByLogoPack(data.icons);
										}
									}
								} catch {
									// Search error fallback
								}

								if (iconList.length === 0 && !pack) {
									try {
										const fallbackRes = await fetch(
											`${apiUrl}/search?query=${encodeURIComponent(query)}&limit=${limit}`,
											{ signal: controller.signal },
										);
										if (fallbackRes.ok) {
											const fallbackData = await fallbackRes.json();
											if (Array.isArray(fallbackData.icons)) {
												iconList = fallbackData.icons;
											}
										}
									} catch {
										// Fallback search error
									}
								}

								const finalIcons = iconList.slice(0, limit);
								emitAgentSearch(query, finalIcons);
								return {
									ok: true,
									query,
									icons: finalIcons,
									total: finalIcons.length,
									packs: Array.from(
										new Set(finalIcons.map(packOf).filter(Boolean)),
									),
								};
							},
						},
						{ signal: controller.signal },
					),

					registerTool(
						{
							name: 'load_logo_maker_share',
							title: 'Load logo maker share, brand or template',
							description:
								'Loads a complete logo into the editor from an authentic brand preset (e.g. "instagram", "facebook", "spotify", "stripe", "supabase", "linear"), a built-in template ID, an asl1. share code, or a full ?logo= URL: always replaces the current canvas. For the catalog of available brands or templates (a read, not an action), use get_logo_maker_state\'s includeBrands/includeTemplates instead. For a randomized design, use update_logo_maker_state\'s randomize flag.',
							inputSchema: loadShareSchema,
							async execute(args: Record<string, unknown> = {}) {
								if (args.brand) {
									const brandKey = asString(args.brand, '')
										.trim()
										.toLowerCase();
									const brand = BRAND_PRESETS[brandKey];
									if (!brand) {
										throw new Error(
											`Brand "${args.brand}" not found. Available brands: ${Object.keys(BRAND_PRESETS).join(', ')}`,
										);
									}
									const nextCanvas = DEFAULT_CANVAS_SIZE;
									const nextBg: BackgroundConfig = {
										type: brand.bgType,
										solidColor: brand.solidColor,
										gradientColors: brand.gradientColors,
										gradientDirection: brand.gradientDirection,
										noise: 0,
										borderRadius: brand.borderRadius,
										pattern: brand.pattern,
										patternColor: brand.patternColor,
										patternOpacity: brand.patternOpacity,
										shape: brand.shape,
										radialCenterX: 50,
										radialCenterY: 50,
										radialRadius: 50,
									};
									const nextLayers: LogoLayer[] = [
										{
											id: crypto.randomUUID(),
											iconName: brand.defaultIcon,
											url: iconUrl(brand.defaultIcon),
											x: nextCanvas.width / 2,
											y: brand.id === 'facebook' ? 275 : nextCanvas.height / 2,
											scale: brand.id === 'facebook' ? 2.1 : 1.8,
											rotation: 0,
											fill: brand.iconFill,
											stroke: brand.iconStroke || 'none',
											strokeWidth: 0,
											overwriteFill: true,
											overwriteStroke: false,
											opacity: 1,
											blendMode: 'normal',
											visible: true,
											locked: false,
											shadowColor: brand.shadowColor,
											shadowBlur: brand.shadowBlur,
											shadowOffsetX: 0,
											shadowOffsetY: brand.shadowOffsetY,
											shadowOpacity: brand.shadowOpacity,
										},
									];
									setCanvasSize(nextCanvas);
									setBackground(nextBg);
									setLayers(nextLayers);
									setSelectedLayerId(null);
									const code = await encodeLogo({
										canvasSize: nextCanvas,
										background: nextBg,
										layers: nextLayers,
									});
									return {
										ok: true,
										brand: brand.id,
										brandName: brand.name,
										canvasSize: nextCanvas,
										background: nextBg,
										layers: nextLayers.map((l, index) => ({
											id: l.id,
											index,
											...toSharedLayer(l),
										})),
										layerCount: nextLayers.length,
										shareCode: code,
										shareUrl: buildShareUrl(code),
										svg: args.includeSvg
											? await generateLogoSvg(nextLayers, nextCanvas, nextBg)
											: undefined,
									};
								}

								if (args.templateId) {
									const idStr = asString(args.templateId, '')
										.trim()
										.toLowerCase();
									const tpl = logoTemplates.find(
										(t) =>
											t.id.toLowerCase() === idStr ||
											t.name.toLowerCase() === idStr,
									);
									if (!tpl) {
										throw new Error(
											`Template "${args.templateId}" not found. Available templates: ${logoTemplates.map((t) => t.id).join(', ')}`,
										);
									}
									const nextCanvas = DEFAULT_CANVAS_SIZE;
									const nextBg = { ...DEFAULT_BACKGROUND, ...tpl.background };
									const nextLayers = tpl.layers.map((l) => ({
										...l,
										id: crypto.randomUUID(),
										url: l.url || iconUrl(l.iconName),
									}));
									setCanvasSize(nextCanvas);
									setBackground(nextBg);
									setLayers(nextLayers);
									setSelectedLayerId(null);
									const code = await encodeLogo({
										canvasSize: nextCanvas,
										background: nextBg,
										layers: nextLayers,
									});
									return {
										ok: true,
										templateId: tpl.id,
										templateName: tpl.name,
										canvasSize: nextCanvas,
										background: nextBg,
										layers: nextLayers.map((l, index) => ({
											id: l.id,
											index,
											...toSharedLayer(l),
										})),
										layerCount: nextLayers.length,
										shareCode: code,
										shareUrl: buildShareUrl(code),
										svg: args.includeSvg
											? await generateLogoSvg(nextLayers, nextCanvas, nextBg)
											: undefined,
									};
								}

								const value = asString(args.logo, '').trim();
								const code = value.startsWith('http')
									? new URL(value).searchParams.get('logo')
									: value;
								if (!code)
									throw new Error(
										'Missing logo share code, brand, or templateId.',
									);
								const nextState = await decodeLogo(code);
								setCanvasSize(nextState.canvasSize);
								setBackground(nextState.background);
								setLayers(nextState.layers);
								setSelectedLayerId(null);
								return {
									ok: true,
									layerCount: nextState.layers.length,
									canvasSize: nextState.canvasSize,
									background: nextState.background,
									layers: nextState.layers.map((l, index) => ({
										id: l.id,
										index,
										...toSharedLayer(l),
									})),
									shareCode: code,
									shareUrl: buildShareUrl(code),
									svg: args.includeSvg
										? await generateLogoSvg(
												nextState.layers,
												nextState.canvasSize,
												nextState.background,
											)
										: undefined,
								};
							},
						},
						{ signal: controller.signal },
					),

					registerTool(
						{
							name: 'get_logo_preview',
							title: 'Get logo preview',
							description:
								'Renders the current canvas so an agent can check its own composition without a manual export round-trip. format: "svg" returns the exact SVG markup (same generator as includeSvg elsewhere). format: "png" rasterizes it client-side to a small (max 256px) PNG data URI: a cheap sanity check, not a hi-res export.',
							annotations: { readOnlyHint: true },
							inputSchema: getLogoPreviewSchema,
							async execute(args: Record<string, unknown> = {}) {
								const format = args.format === 'png' ? 'png' : 'svg';
								if (args.format !== 'svg' && args.format !== 'png') {
									throw new Error('format must be "svg" or "png".');
								}
								const current = stateRef.current;
								const svg = await generateLogoSvg(
									current.layers,
									current.canvasSize,
									current.background,
								);
								if (format === 'svg') {
									return { format: 'svg', svg };
								}
								const dataUri = await svgToPngDataUri(
									svg,
									current.canvasSize,
									256,
								);
								return { format: 'png', dataUri };
							},
						},
						{ signal: controller.signal },
					),

					registerTool(
						{
							name: 'manage_saved_logos',
							title: 'Manage saved logos',
							description:
								'Reads and writes the "My logos" list (the same browser-local list the human Save/My-logos UI uses). action: "list" returns saved entries (id, code, savedAt, iconName, thumb). action: "load" replaces the current editor state with a saved entry by id. action: "save" saves the current editor state as a new entry, so agent-built logos show up in the human "My logos" panel too.',
							inputSchema: manageSavedLogosSchema,
							async execute(args: Record<string, unknown> = {}) {
								const action = asString(args.action, '');

								if (action === 'list') {
									return { ok: true, logos: listLogos() };
								}

								if (action === 'load') {
									const id = asString(args.id, '').trim();
									if (!id) {
										throw new Error('id is required for action "load".');
									}
									const entry = listLogos().find((logo) => logo.id === id);
									if (!entry) {
										throw new Error(`No saved logo found with id "${id}".`);
									}
									const nextState = await decodeLogo(entry.code);
									setCanvasSize(nextState.canvasSize);
									setBackground(nextState.background);
									setLayers(nextState.layers);
									setSelectedLayerId(null);
									return {
										ok: true,
										id: entry.id,
										layerCount: nextState.layers.length,
										canvasSize: nextState.canvasSize,
										background: nextState.background,
										layers: nextState.layers.map((l, index) => ({
											id: l.id,
											index,
											...toSharedLayer(l),
										})),
										shareCode: entry.code,
										shareUrl: buildShareUrl(entry.code),
									};
								}

								if (action === 'save') {
									const current = stateRef.current;
									const code = await encodeLogo({
										canvasSize: current.canvasSize,
										background: current.background,
										layers: current.layers,
									});
									const iconName = current.layers[0]?.iconName ?? 'logo';
									let thumb: string | undefined;
									try {
										const svg = await generateLogoSvg(
											current.layers,
											current.canvasSize,
											current.background,
										);
										thumb = svgToDataUri(svg);
									} catch {
										// Thumbnail generation is a nice-to-have; saveLogo tolerates
										// a missing thumb.
										thumb = undefined;
									}
									const logos = saveLogo({ code, iconName, thumb });
									// Agent checkpoints show up where the human can click them.
									setLeftTab('saved');
									return { ok: true, logos };
								}

								throw new Error('action must be "list", "load", or "save".');
							},
						},
						{ signal: controller.signal },
					),
				]);
			} catch (err) {
				// WebMCP is still experimental; keep it silent for normal users but log for debugging.
				console.error('[WebMCP] tool registration failed:', err);
			}
		};

		registerTools();
		return () => controller.abort();
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.isContentEditable ||
					/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
			) {
				return;
			}

			if (!selectedLayerId) return;

			// Copy (Ctrl+C or Cmd+C)
			if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
				e.preventDefault();
				handleCopyLayer(selectedLayerId);
				return;
			}

			// Paste (Ctrl+V or Cmd+V)
			if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
				e.preventDefault();
				handlePasteLayer(selectedLayerId);
				return;
			}

			// Delete
			if (
				e.key === 'Delete' ||
				e.key === 'Backspace' ||
				e.key.toLowerCase() === 'x'
			) {
				handleDeleteLayer(selectedLayerId);
				return;
			}

			// Move
			const layer = layers.find((l) => l.id === selectedLayerId);
			if (!layer || layer.locked) return;

			const step = e.shiftKey ? 10 : 1;
			let dx = 0;
			let dy = 0;

			if (e.key === 'ArrowUp') dy = -step;
			if (e.key === 'ArrowDown') dy = step;
			if (e.key === 'ArrowLeft') dx = -step;
			if (e.key === 'ArrowRight') dx = step;

			if (dx !== 0 || dy !== 0) {
				e.preventDefault();
				handleUpdateLayer(selectedLayerId, {
					x: layer.x + dx,
					y: layer.y + dy,
				});
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [
		selectedLayerId,
		layers,
		handleCopyLayer,
		handlePasteLayer,
		handleDeleteLayer,
		handleUpdateLayer,
	]);

	return (
		<>
			<div className='flex h-full w-full overflow-hidden bg-background'>
				{/* Left Sidebar - Search & Templates */}
				<motion.div
					className='border-r bg-card overflow-hidden shrink-0'
					animate={{ width: leftPanelCollapsed ? 0 : 320 }}
					transition={{
						duration: shouldReduceMotion ? 0 : 0.25,
						ease: [0.19, 1, 0.22, 1],
					}}
				>
					<div
						className='w-80 h-full flex flex-col'
						inert={leftPanelCollapsed || undefined}
					>
						<Tabs
							value={leftTab}
							onValueChange={(v) => setLeftTab(v as typeof leftTab)}
							className='flex flex-col h-full gap-0'
						>
							<div className='p-2 border-b'>
								<TabsList className='w-full'>
									<TabsTrigger value='icons' className='flex-1'>
										Icons
									</TabsTrigger>
									<TabsTrigger value='templates' className='flex-1'>
										Templates
									</TabsTrigger>
									<TabsTrigger value='saved' className='flex-1'>
										My logos
									</TabsTrigger>
								</TabsList>
							</div>

							<TabsContent
								value='icons'
								className='flex-1 overflow-hidden mt-0'
							>
								<IconSearchPanel
									totalIconsLabel={totalIconsLabel}
									onSelectIcon={handleAddIcon}
									replacingLayerId={replacingLayerId}
									onCancelReplace={() => setReplacingLayerId(null)}
									currentLayers={layers}
									currentBackground={background}
								/>
							</TabsContent>

							<TabsContent
								value='templates'
								className='flex-1 overflow-hidden mt-0 flex flex-col min-h-0'
							>
								<TemplatesPanel
									onSelectTemplate={(template) => {
										const newLayers = template.layers.map((l) => ({
											...l,
											id: crypto.randomUUID(),
										}));
										setLayers(newLayers);
										setBackground({ ...template.background });
										setSelectedLayerId(null);
									}}
								/>
							</TabsContent>

							<TabsContent
								value='saved'
								className='flex-1 overflow-hidden mt-0 flex flex-col min-h-0'
							>
								<MyLogosPanel />
							</TabsContent>
						</Tabs>
					</div>
				</motion.div>

				{/* Center - Canvas */}
				<div className='flex-1 flex flex-col min-w-0'>
					{/* Canvas toolbar */}
					<div className='flex items-center justify-between gap-3 border-b bg-card px-3 py-2'>
						<div className='flex items-baseline gap-2 min-w-0'>
							<Button
								type='button'
								variant='ghost'
								size='icon'
								className='size-8 -ml-1 shrink-0'
								onClick={() => setLeftPanelCollapsed((v) => !v)}
								title={leftPanelCollapsed ? 'Show panel' : 'Hide panel'}
							>
								{leftPanelCollapsed ? (
									<PanelLeftOpen className='size-4' />
								) : (
									<PanelLeftClose className='size-4' />
								)}
							</Button>
							<span className='text-xs text-muted-foreground tabular-nums truncate'>
								{canvasSize.width} x {canvasSize.height} px
							</span>
						</div>
						<div className='flex items-center gap-1.5'>
							<Button
								type='button'
								variant={showSafeZone ? 'secondary' : 'ghost'}
								size='icon'
								onClick={() => setShowSafeZone((v) => !v)}
								className='size-8'
								title='Toggle safe zone guides: 75% logo extent, 61% Android adaptive critical zone'
							>
								<ShieldCheck className='size-3.5' />
							</Button>
							<Button
								type='button'
								variant={showDesignGrid ? 'secondary' : 'ghost'}
								size='icon'
								onClick={() => setShowDesignGrid((v) => !v)}
								className='size-8'
								title='Toggle Apple/iOS icon keyline grid'
							>
								<Grid2x2 className='size-3.5' />
							</Button>
							<RandomizeControl
								onRandomize={handleRandomize}
								canvasSize={canvasSize}
								compact
							/>
						</div>
					</div>

					<div className='relative flex-1 min-h-0'>
						<button
							type='button'
							className='absolute inset-0 flex flex-col w-full border-0 p-0 text-left focus:outline-none transition-colors'
							style={CANVAS_WORKSPACE_STYLE}
							onClick={() => setSelectedLayerId(null)}
						>
							<div
								className='flex-1 flex items-center justify-center overflow-hidden p-8'
								// biome-ignore lint/suspicious/noExplicitAny: containerType isn't in this csstype version yet
								style={{ containerType: 'size' } as any}
							>
								{/* Scales the canvas down to fit the container while keeping its
							    aspect ratio, via container query units instead of a
							    ResizeObserver. Never scales up past 1 (canvas stays 1:1 when
							    there's room). */}
								<div
									style={{
										transform: `scale(min(1, calc(100cqw / ${canvasSize.width}px), calc(100cqh / ${canvasSize.height}px)))`,
									}}
								>
									<LogoCanvas
										layers={layers}
										selectedLayerId={selectedLayerId}
										onSelectLayer={setSelectedLayerId}
										onUpdateLayer={handleUpdateLayer}
										onDeleteLayer={handleDeleteLayer}
										onDuplicateLayer={handleDuplicateLayer}
										onReplaceLayer={setReplacingLayerId}
										onCopyLayer={handleCopyLayer}
										onPasteLayer={handlePasteLayer}
										canvasSize={canvasSize}
										background={background}
										showSafeZone={showSafeZone}
										showDesignGrid={showDesignGrid}
										safeZoneRatio={safeZoneRatio}
									/>
								</div>
							</div>
						</button>

						{importState?.loading && (
							<div className='pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-background/80 p-8 backdrop-blur-sm animate-in fade-in-0 duration-200'>
								<div className='flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200'>
									<div className='relative flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary'>
										<Loader2 className='size-6 animate-spin' />
									</div>
									<div className='space-y-1'>
										<h3 className='text-sm font-semibold text-foreground'>
											{importState.title}
										</h3>
										<p className='text-xs text-muted-foreground'>
											Preparing canvas layers and palettes...
										</p>
									</div>
								</div>
							</div>
						)}

						{layers.length === 0 && !importState?.loading && (
							<div className='pointer-events-none absolute inset-0 flex items-center justify-center p-8'>
								<div className='pointer-events-auto w-full max-w-xs rounded-xl border bg-card/95 p-5 text-center shadow-lg backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-300 ease-out motion-reduce:animate-none'>
									<h3 className='text-sm font-semibold'>
										Your canvas is empty
									</h3>
									<p className='mt-1 text-xs text-muted-foreground'>
										Pick an icon or type a brand keyword on the left.
									</p>
									<div className='mt-4 space-y-2'>
										<Button
											type='button'
											size='sm'
											className='w-full'
											onClick={() =>
												copyToClipboard(
													buildAgentPrompt(window.location.href),
													'Starter prompt copied, paste it into your coding agent',
												)
											}
											data-track-click='logo_ai_agent_cta_click'
										>
											<Copy className='mr-2 h-4 w-4' />
											Let your AI agent design it
										</Button>
										<RandomizeControl
											onRandomize={handleRandomize}
											canvasSize={canvasSize}
										/>
										<p className='text-[11px] text-muted-foreground'>
											Agent not finding these tools? Most browsers need WebMCP
											enabled —{' '}
											<a
												href='https://www.google.com/search?q=how+to+enable+webmcp+support+in+browser'
												target='_blank'
												rel='noopener noreferrer'
												className='underline hover:text-foreground'
											>
												search how to enable it
											</a>
											.
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Right Sidebar - Layers & Properties */}
				<div className='w-80 border-l bg-card flex flex-col'>
					<RightSidebar
						layers={layers}
						selectedLayerId={selectedLayerId}
						onSelectLayer={setSelectedLayerId}
						onUpdateLayer={handleUpdateLayer}
						onDeleteLayer={handleDeleteLayer}
						setLayers={setLayers}
						background={background}
						setBackground={setBackground}
						canvasSize={canvasSize}
					/>
				</div>
			</div>
			{import.meta.env.DEV && <WebMcpDebugPanel />}
		</>
	);
}
