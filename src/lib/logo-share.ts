import type { BackgroundConfig, LogoLayer } from '@/components/LogoMaker';
import { iconUrl } from '@/lib/logo-icons';

/**
 * Share codes for a logo. Format: `asl1.` + base64url(deflate-raw(JSON)).
 * The payload drops per-session fields (layer `id`, resolved `url`) and
 * rebuilds them on decode, so the same logo always encodes to the same code.
 */
const PREFIX = 'asl1.';

export interface LogoState {
	canvasSize: { width: number; height: number };
	background: BackgroundConfig;
	layers: LogoLayer[];
}

type SharedLayer = Omit<LogoLayer, 'id' | 'url'>;

interface LogoPayload {
	v: 1;
	c: [number, number];
	b: BackgroundConfig;
	l: SharedLayer[];
}

const toBase64Url = (bytes: Uint8Array): string => {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
};

const fromBase64Url = (value: string): Uint8Array => {
	const padded = value
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(Math.ceil(value.length / 4) * 4, '=');
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
};

const pipe = async (
	bytes: Uint8Array,
	stream: TransformStream<BufferSource, Uint8Array>,
): Promise<Uint8Array> => {
	const writer = stream.writable.getWriter();
	// Errors surface on the readable side; ignore them here so a corrupt code
	// does not raise an unhandled rejection.
	const noop = () => {};
	writer.write(bytes as BufferSource).catch(noop);
	writer.close().catch(noop);
	const chunks: Uint8Array[] = [];
	const reader = stream.readable.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
};

export async function encodeLogo({
	canvasSize,
	background,
	layers,
}: LogoState): Promise<string> {
	const payload: LogoPayload = {
		v: 1,
		c: [canvasSize.width, canvasSize.height],
		b: background,
		l: layers.map(({ id: _id, url: _url, ...rest }) => rest),
	};
	const raw = new TextEncoder().encode(JSON.stringify(payload));
	const deflated = await pipe(raw, new CompressionStream('deflate-raw'));
	return PREFIX + toBase64Url(deflated);
}

const isNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

export async function decodeLogo(code: string): Promise<LogoState> {
	try {
		const trimmed = code.trim();
		if (!trimmed.startsWith(PREFIX)) throw new Error('bad prefix');
		const inflated = await pipe(
			fromBase64Url(trimmed.slice(PREFIX.length)),
			new DecompressionStream('deflate-raw'),
		);
		const payload = JSON.parse(new TextDecoder().decode(inflated));

		if (
			!payload ||
			payload.v !== 1 ||
			!Array.isArray(payload.c) ||
			payload.c.length !== 2 ||
			!payload.c.every(isNumber) ||
			!payload.b ||
			typeof payload.b !== 'object' ||
			!Array.isArray(payload.l)
		) {
			throw new Error('bad payload');
		}

		const layers: LogoLayer[] = payload.l.map((layer: SharedLayer) => {
			if (
				!layer ||
				typeof layer.iconName !== 'string' ||
				!isNumber(layer.x) ||
				!isNumber(layer.y) ||
				!isNumber(layer.scale)
			) {
				throw new Error('bad layer');
			}
			return {
				...layer,
				id: crypto.randomUUID(),
				url: iconUrl(layer.iconName),
			};
		});

		return {
			canvasSize: { width: payload.c[0], height: payload.c[1] },
			background: payload.b as BackgroundConfig,
			layers,
		};
	} catch {
		throw new Error('Invalid logo code');
	}
}

export function buildShareUrl(code: string): string {
	return `${location.origin}/?logo=${code}`;
}
