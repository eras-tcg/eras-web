#!/usr/bin/env node
// Copies the game engine's browser package (DriveManager/eras-engine, `./gradlew jsBrowserProductionLibraryDistribution`)
// into vendor/eras-engine, and writes which DriveManager commit it was built from (vendor/eras-engine/BUILD.json and
// src/app/data-access/simulator/engine-build.ts, whose id versions the engine's assets so browsers fetch the new ones).
//
//   npm run engine:update                    # from ../DriveManager/eras-engine/build/dist/js/productionLibrary
//   ERAS_ENGINE_DIST=/path/to/dist npm run engine:update
//
// eras-web's own build never runs this: it uses what is committed in vendor/eras-engine.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engineDir = resolve(root, '../DriveManager/eras-engine');
const dist = resolve(process.env.ERAS_ENGINE_DIST ?? join(engineDir, 'build/dist/js/productionLibrary'));
const vendor = join(root, 'vendor/eras-engine');

if (!existsSync(join(dist, 'eras-engine.mjs'))) {
  console.error(`No engine package at ${dist}.`);
  console.error('Build it first: cd ../DriveManager/eras-engine && ./gradlew jsBrowserProductionLibraryDistribution');
  process.exit(1);
}

/** What a game needs: the ES modules, their types, the package's manifest and its three data files (no source maps). */
const wanted = (name) => /\.(mjs|d\.mts|json)$/.test(name) && !name.endsWith('.map');
const files = readdirSync(dist).filter(wanted).sort();

mkdirSync(vendor, { recursive: true });
for (const old of readdirSync(vendor)) if (wanted(old) && old !== 'BUILD.json') rmSync(join(vendor, old));
for (const name of files) copyFileSync(join(dist, name), join(vendor, name));

/** The engine's project: four levels up from build/dist/js/productionLibrary. */
const sourceDir = existsSync(resolve(dist, '../../../../build.gradle.kts')) ? resolve(dist, '../../../..') : dist;
/** The DriveManager commit of the package (and whether its tree had changes), when it comes from a checkout. */
function git(...args) {
  try {
    return execFileSync('git', ['-C', sourceDir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}
const commit = git('rev-parse', 'HEAD');
const dirty = commit ? git('status', '--porcelain', '--untracked-files=no', '--', '.') !== '' : null;
const subject = commit ? git('log', '-1', '--format=%s') : null;
const build = { commit, dirty, subject, copiedAt: new Date().toISOString(), files };
writeFileSync(join(vendor, 'BUILD.json'), JSON.stringify(build, null, 2) + '\n');

const id = commit ? commit.slice(0, 12) + (dirty ? '-dirty' : '') : build.copiedAt.replace(/\D/g, '').slice(0, 14);
writeFileSync(
  join(root, 'src/app/data-access/simulator/engine-build.ts'),
  `// Written by \`npm run engine:update\` (scripts/engine-update.mjs): do not edit.\n` +
    `/** The vendored engine's build (vendor/eras-engine/BUILD.json): it versions the engine's assets (/engine/*.json). */\n` +
    `export const ENGINE_BUILD = '${id}';\n`,
);

console.log(`Copied ${files.length} files from ${dist}`);
console.log(`DriveManager ${commit ?? '(not a git checkout)'}${dirty ? ' (with uncommitted changes)' : ''}${subject ? ` — ${subject}` : ''}`);
