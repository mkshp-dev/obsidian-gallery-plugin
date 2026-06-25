/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'what-is-gallery-view',
    'installation',
    'gallery-block-syntax',
    {
      type: 'category',
      label: 'Sources',
      link: {
        type: 'generated-index',
        title: 'Sources',
        description: 'Supported image source types for Gallery View.',
        slug: '/category/sources',
      },
      items: [
        'sources/local-vault-source',
        'sources/external-urls',
        'sources/immich-shared-links',
        'sources/immich-authenticated',
      ],
    },
    {
      type: 'category',
      label: 'Views',
      link: {
        type: 'generated-index',
        title: 'Views',
        description: 'Supported gallery view types for Gallery View.',
        slug: '/category/views',
      },
      items: ['views/thumbnail', 'views/carousel', 'views/grid'],
    },
    'settings',
    'troubleshooting',
    'changelog',
  ],
};

export default sidebars;
