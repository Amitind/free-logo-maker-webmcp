import { useState } from 'react';

type LazySvgProps = {
	url: string;
	alt: string;
	className?: string;
	/**
	 * No-op: kept only so existing call sites (IconCard) don't need editing.
	 * Off-screen mount/unmount is already handled by the caller's
	 * @tanstack/react-virtual virtualizer, and native <img loading="lazy">
	 * handles the fetch timing, so there's nothing left for this to root.
	 */
	ioRoot?: Element | null;
};

export function LazySvg({ url, alt, className }: LazySvgProps) {
	const [hasError, setHasError] = useState(false);

	if (hasError) {
		return (
			<div className='flex items-center justify-center size-full'>
				<svg
					xmlns='http://www.w3.org/2000/svg'
					viewBox='0 0 24 24'
					fill='none'
					stroke='currentColor'
					strokeWidth='1.5'
					className={`opacity-30 ${className ?? 'size-6'}`}
					aria-hidden='true'
				>
					<circle cx='12' cy='12' r='10' />
					<line x1='12' y1='8' x2='12' y2='12' />
					<line x1='12' y1='16' x2='12.01' y2='16' />
				</svg>
			</div>
		);
	}

	return (
		<div className='flex items-center justify-center size-full'>
			<img
				src={url}
				alt={alt}
				loading='lazy'
				className={className}
				onError={() => setHasError(true)}
			/>
		</div>
	);
}
