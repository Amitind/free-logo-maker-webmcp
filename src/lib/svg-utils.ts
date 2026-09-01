import { createElement, type ReactElement, type ReactNode } from 'react';

export interface MutateSvgOptions {
	fill?: string | null;
	stroke?: string | null;
	strokeWidth?: number;
	strokeDasharray?: string | null;
	strokeLinecap?: 'round' | 'butt' | 'square';
	strokeLinejoin?: 'round' | 'bevel' | 'miter';
	overwriteFill?: boolean;
	overwriteStroke?: boolean;
	fillMap?: Record<string, string>;
	strokeMap?: Record<string, string>;
	forceFullSize?: boolean;
	stretch?: boolean;
	fillGradient?: {
		id: string;
		type: 'linear' | 'radial';
		stops: string[];
		positions?: number[];
		angle?: number;
	};
	/** When set, applies a CSS animation to elements matching `target` inside
	 * the SVG (or to the root `<svg>` if `target` is omitted). */
	animation?: {
		name: string;
		duration: number;
		target?: string;
		className?: string;
	};
}

// Top-level helper: mutate an SVG Document to apply color overrides
export function mutateSvgDocument(
	text: string,
	title: string,
	opts: MutateSvgOptions,
) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(text, 'image/svg+xml');
	const svgEl = doc.documentElement;
	if (svgEl.tagName.toLowerCase() !== 'svg') return doc;
	let titleEl: Element | null = svgEl.querySelector('title');
	if (!titleEl) {
		titleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'title');
		titleEl.textContent = title;
		svgEl.insertBefore(titleEl, svgEl.firstChild);
	} else {
		titleEl.textContent = title;
	}

	// Force SVG to fill container if requested
	if (opts.forceFullSize) {
		svgEl.setAttribute('width', '100%');
		svgEl.setAttribute('height', '100%');
	}
	if (opts.stretch) {
		svgEl.setAttribute('preserveAspectRatio', 'none');
	}

	const SVG_NS = 'http://www.w3.org/2000/svg';

	let effectiveFillPaint = opts.fill;

	if (opts.fillGradient && opts.overwriteFill) {
		const { id, type, stops, positions, angle } = opts.fillGradient;

		// Read root viewBox or fall back to width/height, then 0 0 24 24
		let vx = 0;
		let vy = 0;
		let vw = 24;
		let vh = 24;

		const viewBoxAttr = svgEl.getAttribute('viewBox');
		if (viewBoxAttr) {
			const parts = viewBoxAttr
				.trim()
				.split(/[\s,]+/)
				.map(Number);
			if (
				parts.length === 4 &&
				parts.every((p) => Number.isFinite(p)) &&
				parts[2] > 0 &&
				parts[3] > 0
			) {
				[vx, vy, vw, vh] = parts;
			}
		} else {
			const wAttr = parseFloat(svgEl.getAttribute('width') || '');
			const hAttr = parseFloat(svgEl.getAttribute('height') || '');
			if (
				Number.isFinite(wAttr) &&
				wAttr > 0 &&
				Number.isFinite(hAttr) &&
				hAttr > 0
			) {
				vx = 0;
				vy = 0;
				vw = wAttr;
				vh = hAttr;
			}
		}

		let gradEl: Element;

		if (type === 'radial') {
			gradEl = doc.createElementNS(SVG_NS, 'radialGradient');
			gradEl.setAttribute('id', id);
			gradEl.setAttribute('gradientUnits', 'userSpaceOnUse');
			const cx = vx + vw / 2;
			const cy = vy + vh / 2;
			const r = Math.hypot(vw, vh) / 2;
			gradEl.setAttribute('cx', String(cx));
			gradEl.setAttribute('cy', String(cy));
			gradEl.setAttribute('r', String(r));
			gradEl.setAttribute('fx', String(cx));
			gradEl.setAttribute('fy', String(cy));
		} else {
			gradEl = doc.createElementNS(SVG_NS, 'linearGradient');
			gradEl.setAttribute('id', id);
			gradEl.setAttribute('gradientUnits', 'userSpaceOnUse');
			const aDeg = angle ?? 90;
			const rad = (aDeg * Math.PI) / 180;
			const dx = Math.sin(rad);
			const dy = -Math.cos(rad);
			const cx = vx + vw / 2;
			const cy = vy + vh / 2;
			const halfL = (Math.abs(dx) * vw + Math.abs(dy) * vh) / 2;
			const x1 = cx - dx * halfL;
			const y1 = cy - dy * halfL;
			const x2 = cx + dx * halfL;
			const y2 = cy + dy * halfL;
			gradEl.setAttribute('x1', String(x1));
			gradEl.setAttribute('y1', String(y1));
			gradEl.setAttribute('x2', String(x2));
			gradEl.setAttribute('y2', String(y2));
		}

		const hasPositions =
			Array.isArray(positions) && positions.length === stops.length;
		stops.forEach((color, i) => {
			const stopEl = doc.createElementNS(SVG_NS, 'stop');
			const offset = hasPositions
				? positions[i]
				: stops.length > 1
					? Math.round((i / (stops.length - 1)) * 100)
					: 0;
			stopEl.setAttribute('offset', `${offset}%`);
			stopEl.setAttribute('stop-color', color);
			gradEl.appendChild(stopEl);
		});

		let defsEl = svgEl.querySelector('defs');
		if (!defsEl) {
			defsEl = doc.createElementNS(SVG_NS, 'defs');
			if (titleEl?.nextSibling) {
				svgEl.insertBefore(defsEl, titleEl.nextSibling);
			} else if (titleEl) {
				svgEl.appendChild(defsEl);
			} else {
				svgEl.insertBefore(defsEl, svgEl.firstChild);
			}
		}
		defsEl.appendChild(gradEl);

		effectiveFillPaint = `url(#${id})`;
	}

	const overwriteFill = !!opts.overwriteFill && !!opts.fill;
	const overwriteStroke = !!opts.overwriteStroke && !!opts.stroke;
	const applyTo = (
		el: Element,
		inheritedFill: string | null,
		inheritedStroke: string | null,
	) => {
		// Per-color mapping first
		if (opts.fillMap) {
			const cur = el.getAttribute('fill');
			if (cur && cur.toLowerCase() !== 'none' && cur in opts.fillMap) {
				const next = opts.fillMap[cur];
				if (next && next !== cur) el.setAttribute('fill', next);
			}
		}
		if (opts.strokeMap) {
			const curS = el.getAttribute('stroke');
			if (curS && curS.toLowerCase() !== 'none' && curS in opts.strokeMap) {
				const nextS = opts.strokeMap[curS];
				if (nextS && nextS !== curS) el.setAttribute('stroke', nextS);
			}
		}

		// Paint inheritance decides what an override may touch, so an icon
		// keeps the shape it had: a stroke-only icon (paths under a
		// `fill="none"` group) never gains a fill, and a fill-only icon never
		// gains an outline unless a stroke width was asked for.
		const ownFill = el.getAttribute('fill');
		const ownStroke = el.getAttribute('stroke');
		const effectiveFill = ownFill ?? inheritedFill;
		const effectiveStroke = ownStroke ?? inheritedStroke;

		if (overwriteFill && opts.fill) {
			// Fill defaults to black, so an undefined fill is still painted.
			if (effectiveFill?.toLowerCase() !== 'none' && effectiveFillPaint)
				el.setAttribute('fill', effectiveFillPaint);
		}
		if (overwriteStroke && opts.stroke) {
			const hasStroke =
				!!effectiveStroke && effectiveStroke.toLowerCase() !== 'none';
			const addsStroke = opts.strokeWidth !== undefined && opts.strokeWidth > 0;
			if (hasStroke || addsStroke) {
				el.setAttribute('stroke', opts.stroke);
				// Apply stroke width if provided
				if (addsStroke) {
					el.setAttribute('stroke-width', String(opts.strokeWidth));
				}
				if (opts.strokeDasharray && opts.strokeDasharray !== 'none') {
					el.setAttribute('stroke-dasharray', opts.strokeDasharray);
				}
				if (opts.strokeLinecap) {
					el.setAttribute('stroke-linecap', opts.strokeLinecap);
				}
				if (opts.strokeLinejoin) {
					el.setAttribute('stroke-linejoin', opts.strokeLinejoin);
				}
			}
		}

		return { fill: effectiveFill, stroke: effectiveStroke };
	};
	const walker = (
		node: Element,
		inheritedFill: string | null,
		inheritedStroke: string | null,
	): void => {
		if (node.tagName.toLowerCase() === 'defs') return;
		const inherited = applyTo(node, inheritedFill, inheritedStroke);
		for (const child of Array.from(node.children))
			walker(child as Element, inherited.fill, inherited.stroke);
	};
	walker(svgEl, null, null);

	// Apply targeted animation: inject an inline `style` attribute on each
	// element matched by the caller's CSS selector inside the parsed SVG.
	if (opts.animation?.target) {
		const { name, duration, target, className } = opts.animation;
		const animStyle = `animation: ${name} ${duration}s ease-in-out infinite`;
		try {
			const matches = svgEl.querySelectorAll(target);
			if (matches.length === 0) {
				console.warn(
					`[mutateSvgDocument] animationTarget "${target}" matched 0 elements: animation not applied.`,
				);
			}
			for (const el of Array.from(matches)) {
				if (className) {
					const existingClass = el.getAttribute('class');
					el.setAttribute(
						'class',
						existingClass ? `${existingClass} ${className}` : className,
					);
				} else {
					const existing = el.getAttribute('style') || '';
					el.setAttribute(
						'style',
						existing ? `${existing}; ${animStyle}` : animStyle,
					);
				}
			}
		} catch {
			console.warn(
				`[mutateSvgDocument] animationTarget "${target}" is not a valid CSS selector: animation not applied.`,
			);
		}
	}

	return doc;
}

// Serialize mutated SVG
export function buildSvgString(
	text: string,
	title: string,
	opts: MutateSvgOptions,
): string | null {
	try {
		const doc = mutateSvgDocument(text, title, opts);
		return new XMLSerializer().serializeToString(doc.documentElement);
	} catch {
		return null;
	}
}

// kebab-case inline `style` attribute -> a camelCase object, the shape React's
// `style` prop requires (a plain string throws a dev warning and is dropped).
function parseInlineStyle(styleAttr: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const decl of styleAttr.split(';')) {
		const idx = decl.indexOf(':');
		if (idx === -1) continue;
		const prop = decl.slice(0, idx).trim();
		const value = decl.slice(idx + 1).trim();
		if (!prop || !value) continue;
		result[prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] =
			value;
	}
	return result;
}

// React wants camelCase SVG props (strokeWidth, clipPath, xlinkHref) and
// warns "Invalid DOM property" for the kebab-case originals. data-* and
// aria-* stay as written.
function reactPropName(attrName: string): string {
	if (attrName.startsWith('data-') || attrName.startsWith('aria-')) {
		return attrName;
	}
	return attrName.replace(/[-:]([a-z])/g, (_, c: string) => c.toUpperCase());
}

function domNodeToReactElement(el: Element, key: string): ReactElement {
	const props: Record<string, unknown> = { key };
	for (const attr of Array.from(el.attributes)) {
		if (attr.name === 'style') {
			props.style = parseInlineStyle(attr.value);
		} else if (attr.name === 'class') {
			props.className = attr.value;
		} else {
			props[reactPropName(attr.name)] = attr.value;
		}
	}
	const children: ReactNode[] = [];
	el.childNodes.forEach((node, i) => {
		if (node.nodeType === 1) {
			children.push(domNodeToReactElement(node as Element, `${key}-${i}`));
		} else if (node.nodeType === 3 && node.textContent) {
			children.push(node.textContent);
		}
	});
	return createElement(el.tagName, props, ...children);
}

/**
 * Same mutation pipeline as `buildSvgString`, but returns a React element
 * tree built directly from the parsed DOM instead of a serialized string, so
 * callers can render it without `dangerouslySetInnerHTML`.
 */
export function mutateSvgToReactElement(
	text: string,
	title: string,
	opts: MutateSvgOptions,
): ReactElement | null {
	try {
		const doc = mutateSvgDocument(text, title, opts);
		const svgEl = doc.documentElement;
		if (svgEl.tagName.toLowerCase() !== 'svg') return null;
		return domNodeToReactElement(svgEl, 'svg-root');
	} catch {
		return null;
	}
}

// Extract existing fill & stroke values and counts (excluding 'none')
export function extractSvgPaintAttributes(text: string): {
	fills: Map<string, number>;
	strokes: Map<string, number>;
} {
	try {
		const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
		const svgEl = doc.documentElement;
		const fills = new Map<string, number>();
		const strokes = new Map<string, number>();
		const walk = (el: Element) => {
			const f = el.getAttribute('fill');
			if (f && f.toLowerCase() !== 'none')
				fills.set(f, (fills.get(f) || 0) + 1);
			const s = el.getAttribute('stroke');
			if (s && s.toLowerCase() !== 'none')
				strokes.set(s, (strokes.get(s) || 0) + 1);
			for (const child of Array.from(el.children)) walk(child as Element);
		};
		if (svgEl && svgEl.tagName.toLowerCase() === 'svg') walk(svgEl);
		return { fills, strokes };
	} catch {
		return { fills: new Map(), strokes: new Map() };
	}
}

// Non-paintable/structural tags a user would never want to individually
// animate: kept in sync with the tags `mutateSvgDocument` itself skips
// treating as visual "parts".
const NON_ANIMATABLE_TAGS = new Set(['title', 'defs', 'style']);

// Lists every element inside raw icon SVG markup a layer's animation could
// target, with a selector generated by the exact same rule
// `mutateSvgDocument`'s `opts.animation.target` matching relies on
// (`#id` when present, else `tagName:nth-of-type(n)`): verified against the
// same parsed document via `querySelectorAll` so the picker can never offer
// a selector that resolves to the wrong element or nothing at all.
export function getAnimatableTargets(
	svgMarkup: string,
): { label: string; selector: string }[] {
	let doc: Document;
	try {
		doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
	} catch {
		return [];
	}
	const svgEl = doc.documentElement;
	if (
		!svgEl ||
		svgEl.tagName.toLowerCase() !== 'svg' ||
		doc.querySelector('parsererror')
	)
		return [];

	const results: { label: string; selector: string }[] = [];
	const walk = (parent: Element) => {
		for (const child of Array.from(parent.children)) {
			const tag = child.tagName;
			if (NON_ANIMATABLE_TAGS.has(tag.toLowerCase())) continue;
			const id = child.getAttribute('id');
			let selector: string;
			let label: string;
			if (id) {
				selector = `#${id}`;
				label = `#${id}`;
			} else {
				const sameTagSiblings = Array.from(parent.children).filter(
					(sib) => sib.tagName === tag,
				);
				const index = sameTagSiblings.indexOf(child) + 1;
				selector = `${tag}:nth-of-type(${index})`;
				label = `${tag.toLowerCase()} ${index}`;
			}
			// Only offer a selector that actually resolves back to this exact
			// element, matching what mutateSvgDocument's querySelectorAll will do.
			if (Array.from(svgEl.querySelectorAll(selector)).includes(child)) {
				results.push({ label, selector });
			}
			walk(child);
		}
	};
	walk(svgEl);
	return results;
}

export const BLEND_MODES = [
	'normal',
	'multiply',
	'screen',
	'overlay',
	'darken',
	'lighten',
	'color-dodge',
	'color-burn',
	'hard-light',
	'soft-light',
	'difference',
	'exclusion',
] as const;

export type BlendMode = (typeof BLEND_MODES)[number];

export const ANIMATION_TYPES = [
	'none',
	'rotate',
	'float',
	'pulse',
	'sway',
	'custom',
] as const;

export type AnimationType = (typeof ANIMATION_TYPES)[number];

export interface LogoLayer {
	id: string;
	iconName: string;
	url: string;
	customSvg?: string;
	x: number;
	y: number;
	scale: number;
	/** Vertical scale multiplier. Unset means same as `scale` (square box). */
	scaleY?: number;
	rotation: number;
	fill: string;
	/** 'solid' (default) uses `fill`. 'linear' / 'radial' use fillStops instead. */
	fillType?: 'solid' | 'linear' | 'radial';
	/** Gradient colours in order, 2 or more. Only read when fillType is not solid. */
	fillStops?: string[];
	/** Stop offsets in percent, same length as fillStops. Omit for evenly spaced. */
	fillPositions?: number[];
	/** CSS linear-gradient angle in degrees: 0 = to top, 90 = to right. Default 90. */
	fillAngle?: number;
	stroke: string;
	strokeWidth?: number;
	strokeDasharray?: string;
	strokeLinecap?: 'round' | 'butt' | 'square';
	strokeLinejoin?: 'round' | 'bevel' | 'miter';
	overwriteFill: boolean;
	overwriteStroke: boolean;
	opacity: number;
	blendMode: BlendMode;
	animationType?: AnimationType;
	animationDuration?: number;
	animationTarget?: string;
	animationCustomKeyframes?: string;
	visible: boolean;
	locked: boolean;
	shadowColor: string;
	shadowBlur: number;
	shadowOffsetX: number;
	shadowOffsetY: number;
	shadowOpacity: number;
}

export type SplitLayout = 'halves' | 'thirds' | 'quadrant' | 'pinwheel';

/** Slots per layout. */
export const SPLIT_SLOTS: Record<SplitLayout, number> = {
	halves: 2,
	thirds: 3,
	quadrant: 4,
	pinwheel: 4,
};

export function splitColors(layout: SplitLayout, colors: string[]): string[] {
	const count = SPLIT_SLOTS[layout];
	const valid = colors.filter(Boolean);
	const pool = valid.length > 0 ? valid : ['#000000'];
	return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

export function splitIsHorizontal(direction: string): boolean {
	return direction === 'to bottom' || direction === 'to top';
}

export function splitCss(background: BackgroundConfig): string {
	const layout = background.splitLayout || 'halves';
	const colors = splitColors(layout, background.gradientColors);
	if (layout === 'quadrant') {
		return `conic-gradient(from 0deg at 50% 50%, ${colors[1]} 0% 25%, ${colors[2]} 25% 50%, ${colors[3]} 50% 75%, ${colors[0]} 75% 100%)`;
	}
	if (layout === 'pinwheel') {
		return `conic-gradient(from 315deg at 50% 50%, ${colors[0]} 0% 25%, ${colors[1]} 25% 50%, ${colors[2]} 50% 75%, ${colors[3]} 75% 100%)`;
	}
	const dir = splitIsHorizontal(background.gradientDirection)
		? 'to bottom'
		: 'to right';
	if (layout === 'thirds') {
		return `linear-gradient(${dir}, ${colors[0]} 0% 33.333%, ${colors[1]} 33.333% 66.667%, ${colors[2]} 66.667% 100%)`;
	}
	return `linear-gradient(${dir}, ${colors[0]} 0% 50%, ${colors[1]} 50% 100%)`;
}

export interface BackgroundConfig {
	type: 'solid' | 'gradient' | 'radial' | 'split';
	splitLayout?: SplitLayout;
	solidColor: string;
	gradientColors: string[];
	gradientPositions?: number[];
	gradientDirection: string;
	noise: number;
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
	shape: 'rectangle' | 'circle' | 'squircle';
	radialCenterX: number; // 0-100 percentage
	radialCenterY: number; // 0-100 percentage
	radialRadius: number; // 0-100 percentage
	borderWidth?: number;
	borderColor?: string;
	borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
}

import { getPatternSvgDef } from './pattern-utils';

export function sanitizeCssIdentifier(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function getLayerCustomAnimationName(layerId: string): string {
	return `logo-layer-custom-${sanitizeCssIdentifier(layerId)}`;
}

/**
 * Native SVG SMIL markup for one layer's looping motion, appended as a
 * direct child of that layer's `<g>` alongside its existing static
 * `transform` attribute. Uses `additive="sum"` so the animated function
 * composes onto the static transform instead of replacing it (mirrors the
 * live-canvas nested-wrapper fix in LogoCanvas.tsx, but here the two live on
 * the same element since SMIL transform composition allows it).
 *
 * `rotate`/`sway` pass an explicit `cx cy` pivot (the icon's own local
 * center) as part of the SMIL `rotate` value: that pivot is a fixed point
 * of the animated rotation, and everything downstream in the static
 * transform chain (centering translate, layer rotation, layer scale,
 * position translate) is a rigid, non-shearing map, so the fixed point
 * always lands exactly on the layer's on-screen center regardless of
 * composition order.
 *
 * `scale` has no such pivot parameter in SVG, so `pulse` instead wraps the
 * layer's children in three extra nested `<g>`s implementing the standard
 * translate-scale-translate-back trick around that same local center.
 */
function buildAnimateTransformMarkup(
	layer: LogoLayer,
	svgWidth: number,
	svgHeight: number,
	_scaleX: number,
	scaleY: number,
	childrenHTML: string,
): string {
	const type = layer.animationType;
	if (!type || type === 'none' || type === 'custom') return childrenHTML;
	const duration = layer.animationDuration || 2;
	const cx = svgWidth / 2;
	const cy = svgHeight / 2;

	if (type === 'rotate') {
		return `${childrenHTML}
			<animateTransform attributeName="transform" type="rotate" additive="sum" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${duration}s" repeatCount="indefinite" />`;
	}
	if (type === 'sway') {
		return `${childrenHTML}
			<animateTransform attributeName="transform" type="rotate" additive="sum" values="-3 ${cx} ${cy};3 ${cx} ${cy};-3 ${cx} ${cy}" keyTimes="0;0.5;1" dur="${duration}s" repeatCount="indefinite" />`;
	}
	if (type === 'float') {
		// The animated translate composes onto the static transform's own
		// `scale(scaleX, scaleY)` component (see buildLayerGroup), so a local
		// amplitude of `4 / scaleY` lands as ~4 on-screen px: matching
		// the live-canvas keyframe's fixed `translateY(-4px)`.
		const lift = 4 / scaleY;
		return `${childrenHTML}
			<animateTransform attributeName="transform" type="translate" additive="sum" values="0,0;0,${-lift};0,0" keyTimes="0;0.5;1" dur="${duration}s" repeatCount="indefinite" />`;
	}
	// pulse: scale has no pivot param, so pivot around the icon's own local
	// center via nested translate/scale/translate-back groups instead.
	return `<g transform="translate(${cx} ${cy})">
			<g>
				<animateTransform attributeName="transform" type="scale" values="1;1.04;1" keyTimes="0;0.5;1" dur="${duration}s" repeatCount="indefinite" />
				<g transform="translate(${-cx} ${-cy})">
					${childrenHTML}
				</g>
			</g>
		</g>`;
}

/**
 * Builds one layer's `<g>` element: fetches/colors its SVG, positions it via
 * the same translate/scale/rotate math LogoCanvas uses, and (when
 * `animated` is true and the layer has a non-'none' animationType) embeds
 * the native `<animateTransform>` markup from `buildAnimateTransformMarkup`.
 * Shared by `generateLogoSvg` (animated: false, unchanged default output)
 * and `generateAnimatedLogoSvg` (animated: true).
 */
async function buildLayerGroup(
	layer: LogoLayer,
	layerIndex: number,
	filters: string[],
	animated: boolean,
): Promise<string> {
	if (!layer.visible) return '';
	try {
		const customKeyframes = layer.animationCustomKeyframes?.trim();
		const isCustomAnimation =
			animated && layer.animationType === 'custom' && !!customKeyframes;
		const customAnimationName = getLayerCustomAnimationName(layer.id);
		const customAnimationClass = `logo-layer-custom-target-${sanitizeCssIdentifier(layer.id)}`;
		const text = layer.customSvg
			? layer.customSvg
			: await (await fetch(layer.url)).text();
		const colored = buildSvgString(text, layer.iconName, {
			fill: layer.fill,
			stroke: layer.stroke,
			strokeWidth: layer.strokeWidth,
			strokeDasharray: layer.strokeDasharray,
			strokeLinecap: layer.strokeLinecap,
			strokeLinejoin: layer.strokeLinejoin,
			overwriteFill: layer.overwriteFill,
			overwriteStroke: layer.overwriteStroke,
			fillGradient:
				layer.fillType &&
				layer.fillType !== 'solid' &&
				layer.fillStops &&
				layer.fillStops.length >= 2
					? {
							id: `fill-grad-${sanitizeCssIdentifier(layer.id)}`,
							type: layer.fillType,
							stops: layer.fillStops,
							positions: layer.fillPositions,
							angle: layer.fillAngle,
						}
					: undefined,
			forceFullSize: true,
			stretch: layer.scaleY !== undefined && layer.scaleY !== layer.scale,
			animation:
				isCustomAnimation && layer.animationTarget
					? {
							name: customAnimationName,
							duration: layer.animationDuration ?? 2,
							target: layer.animationTarget,
							className: customAnimationClass,
						}
					: undefined,
		});
		if (!colored) return '';

		// Parse the SVG to extract its content
		const parser = new DOMParser();
		const svgDoc = parser.parseFromString(colored, 'image/svg+xml');
		const svgEl = svgDoc.documentElement;

		// Extract viewBox for proper scaling
		const viewBox = svgEl.getAttribute('viewBox');
		let svgWidth = 100;
		let svgHeight = 100;
		if (viewBox) {
			const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
			svgWidth = vbWidth;
			svgHeight = vbHeight;
		}

		// Get all children of the SVG (paths, circles, etc.)
		const children = Array.from(svgEl.children);

		// Make IDs unique across layers. A layer's top-level children (e.g. a
		// customSvg's <defs> and its sibling <path>) are separate DOM nodes, so
		// a fill="url(#g)" reference on one child can point at an id defined on
		// another. Clone the whole set first and run one id-collection pass and
		// one reference-rewrite pass across ALL clones together, so a rename
		// made while processing one child is visible when rewriting another.
		const idPrefix = `layer-${layerIndex}`;
		const clones = children.map((child) => child.cloneNode(true) as Element);

		// Pass 1: collect every id in the combined set (each clone's own root
		// id, plus every [id] descendant) and build the old -> new id map.
		const idMap = new Map<string, string>();
		for (const clone of clones) {
			if (clone.id) idMap.set(clone.id, `${idPrefix}-${clone.id}`);
			clone.querySelectorAll('[id]').forEach((descendant) => {
				idMap.set(descendant.id, `${idPrefix}-${descendant.id}`);
			});
		}

		// Pass 2: apply the renames.
		for (const clone of clones) {
			const newRootId = idMap.get(clone.id);
			if (newRootId) clone.id = newRootId;
			clone.querySelectorAll('[id]').forEach((descendant) => {
				const newId = idMap.get(descendant.id);
				if (newId) descendant.id = newId;
			});
		}

		// Pass 3: rewrite url(#oldId) references anywhere in the combined set,
		// including on a top-level child's own tag (e.g. <path fill="url(#g)">
		// carries the reference directly, not on a nested descendant).
		const rewriteRefs = (el: Element) => {
			['fill', 'stroke', 'filter', 'clip-path', 'mask'].forEach((attr) => {
				const val = el.getAttribute(attr);
				if (!val) return;
				let newVal = val;
				idMap.forEach((newId, oldId) => {
					if (newVal.includes(`url(#${oldId})`)) {
						newVal = newVal.split(`url(#${oldId})`).join(`url(#${newId})`);
					}
				});
				if (newVal !== val) el.setAttribute(attr, newVal);
			});
		};
		for (const clone of clones) {
			rewriteRefs(clone);
			clone.querySelectorAll('*').forEach(rewriteRefs);
		}

		let childrenHTML = clones
			.map((clone) => new XMLSerializer().serializeToString(clone))
			.join('\n');

		// Match LogoCanvas logic:
		// Base size is 200
		// Scale the SVG to match the layer's scale
		const baseSize = 200;
		const denom = Math.max(svgWidth, svgHeight);
		const scaleX = (baseSize * layer.scale) / denom;
		const scaleY = (baseSize * (layer.scaleY ?? layer.scale)) / denom;

		if (animated) {
			childrenHTML = buildAnimateTransformMarkup(
				layer,
				svgWidth,
				svgHeight,
				scaleX,
				scaleY,
				childrenHTML,
			);
			if (isCustomAnimation) {
				const duration = layer.animationDuration || 2;
				const animationCss = `<style>
					@keyframes ${customAnimationName} { ${customKeyframes} }
					.${customAnimationClass} {
						animation: ${customAnimationName} ${duration}s ease-in-out infinite;
						transform-box: fill-box;
						transform-origin: center;
					}
				</style>`;
				childrenHTML = layer.animationTarget
					? `${animationCss}\n${childrenHTML}`
					: `${animationCss}\n<g class="${customAnimationClass}">${childrenHTML}</g>`;
			}
		}

		// Position: centered at layer.x, layer.y
		// Translate to position, then scale, then rotate
		const transforms = [
			`translate(${layer.x}, ${layer.y})`,
			`scale(${scaleX}, ${scaleY})`,
			`rotate(${layer.rotation})`,
			`translate(${-svgWidth / 2}, ${-svgHeight / 2})`,
		];

		// Handle Shadow
		let filterAttr = '';
		if (layer.shadowOpacity > 0) {
			const filterId = `shadow-${layerIndex}`;
			// CSS drop-shadow blur is roughly 2x stdDeviation
			// We must adjust the shadow parameters by the scale factor because
			// the filter is applied to the element before the scale transform.
			// In LogoCanvas, the shadow is applied to the sized div (pixels), so it doesn't scale with the content.
			// Here, we scale the content, so we must inverse-scale the shadow to keep it constant in pixels.
			const maxScale = Math.max(scaleX, scaleY);
			const stdDeviation =
				layer.shadowBlur === 0 ? 0 : layer.shadowBlur / 2 / maxScale;
			const dx = layer.shadowOffsetX / scaleX;
			const dy = layer.shadowOffsetY / scaleY;

			filters.push(`
				<filter id="${filterId}" x="-200%" y="-200%" width="500%" height="500%">
					<feDropShadow
						dx="${dx}"
						dy="${dy}"
						stdDeviation="${stdDeviation}"
						flood-color="${layer.shadowColor}"
						flood-opacity="${layer.shadowOpacity}"
					/>
				</filter>
			`);
			filterAttr = `filter="url(#${filterId})"`;
		}

		return `<g transform="${transforms.join(' ')}" opacity="${layer.opacity}" style="mix-blend-mode: ${layer.blendMode}" ${filterAttr}>
			${childrenHTML}
		</g>`;
	} catch {
		return '';
	}
}

/** Shared background/pattern/border/clip composition, wraps the already-built
 * per-layer `<g>` markup into the final `<svg>` document. Used by both
 * `generateLogoSvg` and `generateAnimatedLogoSvg`. */
function composeLogoSvg(
	layerContents: string[],
	filters: string[],
	canvasSize: { width: number; height: number },
	background: BackgroundConfig,
): string {
	// Generate background
	let bgRect = '';
	let patternRect = '';

	const hasCustomPositions =
		Array.isArray(background.gradientPositions) &&
		background.gradientPositions.length === background.gradientColors.length;

	if (background.type === 'solid') {
		bgRect = `<rect width="100%" height="100%" fill="${background.solidColor}" />`;
	} else if (background.type === 'radial') {
		const gradId = 'bg-radial';
		const stops = background.gradientColors
			.map((c, i) => {
				const offset = hasCustomPositions
					? (background.gradientPositions?.[i] ?? 0)
					: Math.round(
							(i / Math.max(background.gradientColors.length - 1, 1)) * 100,
						);
				return `<stop offset="${offset}%" stop-color="${c}" />`;
			})
			.join('');

		bgRect = `
			<defs>
				<radialGradient id="${gradId}" cx="${background.radialCenterX}%" cy="${background.radialCenterY}%" r="${background.radialRadius}%" fx="${background.radialCenterX}%" fy="${background.radialCenterY}%">
					${stops}
				</radialGradient>
			</defs>
			<rect width="100%" height="100%" fill="url(#${gradId})" />
		`;
	} else if (background.type === 'split') {
		const layout = background.splitLayout || 'halves';
		const colors = splitColors(layout, background.gradientColors);
		const W = canvasSize.width;
		const H = canvasSize.height;
		let shapes = '';

		if (layout === 'quadrant') {
			const halfW = W / 2;
			const halfH = H / 2;
			shapes = [
				`<rect x="0" y="0" width="${halfW}" height="${halfH}" fill="${colors[0]}" />`,
				`<rect x="${halfW}" y="0" width="${halfW}" height="${halfH}" fill="${colors[1]}" />`,
				`<rect x="${halfW}" y="${halfH}" width="${halfW}" height="${halfH}" fill="${colors[2]}" />`,
				`<rect x="0" y="${halfH}" width="${halfW}" height="${halfH}" fill="${colors[3]}" />`,
			].join('');
		} else if (layout === 'pinwheel') {
			const cx = W / 2;
			const cy = H / 2;
			shapes = [
				`<polygon points="0,0 ${W},0 ${cx},${cy}" fill="${colors[0]}" />`,
				`<polygon points="${W},0 ${W},${H} ${cx},${cy}" fill="${colors[1]}" />`,
				`<polygon points="${W},${H} 0,${H} ${cx},${cy}" fill="${colors[2]}" />`,
				`<polygon points="0,${H} 0,0 ${cx},${cy}" fill="${colors[3]}" />`,
			].join('');
		} else {
			const n = SPLIT_SLOTS[layout];
			const isHorizontal = splitIsHorizontal(background.gradientDirection);
			if (isHorizontal) {
				const bandH = H / n;
				shapes = colors
					.map(
						(c, i) =>
							`<rect x="0" y="${(i * H) / n}" width="${W}" height="${bandH}" fill="${c}" />`,
					)
					.join('');
			} else {
				const bandW = W / n;
				shapes = colors
					.map(
						(c, i) =>
							`<rect x="${(i * W) / n}" y="0" width="${bandW}" height="${H}" fill="${c}" />`,
					)
					.join('');
			}
		}

		bgRect = `<g shape-rendering="crispEdges">${shapes}</g>`;
	} else {
		// Linear gradient
		const gradId = 'bg-grad';
		const stops = background.gradientColors
			.map((c, i) => {
				const offset = hasCustomPositions
					? (background.gradientPositions?.[i] ?? 0)
					: Math.round(
							(i / Math.max(background.gradientColors.length - 1, 1)) * 100,
						);
				return `<stop offset="${offset}%" stop-color="${c}" />`;
			})
			.join('');

		let x1 = '0%';
		let y1 = '0%';
		let x2 = '100%';
		let y2 = '0%';

		const dir = background.gradientDirection;
		if (dir === 'to top') {
			x1 = '0%';
			y1 = '100%';
			x2 = '0%';
			y2 = '0%';
		} else if (dir === 'to top right') {
			x1 = '0%';
			y1 = '100%';
			x2 = '100%';
			y2 = '0%';
		} else if (dir === 'to right') {
			x1 = '0%';
			y1 = '0%';
			x2 = '100%';
			y2 = '0%';
		} else if (dir === 'to bottom right') {
			x1 = '0%';
			y1 = '0%';
			x2 = '100%';
			y2 = '100%';
		} else if (dir === 'to bottom') {
			x1 = '0%';
			y1 = '0%';
			x2 = '0%';
			y2 = '100%';
		} else if (dir === 'to bottom left') {
			x1 = '100%';
			y1 = '0%';
			x2 = '0%';
			y2 = '100%';
		} else if (dir === 'to left') {
			x1 = '100%';
			y1 = '0%';
			x2 = '0%';
			y2 = '0%';
		} else if (dir === 'to top left') {
			x1 = '100%';
			y1 = '100%';
			x2 = '0%';
			y2 = '0%';
		}

		bgRect = `
            <defs>
                <linearGradient id="${gradId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
                    ${stops}
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#${gradId})" />
        `;
	}

	// Pattern overlay
	if (background.pattern !== 'none') {
		const patternId = 'bg-pattern';
		const patternDef = getPatternSvgDef(
			background.pattern,
			background.patternColor,
			patternId,
		);

		if (patternDef) {
			patternRect = `
				<defs>
					${patternDef}
				</defs>
				<rect width="100%" height="100%" fill="url(#${patternId})" opacity="${background.patternOpacity}" />
			`;
		}
	}

	// Outline / Border on container
	let borderOverlay = '';
	const bWidth = background.borderWidth ?? 0;
	const bColor = background.borderColor || '#ffffff';
	const bStyle = background.borderStyle || 'solid';
	const bDash =
		bStyle === 'dashed'
			? `${bWidth * 2} ${bWidth * 1.5}`
			: bStyle === 'dotted'
				? `${bWidth} ${bWidth * 1.5}`
				: 'none';

	// Clip Path for Border Radius / Shape
	let clipPathDef = '';
	let clipAttr = '';

	const clipId = 'clip-shape';
	const w = canvasSize.width;
	const h = canvasSize.height;

	if (background.shape === 'squircle') {
		const path = `M ${w * 0.5},0 C ${w * 0.1},0 0,${h * 0.1} 0,${h * 0.5} C 0,${h * 0.9} ${w * 0.1},${h} ${w * 0.5},${h} C ${w * 0.9},${h} ${w},${h * 0.9} ${w},${h * 0.5} C ${w},${h * 0.1} ${w * 0.9},0 ${w * 0.5},0 Z`;

		clipPathDef = `
			<defs>
				<clipPath id="${clipId}">
					<path d="${path}" />
				</clipPath>
			</defs>
		`;
		clipAttr = `clip-path="url(#${clipId})"`;

		if (bWidth > 0) {
			borderOverlay = `<path d="${path}" fill="none" stroke="${bColor}" stroke-width="${bWidth * 2}" ${bDash !== 'none' ? `stroke-dasharray="${bDash}"` : ''} />`;
		}
	} else if (background.borderRadius > 0 || background.shape === 'circle') {
		const rx =
			background.shape === 'circle' ? '50%' : `${background.borderRadius}px`;
		clipPathDef = `
            <defs>
                <clipPath id="${clipId}">
                    <rect width="100%" height="100%" rx="${rx}" ry="${rx}" />
                </clipPath>
            </defs>
        `;
		clipAttr = `clip-path="url(#${clipId})"`;

		if (bWidth > 0) {
			borderOverlay = `<rect width="100%" height="100%" rx="${rx}" ry="${rx}" fill="none" stroke="${bColor}" stroke-width="${bWidth * 2}" ${bDash !== 'none' ? `stroke-dasharray="${bDash}"` : ''} />`;
		}
	} else if (bWidth > 0) {
		borderOverlay = `<rect width="100%" height="100%" fill="none" stroke="${bColor}" stroke-width="${bWidth * 2}" ${bDash !== 'none' ? `stroke-dasharray="${bDash}"` : ''} />`;
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize.width}" height="${canvasSize.height}" viewBox="0 0 ${canvasSize.width} ${canvasSize.height}">
        ${clipPathDef}
		<defs>
			${filters.join('\n')}
		</defs>
        <g ${clipAttr}>
            ${bgRect}
			${patternRect}
            ${layerContents.join('\n')}
			${borderOverlay}
        </g>
    </svg>`;
}

/** Static-frame export (default tier): one frame, no animation markup. */
export async function generateLogoSvg(
	layers: LogoLayer[],
	canvasSize: { width: number; height: number },
	background: BackgroundConfig,
): Promise<string> {
	const filters: string[] = [];
	const layerContents = await Promise.all(
		layers.map((layer, layerIndex) =>
			buildLayerGroup(layer, layerIndex, filters, false),
		),
	);
	return composeLogoSvg(layerContents, filters, canvasSize, background);
}

/**
 * Same composition as `generateLogoSvg`, but each animated layer's `<g>`
 * additionally carries native SMIL `<animateTransform>` markup (see
 * `buildAnimateTransformMarkup`) so the exported file animates on its own
 * when opened in a browser: no JS or CSS dependency, fully self-contained.
 */
export async function generateAnimatedLogoSvg(
	layers: LogoLayer[],
	canvasSize: { width: number; height: number },
	background: BackgroundConfig,
): Promise<string> {
	const filters: string[] = [];
	const layerContents = await Promise.all(
		layers.map((layer, layerIndex) =>
			buildLayerGroup(layer, layerIndex, filters, true),
		),
	);
	return composeLogoSvg(layerContents, filters, canvasSize, background);
}

/**
 * Rasterizes an SVG string to a PNG data URI, client-side (Image -> canvas ->
 * toDataURL), the same approach `ExportPanel.tsx`'s PNG download uses. Scales
 * down to fit within `maxDim` on the longer side: callers that need a cheap
 * preview (e.g. the `get_logo_preview` WebMCP tool) should pass a small value
 * rather than rasterizing at full canvas resolution.
 */
export function svgToPngDataUri(
	svgString: string,
	canvasSize: { width: number; height: number },
	maxDim = 256,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const blob = new Blob([svgString], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);

		img.onload = () => {
			try {
				const scale = Math.min(
					1,
					maxDim / Math.max(canvasSize.width, canvasSize.height),
				);
				const canvas = document.createElement('canvas');
				canvas.width = Math.max(1, Math.round(canvasSize.width * scale));
				canvas.height = Math.max(1, Math.round(canvasSize.height * scale));
				const ctx = canvas.getContext('2d');
				if (!ctx) throw new Error('Canvas 2D context unavailable.');
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL('image/png'));
			} catch (err) {
				reject(
					err instanceof Error ? err : new Error('PNG rasterization failed.'),
				);
			} finally {
				URL.revokeObjectURL(url);
			}
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load SVG for rasterization.'));
		};
		img.src = url;
	});
}

/** sRGB -> linear-light channel, per the WCAG relative luminance formula. */
function srgbChannelToLinear(value255: number): number {
	const c = value255 / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Parses a `#rgb` or `#rrggbb` hex color. Returns null for anything else
 * (named CSS colors, `none`, gradients): this contrast check is a loose
 * legibility heuristic, not a full color-parsing engine. */
export function hexToRgb(hex: string): [number, number, number] | null {
	const clean = hex.trim().replace(/^#/, '');
	if (clean.length !== 3 && clean.length !== 6) return null;
	const full =
		clean.length === 3
			? clean
					.split('')
					.map((c) => c + c)
					.join('')
			: clean;
	const num = Number.parseInt(full, 16);
	if (Number.isNaN(num)) return null;
	return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** WCAG relative luminance (0-1), or null if `hex` isn't a parseable hex color. */
export function relativeLuminance(hex: string): number | null {
	const rgb = hexToRgb(hex);
	if (!rgb) return null;
	const [r, g, b] = rgb.map(srgbChannelToLinear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG-style contrast ratio between two colors (1 = identical, 21 = max).
 * Returns null when either color isn't a parseable hex value.
 */
export function contrastRatio(hexA: string, hexB: string): number | null {
	const lumA = relativeLuminance(hexA);
	const lumB = relativeLuminance(hexB);
	if (lumA === null || lumB === null) return null;
	const lighter = Math.max(lumA, lumB);
	const darker = Math.min(lumA, lumB);
	return (lighter + 0.05) / (darker + 0.05);
}

/** Rasterizes an SVG string to raw RGBA pixel data, same Image -> canvas
 * technique as `svgToPngDataUri`, but returns `ImageData` for GIF frame
 * encoding instead of a data URI. */
function svgToImageData(
	svgString: string,
	canvasSize: { width: number; height: number },
): Promise<ImageData> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const blob = new Blob([svgString], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);

		img.onload = () => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = canvasSize.width;
				canvas.height = canvasSize.height;
				const ctx = canvas.getContext('2d');
				if (!ctx) throw new Error('Canvas 2D context unavailable.');
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
			} catch (err) {
				reject(err instanceof Error ? err : new Error('Rasterization failed.'));
			} finally {
				URL.revokeObjectURL(url);
			}
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load SVG for rasterization.'));
		};
		img.src = url;
	});
}

// Frame count for the GIF export loop: enough for a smooth "minor motion"
// loop without over-engineering into a configurable frame rate.
const GIF_FRAME_COUNT = 24;

/**
 * Renders one full animation loop to an animated GIF: N static frames, each
 * built via `generateLogoSvg` with animated layers' x/y/scale/rotation
 * temporarily nudged to that frame's interpolated offset (same oscillation
 * shapes as the live CSS keyframes / SMIL markup, sampled directly rather
 * than reusing the SVG DOM), rasterized to raw pixels, and encoded with
 * `gifenc`. One shared loop duration (the longest animated layer's
 * `animationDuration`) is used so every layer completes a whole number of
 * its own cycles within it.
 */
export async function exportLogoGif(
	layers: LogoLayer[],
	canvasSize: { width: number; height: number },
	background: BackgroundConfig,
): Promise<Blob> {
	const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

	const animatedLayers = layers.filter(
		(layer) =>
			layer.visible && layer.animationType && layer.animationType !== 'none',
	);
	const loopDuration =
		animatedLayers.length > 0
			? Math.max(...animatedLayers.map((layer) => layer.animationDuration || 2))
			: 2;
	const delayMs = Math.round((loopDuration * 1000) / GIF_FRAME_COUNT);

	const gif = GIFEncoder();

	for (let frame = 0; frame < GIF_FRAME_COUNT; frame++) {
		const elapsed = (frame / GIF_FRAME_COUNT) * loopDuration;
		const frameLayers = layers.map((layer) => {
			const type = layer.animationType;
			if (!layer.visible || !type || type === 'none') return layer;
			const duration = layer.animationDuration || 2;
			const phase = (elapsed % duration) / duration; // 0..1 within this layer's own cycle
			switch (type) {
				case 'rotate':
					return { ...layer, rotation: layer.rotation + phase * 360 };
				case 'sway':
					return {
						...layer,
						rotation: layer.rotation - 3 * Math.cos(2 * Math.PI * phase),
					};
				case 'pulse': {
					const factor = 1 + 0.02 * (1 - Math.cos(2 * Math.PI * phase));
					return {
						...layer,
						scale: layer.scale * factor,
						scaleY:
							layer.scaleY !== undefined ? layer.scaleY * factor : undefined,
					};
				}
				case 'float':
					return {
						...layer,
						y: layer.y - 2 * (1 - Math.cos(2 * Math.PI * phase)),
					};
				default:
					return layer;
			}
		});

		const svgString = await generateLogoSvg(
			frameLayers,
			canvasSize,
			background,
		);
		const { data } = await svgToImageData(svgString, canvasSize);
		const palette = quantize(data, 256);
		const index = applyPalette(data, palette);
		gif.writeFrame(index, canvasSize.width, canvasSize.height, {
			palette,
			delay: delayMs,
		});
	}

	gif.finish();
	// gif.bytes() types as Uint8Array<ArrayBufferLike>, which TS's DOM lib
	// doesn't accept as a BlobPart (it wants ArrayBufferView<ArrayBuffer>) :
	// a real runtime Uint8Array works fine in a Blob, so cast through unknown.
	return new Blob([gif.bytes() as unknown as BlobPart], { type: 'image/gif' });
}
