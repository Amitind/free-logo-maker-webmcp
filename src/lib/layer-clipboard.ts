// Clipboard utilities for layer operations
let clipboardLayer: Partial<LogoLayer> | null = null;

export interface LogoLayer {
	id: string;
	iconName: string;
	url: string;
	x: number;
	y: number;
	scale: number;
	scaleY?: number;
	rotation: number;
	fill: string;
	fillType?: 'solid' | 'linear' | 'radial';
	fillStops?: string[];
	fillPositions?: number[];
	fillAngle?: number;
	stroke: string;
	overwriteFill: boolean;
	overwriteStroke: boolean;
	opacity: number;
	visible: boolean;
	locked: boolean;
	shadowColor: string;
	shadowBlur: number;
	shadowOffsetX: number;
	shadowOffsetY: number;
	shadowOpacity: number;
}

/**
 * Copy layer properties to clipboard (excluding id, iconName, url, x, y)
 */
export function copyLayerToClipboard(layer: LogoLayer): void {
	const {
		id: _id,
		iconName: _iconName,
		url: _url,
		x: _x,
		y: _y,
		...properties
	} = layer;
	clipboardLayer = properties;
}

/**
 * Get the layer properties from clipboard
 */
export function getClipboardLayer(): Partial<LogoLayer> | null {
	return clipboardLayer;
}

/**
 * Check if clipboard has layer data
 */
export function hasClipboardData(): boolean {
	return clipboardLayer !== null;
}

/**
 * Clear clipboard
 */
export function clearClipboard(): void {
	clipboardLayer = null;
}
