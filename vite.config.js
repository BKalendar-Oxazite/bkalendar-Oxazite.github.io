import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vitest/config').UserConfig} */
const config = {
	envPrefix: ['VITE_', 'PUBLIC_'],
	build: {
		target: 'esnext',
		minify: false,
		sourcemap: true
	},
	plugins: [sveltekit()],
	test: {
		include: ['tests/**/*.test.ts']
	}
};

export default config;
