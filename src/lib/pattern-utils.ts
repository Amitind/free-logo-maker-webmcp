/**
 * Generates SVG pattern definitions for all pattern types
 * This utility is used in both LogoCanvas (for preview) and svg-utils (for export)
 */

export type PatternType =
	| 'none'
	| 'grid'
	| 'dots'
	| 'checker'
	| 'lines'
	| 'diagonal'
	| 'circles'
	| 'zigzag';

export interface PatternStyle {
	backgroundImage: string;
	backgroundSize: string;
	backgroundPosition: string;
}

/**
 * Scale the px lengths in a background-size / background-position value.
 * Used only by small previews that need the tile to repeat a few times.
 */
function scaleLengths(value: string, scale: number): string {
	if (scale === 1) {
		return value;
	}
	return value.replace(/(-?\d*\.?\d+)px/g, (_match, raw: string) => {
		const scaled = Number(raw) * scale;
		// 2px floor: below that a 1px stripe fills its own tile and the
		// pattern collapses into a solid block.
		return `${scaled > 0 ? Math.max(2, scaled) : scaled}px`;
	});
}

/**
 * Generate CSS background pattern style for canvas preview.
 * `scale` shrinks the tile only (default 1 keeps the canvas size).
 */
export function getPatternStyle(
	pattern: PatternType,
	color: string,
	scale = 1,
): PatternStyle {
	const style = buildPatternStyle(pattern, color);
	if (scale === 1) {
		return style;
	}
	return {
		...style,
		backgroundSize: scaleLengths(style.backgroundSize, scale),
		backgroundPosition: scaleLengths(style.backgroundPosition, scale),
	};
}

function buildPatternStyle(pattern: PatternType, color: string): PatternStyle {
	const baseStyle: PatternStyle = {
		backgroundImage: 'none',
		backgroundSize: '40px 40px',
		backgroundPosition: '0 0',
	};

	if (pattern === 'none') {
		return baseStyle;
	}

	if (pattern === 'grid') {
		return {
			backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
			backgroundSize: '40px 40px',
			backgroundPosition: '0 0',
		};
	}

	if (pattern === 'dots') {
		return {
			backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`,
			backgroundSize: '20px 20px',
			backgroundPosition: '0 0',
		};
	}

	if (pattern === 'checker') {
		return {
			backgroundImage: `linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%, ${color}), linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%, ${color})`,
			backgroundSize: '20px 20px',
			backgroundPosition: '0 0, 10px 10px',
		};
	}

	if (pattern === 'lines') {
		return {
			backgroundImage: `linear-gradient(0deg, ${color} 1px, transparent 1px)`,
			backgroundSize: '100% 2px',
			backgroundPosition: '0 0',
		};
	}

	if (pattern === 'diagonal') {
		return {
			backgroundImage: `linear-gradient(45deg, ${color} 1px, transparent 1px), linear-gradient(-45deg, ${color} 1px, transparent 1px)`,
			backgroundSize: '20px 20px',
			backgroundPosition: '0 0',
		};
	}

	if (pattern === 'circles') {
		return {
			backgroundImage: `radial-gradient(circle, transparent 40%, ${color} 50%, transparent 60%)`,
			backgroundSize: '30px 30px',
			backgroundPosition: '0 0',
		};
	}

	if (pattern === 'zigzag') {
		return {
			backgroundImage: `linear-gradient(45deg, ${color} 12.5%, transparent 12.5%, transparent 50%), linear-gradient(-45deg, ${color} 12.5%, transparent 12.5%, transparent 50%)`,
			backgroundSize: '20px 20px',
			backgroundPosition: '0 0, 10px 10px',
		};
	}

	return baseStyle;
}

/**
 * Generate SVG pattern definition for export
 */
export function getPatternSvgDef(
	pattern: PatternType,
	color: string,
	patternId: string,
): string {
	if (pattern === 'none') {
		return '';
	}

	if (pattern === 'grid') {
		return `
			<pattern id="${patternId}" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
				<path d="M 40 0 L 0 0 0 40" fill="none" stroke="${color}" stroke-width="1"/>
			</pattern>
		`;
	}

	if (pattern === 'dots') {
		return `
			<pattern id="${patternId}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
				<circle cx="10" cy="10" r="1" fill="${color}" />
			</pattern>
		`;
	}

	if (pattern === 'checker') {
		return `
			<pattern id="${patternId}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
				<rect x="0" y="0" width="10" height="10" fill="${color}" />
				<rect x="10" y="10" width="10" height="10" fill="${color}" />
			</pattern>
		`;
	}

	if (pattern === 'lines') {
		return `
			<pattern id="${patternId}" x="0" y="0" width="100%" height="2" patternUnits="userSpaceOnUse">
				<line x1="0" y1="0" x2="100%" y2="0" stroke="${color}" stroke-width="1" />
			</pattern>
		`;
	}

	if (pattern === 'diagonal') {
		return `
			<pattern id="${patternId}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
				<line x1="0" y1="0" x2="20" y2="20" stroke="${color}" stroke-width="1" />
				<line x1="20" y1="0" x2="0" y2="20" stroke="${color}" stroke-width="1" />
			</pattern>
		`;
	}

	if (pattern === 'circles') {
		return `
			<pattern id="${patternId}" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
				<circle cx="15" cy="15" r="10" fill="none" stroke="${color}" stroke-width="1" />
			</pattern>
		`;
	}

	if (pattern === 'zigzag') {
		return `
			<pattern id="${patternId}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
				<polyline points="0,10 10,0 20,10" fill="none" stroke="${color}" stroke-width="1" />
				<polyline points="0,20 10,30 20,20" fill="none" stroke="${color}" stroke-width="1" />
			</pattern>
		`;
	}

	return '';
}
