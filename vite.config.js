import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			// The dev server needs explicit permission to read files from the root `data/` directory
			// (imported by `src/lib/data/dataset.js`).
			allow: [path.resolve(__dirname), path.resolve(__dirname, 'data')]
		}
	}
});
