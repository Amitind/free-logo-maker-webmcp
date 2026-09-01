import { Shuffle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { buildCandidate, fetchLogoIcons, PALETTES } from '@/lib/logo-icons';
import type { BackgroundConfig, LogoLayer } from '../LogoMaker';
import { Spinner } from '../ui/spinner';

interface RandomizeControlProps {
	onRandomize: (layers: LogoLayer[], background: BackgroundConfig) => void;
	canvasSize: { width: number; height: number };
	// Icon-only button (toolbar), instead of the full-width labeled button.
	compact?: boolean;
}

// Logo-friendly seed terms for the randomizer.
const SEARCH_TERMS = [
	'nature',
	'tech',
	'animal',
	'abstract',
	'geometry',
	'business',
	'minimal',
	'food',
	'travel',
	'music',
	'star',
	'circle',
	'arrow',
	'shield',
	'crown',
	'heart',
	'code',
	'rocket',
	'leaf',
	'sun',
	'moon',
	'mountain',
	'wave',
	'fire',
	'coffee',
	'paw',
	'bolt',
];

const SHAPES: BackgroundConfig['shape'][] = ['rectangle', 'circle', 'squircle'];

const pick = <T,>(items: readonly T[]): T =>
	items[Math.floor(Math.random() * items.length)];

export function RandomizeControl({
	onRandomize,
	canvasSize,
	compact = false,
}: RandomizeControlProps) {
	const [loading, setLoading] = useState(false);

	const handleRandomize = async () => {
		setLoading(true);
		try {
			const term = pick(SEARCH_TERMS);
			const icons = await fetchLogoIcons(term, undefined, 12);
			if (icons.length === 0) throw new Error('No icons found');

			const candidate = buildCandidate(
				pick(icons),
				canvasSize,
				Math.floor(Math.random() * PALETTES.length),
				pick(SHAPES),
			);

			onRandomize(candidate.layers, candidate.background);
		} catch (error) {
			console.error('Randomization failed:', error);
		} finally {
			setLoading(false);
		}
	};

	if (compact) {
		return (
			<Button
				type='button'
				variant='outline'
				size='icon'
				onClick={handleRandomize}
				disabled={loading}
				className='size-8'
				title={loading ? 'Designing...' : 'Randomize logo'}
				data-track-click='logo_randomizer_click'
			>
				{loading ? <Spinner /> : <Shuffle className='size-3.5' />}
			</Button>
		);
	}

	return (
		<Button
			variant='outline'
			size='sm'
			onClick={handleRandomize}
			disabled={loading}
			className='w-full'
			data-track-click='logo_randomizer_click'
		>
			{loading ? <Spinner /> : <Shuffle className='mr-2 h-4 w-4' />}
			{loading ? 'Designing' : 'Randomize Logo'}
		</Button>
	);
}
