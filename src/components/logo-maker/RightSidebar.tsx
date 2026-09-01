import {
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	GripVertical,
	Lock,
	Trash2,
	Unlock,
} from 'lucide-react';
import { Reorder } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { iconUrl } from '@/lib/logo-icons';
import {
	getAnimatableTargets,
	mutateSvgToReactElement,
	sanitizeCssIdentifier,
} from '@/lib/svg-utils';
import { cn } from '@/lib/utils';
import { ColorPickerButton } from '../common/ColorPickerButton';
import type { BackgroundConfig, LogoLayer } from '../LogoMaker';
import { ANIMATION_TYPES, BLEND_MODES } from '../LogoMaker';
import { BackgroundControls, GradientStopsEditor } from './BackgroundControls';
import { ExportPanel } from './ExportPanel';

// Single source of truth for "this layer's raw icon SVG markup": used by
// both the identity-header thumbnail and the animation-target picker so
// neither has to duplicate the fetch. A custom-SVG layer (Group C) needs no
// network round trip, its markup is already in the layer itself.
function useLayerSvgMarkup(layer: LogoLayer | null): string | null {
	const [fetched, setFetched] = useState<{ name: string; text: string } | null>(
		null,
	);

	useEffect(() => {
		if (!layer || layer.customSvg) return;
		let cancelled = false;
		fetch(iconUrl(layer.iconName))
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.text();
			})
			.then((text) => {
				if (!cancelled) setFetched({ name: layer.iconName, text });
			})
			.catch(() => {
				if (!cancelled) setFetched(null);
			});
		return () => {
			cancelled = true;
		};
	}, [layer]);

	if (!layer) return null;
	if (layer.customSvg) return layer.customSvg;
	return fetched?.name === layer.iconName ? fetched.text : null;
}

// Renders the selected layer's actual icon, colored with its current
// fill/stroke, so the identity header shows what's on the canvas instead of
// a flat color dot: the selection ring on the canvas itself was removed,
// so this is now the primary way to see which icon/color is selected.
function LayerIconThumb({ layer }: { layer: LogoLayer }) {
	const rawSvg = useLayerSvgMarkup(layer);

	const coloredSvgElement =
		rawSvg != null
			? mutateSvgToReactElement(rawSvg, layer.iconName, {
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
									id: `thumb-fill-grad-${sanitizeCssIdentifier(layer.id)}`,
									type: layer.fillType,
									stops: layer.fillStops,
									positions: layer.fillPositions,
									angle: layer.fillAngle,
								}
							: undefined,
					forceFullSize: true,
				})
			: null;

	return (
		<span className='size-9 shrink-0 rounded-md ring-1 ring-inset ring-foreground/15 bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:8px_8px] p-1.5'>
			{coloredSvgElement ? (
				<span className='block size-full drop-shadow-[0_0_1px_rgba(0,0,0,0.5)] [&_*]:drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]'>
					{coloredSvgElement}
				</span>
			) : (
				<span className='block size-full animate-pulse rounded-sm bg-muted' />
			)}
		</span>
	);
}

const SECTION_LABEL =
	'text-xs font-medium text-muted-foreground uppercase tracking-wide';

interface RightSidebarProps {
	layers: LogoLayer[];
	selectedLayerId: string | null;
	onSelectLayer: (id: string | null) => void;
	onUpdateLayer: (id: string, updates: Partial<LogoLayer>) => void;
	onDeleteLayer: (id: string) => void;
	setLayers: React.Dispatch<React.SetStateAction<LogoLayer[]>>;
	background: BackgroundConfig;
	setBackground: React.Dispatch<React.SetStateAction<BackgroundConfig>>;
	canvasSize: { width: number; height: number };
}

function SliderRow({
	label,
	value,
	readout,
	min,
	max,
	step,
	onChange,
}: {
	label: string;
	value: number;
	readout: string;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
}) {
	return (
		<div className='grid grid-cols-[60px_1fr_46px] items-center gap-3'>
			<Label className='text-sm text-muted-foreground'>{label}</Label>
			<Slider
				value={[value]}
				min={min}
				max={max}
				step={step}
				onValueChange={([val]) => onChange(val)}
				aria-label={label}
			/>
			<span className='text-right text-xs text-muted-foreground tabular-nums'>
				{readout}
			</span>
		</div>
	);
}

function ColorField({
	color,
	onChange,
	label,
}: {
	color: string;
	onChange: (color: string) => void;
	label: string;
}) {
	return (
		<div className='flex items-center gap-2'>
			<span className='text-[11px] font-mono uppercase text-muted-foreground tabular-nums'>
				{color === 'none' ? 'none' : color}
			</span>
			<ColorPickerButton color={color} onChange={onChange} label={label} />
		</div>
	);
}

export function RightSidebar({
	layers,
	selectedLayerId,
	onSelectLayer,
	onUpdateLayer,
	onDeleteLayer,
	setLayers,
	background,
	setBackground,
	canvasSize,
}: RightSidebarProps) {
	const [activeTab, setActiveTab] = useState<'layer' | 'canvas'>('canvas');
	const [layersOpenOverride, setLayersOpenOverride] = useState<boolean | null>(
		null,
	);
	const [previousShadowOpacity, setPreviousShadowOpacity] = useState<
		Record<string, number>
	>({});
	const [customSvgOpenOverride, setCustomSvgOpenOverride] = useState<
		boolean | null
	>(null);
	const [customSvgDraft, setCustomSvgDraft] = useState('');
	const selectedLayer = layers.find((l) => l.id === selectedLayerId);
	const selectedLayerSvgMarkup = useLayerSvgMarkup(selectedLayer ?? null);
	const animatableTargets = useMemo(
		() =>
			selectedLayerSvgMarkup
				? getAnimatableTargets(selectedLayerSvgMarkup)
				: [],
		[selectedLayerSvgMarkup],
	);

	// Re-seed the textarea (and the section's open/closed default) whenever
	// the selection changes to a different layer, or that layer's customSvg
	// changes underneath us (e.g. an agent patched it via WebMCP).
	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedLayerId is required even though it isn't read in the body: without it, switching between two layers whose customSvg values happen to match (e.g. both undefined) wouldn't reset the draft.
	useEffect(() => {
		setCustomSvgDraft(selectedLayer?.customSvg ?? '');
		setCustomSvgOpenOverride(null);
	}, [selectedLayerId, selectedLayer?.customSvg]);

	const isCustomSvgOpen = customSvgOpenOverride ?? !!selectedLayer?.customSvg;

	// The sidebar follows the selection: picking a layer (on the canvas or in
	// the layers list) opens Layer, clicking empty canvas returns to Background.
	// A manual tab click still holds until the next selection change.
	useEffect(() => {
		setActiveTab(selectedLayerId ? 'layer' : 'canvas');
	}, [selectedLayerId]);

	// The list is open by default once a logo has more than one layer, because
	// reordering, hiding and locking only live here.
	const isLayersOpen = layersOpenOverride ?? layers.length > 1;

	// Reversed layers for visual display (top layer on top)
	const reversedLayers = [...layers].reverse();

	const [iconPrefix, iconBaseName] = selectedLayer
		? [
				selectedLayer.iconName.split(':')[0],
				selectedLayer.iconName.split(':').slice(1).join(':') ||
					selectedLayer.iconName,
			]
		: ['', ''];

	return (
		<div className='flex flex-col h-full overflow-hidden'>
			{/* Export Controls - Above Tabs */}
			<div className='border-b p-3'>
				<ExportPanel
					layers={layers}
					canvasSize={canvasSize}
					background={background}
				/>
			</div>

			{/* Tabbed Properties Panel */}
			<Tabs
				value={activeTab}
				onValueChange={(val) => {
					const newTab = val as 'layer' | 'canvas';
					setActiveTab(newTab);
					// Auto-select first layer when switching to Layer tab if no layer is selected
					if (newTab === 'layer' && !selectedLayerId && layers.length > 0) {
						onSelectLayer(layers[0].id);
					}
				}}
				className='flex-1 flex flex-col overflow-hidden'
			>
				<div className='border-b p-3'>
					<TabsList className='grid w-full grid-cols-2'>
						<TabsTrigger
							value='layer'
							disabled={!selectedLayer && layers.length === 0}
						>
							Layer
						</TabsTrigger>
						<TabsTrigger value='canvas'>Background</TabsTrigger>
					</TabsList>
				</div>

				<div className='flex-1 overflow-y-auto [scrollbar-gutter:stable] border-b'>
					<TabsContent value='layer' className='mt-0 p-4'>
						{selectedLayer ? (
							<div className='space-y-4'>
								{/* Selected layer identity */}
								<div className='flex items-center gap-2.5'>
									<LayerIconThumb layer={selectedLayer} />
									<div className='min-w-0'>
										<p
											className='truncate text-sm font-medium leading-tight'
											title={selectedLayer.iconName}
										>
											{iconBaseName}
										</p>
										<p className='truncate text-xs text-muted-foreground'>
											{iconPrefix}
										</p>
									</div>
								</div>

								{/* Custom SVG Section */}
								<div className='space-y-2 border-t pt-4'>
									<button
										type='button'
										className='flex w-full items-center justify-between'
										onClick={() => setCustomSvgOpenOverride(!isCustomSvgOpen)}
										aria-expanded={isCustomSvgOpen}
									>
										<h3 className={SECTION_LABEL}>Custom SVG</h3>
										{isCustomSvgOpen ? (
											<ChevronDown className='size-4 text-muted-foreground' />
										) : (
											<ChevronRight className='size-4 text-muted-foreground' />
										)}
									</button>
									{isCustomSvgOpen && (
										<div className='space-y-2'>
											<textarea
												value={customSvgDraft}
												onChange={(e) => setCustomSvgDraft(e.target.value)}
												placeholder="Paste raw SVG markup to override this layer's rendering..."
												spellCheck={false}
												className='h-28 w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-[11px] leading-snug'
											/>
											<Button
												type='button'
												variant='outline'
												size='sm'
												className='w-full'
												onClick={() =>
													onUpdateLayer(selectedLayer.id, {
														customSvg: customSvgDraft.trim()
															? customSvgDraft
															: undefined,
													})
												}
											>
												Apply
											</Button>
											<p className='text-[11px] text-muted-foreground'>
												Overrides icon-based rendering for this layer. Clear the
												text and apply to go back to the icon.
											</p>
										</div>
									)}
								</div>

								{/* Transform Section */}
								<div className='space-y-3 border-t pt-4'>
									<h3 className={SECTION_LABEL}>Transform</h3>

									<div className='grid grid-cols-2 gap-3'>
										<div className='space-y-1'>
											<Label className='text-xs text-muted-foreground'>X</Label>
											<Input
												type='number'
												value={Math.round(selectedLayer.x)}
												onChange={(e) =>
													onUpdateLayer(selectedLayer.id, {
														x: Number(e.target.value),
													})
												}
												className='h-8 text-xs tabular-nums'
											/>
										</div>
										<div className='space-y-1'>
											<Label className='text-xs text-muted-foreground'>Y</Label>
											<Input
												type='number'
												value={Math.round(selectedLayer.y)}
												onChange={(e) =>
													onUpdateLayer(selectedLayer.id, {
														y: Number(e.target.value),
													})
												}
												className='h-8 text-xs tabular-nums'
											/>
										</div>
									</div>

									<SliderRow
										label='Width'
										value={selectedLayer.scale}
										readout={`${Math.round(selectedLayer.scale * 100)}%`}
										min={0.1}
										max={5}
										step={0.01}
										onChange={(val) =>
											onUpdateLayer(selectedLayer.id, { scale: val })
										}
									/>
									<SliderRow
										label='Height'
										value={selectedLayer.scaleY ?? selectedLayer.scale}
										readout={`${Math.round((selectedLayer.scaleY ?? selectedLayer.scale) * 100)}%`}
										min={0.1}
										max={5}
										step={0.01}
										onChange={(val) =>
											onUpdateLayer(selectedLayer.id, {
												scaleY:
													Math.abs(val - selectedLayer.scale) < 0.005
														? undefined
														: val,
											})
										}
									/>
									<SliderRow
										label='Rotate'
										value={selectedLayer.rotation}
										readout={`${Math.round(selectedLayer.rotation)}°`}
										min={0}
										max={360}
										step={1}
										onChange={(val) =>
											onUpdateLayer(selectedLayer.id, { rotation: val })
										}
									/>
								</div>

								{/* Colors Section */}
								<div className='space-y-3 border-t pt-4'>
									<h3 className={SECTION_LABEL}>Color</h3>

									{/* Fill */}
									<div className='flex items-center gap-2'>
										<Label className='w-11 shrink-0 text-sm text-muted-foreground'>
											Fill
										</Label>
										<Switch
											checked={selectedLayer.overwriteFill}
											onCheckedChange={(checked) =>
												onUpdateLayer(selectedLayer.id, {
													overwriteFill: checked,
												})
											}
											aria-label='Override fill color'
										/>
										<div className='ml-auto'>
											<ColorField
												color={selectedLayer.fill}
												onChange={(color) =>
													onUpdateLayer(selectedLayer.id, { fill: color })
												}
												label='Fill Color'
											/>
										</div>
									</div>

									{selectedLayer.overwriteFill && (
										<>
											<div className='grid grid-cols-3 gap-1 rounded-lg bg-muted p-1'>
												{(['solid', 'linear', 'radial'] as const).map((t) => (
													<button
														key={t}
														type='button'
														onClick={() =>
															onUpdateLayer(selectedLayer.id, {
																fillType: t,
																...(t !== 'solid' && !selectedLayer.fillStops
																	? {
																			fillStops: [
																				selectedLayer.fill,
																				'#ffffff',
																			],
																		}
																	: {}),
															})
														}
														className={cn(
															'rounded-md px-2 py-1 text-xs capitalize transition-colors',
															(selectedLayer.fillType ?? 'solid') === t
																? 'bg-background shadow-sm'
																: 'text-muted-foreground hover:text-foreground',
														)}
													>
														{t}
													</button>
												))}
											</div>

											{(selectedLayer.fillType === 'linear' ||
												selectedLayer.fillType === 'radial') && (
												<GradientStopsEditor
													colors={
														selectedLayer.fillStops ?? [
															selectedLayer.fill,
															'#ffffff',
														]
													}
													positions={selectedLayer.fillPositions}
													onChange={(colors, positions) =>
														onUpdateLayer(selectedLayer.id, {
															fillStops: colors,
															fillPositions: positions,
														})
													}
												/>
											)}

											{selectedLayer.fillType === 'linear' && (
												<SliderRow
													label='Angle'
													value={selectedLayer.fillAngle ?? 90}
													readout={`${selectedLayer.fillAngle ?? 90}°`}
													min={0}
													max={360}
													step={1}
													onChange={(v) =>
														onUpdateLayer(selectedLayer.id, { fillAngle: v })
													}
												/>
											)}
										</>
									)}

									{/* Stroke */}
									<div className='flex items-center gap-2'>
										<Label className='w-11 shrink-0 text-sm text-muted-foreground'>
											Stroke
										</Label>
										<Switch
											checked={selectedLayer.overwriteStroke}
											onCheckedChange={(checked) =>
												onUpdateLayer(selectedLayer.id, {
													overwriteStroke: checked,
												})
											}
											aria-label='Override stroke color'
										/>
										<div className='ml-auto'>
											<ColorField
												color={
													selectedLayer.stroke === 'none'
														? '#000000'
														: selectedLayer.stroke
												}
												onChange={(color) =>
													onUpdateLayer(selectedLayer.id, { stroke: color })
												}
												label='Stroke Color'
											/>
										</div>
									</div>

									<p className='text-[11px] text-muted-foreground'>
										Toggles replace the icon's own colors.
									</p>

									{/* Stroke Width & Style */}
									{selectedLayer.overwriteStroke &&
										selectedLayer.stroke !== 'none' && (
											<div className='space-y-2 pt-1'>
												<SliderRow
													label='Width'
													value={selectedLayer.strokeWidth ?? 2}
													readout={`${selectedLayer.strokeWidth ?? 2}px`}
													min={0}
													max={24}
													step={0.5}
													onChange={(val) =>
														onUpdateLayer(selectedLayer.id, {
															strokeWidth: val,
														})
													}
												/>
												<div className='grid grid-cols-3 gap-1'>
													<Button
														type='button'
														variant={
															!selectedLayer.strokeDasharray ||
															selectedLayer.strokeDasharray === 'none'
																? 'default'
																: 'outline'
														}
														size='sm'
														className='h-7 text-xs'
														onClick={() =>
															onUpdateLayer(selectedLayer.id, {
																strokeDasharray: 'none',
															})
														}
													>
														Solid
													</Button>
													<Button
														type='button'
														variant={
															selectedLayer.strokeDasharray === '6 4'
																? 'default'
																: 'outline'
														}
														size='sm'
														className='h-7 text-xs'
														onClick={() =>
															onUpdateLayer(selectedLayer.id, {
																strokeDasharray: '6 4',
															})
														}
													>
														Dashed
													</Button>
													<Button
														type='button'
														variant={
															selectedLayer.strokeDasharray === '2 4'
																? 'default'
																: 'outline'
														}
														size='sm'
														className='h-7 text-xs'
														onClick={() =>
															onUpdateLayer(selectedLayer.id, {
																strokeDasharray: '2 4',
															})
														}
													>
														Dotted
													</Button>
												</div>
											</div>
										)}

									{/* No Stroke Button */}
									{selectedLayer.overwriteStroke && (
										<Button
											variant='outline'
											size='sm'
											className='w-full'
											onClick={() =>
												onUpdateLayer(selectedLayer.id, { stroke: 'none' })
											}
										>
											Remove stroke
										</Button>
									)}
								</div>

								{/* Effects Section */}
								<div className='space-y-3 border-t pt-4'>
									<h3 className={SECTION_LABEL}>Effects</h3>

									<SliderRow
										label='Opacity'
										value={selectedLayer.opacity}
										readout={`${Math.round(selectedLayer.opacity * 100)}%`}
										min={0}
										max={1}
										step={0.01}
										onChange={(val) =>
											onUpdateLayer(selectedLayer.id, { opacity: val })
										}
									/>

									<div className='space-y-2'>
										<Label className='text-xs font-medium text-muted-foreground'>
											Blend mode
										</Label>
										<select
											value={selectedLayer.blendMode}
											onChange={(e) =>
												onUpdateLayer(selectedLayer.id, {
													blendMode: e.target.value as LogoLayer['blendMode'],
												})
											}
											className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm'
										>
											{BLEND_MODES.map((mode) => (
												<option key={mode} value={mode}>
													{mode
														.split('-')
														.map((w) => w[0].toUpperCase() + w.slice(1))
														.join(' ')}
												</option>
											))}
										</select>
									</div>

									<div className='space-y-2'>
										<Label className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
											Animation
											<span className='rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400'>
												Experimental
											</span>
										</Label>
										<select
											value={selectedLayer.animationType ?? 'none'}
											onChange={(e) =>
												onUpdateLayer(selectedLayer.id, {
													animationType: e.target
														.value as LogoLayer['animationType'],
												})
											}
											className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm'
										>
											{ANIMATION_TYPES.map((type) => (
												<option key={type} value={type}>
													{type === 'none'
														? 'None'
														: type[0].toUpperCase() + type.slice(1)}
												</option>
											))}
										</select>
										{selectedLayer.animationType &&
											selectedLayer.animationType !== 'none' && (
												<>
													{selectedLayer.animationType === 'custom' && (
														<div className='space-y-1'>
															<Label className='text-xs font-medium text-muted-foreground'>
																Keyframes
															</Label>
															<textarea
																value={
																	selectedLayer.animationCustomKeyframes ?? ''
																}
																onChange={(e) =>
																	onUpdateLayer(selectedLayer.id, {
																		animationCustomKeyframes:
																			e.target.value || undefined,
																	})
																}
																placeholder={`0% { transform: scale(1); }\n50% { transform: skewX(12deg) scale(1.08); }\n100% { transform: scale(1); }`}
																spellCheck={false}
																className='h-24 w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-[11px] leading-snug'
															/>
														</div>
													)}
													<SliderRow
														label='Duration'
														value={selectedLayer.animationDuration ?? 2}
														readout={`${(selectedLayer.animationDuration ?? 2).toFixed(1)}s`}
														min={0.5}
														max={8}
														step={0.1}
														onChange={(val) =>
															onUpdateLayer(selectedLayer.id, {
																animationDuration: val,
															})
														}
													/>
													<div className='space-y-1'>
														<Label className='text-xs font-medium text-muted-foreground'>
															Target element
														</Label>
														<Input
															type='text'
															value={selectedLayer.animationTarget ?? ''}
															onChange={(e) =>
																onUpdateLayer(selectedLayer.id, {
																	animationTarget: e.target.value || undefined,
																})
															}
															placeholder='e.g. circle, path:nth-of-type(2)'
															className='h-8 text-xs font-mono'
														/>
														<p className='text-[11px] text-muted-foreground'>
															CSS selector to animate only a part of the icon.
															Leave empty for whole icon.
														</p>
														{animatableTargets.length > 1 && (
															<div className='flex flex-wrap gap-1 pt-0.5'>
																{animatableTargets.map((t) => (
																	<button
																		key={t.selector}
																		type='button'
																		onClick={() =>
																			onUpdateLayer(selectedLayer.id, {
																				animationTarget: t.selector,
																			})
																		}
																		className={`rounded border px-1.5 py-0.5 text-[10px] font-mono ${
																			selectedLayer.animationTarget ===
																			t.selector
																				? 'border-primary bg-primary/10 text-primary'
																				: 'border-input text-muted-foreground hover:bg-muted'
																		}`}
																	>
																		{t.label}
																	</button>
																))}
															</div>
														)}
													</div>
												</>
											)}
									</div>

									{/* Shadow Toggle */}
									<div className='flex items-center gap-2'>
										<Label className='text-sm text-muted-foreground'>
											Shadow
										</Label>
										<Switch
											className='ml-auto'
											checked={selectedLayer.shadowOpacity > 0}
											aria-label='Enable shadow'
											onCheckedChange={(checked) => {
												if (checked) {
													const restoredOpacity =
														previousShadowOpacity[selectedLayer.id] || 0.5;
													onUpdateLayer(selectedLayer.id, {
														shadowOpacity: restoredOpacity,
													});
												} else {
													setPreviousShadowOpacity((prev) => ({
														...prev,
														[selectedLayer.id]: selectedLayer.shadowOpacity,
													}));
													onUpdateLayer(selectedLayer.id, {
														shadowOpacity: 0,
													});
												}
											}}
										/>
									</div>

									{/* Shadow Controls - Only when enabled */}
									{selectedLayer.shadowOpacity > 0 && (
										<div className='space-y-3 rounded-lg bg-muted/50 p-3'>
											{/* Quick Shadow Presets */}
											<div className='space-y-1.5'>
												<span className='text-[11px] font-medium text-muted-foreground'>
													Shadow Presets
												</span>
												<div className='grid grid-cols-3 gap-1'>
													<Button
														type='button'
														variant={
															selectedLayer.shadowBlur > 15 &&
															selectedLayer.shadowOffsetX === 0
																? 'default'
																: 'outline'
														}
														size='sm'
														className='h-7 text-[11px]'
														onClick={() =>
															onUpdateLayer(selectedLayer.id, {
																shadowBlur: 24,
																shadowOffsetX: 0,
																shadowOffsetY: 4,
																shadowOpacity: 0.45,
															})
														}
													>
														Soft Glow
													</Button>
													<Button
														type='button'
														variant={
															selectedLayer.shadowBlur === 0
																? 'default'
																: 'outline'
														}
														size='sm'
														className='h-7 text-[11px]'
														onClick={() =>
															onUpdateLayer(selectedLayer.id, {
																shadowBlur: 0,
																shadowOffsetX: 6,
																shadowOffsetY: 6,
																shadowOpacity: 0.85,
															})
														}
													>
														Hard Retro
													</Button>
													<Button
														type='button'
														variant={
															selectedLayer.shadowBlur > 0 &&
															selectedLayer.shadowOffsetY >= 8
																? 'default'
																: 'outline'
														}
														size='sm'
														className='h-7 text-[11px]'
														onClick={() =>
															onUpdateLayer(selectedLayer.id, {
																shadowBlur: 16,
																shadowOffsetX: 0,
																shadowOffsetY: 8,
																shadowOpacity: 0.35,
															})
														}
													>
														Elevated
													</Button>
												</div>
											</div>

											{/* Shadow Color */}
											<div className='flex items-center gap-2 pt-1'>
												<Label className='text-sm text-muted-foreground'>
													Color
												</Label>
												<div className='ml-auto'>
													<ColorField
														color={selectedLayer.shadowColor}
														onChange={(color) =>
															onUpdateLayer(selectedLayer.id, {
																shadowColor: color,
															})
														}
														label='Shadow Color'
													/>
												</div>
											</div>
											<SliderRow
												label='Opacity'
												value={selectedLayer.shadowOpacity}
												readout={`${Math.round(selectedLayer.shadowOpacity * 100)}%`}
												min={0}
												max={1}
												step={0.01}
												onChange={(val) =>
													onUpdateLayer(selectedLayer.id, {
														shadowOpacity: val,
													})
												}
											/>
											<SliderRow
												label='Blur'
												value={selectedLayer.shadowBlur}
												readout={
													selectedLayer.shadowBlur === 0
														? '0px (Hard)'
														: `${selectedLayer.shadowBlur}px`
												}
												min={0}
												max={50}
												step={1}
												onChange={(val) =>
													onUpdateLayer(selectedLayer.id, { shadowBlur: val })
												}
											/>
											<div className='grid grid-cols-2 gap-3'>
												<div className='space-y-1'>
													<Label className='text-xs text-muted-foreground'>
														Offset X
													</Label>
													<Input
														type='number'
														value={selectedLayer.shadowOffsetX}
														onChange={(e) =>
															onUpdateLayer(selectedLayer.id, {
																shadowOffsetX: Number(e.target.value),
															})
														}
														className='h-8 bg-background text-xs tabular-nums'
													/>
												</div>
												<div className='space-y-1'>
													<Label className='text-xs text-muted-foreground'>
														Offset Y
													</Label>
													<Input
														type='number'
														value={selectedLayer.shadowOffsetY}
														onChange={(e) =>
															onUpdateLayer(selectedLayer.id, {
																shadowOffsetY: Number(e.target.value),
															})
														}
														className='h-8 bg-background text-xs tabular-nums'
													/>
												</div>
											</div>
										</div>
									)}
								</div>

								{/* Delete Button */}
								<div className='border-t pt-4'>
									<Button
										variant='outline'
										size='sm'
										className='w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive'
										onClick={() => onDeleteLayer(selectedLayer.id)}
									>
										<Trash2 className='mr-2 size-4' />
										Delete layer
									</Button>
								</div>
							</div>
						) : (
							<div className='rounded-lg border border-dashed px-4 py-10 text-center'>
								<p className='text-sm font-medium'>No layer selected</p>
								<p className='mt-1 text-xs text-muted-foreground'>
									{layers.length > 0
										? 'Pick a layer on the canvas or in the list below to edit its transform, color, and shadow.'
										: 'Add an icon from the left panel, then select it to edit its transform, color, and shadow.'}
								</p>
							</div>
						)}
					</TabsContent>

					<TabsContent value='canvas' className='mt-0 p-4'>
						<BackgroundControls
							background={background}
							onChange={(updates) =>
								setBackground((prev) => ({ ...prev, ...updates }))
							}
						/>
					</TabsContent>
				</div>
			</Tabs>

			{/* Layers List */}
			<div
				className={`border-t flex flex-col flex-none ${isLayersOpen ? 'max-h-[34%]' : ''}`}
			>
				<button
					type='button'
					className={`px-3 py-2.5 font-medium text-xs uppercase tracking-wide flex items-center justify-between w-full transition-colors motion-reduce:transition-none hover:bg-muted ${isLayersOpen ? 'bg-muted/50 border-b' : 'bg-transparent'}`}
					onClick={() => setLayersOpenOverride(!isLayersOpen)}
					aria-expanded={isLayersOpen}
				>
					<span>
						Layers
						<span className='ml-1.5 text-muted-foreground tabular-nums'>
							{layers.length}
						</span>
					</span>
					{isLayersOpen ? (
						<ChevronDown className='size-4 text-muted-foreground' />
					) : (
						<ChevronRight className='size-4 text-muted-foreground' />
					)}
				</button>
				{isLayersOpen && (
					<Reorder.Group
						axis='y'
						values={reversedLayers}
						onReorder={(newReversedLayers) => {
							setLayers([...newReversedLayers].reverse());
						}}
						className='min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] p-2 space-y-1'
					>
						{reversedLayers.map((layer) => (
							<Reorder.Item
								key={layer.id}
								value={layer}
								role='button'
								tabIndex={0}
								aria-pressed={selectedLayerId === layer.id}
								aria-label={`Select layer ${
									layer.iconName.split(':').slice(1).join(':') || layer.iconName
								}`}
								className={`flex items-center gap-2 p-2 rounded-md border cursor-grab active:cursor-grabbing group transition-colors motion-reduce:transition-none ${
									selectedLayerId === layer.id
										? 'bg-accent border-primary'
										: 'bg-card border-transparent hover:bg-accent/50'
								} ${layer.visible ? '' : 'opacity-50'}`}
								onClick={() => {
									onSelectLayer(layer.id);
									setActiveTab('layer');
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onSelectLayer(layer.id);
										setActiveTab('layer');
									}
								}}
							>
								<GripVertical className='size-4 text-muted-foreground/60 flex-shrink-0' />
								<span
									className='size-5 shrink-0 rounded-full ring-1 ring-inset ring-foreground/15'
									style={
										layer.fillType &&
										layer.fillType !== 'solid' &&
										layer.fillStops
											? {
													backgroundImage: `linear-gradient(${layer.fillAngle ?? 90}deg, ${layer.fillStops.join(', ')})`,
												}
											: { backgroundColor: layer.fill }
									}
								/>
								<div className='flex-1 min-w-0'>
									<div
										className='text-sm font-medium truncate'
										title={layer.iconName}
									>
										{layer.iconName.split(':').slice(1).join(':') ||
											layer.iconName}
									</div>
								</div>
								<div className='flex items-center gap-1 opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 focus-within:opacity-100'>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant='ghost'
													size='icon-sm'
													className='size-6'
													aria-label={
														layer.visible ? 'Hide layer' : 'Show layer'
													}
													onClick={(e) => {
														e.stopPropagation();
														onUpdateLayer(layer.id, {
															visible: !layer.visible,
														});
													}}
												>
													{layer.visible ? (
														<Eye className='size-3' />
													) : (
														<EyeOff className='size-3' />
													)}
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p className='text-xs'>
													{layer.visible ? 'Hide Layer' : 'Show Layer'}
												</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>

									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant='ghost'
													size='icon-sm'
													className='size-6'
													aria-label={
														layer.locked ? 'Unlock layer' : 'Lock layer'
													}
													onClick={(e) => {
														e.stopPropagation();
														onUpdateLayer(layer.id, { locked: !layer.locked });
													}}
												>
													{layer.locked ? (
														<Lock className='size-3' />
													) : (
														<Unlock className='size-3' />
													)}
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p className='text-xs'>
													{layer.locked ? 'Unlock Layer' : 'Lock Layer'}
												</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>

									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant='ghost'
													size='icon-sm'
													className='size-6 text-destructive hover:text-destructive'
													aria-label='Delete layer'
													onClick={(e) => {
														e.stopPropagation();
														onDeleteLayer(layer.id);
													}}
												>
													<Trash2 className='size-3' />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p className='text-xs'>Delete Layer</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							</Reorder.Item>
						))}
						{layers.length === 0 && (
							<div className='rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground'>
								No layers yet. Add an icon from the left panel.
							</div>
						)}
					</Reorder.Group>
				)}
			</div>
		</div>
	);
}
