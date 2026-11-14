import { access, readFile, writeFile } from 'node:fs/promises';

const htmlPath = new URL('../dist/index.html', import.meta.url);
const iconPath = new URL('../dist/apple-touch-icon.png', import.meta.url);
const html = await readFile(htmlPath, 'utf8');

await access(iconPath);

let updatedHtml = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />',
);
const headTags = [
  ['name="apple-mobile-web-app-capable"', '<meta name="apple-mobile-web-app-capable" content="yes">'],
  ['name="apple-mobile-web-app-title"', '<meta name="apple-mobile-web-app-title" content="Social DL">'],
  ['name="apple-mobile-web-app-status-bar-style"', '<meta name="apple-mobile-web-app-status-bar-style" content="default">'],
  ['rel="apple-touch-icon"', '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">'],
  ['src="/theme-bootstrap.js"', '<script src="/theme-bootstrap.js"></script>'],
  ['id="webapp-theme-colors"', '<style id="webapp-theme-colors">html,body{background-color:#F7F9F8}html[data-app-theme="dark"],html[data-app-theme="dark"] body{background-color:#0D1110}</style>'],
];
const missingTags = headTags.filter(([marker]) => !updatedHtml.includes(marker)).map(([, tag]) => tag);

if (!updatedHtml.includes('</head>')) {
  throw new Error('Could not find </head> in the exported web entry point.');
}

updatedHtml = updatedHtml.replace('</head>', `${missingTags.join('\n')}\n</head>`);
await writeFile(htmlPath, updatedHtml);
