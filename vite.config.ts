import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'path';
// import * as pkg from './package.json';

export default defineConfig({
	plugins: [sveltekit()],
	// define: {
	// 	PKG: pkg
	// },
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib')
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	ssr: {
		external: ['reflect-metadata']
	}
});
