import esbuild from "esbuild";

const banner =
`/*
Obsidian Gallery Plugin - Simple Version
*/
`;

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ["main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron"
	],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: false,
	treeShaking: true,
	outfile: "main.js",
});

await context.rebuild();
process.exit(0);