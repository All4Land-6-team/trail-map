import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = new URL('../dist/', import.meta.url)
const swUrl = new URL('sw.js', distDir)
const distPath = fileURLToPath(distDir)
const appShellFiles = []

async function collectFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(path)
    } else if (entry.name !== 'sw.js' &&
      (entry.name === 'index.html' || /\.(js|css|svg)$/.test(entry.name))) {
      appShellFiles.push(relative(distPath, path).replaceAll('\\', '/'))
    }
  }
}

await collectFiles(distPath)
appShellFiles.sort()

if (!appShellFiles.includes('index.html') || !appShellFiles.some((file) => file.endsWith('.js'))) {
  throw new Error('앱 셸의 HTML과 JavaScript 결과물이 필요합니다.')
}

const buildHash = createHash('sha256')
for (const file of appShellFiles) {
  buildHash.update(file)
  buildHash.update(await readFile(join(distPath, file)))
}
const buildId = buildHash.digest('hex').slice(0, 12)
const source = await readFile(swUrl, 'utf8')
if (!source.includes('/* __PRECACHE_MANIFEST__ */ []') || !source.includes('__BUILD_ID__')) {
  throw new Error('서비스 워커의 프리캐시 자리표시자를 찾을 수 없습니다.')
}

const output = source
  .replace('/* __PRECACHE_MANIFEST__ */ []', JSON.stringify(appShellFiles))
  .replace('__BUILD_ID__', buildId)

await writeFile(swUrl, output)
