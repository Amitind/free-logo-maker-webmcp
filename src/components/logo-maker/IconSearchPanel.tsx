import { RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LazySvg } from '@/components/common/LazySvg';
import type { BackgroundConfig, LogoLayer } from '@/components/LogoMaker';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@/components/ui/input-group';
import {
	CURATED_ALL_SUGGESTED_ICONS,
	CURATED_ICON_CATEGORIES,
	ICON_API_URL,
	iconUrl,
	LOGO_PACKS,
	packOf,
	shuffle,
	sortByLogoPack,
} from '@/lib/logo-icons';
import { Button } from '../ui/button';
import { GeneratePanel } from './GeneratePanel';

export const AGENT_SEARCH_EVENT = 'logo:agent-search';

export function emitAgentSearch(query: string, icons: string[]): void {
	window.dispatchEvent(
		new CustomEvent(AGENT_SEARCH_EVENT, { detail: { query, icons } }),
	);
}

interface IconSearchPanelProps {
	/** Live icon total, passed down from LogoMaker because siteStats is build-time only. */
	totalIconsLabel: string;
	onSelectIcon: (iconName: string, url: string) => void;
	replacingLayerId?: string | null;
	onCancelReplace?: () => void;
	currentLayers?: LogoLayer[];
	currentBackground?: BackgroundConfig;
}

export const DEFAULT_SUGGESTED_ICONS = CURATED_ALL_SUGGESTED_ICONS;

export function IconSearchPanel({
	totalIconsLabel,
	onSelectIcon,
	replacingLayerId,
	onCancelReplace,
	currentLayers,
	currentBackground,
}: IconSearchPanelProps) {
	const [search, setSearch] = useState('');
	const [selectedCategory, setSelectedCategory] = useState<string>('all');
	// Starts unshuffled (deterministic), shuffled in a mount-only useEffect
	// instead: shuffle() calls Math.random(), and LogoMaker (this component's
	// root) is a client:only island specifically to avoid SSR/hydration
	// mismatches, keep randomness out of render for the same reason, in
	// case that ever changes.
	const [shuffledSuggested, setShuffledSuggested] = useState<string[]>(
		CURATED_ALL_SUGGESTED_ICONS,
	);

	useEffect(() => {
		setShuffledSuggested(shuffle(CURATED_ALL_SUGGESTED_ICONS));
	}, []);
	const [searchResults, setSearchResults] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [packFilter, setPackFilter] = useState<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const agentSearchRef = useRef<{ query: string; icons: string[] } | null>(
		null,
	);
	const ICON_LOAD_LIMIT = 300;

	useEffect(() => {
		const onAgentSearch = (event: Event) => {
			const { query, icons } = (
				event as CustomEvent<{ query: string; icons: string[] }>
			).detail;
			agentSearchRef.current = { query, icons };
			setPackFilter(null);
			setSearch(query);
		};
		window.addEventListener(AGENT_SEARCH_EVENT, onAgentSearch);
		return () => window.removeEventListener(AGENT_SEARCH_EVENT, onAgentSearch);
	}, []);

	const handleShuffleSuggested = () => {
		setShuffledSuggested(shuffle(CURATED_ALL_SUGGESTED_ICONS));
	};

	useEffect(() => {
		const query = search.trim();
		if (!query) {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
			setSearchResults([]);
			setLoading(false);
			setPackFilter(null);
			return;
		}

		if (agentSearchRef.current?.query === query) {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
			setSearchResults(sortByLogoPack(agentSearchRef.current.icons));
			setLoading(false);
			agentSearchRef.current = null;
			return;
		}

		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		const controller = new AbortController();
		abortControllerRef.current = controller;
		setLoading(true);
		setPackFilter(null);

		const fetchIcons = async () => {
			try {
				const apiUrl = ICON_API_URL;
				const res = await fetch(
					`${apiUrl}/search?query=${encodeURIComponent(query)}&limit=${ICON_LOAD_LIMIT}`,
					{ signal: controller.signal },
				);
				if (!res.ok) throw new Error('Failed');
				const data = await res.json();
				setSearchResults(sortByLogoPack(data.icons ?? []));
			} catch (err) {
				if ((err as Error).name !== 'AbortError') {
					console.error(err);
					setSearchResults([]);
				}
			} finally {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			}
		};

		const timeoutId = setTimeout(fetchIcons, 300);
		return () => {
			clearTimeout(timeoutId);
			controller.abort();
		};
	}, [search]);

	const categoryIcons = useMemo(() => {
		if (search.trim()) return searchResults;
		if (selectedCategory === 'all') return shuffledSuggested;
		const cat = CURATED_ICON_CATEGORIES.find((c) => c.id === selectedCategory);
		return cat ? cat.icons : shuffledSuggested;
	}, [search, searchResults, selectedCategory, shuffledSuggested]);

	const packOptions = useMemo(() => {
		if (!search.trim()) return [];
		const present = new Set(searchResults.map(packOf));
		return LOGO_PACKS.filter((pack) => present.has(pack)).slice(0, 6);
	}, [search, searchResults]);

	const visibleIcons = useMemo(() => {
		if (packFilter && search.trim()) {
			return categoryIcons.filter((i) => packOf(i) === packFilter);
		}
		return categoryIcons;
	}, [categoryIcons, packFilter, search]);

	return (
		<div className='flex flex-col h-full'>
			<GeneratePanel
				currentLayers={currentLayers}
				currentBackground={currentBackground}
			/>
			<div className='p-4 border-b space-y-2.5'>
				<div className='flex items-center justify-between'>
					<h2 className='text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5'>
						<span>
							{replacingLayerId
								? 'Replace icon'
								: search.trim()
									? 'Search results'
									: 'Curated Icon Ideas'}
						</span>
					</h2>
					{!search.trim() && (
						<button
							type='button'
							onClick={handleShuffleSuggested}
							className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
							title='Shuffle icon inspiration'
							data-track-click='logo_suggested_shuffle'
						>
							<RefreshCw className='size-3' />
							<span>Shuffle</span>
						</button>
					)}
				</div>

				{replacingLayerId && (
					<div className='p-2 bg-accent/50 rounded-md text-sm flex items-center justify-between'>
						<span>Replacing icon</span>
						<Button variant='destructive' size='sm' onClick={onCancelReplace}>
							Cancel
						</Button>
					</div>
				)}

				<InputGroup className='h-10'>
					<InputGroupInput
						placeholder={`Search ${totalIconsLabel} icons (e.g. coffee, rocket, shield)`}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<InputGroupAddon>
						{loading ? (
							<div className='animate-spin size-4 border-2 border-primary border-t-transparent rounded-full' />
						) : (
							<Search className='size-4 text-muted-foreground' />
						)}
					</InputGroupAddon>
				</InputGroup>

				{/* If no search term, show category chips */}
				{!search.trim() && (
					<div className='flex gap-1 overflow-x-auto flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pt-0.5'>
						<button
							type='button'
							onClick={() => setSelectedCategory('all')}
							aria-pressed={selectedCategory === 'all'}
							className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs transition-colors border ${
								selectedCategory === 'all'
									? 'bg-primary text-primary-foreground border-primary font-medium'
									: 'bg-muted/50 text-muted-foreground hover:text-foreground border-transparent'
							}`}
						>
							All
						</button>
						{CURATED_ICON_CATEGORIES.map((cat) => (
							<button
								type='button'
								key={cat.id}
								onClick={() => setSelectedCategory(cat.id)}
								aria-pressed={selectedCategory === cat.id}
								className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs transition-colors border ${
									selectedCategory === cat.id
										? 'bg-primary text-primary-foreground border-primary font-medium'
										: 'bg-muted/50 text-muted-foreground hover:text-foreground border-transparent'
								}`}
							>
								{cat.label}
							</button>
						))}
					</div>
				)}

				{/* If search term present, show pack filters */}
				{search.trim() && packOptions.length > 0 && (
					<div className='flex gap-1 overflow-x-auto flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pt-0.5'>
						{[null, ...packOptions].map((pack) => (
							<button
								type='button'
								key={pack ?? 'all'}
								onClick={() => setPackFilter(pack)}
								aria-pressed={packFilter === pack}
								className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs transition-colors border ${
									packFilter === pack
										? 'bg-muted text-foreground border-border font-medium'
										: 'text-muted-foreground hover:text-foreground border-transparent'
								}`}
							>
								{pack ?? 'All Packs'}
							</button>
						))}
					</div>
				)}
			</div>

			<div className='flex-1 overflow-y-auto [scrollbar-gutter:stable] p-3 grid grid-cols-3 gap-2.5 content-start'>
				{visibleIcons.map((iconName) => {
					const url = iconUrl(iconName);
					return (
						<button
							type='button'
							key={iconName}
							className='aspect-square rounded-xl border bg-card p-[20%] flex items-center justify-center transition-all duration-150 ease-out hover:border-primary/50 hover:bg-accent/40 hover:scale-[1.04] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
							onClick={() => onSelectIcon(iconName, url)}
							title={iconName}
							data-track-click='logo_icon_select'
							data-track-params={JSON.stringify({
								icon_name: iconName,
								replacing: Boolean(replacingLayerId),
							})}
						>
							<LazySvg alt={iconName} url={url} className='w-full h-full' />
						</button>
					);
				})}
				{visibleIcons.length === 0 && search && !loading && (
					<div className='col-span-3 rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground'>
						No icons match that keyword. Try another term or browse curated
						categories above.
					</div>
				)}
			</div>
		</div>
	);
}
