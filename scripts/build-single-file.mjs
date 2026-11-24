// Inline the Vite build (one JS bundle + one CSS file) into a single HTML file
// that can be opened by double-clicking, no web server required.
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const html = await readFile(join(dist, 'index.html'), 'utf8');

// The IIFE build folds the stylesheet into the JS bundle, so the CSS link is
// optional; only the script reference has to be there.
const cssMatch = html.match(/<link[^>]+rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/);
const jsMatch = html.match(/<script[^>]+src="\.\/([^"]+)"[^>]*><\/script>/);
if (!jsMatch) {
  throw new Error('Could not find the built JS reference in dist/index.html');
}

const js = await readFile(join(dist, jsMatch[1]), 'utf8');

// </script> inside a string literal would end the inline script early.
const safeJs = js.replace(/<\/script/gi, '<\\/script');

// Replacer functions, not strings: `$&`, `$'` and friends in the bundle would
// otherwise be interpreted as replacement patterns and corrupt the output.
let out = html.replace(jsMatch[0], '');
if (cssMatch) {
  const css = await readFile(join(dist, cssMatch[1]), 'utf8');
  out = out.replace(cssMatch[0], () => `<style>\n${css}\n</style>`);
}

// The original tag was a deferred module script; an inline classic script runs
// immediately, so it has to sit at the end of the document instead of in <head>.
const bodyEnd = out.lastIndexOf('</body>');
if (bodyEnd === -1) throw new Error('No </body> in dist/index.html');
out = out.slice(0, bodyEnd) + `<script>\n${safeJs}\n</script>\n` + out.slice(bodyEnd);

if (out.includes('src="./assets/') || out.includes('href="./assets/')) {
  throw new Error('Asset references still remain after inlining');
}

// No service worker, no module preload, no external bundle left.
const target = join(dist, 'sydney-harbor-bridge.html');
await writeFile(target, out);
console.log(`wrote ${target} (${(out.length / 1024).toFixed(0)} KB)`);
