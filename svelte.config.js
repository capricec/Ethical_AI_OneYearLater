import adapter from '@sveltejs/adapter-static';

/** Deployed at https://originaldatum.com/EverydayEthics — override for local root dev. */
const base = process.env.BASE_PATH ?? '/EverydayEthics';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		paths: {
			base
		},
		// Writes a static site to ./build (visible in Finder) for preview or static hosting.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		})
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
