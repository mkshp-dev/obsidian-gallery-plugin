// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Image Gallery',
  tagline: 'Create interactive image galleries in your Obsidian notes.',
  favicon: 'img/favicon.ico',

  url: 'https://mkshp-dev.github.io',
  baseUrl: '/obsidian-gallery-plugin/',

  organizationName: 'mkshp-dev',
  projectName: 'obsidian-gallery-plugin',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/mkshp-dev/obsidian-gallery-plugin/tree/Dev/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Image Gallery',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/mkshp-dev/obsidian-gallery-plugin',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting started', to: '/docs/getting-started' },
              { label: 'Configuration', to: '/docs/configuration' },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub Issues',
                href: 'https://github.com/mkshp-dev/obsidian-gallery-plugin/issues',
              },
              {
                label: 'Discussions',
                href: 'https://github.com/mkshp-dev/obsidian-gallery-plugin/discussions',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} mkshp. Built with Docusaurus.`,
      },
    }),
};

export default config;
