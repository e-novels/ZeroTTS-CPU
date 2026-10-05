const path = require('node:path')
const fs = require('node:fs')
const { build, context } = require('esbuild')

const root = __dirname
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension.json'), 'utf8'))
const extensionKind = manifest.starter?.kind
const isWatch = process.argv.includes('--watch') || process.argv.includes('-w')

// Ensure dist directory has the WebAssembly binary
const wasmSrc = path.resolve(root, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm')
if (fs.existsSync(wasmSrc)) {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true })
  fs.copyFileSync(wasmSrc, path.join(root, 'dist/ort-wasm-simd-threaded.wasm'))
}

async function bundle(outfile, platform) {
  const options = {
    entryPoints: [path.join(root, 'src/index.ts')],
    outfile: path.join(root, outfile),
    bundle: true,
    format: 'cjs',
    platform: platform,
    mainFields: ['main'],
    target: 'es2022',
    legalComments: 'none',
    minify: false,
    define: {
      __NOVEL_EXTENSION_KIND__: JSON.stringify(extensionKind)
    },
    alias: {
      'onnxruntime-web': path.resolve(root, 'node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs')
    },
    external: ['onnxruntime-node']
  }

  if (isWatch) {
    const ctx = await context(options)
    await ctx.watch()
    console.log(`[esbuild watch] Watching ${outfile} for changes...`)
  } else {
    await build(options)
  }
}

Promise.all([
  bundle('dist/index.js', 'node'),
  bundle('dist/browser.js', 'browser')
]).catch(error => {
  console.error(error)
  process.exitCode = 1
})