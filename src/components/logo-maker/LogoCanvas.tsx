import { Copy, RefreshCw, Trash2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { getPatternStyle } from '@/lib/pattern-utils';
import {
	getLayerCustomAnimationName,
	mutateSvgToReactElement,
	sanitizeCssIdentifier,
	splitCss,
} from '@/lib/svg-utils';
import type { BackgroundConfig, LogoLayer } from '../LogoMaker';

interface LogoCanvasProps {
	layers: LogoLayer[];
	selectedLayerId: string | null;
	onSelectLayer: (id: string | null) => void;
	onUpdateLayer: (id: string, updates: Partial<LogoLayer>) => void;
	onDeleteLayer: (id: string) => void;
	onDuplicateLayer: (id: string) => void;
	onReplaceLayer: (id: string) => void;
	onCopyLayer: (id: string) => void;
	onPasteLayer: (id: string) => void;
	canvasSize: { width: number; height: number };
	background: BackgroundConfig;
	showSafeZone?: boolean;
	showDesignGrid?: boolean;
	safeZoneRatio?: number;
}

// Practical "how big the logo can go" guide (storelit.co/blog/app-icon-safe-zones-practical-guide).
// Not user-configurable: safeZoneRatio only controls the inner critical-zone circle.
const LOGO_EXTENT_RATIO = 0.75;
const DESIGN_GRID_INSET_RATIO = 0.66;
const DESIGN_GRID_SMALL_CIRCLE_RATIO = 0.36;

function hexToRgba(hex: string, alpha: number) {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function LogoCanvas({
	layers,
	selectedLayerId,
	onSelectLayer,
	onUpdateLayer,
	onDeleteLayer,
	onDuplicateLayer,
	onReplaceLayer,
	onCopyLayer,
	onPasteLayer,
	canvasSize,
	background,
	showSafeZone = false,
	showDesignGrid = false,
	safeZoneRatio = 0.66,
}: LogoCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });
	const [guidelines, setGuidelines] = useState<{
		x: number | null;
		y: number | null;
	}>({ x: null, y: null });

	// Helper to fetch SVG content for layers if needed, but for now we might rely on LazySvg or fetch them.
	// Actually, to render them in a single SVG for export, we need the content.
	// For the canvas editor, we can render them as individual HTML elements (imgs or inline svgs) absolutely positioned.
	// Using inline SVGs allows us to color them easily.

	// We need the SVG content for each layer to apply colors.
	// Track both a cache key (the custom markup itself, or the URL it came
	// from when there's no custom override) and the resolved content, so a
	// change to either triggers a re-render the same way.
	const [layerSvgs, setLayerSvgs] = useState<
		Record<string, { key: string; content: string }>
	>({});

	useEffect(() => {
		layers.forEach((layer) => {
			const cacheKey = layer.customSvg
				? `custom:${layer.customSvg}`
				: layer.url;
			const cached = layerSvgs[layer.id];
			if (cached?.key === cacheKey) return;

			// customSvg takes precedence over fetching layer.url: populate the
			// cache directly from the markup string, no network round-trip.
			if (layer.customSvg) {
				setLayerSvgs((prev) => ({
					...prev,
					[layer.id]: { key: cacheKey, content: layer.customSvg as string },
				}));
				return;
			}

			fetch(layer.url)
				.then((res) => {
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					return res.text();
				})
				.then((text) => {
					if (!text.includes('<svg')) {
						throw new Error('Invalid SVG format');
					}
					setLayerSvgs((prev) => ({
						...prev,
						[layer.id]: { key: cacheKey, content: text },
					}));
				})
				.catch((err) => {
					console.warn(`Layer SVG load fallback for ${layer.iconName}:`, err);
					const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
					setLayerSvgs((prev) => ({
						...prev,
						[layer.id]: { key: cacheKey, content: fallbackSvg },
					}));
				});
		});
	}, [layers, layerSvgs]);

	const handleMouseDown = (e: React.MouseEvent, layerId: string) => {
		e.stopPropagation();
		onSelectLayer(layerId);
		const layer = layers.find((l) => l.id === layerId);
		if (!layer || layer.locked) return;

		setDragging(true);
		setDragStart({ x: e.clientX, y: e.clientY });
		setInitialPos({ x: layer.x, y: layer.y });
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (dragging && selectedLayerId) {
			const dx = e.clientX - dragStart.x;
			const dy = e.clientY - dragStart.y;

			let newX = initialPos.x + dx;
			let newY = initialPos.y + dy;

			// Snapping logic
			const centerX = canvasSize.width / 2;
			const centerY = canvasSize.height / 2;
			const threshold = 10;

			let snapX = null;
			let snapY = null;

			if (Math.abs(newX - centerX) < threshold) {
				newX = centerX;
				snapX = centerX;
			}

			if (Math.abs(newY - centerY) < threshold) {
				newY = centerY;
				snapY = centerY;
			}

			setGuidelines({ x: snapX, y: snapY });

			onUpdateLayer(selectedLayerId, {
				x: newX,
				y: newY,
			});
		}
	};

	const handleMouseUp = () => {
		setDragging(false);
		setGuidelines({ x: null, y: null });
	};

	const hasCustomPositions =
		Array.isArray(background.gradientPositions) &&
		background.gradientPositions.length === background.gradientColors.length;

	const gradientStopsCss = background.gradientColors
		.map((color, i) => {
			const pos = hasCustomPositions
				? (background.gradientPositions?.[i] ?? 0)
				: Math.round(
						(i / Math.max(background.gradientColors.length - 1, 1)) * 100,
					);
			return `${color} ${pos}%`;
		})
		.join(', ');

	const bWidth = background.borderWidth ?? 0;
	const bColor = background.borderColor || '#ffffff';
	const bStyle = background.borderStyle || 'solid';
	const bDash =
		bStyle === 'dashed'
			? `${bWidth * 2} ${bWidth * 1.5}`
			: bStyle === 'dotted'
				? `${bWidth} ${bWidth * 1.5}`
				: 'none';

	return (
		// biome-ignore lint/a11y/useSemanticElements: canvas needs pointer positioning and drag/click handling a <button> can't host.
		<div
			ref={containerRef}
			role='button'
			tabIndex={0}
			aria-label='Logo canvas. Press Enter or Space to deselect the current layer.'
			className='bg-white shadow-lg relative overflow-hidden'
			style={{
				width: canvasSize.width,
				height: canvasSize.height,
				background:
					background.type === 'solid'
						? background.solidColor
						: background.type === 'radial'
							? `radial-gradient(circle at ${background.radialCenterX}% ${background.radialCenterY}%, ${gradientStopsCss})`
							: background.type === 'split'
								? splitCss(background)
								: `linear-gradient(${background.gradientDirection}, ${gradientStopsCss})`,
				borderRadius:
					background.shape === 'circle'
						? '50%'
						: background.shape === 'squircle'
							? '0'
							: `${background.borderRadius}px`,
				border:
					bWidth > 0 && background.shape !== 'squircle'
						? `${bWidth}px ${bStyle} ${bColor}`
						: undefined,
				clipPath:
					background.shape === 'squircle'
						? `path('M ${canvasSize.width * 0.5},0 C ${canvasSize.width * 0.1},0 0,${canvasSize.height * 0.1} 0,${canvasSize.height * 0.5} C 0,${canvasSize.height * 0.9} ${canvasSize.width * 0.1},${canvasSize.height} ${canvasSize.width * 0.5},${canvasSize.height} C ${canvasSize.width * 0.9},${canvasSize.height} ${canvasSize.width},${canvasSize.height * 0.9} ${canvasSize.width},${canvasSize.height * 0.5} C ${canvasSize.width},${canvasSize.height * 0.1} ${canvasSize.width * 0.9},0 ${canvasSize.width * 0.5},0 Z')`
						: undefined,
			}}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onClick={(e) => {
				const target = e.target as HTMLElement;
				if (target === e.currentTarget) {
					onSelectLayer(null);
				}
			}}
			onKeyDown={(e) => {
				if (e.target !== e.currentTarget) return;
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onSelectLayer(null);
				}
			}}
		>
			{background.pattern !== 'none' && (
				<div
					className='absolute inset-0 pointer-events-none z-0'
					style={{
						opacity: background.patternOpacity,
						...getPatternStyle(background.pattern, background.patternColor),
					}}
				/>
			)}

			{/* Squircle Border Outline if applicable */}
			{bWidth > 0 && background.shape === 'squircle' && (
				<svg
					className='absolute inset-0 pointer-events-none z-10 overflow-visible'
					width={canvasSize.width}
					height={canvasSize.height}
					viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
					aria-hidden='true'
				>
					<path
						d={`M ${canvasSize.width * 0.5},0 C ${canvasSize.width * 0.1},0 0,${canvasSize.height * 0.1} 0,${canvasSize.height * 0.5} C 0,${canvasSize.height * 0.9} ${canvasSize.width * 0.1},${canvasSize.height} ${canvasSize.width * 0.5},${canvasSize.height} C ${canvasSize.width * 0.9},${canvasSize.height} ${canvasSize.width},${canvasSize.height * 0.9} ${canvasSize.width},${canvasSize.height * 0.5} C ${canvasSize.width},${canvasSize.height * 0.1} ${canvasSize.width * 0.9},0 ${canvasSize.width * 0.5},0 Z`}
						fill='none'
						stroke={bColor}
						strokeWidth={bWidth * 2}
						strokeDasharray={bDash !== 'none' ? bDash : undefined}
					/>
				</svg>
			)}

			{/* Guidelines */}
			{guidelines.x !== null && (
				<div
					className='absolute top-0 bottom-0 w-px bg-primary z-50 pointer-events-none'
					style={{ left: guidelines.x }}
				/>
			)}
			{guidelines.y !== null && (
				<div
					className='absolute left-0 right-0 h-px bg-primary z-50 pointer-events-none'
					style={{ top: guidelines.y }}
				/>
			)}

			{showSafeZone && (
				<svg
					className='absolute inset-0 pointer-events-none z-20 overflow-visible select-none'
					width={canvasSize.width}
					height={canvasSize.height}
					viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
					aria-hidden='true'
				>
					<title>
						Safe zone guides: 75% practical logo extent, 61% Android critical
						zone
					</title>
					{/* Center crosshairs */}
					<line
						x1={canvasSize.width / 2}
						y1='0'
						x2={canvasSize.width / 2}
						y2={canvasSize.height}
						stroke='#fff'
						strokeOpacity='0.5'
						strokeWidth='1'
						strokeDasharray='1 4'
						strokeLinecap='round'
					/>
					<line
						x1='0'
						y1={canvasSize.height / 2}
						x2={canvasSize.width}
						y2={canvasSize.height / 2}
						stroke='#fff'
						strokeOpacity='0.5'
						strokeWidth='1'
						strokeDasharray='1 4'
						strokeLinecap='round'
					/>
					{/* Outer guide: practical logo extent, not user-configurable */}
					<circle
						cx={canvasSize.width / 2}
						cy={canvasSize.height / 2}
						r={(canvasSize.width * LOGO_EXTENT_RATIO) / 2}
						fill='none'
						stroke='#fff'
						strokeOpacity='0.6'
						strokeWidth='1.5'
						strokeDasharray='1 4'
						strokeLinecap='round'
					/>
					<text
						x={canvasSize.width / 2}
						y={
							canvasSize.height / 2 -
							(canvasSize.width * LOGO_EXTENT_RATIO) / 2 -
							8
						}
						textAnchor='middle'
						fill='#fff'
						fillOpacity='0.75'
						fontSize='10'
						fontFamily='ui-monospace, monospace'
						fontWeight='600'
					>
						{Math.round(LOGO_EXTENT_RATIO * 100)}% LOGO
					</text>
					{/* Inner guide: critical details, user-configurable via safeZoneRatio */}
					<circle
						cx={canvasSize.width / 2}
						cy={canvasSize.height / 2}
						r={(canvasSize.width * (safeZoneRatio || 0.611)) / 2}
						fill='none'
						stroke='#9ca3af'
						strokeOpacity='0.9'
						strokeWidth='1.5'
						strokeDasharray='1 4'
						strokeLinecap='round'
					/>
					<text
						x={canvasSize.width / 2}
						y={
							canvasSize.height / 2 -
							(canvasSize.width * (safeZoneRatio || 0.611)) / 2 -
							8
						}
						textAnchor='middle'
						fill='#9ca3af'
						fontSize='10'
						fontFamily='ui-monospace, monospace'
						fontWeight='600'
					>
						{Math.round((safeZoneRatio || 0.611) * 100)}% CRITICAL
					</text>
				</svg>
			)}

			{showDesignGrid && (
				<svg
					className='absolute inset-0 pointer-events-none z-20 overflow-visible select-none'
					width={canvasSize.width}
					height={canvasSize.height}
					viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
					aria-hidden='true'
				>
					<title>Apple/iOS app icon keyline alignment grid</title>
					<rect
						x='0.75'
						y='0.75'
						width={canvasSize.width - 1.5}
						height={canvasSize.height - 1.5}
						fill='none'
						stroke='#fff'
						strokeOpacity='0.6'
						strokeWidth='1.5'
						strokeDasharray='1 4'
						strokeLinecap='round'
					/>
					<circle
						cx={canvasSize.width / 2}
						cy={canvasSize.height / 2}
						r={canvasSize.width / 2}
						fill='none'
						stroke='#fff'
						strokeOpacity='0.5'
						strokeWidth='1.5'
						strokeDasharray='1 4'
						strokeLinecap='round'
					/>
					<rect
						x={
							(canvasSize.width -
								Math.min(canvasSize.width, canvasSize.height) *
									DESIGN_GRID_INSET_RATIO) /
							2
						}
						y={
							(canvasSize.height -
								Math.min(canvasSize.width, canvasSize.height) *
									DESIGN_GRID_INSET_RATIO) /
							2
						}
						width={
							Math.min(canvasSize.width, canvasSize.height) *
							DESIGN_GRID_INSET_RATIO
						}
						height={
							Math.min(canvasSize.width, canvasSize.height) *
							DESIGN_GRID_INSET_RATIO
						}
						fill='none'
						stroke='#9ca3af'
						strokeOpacity='0.9'
						strokeWidth='1.5'
						strokeDasharray='1 4'
						strokeLinecap='round'
					/>
					<circle
						cx={canvasSize.width / 2}
						cy={canvasSize.height / 2}
						r={
							(Math.min(canvasSize.width, canvasSize.height) *
								DESIGN_GRID_SMALL_CIRCLE_RATIO) /
							2
						}
						fill='none'
						stroke='#9ca3af'
						strokeOpacity='0.9'
						strokeWidth='1.5'
						strokeDasharray='1 4'
						strokeLinecap='round'
					/>
					<text
						x={canvasSize.width / 2}
						y='18'
						textAnchor='middle'
						fill='#fff'
						fillOpacity='0.75'
						fontSize='10'
						fontFamily='ui-monospace, monospace'
						fontWeight='600'
					>
						APPLE KEYLINE GRID
					</text>
				</svg>
			)}

			{layers.map((layer) => {
				if (!layer.visible) return null;
				const svgData = layerSvgs[layer.id];
				const svgContent = svgData?.content;

				// When animationTarget is set and an animation is active, inject
				// the animation into the matched SVG child elements via
				// mutateSvgDocument instead of animating the outer wrapper div.

				const customKeyframes = layer.animationCustomKeyframes?.trim();
				const customAnimationName = getLayerCustomAnimationName(layer.id);
				const animationName =
					layer.animationType === 'custom'
						? customKeyframes
							? customAnimationName
							: undefined
						: layer.animationType && layer.animationType !== 'none'
							? `logo-layer-${layer.animationType}`
							: undefined;
				const hasActiveAnimation = !!animationName;
				const hasTargetedAnimation =
					hasActiveAnimation && !!layer.animationTarget;

				const coloredSvgElement = svgContent
					? mutateSvgToReactElement(svgContent, layer.iconName, {
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
							stretch:
								layer.scaleY !== undefined && layer.scaleY !== layer.scale,
							// Targeted animation: inject into SVG markup
							animation: hasTargetedAnimation
								? {
										name: animationName,
										duration: layer.animationDuration ?? 2,
										target: layer.animationTarget,
									}
								: undefined,
						})
					: null;

				return (
					<ContextMenu key={layer.id}>
						<ContextMenuTrigger asChild>
							{/* biome-ignore lint/a11y/useSemanticElements: layer needs drag positioning and a context-menu trigger a <button> can't host. */}
							<div
								role='button'
								tabIndex={0}
								aria-label={`${layer.iconName} layer${selectedLayerId === layer.id ? ', selected' : ''}. Use arrow keys to move once selected.`}
								aria-pressed={selectedLayerId === layer.id}
								className='absolute cursor-move z-10'
								style={{
									left: layer.x,
									top: layer.y,
									width: 200 * layer.scale, // Base size 200
									height: 200 * (layer.scaleY ?? layer.scale),
									transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
									opacity: layer.opacity,
									mixBlendMode: layer.blendMode,
									pointerEvents: layer.locked ? 'none' : 'auto',
									filter:
										layer.shadowOpacity > 0
											? `drop-shadow(${layer.shadowOffsetX}px ${layer.shadowOffsetY}px ${layer.shadowBlur}px ${hexToRgba(layer.shadowColor, layer.shadowOpacity)})`
											: undefined,
								}}
								onMouseDown={(e) => handleMouseDown(e, layer.id)}
								onClick={(e) => e.stopPropagation()}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onSelectLayer(layer.id);
									}
								}}
							>
								{layer.animationType === 'custom' && customKeyframes && (
									<style>
										{`@keyframes ${customAnimationName} { ${customKeyframes} }`}
									</style>
								)}
								{/* Nested wrapper: whole-icon animation lives here when
								    there's no animationTarget. When animationTarget is
								    set, the animation is injected into the SVG markup
								    itself (via mutateSvgDocument), so this wrapper stays
								    static. */}
								<div
									className='w-full h-full'
									style={{
										animation:
											animationName && !hasTargetedAnimation
												? `${animationName} ${layer.animationDuration ?? 2}s ease-in-out infinite`
												: undefined,
									}}
								>
									{coloredSvgElement ? (
										<div className='w-full h-full'>{coloredSvgElement}</div>
									) : (
										<div className='w-full h-full animate-pulse bg-muted' />
									)}
								</div>
							</div>
						</ContextMenuTrigger>
						<ContextMenuContent>
							<ContextMenuItem onClick={() => onCopyLayer(layer.id)}>
								<Copy className='size-4' />
								Copy Layer
								<ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
							</ContextMenuItem>
							<ContextMenuItem onClick={() => onPasteLayer(layer.id)}>
								<Copy className='size-4' />
								Paste Properties
								<ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
							</ContextMenuItem>
							<ContextMenuSeparator />
							<ContextMenuItem onClick={() => onDuplicateLayer(layer.id)}>
								<Copy className='size-4' />
								Duplicate Layer
							</ContextMenuItem>
							<ContextMenuItem onClick={() => onReplaceLayer(layer.id)}>
								<RefreshCw className='size-4' />
								Replace SVG
							</ContextMenuItem>
							<ContextMenuSeparator />
							<ContextMenuItem
								variant='destructive'
								onClick={() => onDeleteLayer(layer.id)}
							>
								<Trash2 className='size-4' />
								Delete Layer
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
				);
			})}
		</div>
	);
}
