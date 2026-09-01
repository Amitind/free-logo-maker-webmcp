import { type ClassValue, clsx } from 'clsx';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Compute a centered, aspect-correct destination rect for drawing an image
 * into a square canvas of the given size, without stretching it. Keeps the
 * canvas itself at size x size (transparent letterbox padding) while the
 * drawn image retains its real proportions.
 */
function fitRectInSquare(
	imgWidth: number,
	imgHeight: number,
	size: number,
): { x: number; y: number; width: number; height: number } {
	const srcWidth = imgWidth || size;
	const srcHeight = imgHeight || size;
	const scale = size / Math.max(srcWidth, srcHeight);
	const width = srcWidth * scale;
	const height = srcHeight * scale;
	return { x: (size - width) / 2, y: (size - height) / 2, width, height };
}

// ========== Clipboard Utilities ==========

/**
 * Copy text to clipboard with optional toast feedback.
 * @param text     The text to copy
 * @param message  Success toast message (pass `false` to suppress toast)
 */
export async function copyToClipboard(
	text: string,
	message: string | false = 'Copied to clipboard',
): Promise<boolean> {
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
		} else {
			// Fallback for older browsers
			const textArea = document.createElement('textarea');
			textArea.value = text;
			textArea.style.position = 'fixed';
			textArea.style.left = '-999999px';
			textArea.style.top = '-999999px';
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			document.execCommand('copy');
			document.body.removeChild(textArea);
		}
		if (message !== false) toast.success(message);
		return true;
	} catch {
		toast.error('Failed to copy');
		return false;
	}
}

/**
 * Copy a PNG image blob to clipboard from an SVG string.
 * Renders SVG to a 512×512 canvas, then copies via ClipboardItem.
 * @param svgString  Raw SVG markup
 * @param message    Success toast (pass `false` to suppress)
 */
export async function copyImageToClipboard(
	svgString: string,
	message: string | false = 'Copied PNG to clipboard',
): Promise<boolean> {
	return new Promise((resolve) => {
		try {
			const img = new Image();
			const svgBlob = new Blob([svgString], {
				type: 'image/svg+xml;charset=utf-8',
			});
			const url = URL.createObjectURL(svgBlob);

			img.onload = () => {
				const canvas = document.createElement('canvas');
				canvas.width = 512;
				canvas.height = 512;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					toast.error('Failed to copy PNG');
					resolve(false);
					return;
				}
				const rect = fitRectInSquare(img.naturalWidth, img.naturalHeight, 512);
				ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
				canvas.toBlob(async (blob) => {
					URL.revokeObjectURL(url);
					if (!blob) {
						toast.error('Failed to copy PNG');
						resolve(false);
						return;
					}
					try {
						await navigator.clipboard.write([
							new ClipboardItem({ 'image/png': blob }),
						]);
						if (message !== false) toast.success(message);
						resolve(true);
					} catch {
						toast.error('Failed to copy PNG');
						resolve(false);
					}
				});
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				toast.error('Failed to generate PNG');
				resolve(false);
			};
			img.src = url;
		} catch {
			toast.error('Failed to generate PNG');
			resolve(false);
		}
	});
}

/**
 * Download a file from a blob.
 * @param content   String content
 * @param filename  Download filename
 * @param mimeType  MIME type for the blob
 * @param message   Success toast (pass `false` to suppress)
 */
export function downloadBlob(
	content: string,
	filename: string,
	mimeType = 'image/svg+xml;charset=utf-8',
	message: string | false = 'Downloaded',
): void {
	try {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		if (message !== false) toast.success(message);
	} catch {
		toast.error('Failed to download');
	}
}

/**
 * Download a PNG from an SVG string.
 * @param svgString  Raw SVG markup
 * @param filename   Download filename
 * @param message    Success toast (pass `false` to suppress)
 */
export function downloadPng(
	svgString: string,
	filename: string,
	message: string | false = 'Downloaded PNG',
): void {
	try {
		const img = new Image();
		const svgBlob = new Blob([svgString], {
			type: 'image/svg+xml;charset=utf-8',
		});
		const url = URL.createObjectURL(svgBlob);

		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = 512;
			canvas.height = 512;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			const rect = fitRectInSquare(img.naturalWidth, img.naturalHeight, 512);
			ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
			const pngUrl = canvas.toDataURL('image/png');
			const a = document.createElement('a');
			a.href = pngUrl;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			if (message !== false) toast.success(message);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			toast.error('Failed to download PNG');
		};
		img.src = url;
	} catch {
		toast.error('Failed to download PNG');
	}
}

/**
 * Generate a data URI from an SVG string.
 */
export function svgToDataUri(svgString: string): string {
	return `data:image/svg+xml;base64,${btoa(svgString)}`;
}

// ========== URL Utilities ==========

/**
 * Build the canonical URL for an icon on its pack page.
 * Always points to /pack/{packSlug}/#iconName regardless of the current page.
 *
 * @param packSlug  The icon pack slug (e.g. "lucide")
 * @param iconName  The icon name (e.g. "arrow-right")
 */
export function getIconUrl(packSlug: string, iconName: string): string {
	const origin = typeof window !== 'undefined' ? window.location.origin : '';
	return `${origin}/pack/${packSlug}/#${encodeURIComponent(iconName)}`;
}
