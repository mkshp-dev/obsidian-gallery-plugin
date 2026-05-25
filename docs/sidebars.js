/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'getting-started',
    'installation',
    'configuration',
    'usage',
    {
      type: 'category',
      label: 'View types',
      items: ['views/thumbnail', 'views/carousel', 'views/grid'],
    },
    'remote-images',
    'troubleshooting',
  ],
};

export default sidebars;
