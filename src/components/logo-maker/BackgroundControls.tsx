import {
	ArrowDown,
	ArrowDownLeft,
	ArrowDownRight,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	ArrowUpLeft,
	ArrowUpRight,
	Plus,
	Trash2,
} from 'lucide-react';
import { type CSSProperties, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	LINEAR_SWATCHES,
	RADIAL_SWATCHES,
	SOLID_SWATCHES,
	type Swatch,
} from '@/lib/logo-presets';
import { getPatternStyle, type PatternType } from '@/lib/pattern-utils';
import {
	type BackgroundConfig,
	type SplitLayout,
	splitColors,
	splitCss,
	splitIsHorizontal,
} from '@/lib/svg-utils';
import { cn } from '@/lib/utils';
import { ColorPickerButton } from '../common/ColorPickerButton';
import { Slider } from '../ui/slider';

const SECTION_LABEL =
	'text-xs font-medium text-muted-foreground uppercase tracking-wide';

const SPLIT_LAYOUTS: { label: string; value: SplitLayout }[] = [
	{ label: 'Halves', value: 'halves' },
	{ label: 'Thirds', value: 'thirds' },
	{ label: 'Quadrant', value: 'quadrant' },
	{ label: 'Pinwheel', value: 'pinwheel' },
];

interface BackgroundControlsProps {
	background: BackgroundConfig;
	onChange: (updates: Partial<BackgroundConfig>) => void;
}

const DIRECTIONS = [
	{ label: 'Up', value: 'to top', icon: ArrowUp },
	{ label: 'Up Right', value: 'to top right', icon: ArrowUpRight },
	{ label: 'Right', value: 'to right', icon: ArrowRight },
	{ label: 'Down Right', value: 'to bottom right', icon: ArrowDownRight },
	{ label: 'Down', value: 'to bottom', icon: ArrowDown },
	{ label: 'Down Left', value: 'to bottom left', icon: ArrowDownLeft },
	{ label: 'Left', value: 'to left', icon: ArrowLeft },
	{ label: 'Up Left', value: 'to top left', icon: ArrowUpLeft },
];

const PATTERNS: { label: string; value: PatternType }[] = [
	{ label: 'None', value: 'none' },
	{ label: 'Grid', value: 'grid' },
	{ label: 'Dots', value: 'dots' },
	{ label: 'Check', value: 'checker' },
	{ label: 'Lines', value: 'lines' },
	{ label: 'Diag', value: 'diagonal' },
	{ label: 'Circles', value: 'circles' },
	{ label: 'Zigzag', value: 'zigzag' },
];

const BORDER_STYLES: {
	label: string;
	value: NonNullable<BackgroundConfig['borderStyle']>;
}[] = [
	{ label: 'Solid', value: 'solid' },
	{ label: 'Dashed', value: 'dashed' },
	{ label: 'Dotted', value: 'dotted' },
];

export function SliderRow({
	label,
	value,
	readout,
	min,
	max,
	step,
	disabled,
	onChange,
}: {
	label: string;
	value: number;
	readout: string;
	min: number;
	max: number;
	step: number;
	disabled?: boolean;
	onChange: (value: number) => void;
}) {
	return (
		<div className='grid grid-cols-[60px_1fr_46px] items-center gap-3'>
			<Label
				className={cn(
					'text-sm text-muted-foreground',
					disabled && 'opacity-50',
				)}
			>
				{label}
			</Label>
			<Slider
				value={[value]}
				min={min}
				max={max}
				step={step}
				disabled={disabled}
				onValueChange={([val]) => onChange(val)}
				aria-label={label}
			/>
			<span
				className={cn(
					'text-right text-xs text-muted-foreground tabular-nums',
					disabled && 'opacity-50',
				)}
			>
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
				{color}
			</span>
			<ColorPickerButton
				color={color}
				onChange={onChange}
				label={label}
				showInput={true}
			/>
		</div>
	);
}

const SWATCH_BASE =
	'size-7 shrink-0 rounded-md transition-transform duration-150 ease-out motion-reduce:transition-none hover:scale-[1.12] active:scale-[0.96]';

const SELECTED_RING = 'ring-2 ring-primary ring-offset-1 z-10';
const RESTING_RING = 'ring-1 ring-inset ring-black/10';

/**
 * Swatch strip with comfortable padding so hover zoom and selection rings never clip.
 */
function SwatchStrip({
	swatches,
	kind,
	isSelected,
	styleFor,
	onSelect,
}: {
	swatches: Swatch[];
	kind: 'solid' | 'linear' | 'radial';
	isSelected: (colors: string[]) => boolean;
	styleFor: (colors: string[]) => CSSProperties;
	onSelect: (colors: string[], label?: string) => void;
}) {
	return (
		<div className='rounded-lg border bg-muted/20 p-2'>
			<div className='grid grid-flow-col grid-rows-2 justify-start gap-2 overflow-x-auto p-1 [scrollbar-width:thin]'>
				{swatches.map(({ colors, group, label }) => {
					const selected = isSelected(colors);
					const titleText = label
						? `${label} (${colors.join(' → ')})`
						: colors.join(' → ');
					return (
						<button
							type='button'
							key={`${colors.join('-')}-${label}`}
							className={`${SWATCH_BASE} ${selected ? SELECTED_RING : RESTING_RING}`}
							style={styleFor(colors)}
							onClick={() => onSelect(colors, label)}
							title={titleText}
							aria-pressed={selected}
							aria-label={`${label || kind} background: ${colors.join(' to ')}`}
							data-track-click='logo_background_preset_select'
							data-track-params={JSON.stringify({
								type: kind,
								group,
								label,
								colors,
							})}
						/>
					);
				})}
			</div>
		</div>
	);
}

/** Pattern button painted with the same CSS the canvas uses, tile shrunk. */
function PatternTile({
	pattern,
	label,
	color,
	selected,
	onSelect,
}: {
	pattern: PatternType;
	label: string;
	color: string;
	selected: boolean;
	onSelect: () => void;
}) {
	const isNone = pattern === 'none';
	const name = isNone ? 'No pattern' : `${label} pattern`;
	return (
		<button
			type='button'
			onClick={onSelect}
			aria-pressed={selected}
			aria-label={name}
			title={name}
			className={`relative block h-9 w-full overflow-hidden rounded-md bg-muted transition-transform duration-150 ease-out motion-reduce:transition-none hover:scale-[1.03] active:scale-[0.98] ${
				selected ? SELECTED_RING : RESTING_RING
			}`}
		>
			{isNone ? (
				<span className='flex h-full items-center justify-center text-[10px] text-muted-foreground'>
					None
				</span>
			) : (
				<span
					className='absolute inset-0 opacity-70'
					style={getPatternStyle(pattern, color, 0.5)}
				/>
			)}
		</button>
	);
}

/** Multi-stop gradient position and color controller */
export function GradientStopsEditor({
	colors,
	positions,
	onChange,
}: {
	colors: string[];
	positions?: number[];
	onChange: (colors: string[], positions: number[]) => void;
}) {
	const currentPositions =
		positions && positions.length === colors.length
			? positions
			: colors.map((_, i) =>
					Math.round((i / Math.max(colors.length - 1, 1)) * 100),
				);

	const handleColorChange = (index: number, newColor: string) => {
		const newColors = [...colors];
		newColors[index] = newColor;
		onChange(newColors, currentPositions);
	};

	const handlePositionChange = (index: number, newPos: number) => {
		const newPositions = [...currentPositions];
		newPositions[index] = newPos;
		onChange(colors, newPositions);
	};

	const handleAddStop = () => {
		const newColors = [...colors, '#ffffff'];
		const newPositions = [...currentPositions, 100];
		// Re-distribute if needed
		if (newColors.length === 3 && currentPositions[1] === 100) {
			newPositions[1] = 50;
			newPositions[2] = 100;
		}
		onChange(newColors, newPositions);
	};

	const handleRemoveStop = (index: number) => {
		if (colors.length <= 2) return;
		const newColors = colors.filter((_, i) => i !== index);
		const newPositions = currentPositions.filter((_, i) => i !== index);
		onChange(newColors, newPositions);
	};

	return (
		<div className='space-y-2.5 rounded-lg border bg-card/60 p-3'>
			<div className='flex items-center justify-between'>
				<span className='text-xs font-semibold text-foreground'>
					Gradient Color Stops ({colors.length})
				</span>
				<Button
					type='button'
					variant='outline'
					size='sm'
					onClick={handleAddStop}
					className='h-7 text-xs gap-1'
					title='Add new color stop to gradient'
				>
					<Plus className='size-3.5' />
					<span>Add stop</span>
				</Button>
			</div>

			<div className='space-y-2'>
				{colors.map((color, index) => {
					const pos =
						currentPositions[index] ??
						Math.round((index / (colors.length - 1)) * 100);
					return (
						<div
							key={`stop-${index}-${color}`}
							className='flex items-center gap-2 rounded-md bg-muted/40 p-2'
						>
							<span className='w-4 text-center font-mono text-[10px] text-muted-foreground'>
								{index + 1}
							</span>
							<ColorPickerButton
								color={color}
								onChange={(newColor) => handleColorChange(index, newColor)}
								label={`Stop ${index + 1}`}
								showInput={false}
							/>
							<div className='flex-1 flex items-center gap-2'>
								<Slider
									value={[pos]}
									min={0}
									max={100}
									step={1}
									onValueChange={([val]) => handlePositionChange(index, val)}
									aria-label='Gradient stop position'
								/>
								<span className='w-8 text-right font-mono text-[10px] text-muted-foreground tabular-nums'>
									{pos}%
								</span>
							</div>
							{colors.length > 2 && (
								<Button
									type='button'
									variant='ghost'
									size='sm'
									onClick={() => handleRemoveStop(index)}
									className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive'
									title='Remove stop'
								>
									<Trash2 className='size-3.5' />
								</Button>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function BackgroundControls({
	background,
	onChange,
}: BackgroundControlsProps) {
	const squircleGradientId = useId();

	const currentSplitLayout: SplitLayout = background.splitLayout || 'halves';
	const isSplitHorizontal = splitIsHorizontal(background.gradientDirection);
	const splitColours = splitColors(
		currentSplitLayout,
		background.gradientColors,
	);

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

	const getBackgroundStyle = () => {
		if (background.type === 'solid') {
			return { background: background.solidColor };
		}
		if (background.type === 'radial') {
			return {
				background: `radial-gradient(circle at ${background.radialCenterX}% ${background.radialCenterY}%, ${gradientStopsCss})`,
			};
		}
		if (background.type === 'split') {
			return {
				background: splitCss(background),
			};
		}
		return {
			background: `linear-gradient(${background.gradientDirection}, ${gradientStopsCss})`,
		};
	};

	const bgStyle = getBackgroundStyle();
	const shapeButton =
		'relative aspect-square rounded-md border-2 transition-transform duration-150 ease-out motion-reduce:transition-none hover:scale-[1.03] active:scale-[0.98]';

	const bWidth = background.borderWidth ?? 0;
	const bColor = background.borderColor || '#ffffff';
	const bStyle = background.borderStyle || 'solid';

	return (
		<div className='space-y-4'>
			{/* Shape */}
			<div className='space-y-2'>
				<h3 className={SECTION_LABEL}>Shape</h3>
				<div className='grid grid-cols-4 gap-2'>
					{/* Square */}
					<button
						type='button'
						className={`${shapeButton} ${
							background.shape === 'rectangle' && background.borderRadius === 0
								? 'border-primary'
								: 'border-border hover:border-primary/50'
						}`}
						onClick={() => onChange({ borderRadius: 0, shape: 'rectangle' })}
						title='Square'
						aria-label='Square'
					>
						<div className='absolute inset-2 rounded-none' style={bgStyle} />
					</button>

					{/* Rounded */}
					<button
						type='button'
						className={`${shapeButton} ${
							background.shape === 'rectangle' &&
							background.borderRadius > 0 &&
							background.borderRadius < 100
								? 'border-primary'
								: 'border-border hover:border-primary/50'
						}`}
						onClick={() => onChange({ borderRadius: 40, shape: 'rectangle' })}
						title='Rounded'
						aria-label='Rounded'
					>
						<div className='absolute inset-2 rounded-lg' style={bgStyle} />
					</button>

					{/* Circle */}
					<button
						type='button'
						className={`${shapeButton} ${
							background.shape === 'rectangle' && background.borderRadius >= 100
								? 'border-primary'
								: 'border-border hover:border-primary/50'
						}`}
						onClick={() => onChange({ borderRadius: 256, shape: 'rectangle' })}
						title='Circle'
						aria-label='Circle'
					>
						<div className='absolute inset-2 rounded-full' style={bgStyle} />
					</button>

					{/* Squircle */}
					<button
						type='button'
						className={`${shapeButton} ${
							background.shape === 'squircle'
								? 'border-primary'
								: 'border-border hover:border-primary/50'
						}`}
						onClick={() => onChange({ shape: 'squircle' })}
						title='Squircle'
						aria-label='Squircle'
					>
						<svg
							className='absolute inset-2'
							viewBox='0 0 100 100'
							xmlns='http://www.w3.org/2000/svg'
							aria-hidden='true'
						>
							<defs>
								<linearGradient
									id={squircleGradientId}
									x1='0%'
									y1='0%'
									x2='100%'
									y2='100%'
								>
									{background.type === 'solid' ? (
										<stop offset='0%' stopColor={background.solidColor} />
									) : (
										background.gradientColors.map((color, i) => {
											const offset = hasCustomPositions
												? (background.gradientPositions?.[i] ?? 0)
												: Math.round(
														(i /
															Math.max(
																background.gradientColors.length - 1,
																1,
															)) *
															100,
													);
											return (
												<stop
													key={`sq-stop-${color}-${offset}`}
													offset={`${offset}%`}
													stopColor={color}
												/>
											);
										})
									)}
								</linearGradient>
							</defs>
							<path
								d='M 50,0 C 10,0 0,10 0,50 C 0,90 10,100 50,100 C 90,100 100,90 100,50 C 100,10 90,0 50,0 Z'
								fill={`url(#${squircleGradientId})`}
							/>
						</svg>
					</button>
				</div>

				{/* Corner Radius */}
				<div className='pt-1'>
					<SliderRow
						label='Radius'
						value={background.borderRadius}
						readout={`${background.borderRadius}px`}
						min={0}
						max={256}
						step={1}
						disabled={background.shape === 'squircle'}
						onChange={(val) =>
							onChange({ borderRadius: val, shape: 'rectangle' })
						}
					/>
				</div>
			</div>

			{/* Outline / Border Controls */}
			<div className='space-y-2.5 border-t pt-4'>
				<h3 className={SECTION_LABEL}>Border Outline</h3>
				<SliderRow
					label='Width'
					value={bWidth}
					readout={`${bWidth}px`}
					min={0}
					max={24}
					step={1}
					onChange={(val) => onChange({ borderWidth: val })}
				/>
				{bWidth > 0 && (
					<div className='space-y-2 pt-1'>
						<div className='flex items-center justify-between'>
							<span className='text-xs text-muted-foreground'>
								Border Color
							</span>
							<ColorField
								color={bColor}
								onChange={(color) => onChange({ borderColor: color })}
								label='Border Color'
							/>
						</div>
						<div className='grid grid-cols-3 gap-1 pt-1'>
							{BORDER_STYLES.map((style) => (
								<Button
									key={style.value}
									type='button'
									variant={bStyle === style.value ? 'default' : 'outline'}
									size='sm'
									className='h-7 text-xs'
									onClick={() => onChange({ borderStyle: style.value })}
								>
									{style.label}
								</Button>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Fill */}
			<div className='space-y-2 border-t pt-4'>
				<h3 className={SECTION_LABEL}>Fill</h3>
				<Tabs
					value={background.type}
					onValueChange={(val) =>
						onChange({ type: val as 'solid' | 'gradient' | 'radial' | 'split' })
					}
					className='w-full'
				>
					<TabsList className='grid w-full grid-cols-4'>
						<TabsTrigger value='solid'>Solid</TabsTrigger>
						<TabsTrigger value='gradient'>Linear</TabsTrigger>
						<TabsTrigger value='radial'>Radial</TabsTrigger>
						<TabsTrigger value='split'>Split</TabsTrigger>
					</TabsList>

					<TabsContent value='solid' className='space-y-2.5 mt-3'>
						<SwatchStrip
							swatches={SOLID_SWATCHES}
							kind='solid'
							isSelected={(colors) => background.solidColor === colors[0]}
							styleFor={(colors) => ({ backgroundColor: colors[0] })}
							onSelect={(colors) => onChange({ solidColor: colors[0] })}
						/>
						<div className='flex justify-end pt-1'>
							<ColorField
								color={background.solidColor}
								onChange={(color) => onChange({ solidColor: color })}
								label='Solid Color'
							/>
						</div>
					</TabsContent>

					<TabsContent value='gradient' className='space-y-3 mt-3'>
						<SwatchStrip
							swatches={LINEAR_SWATCHES}
							kind='linear'
							isSelected={(colors) =>
								JSON.stringify(background.gradientColors) ===
								JSON.stringify(colors)
							}
							styleFor={(colors) => ({
								background: `linear-gradient(${background.gradientDirection}, ${colors.join(', ')})`,
							})}
							onSelect={(colors) =>
								onChange({
									gradientColors: colors,
									gradientPositions: colors.map((_, i) =>
										Math.round((i / Math.max(colors.length - 1, 1)) * 100),
									),
								})
							}
						/>

						{/* Direction Buttons */}
						<div className='grid grid-cols-8 gap-1 pt-1'>
							{DIRECTIONS.map((dir) => (
								<Button
									key={dir.value}
									variant={
										background.gradientDirection === dir.value
											? 'default'
											: 'outline'
									}
									size='sm'
									className='h-7 w-full px-0'
									onClick={() => onChange({ gradientDirection: dir.value })}
									title={dir.label}
									aria-label={dir.label}
								>
									<dir.icon className='size-3.5' />
								</Button>
							))}
						</div>

						{/* Multi-stop position controller */}
						<GradientStopsEditor
							colors={background.gradientColors}
							positions={background.gradientPositions}
							onChange={(colors, positions) =>
								onChange({
									gradientColors: colors,
									gradientPositions: positions,
								})
							}
						/>
					</TabsContent>

					<TabsContent value='radial' className='space-y-3 mt-3'>
						<SwatchStrip
							swatches={RADIAL_SWATCHES}
							kind='radial'
							isSelected={(colors) =>
								JSON.stringify(background.gradientColors) ===
								JSON.stringify(colors)
							}
							styleFor={(colors) => ({
								background: `radial-gradient(circle at 50% 50%, ${colors.join(', ')})`,
							})}
							onSelect={(colors) =>
								onChange({
									gradientColors: colors,
									gradientPositions: colors.map((_, i) =>
										Math.round((i / Math.max(colors.length - 1, 1)) * 100),
									),
								})
							}
						/>

						{/* Multi-stop position controller */}
						<GradientStopsEditor
							colors={background.gradientColors}
							positions={background.gradientPositions}
							onChange={(colors, positions) =>
								onChange({
									gradientColors: colors,
									gradientPositions: positions,
								})
							}
						/>
					</TabsContent>

					<TabsContent value='split' className='space-y-3 mt-3'>
						{/* Layout row */}
						<div className='grid grid-cols-4 gap-1'>
							{SPLIT_LAYOUTS.map((layout) => (
								<Button
									key={layout.value}
									type='button'
									variant={
										currentSplitLayout === layout.value ? 'default' : 'outline'
									}
									size='sm'
									className='h-7 text-xs px-1'
									onClick={() => onChange({ splitLayout: layout.value })}
								>
									{layout.label}
								</Button>
							))}
						</div>

						{/* Direction row (halves / thirds only) */}
						{(currentSplitLayout === 'halves' ||
							currentSplitLayout === 'thirds') && (
							<div className='grid grid-cols-2 gap-1'>
								<Button
									type='button'
									variant={!isSplitHorizontal ? 'default' : 'outline'}
									size='sm'
									className='h-7 text-xs'
									onClick={() => onChange({ gradientDirection: 'to right' })}
								>
									Vertical
								</Button>
								<Button
									type='button'
									variant={isSplitHorizontal ? 'default' : 'outline'}
									size='sm'
									className='h-7 text-xs'
									onClick={() => onChange({ gradientDirection: 'to bottom' })}
								>
									Horizontal
								</Button>
							</div>
						)}

						{/* Colours */}
						<div className='grid grid-cols-2 gap-2 pt-1'>
							{splitColours.map((color, i) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: slot positions are fixed indices for each layout
									key={`split-slot-${currentSplitLayout}-${i}`}
									className='flex items-center justify-end'
								>
									<ColorField
										color={color}
										onChange={(newColor) => {
											const next = [...splitColours];
											next[i] = newColor;
											onChange({ gradientColors: next });
										}}
										label={`Color ${i + 1}`}
									/>
								</div>
							))}
						</div>
					</TabsContent>
				</Tabs>
			</div>

			{/* Pattern Controls */}
			<div className='space-y-2 border-t pt-4'>
				<h3 className={SECTION_LABEL}>Pattern</h3>
				<div className='grid grid-cols-4 gap-1.5'>
					{PATTERNS.map((pattern) => (
						<PatternTile
							key={pattern.value}
							pattern={pattern.value}
							label={pattern.label}
							color={background.patternColor}
							selected={background.pattern === pattern.value}
							onSelect={() => onChange({ pattern: pattern.value })}
						/>
					))}
				</div>
				{background.pattern !== 'none' && (
					<div className='space-y-3 pt-1'>
						<SliderRow
							label='Opacity'
							value={background.patternOpacity}
							readout={`${Math.round(background.patternOpacity * 100)}%`}
							min={0}
							max={1}
							step={0.01}
							onChange={(val) => onChange({ patternOpacity: val })}
						/>
						<div className='flex items-center gap-2'>
							<Label className='text-sm text-muted-foreground'>Color</Label>
							<div className='ml-auto'>
								<ColorField
									color={background.patternColor}
									onChange={(color) => onChange({ patternColor: color })}
									label='Pattern Color'
								/>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
