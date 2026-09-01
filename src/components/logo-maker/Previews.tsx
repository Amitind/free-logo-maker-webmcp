import React from 'react';
import { generateLogoSvg } from '@/lib/svg-utils';
import type { BackgroundConfig, LogoLayer } from '../LogoMaker';

interface PreviewsProps {
	layers: LogoLayer[];
	canvasSize: { width: number; height: number };
	background: BackgroundConfig;
}

export function Previews({ layers, canvasSize, background }: PreviewsProps) {
	// We need to generate a data URI for the preview
	// This logic is duplicated from ExportPanel, ideally should be shared or passed down
	const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

	React.useEffect(() => {
		const generate = async () => {
			const svg = await generateLogoSvg(layers, canvasSize, background);
			const blob = new Blob([svg], { type: 'image/svg+xml' });
			setPreviewUrl(URL.createObjectURL(blob));
		};

		const timeout = setTimeout(generate, 500); // Debounce
		return () => clearTimeout(timeout);
	}, [layers, canvasSize, background]);

	if (!previewUrl) return null;

	return (
		<div className='max-h-[80vh] overflow-y-auto '>
			<div className='space-y-6 py-4'>
				{/* App Icon Sizes */}
				<div className='space-y-3'>
					<h3 className='text-xs font-semibold uppercase tracking-wider text-foreground'>
						App Icon Sizes
					</h3>
					<div className='flex items-end justify-around gap-4 p-6 bg-muted/30 rounded-lg border'>
						{[
							{ size: 32, label: '32px' },
							{ size: 48, label: '48px' },
							{ size: 64, label: '64px' },
							{ size: 96, label: '96px' },
							{ size: 128, label: '128px' },
							{ size: 256, label: '256px' },
						].map(({ size, label }) => (
							<div key={size} className='flex flex-col items-center gap-2'>
								<div
									className='rounded-[18%] overflow-hidden shadow-md border border-border/50 bg-white flex-shrink-0'
									style={{ width: `${size}px`, height: `${size}px` }}
								>
									<img
										src={previewUrl}
										className='w-full h-full object-contain p-2'
										alt={`App Icon ${label}`}
									/>
								</div>
								<span className='text-xs text-muted-foreground font-mono'>
									{label}
								</span>
							</div>
						))}
					</div>
				</div>

				{/* Favicon & Brand Row */}
				<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
					{/* Favicon Preview */}
					<div className='space-y-3'>
						<h3 className='text-xs font-semibold uppercase tracking-wider text-foreground'>
							Favicon
						</h3>
						<div className='p-6 bg-muted/30 rounded-lg border flex flex-col items-center gap-3'>
							<div className='w-full max-w-sm bg-muted rounded-t border flex items-center px-4 py-2 gap-3 shadow-sm'>
								<div className='size-4 rounded-sm overflow-hidden bg-white flex-shrink-0'>
									<img
										src={previewUrl}
										className='w-full h-full object-contain'
										alt='Favicon'
									/>
								</div>
								<div className='h-2 flex-1 bg-foreground/10 rounded-full' />
								<div className='h-2 w-12 bg-foreground/10 rounded-full flex-shrink-0' />
							</div>
							<span className='text-xs text-muted-foreground font-mono'>
								16×16 favicon.ico
							</span>
						</div>
					</div>

					{/* Business Card / Brand Preview */}
					<div className='space-y-3'>
						<h3 className='text-xs font-semibold uppercase tracking-wider text-foreground'>
							Brand Mockup
						</h3>
						<div className='p-6 bg-muted/30 rounded-lg border flex flex-col items-center gap-3'>
							<div className='w-full max-w-sm bg-white border shadow-md rounded-lg p-4 flex items-center gap-4'>
								<img
									src={previewUrl}
									className='w-16 h-16 object-contain flex-shrink-0'
									alt='Brand'
								/>
								<div className='flex flex-col gap-2 flex-1 min-w-0'>
									<div className='h-2.5 w-full bg-slate-300 rounded' />
									<div className='h-2 w-20 bg-slate-200 rounded' />
								</div>
							</div>
							<span className='text-xs text-muted-foreground font-mono'>
								Business card
							</span>
						</div>
					</div>
				</div>

				{/* Web/Social Preview */}
				<div className='space-y-3'>
					<h3 className='text-xs font-semibold uppercase tracking-wider text-foreground'>
						Social Media
					</h3>
					<div className='p-6 bg-muted/30 rounded-lg border'>
						{/* Square Profile */}
						<div className='flex flex-col items-center gap-3'>
							<div className='w-32 h-32 rounded-2xl overflow-hidden shadow-lg border-2 border-border/50 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center'>
								<img
									src={previewUrl}
									className='w-full h-full object-contain p-4'
									alt='Profile'
								/>
							</div>
							<span className='text-xs text-muted-foreground font-mono text-center'>
								Profile Picture (1:1)
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
