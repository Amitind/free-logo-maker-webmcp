import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://logo.allsvgicons.com',
	integrations: [react()],
	vite: {
		plugins: [tailwindcss()],
	},
});
