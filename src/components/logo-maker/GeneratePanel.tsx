import { RefreshCw } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { BackgroundConfig, LogoLayer } from '@/components/LogoMaker';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '@/components/ui/input-group';
import {
	buildCandidate,
	CURATED_ALL_SUGGESTED_ICONS,
	candidateBackgroundCss,
	emitCandidate,
	type LogoCandidate,
	PALETTES,
	pickCandidates,
	randomCandidateStyle,
	shuffle,
} from '@/lib/logo-icons';
import { buildSvgString, hexToRgb } from '@/lib/svg-utils';

interface GeneratePanelProps {
	canvasSize?: { width: number; height: number };
	currentLayers?: LogoLayer[];
	currentBackground?: BackgroundConfig;
}

const KEYWORD_HINTS = [
	'tech',
	'coffee',
	'leaf',
	'bolt',
	'shield',
	'creative',
	'fitness',
];

function colorDistance(a: string, b: string): number {
	const rgbA = hexToRgb(a);
	const rgbB = hexToRgb(b);
	if (!rgbA || !rgbB) return Infinity;
	return Math.hypot(rgbA[0] - rgbB[0], rgbA[1] - rgbB[1], rgbA[2] - rgbB[2]);
}

/**
 * Like `randomCandidateStyle`, but biased toward what's already on the
 * canvas once there's a layer to read a color from: picks among the 6
 * closest-matching palettes (by icon color) instead of any of the 28,
 * and reuses the current background's shape instead of a random one.
 */
export function contextualCandidateStyle(
	currentLayers: LogoLayer[],
	currentBackground: BackgroundConfig,
	slot = 0,
): { paletteIndex: number; shape: BackgroundConfig['shape'] } {
	if (currentLayers.length === 0) return randomCandidateStyle();
	// Rank by background colour: most palettes share a white icon, so the
	// icon colour would tie and always return the same few entries.
	const refColor =
		currentBackground.type === 'solid'
			? currentBackground.solidColor
			: (currentBackground.gradientColors[0] ?? currentBackground.solidColor);
	const ranked = PALETTES.map((palette, index) => ({
		index,
		dist: colorDistance(palette.bg[0], refColor),
	})).sort((a, b) => a.dist - b.dist);
	// One palette per tile: slot walks the 6 nearest without repeats.
	const pick = ranked[slot % Math.min(6, ranked.length)];
	return { paletteIndex: pick.index, shape: currentBackground.shape };
}

function getFreshCuratedCandidates(
	canvasSize: {
		width: number;
		height: number;
	},
	currentLayers?: LogoLayer[],
	currentBackground?: BackgroundConfig,
): LogoCandidate[] {
	const sampled = shuffle(CURATED_ALL_SUGGESTED_ICONS).slice(0, 6);
	return sampled.map((icon, slot) => {
		const style =
			currentLayers && currentLayers.length > 0 && currentBackground
				? contextualCandidateStyle(currentLayers, currentBackground, slot)
				: randomCandidateStyle();
		return buildCandidate(icon, canvasSize, style.paletteIndex, style.shape);
	});
}

/** Tile radius mirrors the shape the candidate applies to the canvas. */
const SHAPE_RADIUS: Record<string, string> = {
	circle: 'rounded-full',
	squircle: 'rounded-[28%]',
	rectangle: 'rounded-lg',
};

/** Raw (uncoloured) SVG source per icon, fetched once and reused across
 * palettes so the preview tile can be recoloured with the exact same
 * `buildSvgString` pipeline the canvas uses when a candidate is applied. */
const rawIconSvgCache = new Map<string, string>();

export function GeneratePanel({
	canvasSize = { width: 512, height: 512 },
	currentLayers,
	currentBackground,
}: GeneratePanelProps) {
	const [keyword, setKeyword] = useState('');
	// Starts empty, not randomized here, and populated in a mount-only
	// useEffect instead: getFreshCuratedCandidates() calls Math.random(), and
	// LogoMaker (this component's root) is a client:only island specifically
	// to avoid SSR/hydration mismatches — keep randomness out of render for
	// the same reason, in case that ever changes.
	const [candidates, setCandidates] = useState<LogoCandidate[]>([]);
	const [appliedIcon, setAppliedIcon] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [searched, setSearched] = useState(false);
	const [runId, setRunId] = useState(0);
	const abortRef = useRef<AbortController | null>(null);
	const lastTermRef = useRef('');
	const reduceMotion = useReducedMotion();
	const [, forceRawSvgTick] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-only, deliberately not reacting to canvasSize changes
	useEffect(() => {
		setCandidates(
			getFreshCuratedCandidates(canvasSize, currentLayers, currentBackground),
		);
	}, []);

	// Fetch each candidate's raw icon SVG once so the tile can be recoloured
	// client side with the same `buildSvgString` call LogoCanvas uses when the
	// candidate is applied — guarantees the preview matches what loads.
	useEffect(() => {
		let cancelled = false;
		const urlByName = new Map(
			candidates.map((c) => [c.layers[0].iconName, c.layers[0].url]),
		);
		const missing = [...urlByName.keys()].filter(
			(name) => !rawIconSvgCache.has(name),
		);
		if (missing.length === 0) return;
		Promise.all(
			missing.map(async (name) => {
				try {
					const res = await fetch(urlByName.get(name) ?? '');
					if (!res.ok) return;
					const text = await res.text();
					if (text.includes('<svg')) rawIconSvgCache.set(name, text);
				} catch {
					// ignore; tile falls back to the loading placeholder
				}
			}),
		).then(() => {
			if (!cancelled) forceRawSvgTick((n) => n + 1);
		});
		return () => {
			cancelled = true;
		};
	}, [candidates]);

	const handleShuffle = () => {
		if (lastTermRef.current) {
			generate(lastTermRef.current);
		} else {
			setCandidates(
				getFreshCuratedCandidates(canvasSize, currentLayers, currentBackground),
			);
			setAppliedIcon(null);
			setRunId((n) => n + 1);
		}
	};

	const generate = async (term: string) => {
		const value = term.trim();
		if (!value) {
			setCandidates(
				getFreshCuratedCandidates(canvasSize, currentLayers, currentBackground),
			);
			setAppliedIcon(null);
			setRunId((n) => n + 1);
			lastTermRef.current = '';
			return;
		}
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		lastTermRef.current = value;
		setLoading(true);
		setError(null);
		try {
			const icons = await pickCandidates(value, 6, controller.signal);
			setCandidates(
				icons.map((icon, slot) => {
					const style =
						currentLayers && currentLayers.length > 0 && currentBackground
							? contextualCandidateStyle(currentLayers, currentBackground, slot)
							: randomCandidateStyle();
					return buildCandidate(
						icon,
						canvasSize,
						style.paletteIndex,
						style.shape,
					);
				}),
			);
			setAppliedIcon(null);
			setRunId((n) => n + 1);
			setSearched(true);
		} catch (err) {
			if ((err as Error).name !== 'AbortError') {
				setError('The icon service did not respond. Try again.');
				setCandidates([]);
				setSearched(true);
			}
		} finally {
			if (!controller.signal.aborted) setLoading(false);
		}
	};

	const applyCandidate = (candidate: LogoCandidate) => {
		setAppliedIcon(candidate.layers[0].iconName);
		emitCandidate(candidate);
	};

	const canShuffle = !loading;

	return (
		<div className='p-4 border-b space-y-3'>
			<div className='flex items-center justify-between gap-2'>
				<h2 className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
					Generate
				</h2>
				<button
					type='button'
					onClick={handleShuffle}
					disabled={!canShuffle}
					className='inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-0'
					data-track-click='logo_generate_shuffle'
					data-track-params={JSON.stringify({
						keyword: lastTermRef.current || 'curated',
					})}
				>
					<RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
					Shuffle
				</button>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					generate(keyword);
				}}
			>
				<InputGroup className='h-10'>
					<InputGroupInput
						placeholder='What is the brand about?'
						value={keyword}
						onChange={(e) => setKeyword(e.target.value)}
						aria-label='Brand keyword'
					/>
					<InputGroupAddon align='inline-end'>
						<InputGroupButton
							type='submit'
							size='sm'
							variant='default'
							disabled={loading || !keyword.trim()}
							data-track-click='logo_generate'
							data-track-params={JSON.stringify({ keyword })}
						>
							{loading ? 'Working' : 'Generate'}
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</form>

			<p className='flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground'>
				<span>Try:</span>
				{KEYWORD_HINTS.map((hint) => (
					<button
						type='button'
						key={hint}
						onClick={() => {
							setKeyword(hint);
							generate(hint);
						}}
						className='text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline'
						data-track-click='logo_chip_click'
						data-track-params={JSON.stringify({ keyword: hint })}
					>
						{hint}
					</button>
				))}
			</p>

			{error && <p className='text-xs text-destructive'>{error}</p>}

			{(loading || (candidates.length === 0 && !error)) && (
				<div className='grid grid-cols-3 gap-2'>
					{[0, 1, 2, 3, 4, 5].map((slot) => (
						<div
							key={slot}
							className='aspect-square rounded-[28%] bg-muted animate-pulse'
						/>
					))}
				</div>
			)}

			{!loading && candidates.length > 0 && (
				<div className='grid grid-cols-3 gap-2'>
					{candidates.map((candidate, index) => {
						const layer = candidate.layers[0];
						const isApplied = appliedIcon === layer.iconName;
						const rawSvg = rawIconSvgCache.get(layer.iconName);
						const coloredSvg = rawSvg
							? buildSvgString(rawSvg, layer.iconName, {
									fill: layer.fill,
									stroke: layer.stroke,
									overwriteFill: layer.overwriteFill,
									overwriteStroke: layer.overwriteStroke,
									forceFullSize: true,
								})
							: null;
						return (
							<motion.button
								type='button'
								key={`${runId}-${layer.iconName}`}
								initial={
									reduceMotion
										? { opacity: 0 }
										: { opacity: 0, y: 6, scale: 0.96 }
								}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								transition={{
									type: 'spring',
									stiffness: 420,
									damping: 32,
									delay: reduceMotion ? 0 : index * 0.03,
								}}
								onClick={() => applyCandidate(candidate)}
								title={`${layer.iconName} on ${candidate.palette}`}
								aria-pressed={isApplied}
								className={`aspect-square p-[22%] flex items-center justify-center ring-1 ring-inset ring-black/10 transition-transform duration-150 ease-out will-change-transform motion-safe:hover:scale-[1.04] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
									SHAPE_RADIUS[candidate.background.shape] ?? 'rounded-lg'
								} ${isApplied ? 'outline-2 outline-offset-2 outline-primary' : 'outline-none'}`}
								style={{
									background: candidateBackgroundCss(candidate.background),
								}}
								data-track-click='logo_candidate_select'
								data-track-params={JSON.stringify({
									icon_name: layer.iconName,
									palette: candidate.palette,
								})}
							>
								{coloredSvg ? (
									<div
										className='w-full h-full'
										// biome-ignore lint/security/noDangerouslySetInnerHtml: same trusted, already-recoloured icon markup LogoCanvas renders when this candidate is applied.
										dangerouslySetInnerHTML={{ __html: coloredSvg }}
									/>
								) : (
									<div className='w-full h-full animate-pulse rounded-md bg-black/10' />
								)}
							</motion.button>
						);
					})}
				</div>
			)}

			{!loading && searched && candidates.length === 0 && !error && (
				<div className='rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground'>
					No marks for that word. Try a shorter, more concrete one.
				</div>
			)}
		</div>
	);
}
