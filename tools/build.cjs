#!/usr/bin/env node
/* CORA · compilación de producción.
   Minifica src/js/*.js y src/css/cora.css hacia assets/ y actualiza las versiones
   ?v= de index.html con un sello calculado del contenido, para que el navegador
   descargue los archivos nuevos después de cada publicación.
   Uso: npm install && npm run build */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minify } = require('terser');
const { transform } = require('lightningcss');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const out = path.join(root, 'assets');
const read = (file) => fs.readFileSync(file, 'utf8');

async function main() {
  const built = {};
  let before = 0, after = 0;

  const css = read(path.join(src, 'css', 'cora.css'));
  const cssOut = transform({
    filename: 'cora.css',
    code: Buffer.from(css),
    minify: true,
    targets: { chrome: 100 << 16, safari: 15 << 16, firefox: 100 << 16 },
  }).code.toString();
  built['cora.css'] = cssOut;
  before += css.length; after += cssOut.length;

  for (const name of fs.readdirSync(path.join(src, 'js')).filter((f) => f.endsWith('.js')).sort()) {
    const code = read(path.join(src, 'js', name));
    // toplevel:false conserva los nombres globales que comparten los scripts clásicos.
    const result = await minify(code, { compress: { passes: 2 }, mangle: true, toplevel: false, format: { comments: false } });
    built[name] = result.code;
    before += code.length; after += result.code.length;
  }

  const stamp = crypto.createHash('sha1').update(Object.values(built).join('\n')).digest('hex').slice(0, 10);
  built['cora-loader.js'] = built['cora-loader.js'].replace('__CORA_VERSION__', stamp);
  for (const [name, code] of Object.entries(built)) fs.writeFileSync(path.join(out, name), code);

  const indexPath = path.join(root, 'index.html');
  const html = read(indexPath).replace(/(assets\/[\w./-]+\.(?:js|css|png|webp))\?v=[^"]*/g, `$1?v=${stamp}`);
  fs.writeFileSync(indexPath, html);

  console.log(`CORA compilado · versión ${stamp} · ${Object.keys(built).length} archivos · ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
}

main().catch((error) => { console.error(error); process.exit(1); });
