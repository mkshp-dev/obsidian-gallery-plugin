// Mirrors the Obsidian plugin review bot: the stock `recommended` config from
// eslint-plugin-obsidianmd with no rule overrides. Keep it that way so local
// lint results match what the bot reports on submission.
// See https://github.com/obsidianmd/eslint-plugin
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
	{
		// Not shipped plugin code: build output, docs site, tests and build scripts.
		ignores: [
			'main.js',
			'docs-site/**',
			'tests/**',
			'esbuild.config.mjs',
			'jest.config.js',
			'version-bump.mjs',
		],
	},
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.*'],
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
]);
