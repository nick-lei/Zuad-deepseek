import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const jsdomRoot = dirname(require.resolve('jsdom/package.json'));
const stylesheet = await readFile(resolve(jsdomRoot, 'lib/jsdom/browser/default-stylesheet.css'), 'utf8');

// Keep CommonJS dependencies inside the DSH entry: its desktop resolver cannot
// distinguish the userland "punycode/" package from the legacy Node builtin.
const result = await build({
  entryPoints: ['lib/index.js'],
  outfile: 'lib/index.js',
  allowOverwrite: true,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  external: ['@deepseek-ai/*', '@napi-rs/canvas', 'canvas', '../assets/playback.mjs', 'jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js'],
  banner: { js: "import { createRequire as createNodeRequire } from 'node:module';\nconst require = createNodeRequire(import.meta.url);" },
  legalComments: 'linked',
  metafile: true,
  plugins: [{
    name: 'jsdom-resources',
    setup(builder) {
      builder.onLoad({ filter: /[/\\]jsdom[/\\]living[/\\]css[/\\]helpers[/\\]computed-style\.js$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8');
        const resource = /fs\.readFileSync\(\s*path\.resolve\(__dirname, "\.\.\/\.\.\/\.\.\/browser\/default-stylesheet\.css"\),\s*\{ encoding: "utf-8" \}\s*\)/;
        assert.match(source, resource, 'Review the bundled jsdom stylesheet path after dependency updates');
        return { contents: source.replace(resource, () => JSON.stringify(stylesheet)), loader: 'js' };
      });
      builder.onLoad({ filter: /[/\\]jsdom[/\\]living[/\\]xhr[/\\]XMLHttpRequest-impl\.js$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8');
        const resource = 'require.resolve("./xhr-sync-worker.js")';
        assert.ok(source.includes(resource), 'Review the jsdom worker path after dependency updates');
        return { contents: source.replace(resource, 'require.resolve("jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js")'), loader: 'js' };
      });
    },
  }],
});

await writeFile('lib/dsh-bundle.json', JSON.stringify({
  entry: 'lib/index.js',
  inputs: Object.keys(result.metafile.inputs).sort(),
}, null, 2) + '\n');
console.log('Built DSH entry with bundled JavaScript dependencies');
