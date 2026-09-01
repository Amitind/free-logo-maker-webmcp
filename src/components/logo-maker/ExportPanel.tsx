import {
	Bookmark,
	ChevronDown,
	Download,
	Eye,
	FileImage,
	FileType,
	Share2,
	Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { emitCandidate } from '@/lib/logo-icons';
import { buildShareUrl, decodeLogo, encodeLogo } from '@/lib/logo-share';
import { saveLogo, svgToDataUri } from '@/lib/my-logos';
import {
	exportLogoGif,
	generateAnimatedLogoSvg,
	generateLogoSvg,
} from '@/lib/svg-utils';
import type { BackgroundConfig, LogoLayer } from '../LogoMaker';
import { Previews } from './Previews';

/** Joined segmented-control item: hairlines collapse, the hovered edge lifts. */
const GROUP_ITEM = 'relative shrink-0 focus-visible:z-10 hover:z-10';

interface ExportPanelProps {
	layers: LogoLayer[];
	canvasSize: { width: number; height: number };
	background: BackgroundConfig;
}

export function ExportPanel({
	layers,
	canvasSize,
	background,
}: ExportPanelProps) {
	const [shareCode, setShareCode] = useState('');
	const [copied, setCopied] = useState<'code' | 'link' | null>(null);
	const [pastedCode, setPastedCode] = useState('');
	const [loadError, setLoadError] = useState('');
	const [saved, setSaved] = useState(false);

	/**
	 * Keep the logo in "My logos". The SVG is the same string the download
	 * writes, so the thumbnail always matches the exported file.
	 */
	const persist = async (svgString?: string) => {
		if (layers.length === 0) return;
		try {
			const code = await encodeLogo({ canvasSize, background, layers });
			const svg =
				svgString ?? (await generateLogoSvg(layers, canvasSize, background));
			saveLogo({
				code,
				thumb: svgToDataUri(svg),
				iconName: layers[0]?.iconName ?? 'logo',
			});
		} catch {
			// Saving is a convenience: a failure never blocks the download.
		}
	};

	const handleSave = async () => {
		await persist();
		setSaved(true);
		setTimeout(() => setSaved(false), 1500);
	};

	const handleShareOpen = async (open: boolean) => {
		if (!open) return;
		setCopied(null);
		setLoadError('');
		try {
			setShareCode(await encodeLogo({ canvasSize, background, layers }));
		} catch {
			setShareCode('');
		}
	};

	const copy = async (value: string, which: 'code' | 'link') => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(which);
			setTimeout(() => setCopied(null), 1500);
		} catch {
			setCopied(null);
		}
	};

	const handleLoadCode = async () => {
		try {
			const state = await decodeLogo(pastedCode);
			emitCandidate({
				layers: state.layers,
				background: state.background,
				palette: 'shared',
				canvasSize: state.canvasSize,
			});
			setPastedCode('');
			setLoadError('');
		} catch {
			setLoadError('That code could not be read.');
		}
	};

	const handleExportSvg = async () => {
		const svgString = await generateLogoSvg(layers, canvasSize, background);
		const blob = new Blob([svgString], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'logo.svg';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		await persist(svgString);
	};

	const handleExportPng = async () => {
		const svgString = await generateLogoSvg(layers, canvasSize, background);
		const img = new Image();
		const blob = new Blob([svgString], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);

		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = canvasSize.width;
			canvas.height = canvasSize.height;
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.drawImage(img, 0, 0);
				const pngUrl = canvas.toDataURL('image/png');
				const a = document.createElement('a');
				a.href = pngUrl;
				a.download = 'logo.png';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			}
			URL.revokeObjectURL(url);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			toast.error('Could not export PNG. Try a different logo or browser.');
		};
		img.src = url;
		await persist(svgString);
	};

	const handleExportAnimatedSvg = async () => {
		const svgString = await generateAnimatedLogoSvg(
			layers,
			canvasSize,
			background,
		);
		const blob = new Blob([svgString], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'logo-animated.svg';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleExportGif = async () => {
		try {
			const blob = await exportLogoGif(layers, canvasSize, background);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'logo.gif';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {
			toast.error(
				'Could not export GIF. Try again or export a static SVG instead.',
			);
		}
	};

	const hasAnimatedLayer = layers.some(
		(layer) => layer.animationType && layer.animationType !== 'none',
	);

	return (
		<div className='space-y-2'>
			<div className='flex items-center justify-between'>
				<h2 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
					Export
				</h2>
				<span className='text-xs text-muted-foreground tabular-nums'>
					{canvasSize.width} x {canvasSize.height}
				</span>
			</div>

			<div className='flex items-center gap-2' data-export-row>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant='default' className='min-w-0 flex-1'>
							<Download className='size-4 mr-2' />
							Download
							<ChevronDown className='size-4 ml-2 opacity-70' />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end'>
						<DropdownMenuItem
							onClick={handleExportSvg}
							data-track-click='logo_download_svg'
						>
							<FileType className='size-4 mr-2' />
							Download SVG
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={handleExportPng}
							data-track-click='logo_download_png'
						>
							<FileImage className='size-4 mr-2' />
							Download PNG
						</DropdownMenuItem>
						{hasAnimatedLayer && (
							<>
								<DropdownMenuItem
									onClick={handleExportAnimatedSvg}
									data-track-click='logo_download_animated_svg'
								>
									<Sparkles className='size-4 mr-2' />
									Download Animated SVG
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={handleExportGif}
									data-track-click='logo_download_gif'
								>
									<FileImage className='size-4 mr-2' />
									Download GIF
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Save / Share / Preview read as one segmented control, so the
				    three secondary actions cost the width of one button plus two. */}
				<div className='inline-flex shrink-0'>
					<Button
						variant='outline'
						size='icon'
						className={`size-9 rounded-r-none ${GROUP_ITEM}`}
						disabled={layers.length === 0}
						onClick={handleSave}
						data-track-click='logo_save'
						title={saved ? 'Saved to My logos' : 'Save to My logos'}
						aria-label={saved ? 'Saved to My logos' : 'Save to My logos'}
					>
						<Bookmark className={`size-4 ${saved ? 'fill-current' : ''}`} />
					</Button>

					<Popover onOpenChange={handleShareOpen}>
						<PopoverTrigger asChild>
							<Button
								variant='outline'
								size='icon'
								className={`size-9 -ml-px rounded-none ${GROUP_ITEM}`}
								data-track-click='logo_share_open'
								title='Share logo'
								aria-label='Share logo'
							>
								<Share2 className='size-4' />
							</Button>
						</PopoverTrigger>
						<PopoverContent align='end' className='w-80 space-y-3'>
							<div className='space-y-1.5'>
								<span className='text-xs font-medium'>Logo code</span>
								<Textarea
									readOnly
									value={shareCode}
									rows={3}
									className='text-[11px] font-mono break-all'
									onFocus={(event) => event.currentTarget.select()}
									aria-label='Logo code'
								/>
								<div className='flex gap-2'>
									<Button
										variant='secondary'
										size='sm'
										className='flex-1'
										disabled={!shareCode}
										data-track-click='logo_share_copy_code'
										onClick={() => copy(shareCode, 'code')}
									>
										{copied === 'code' ? 'Copied' : 'Copy code'}
									</Button>
									<Button
										variant='secondary'
										size='sm'
										className='flex-1'
										disabled={!shareCode}
										data-track-click='logo_share_copy_link'
										onClick={() => copy(buildShareUrl(shareCode), 'link')}
									>
										{copied === 'link' ? 'Copied' : 'Copy link'}
									</Button>
								</div>
							</div>

							<div className='space-y-1.5 border-t pt-3'>
								<span className='text-xs font-medium'>Paste a code</span>
								<div className='flex gap-2'>
									<Input
										value={pastedCode}
										onChange={(event) => setPastedCode(event.target.value)}
										placeholder='asl1.'
										className='h-8 text-xs'
										aria-label='Paste a logo code'
									/>
									<Button
										size='sm'
										className='h-8'
										disabled={!pastedCode.trim()}
										data-track-click='logo_share_load'
										onClick={handleLoadCode}
									>
										Load
									</Button>
								</div>
								{loadError && (
									<p className='text-xs text-destructive'>{loadError}</p>
								)}
							</div>
						</PopoverContent>
					</Popover>

					<Dialog>
						<DialogTrigger asChild>
							<Button
								variant='outline'
								size='icon'
								className={`size-9 -ml-px rounded-l-none ${GROUP_ITEM}`}
								data-track-click='logo_preview'
								title='Preview logo'
								aria-label='Preview logo'
							>
								<Eye className='size-4' />
							</Button>
						</DialogTrigger>
						<DialogContent className='min-w-6xl'>
							<DialogHeader>
								<DialogTitle>Logo previews</DialogTitle>
							</DialogHeader>
							<Previews
								layers={layers}
								canvasSize={canvasSize}
								background={background}
							/>
						</DialogContent>
					</Dialog>
				</div>
			</div>
		</div>
	);
}
