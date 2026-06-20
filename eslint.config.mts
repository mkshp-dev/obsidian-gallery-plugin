import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';

export default tseslint.config(
	globalIgnores([
		'node_modules',
		'dist',
		'docs',
		'scripts',
		'tests',
		'esbuild.config.mjs',
		'jest.config.js',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json', 'jest.config.js'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		rules: {
			"obsidianmd/ui/sentence-case": ["error", {
				"enforceCamelCaseLower": true,
				"acronyms": ["BQL", "USD", "INR", "EUR", "BTC", "GOLD", "CSV", "AST", "HTML", "UI", "URL", "HEAD", "JSON", "YYYY-MM-DD", "BQL-q"],
				"ignoreWords": ["Beancount", "Markdown", "markdown", "Python", "GitHub", "Beancount settings", "Beancount snapshot", "Beancount dashboard", "Beancount configuration", "Transactions/2025.beancount", "Transactions/2025/2025-01.beancount", "queries.beancount", "bql-q:name", "bql:name", "assets:bank:checking", "Try Again", "Try", "Again", "Content-Type", "HEAD", "URLs"]
			}],
			// "@typescript-eslint/no-explicit-any": "off",
			// "@typescript-eslint/no-unsafe-assignment": "off",
			// "@typescript-eslint/no-unsafe-member-access": "off",
			// "@typescript-eslint/no-unsafe-call": "off",
			// "@typescript-eslint/no-unsafe-argument": "off",
			// "@typescript-eslint/no-unsafe-return": "off",
			// "@typescript-eslint/no-non-null-assertion": "off",
			// "@typescript-eslint/no-floating-promises": "off",
			// "@typescript-eslint/no-misused-promises": "off",
			// "@typescript-eslint/restrict-template-expressions": "off",
			// "@typescript-eslint/no-redundant-type-constituents": "off",
			// "@typescript-eslint/no-unnecessary-type-assertion": "off",
			// "@typescript-eslint/no-unused-vars": "off",
			// "@typescript-eslint/no-deprecated": "off",
			// "@typescript-eslint/await-thenable": "off",
			//"@typescript-eslint/no-unused-expressions": "off",
			// "@typescript-eslint/only-throw-error": "off",
			"no-empty": "error",
			// "no-undef": "off",
			// "no-restricted-globals": "off",
			// "obsidianmd/prefer-active-doc": "off",
			//"obsidianmd/prefer-window-timers": "off",
			// "obsidianmd/rule-custom-message": "off",
			// "obsidianmd/prefer-instanceof": "off",
			// "obsidianmd/no-tfile-tfolder-cast": "off"
		}
	}
);
