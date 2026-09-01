import { X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { emitCandidate } from '@/lib/logo-icons';
import { decodeLogo } from '@/lib/logo-share';
import {
	listLogos,
	relativeTime,
	removeLogo,
	SAVED_LOGOS_EVENT,
	type SavedLogo,
} from '@/lib/my-logos';

/** Everything after the pack prefix, e.g. `ph:coffee-fill` -> `coffee fill`. */
function labelOf(iconName: string): string {
	const raw = iconName.slice(iconName.indexOf(':') + 1);
	return raw.replace(/-/g, ' ') || 'logo';
}

export function MyLogosPanel() {
	const [logos, setLogos] = useState<SavedLogo[]>([]);
	const [error, setError] = useState<string | null>(null);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		const refresh = () => setLogos(listLogos());
		refresh();
		window.addEventListener(SAVED_LOGOS_EVENT, refresh);
		return () => window.removeEventListener(SAVED_LOGOS_EVENT, refresh);
	}, []);

	const load = async (logo: SavedLogo) => {
		try {
			const state = await decodeLogo(logo.code);
			emitCandidate({
				layers: state.layers,
				background: state.background,
				palette: 'saved',
				canvasSize: state.canvasSize,
			});
			setError(null);
		} catch {
			setError('That saved logo could not be read.');
		}
	};

	return (
		<div className='h-full overflow-y-auto [scrollbar-gutter:stable] p-4 space-y-3'>
			<h2 className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
				My logos
			</h2>

			{error && <p className='text-xs text-destructive'>{error}</p>}

			{logos.length === 0 ? (
				<div className='rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground'>
					Logos you download or save show up here. Stored in this browser only.
				</div>
			) : (
				<div className='grid grid-cols-3 gap-2'>
					{logos.map((logo, index) => (
						<motion.div
							key={logo.id}
							className='group relative'
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
						>
							<button
								type='button'
								onClick={() => load(logo)}
								title={`${logo.iconName} saved ${relativeTime(logo.savedAt)}`}
								className='block w-full aspect-square overflow-hidden rounded-lg ring-1 ring-inset ring-black/10 bg-muted transition-transform duration-150 ease-out will-change-transform motion-safe:hover:scale-[1.04] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
								data-track-click='logo_saved_load'
								data-track-params={JSON.stringify({ icon_name: logo.iconName })}
							>
								{logo.thumb ? (
									<img
										src={logo.thumb}
										alt={logo.iconName}
										className='w-full h-full object-cover'
									/>
								) : (
									<span className='flex h-full w-full items-center justify-center p-2 text-[10px] leading-tight text-muted-foreground break-words'>
										{labelOf(logo.iconName)}
									</span>
								)}
							</button>

							<button
								type='button'
								onClick={() => setLogos(removeLogo(logo.id))}
								aria-label={`Remove saved logo ${labelOf(logo.iconName)}`}
								className='absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border bg-card text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
								data-track-click='logo_saved_remove'
							>
								<X className='size-3' />
							</button>

							<p className='mt-1 truncate text-[10px] text-muted-foreground'>
								{relativeTime(logo.savedAt)}
							</p>
						</motion.div>
					))}
				</div>
			)}
		</div>
	);
}
