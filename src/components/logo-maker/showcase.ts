import type { BackgroundConfig, LogoLayer } from '@/components/LogoMaker';
import brandShowcaseData from '@/data/brandShowcase.json';
import curatedShowcaseData from '@/data/curatedShowcase.json';

export interface ShowcaseLogo {
	slug: string;
	name: string;
	brandName?: string;
	category?: string;
	tagline: string;
	image: string;
	canvasSize: { width: number; height: number };
	background: BackgroundConfig;
	layers: Array<Omit<LogoLayer, 'id' | 'url'>>;
	code: string;
}

export const TOP_BRAND_LOGOS: ShowcaseLogo[] =
	brandShowcaseData as unknown as ShowcaseLogo[];

export const SHOWCASE_LOGOS: ShowcaseLogo[] =
	curatedShowcaseData as unknown as ShowcaseLogo[];
