// Before packaging: the app's icon, from the site's (public/icons/icon-512.png).
const { copyFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');

mkdirSync(path.join(__dirname, 'build'), { recursive: true });
copyFileSync(path.join(__dirname, '..', 'public', 'icons', 'icon-512.png'), path.join(__dirname, 'build', 'icon.png'));
