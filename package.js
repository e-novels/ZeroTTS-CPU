const path = require('node:path')
const fs = require('node:fs')
const AdmZip = require('adm-zip')

const root = __dirname
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension.json'), 'utf8'))
const archiveName = `${manifest.name}-${manifest.version}.zip`
const archive = new AdmZip()

function requirePackagedAsset(relativePath, field) {
	if (typeof relativePath !== 'string' || !relativePath) {
		throw new Error(`${field} must be a non-empty relative path.`)
	}
	const normalized = relativePath.replace(/\\/g, '/')
	if (normalized.includes('..') || normalized.startsWith('/')) {
		throw new Error(`${field} must be a safe relative path.`)
	}
	const assetPath = [
		path.join(root, normalized),
		path.join(root, 'src', normalized)
	].find(fs.existsSync)
	if (!assetPath) throw new Error(`${field} does not exist: ${relativePath}`)
	archive.addLocalFile(assetPath, path.dirname(normalized))
}

archive.addLocalFile(path.join(root, 'extension.json'))
archive.addLocalFile(path.join(root, 'README.md'))
archive.addLocalFolder(path.join(root, 'dist'), 'dist')
archive.addLocalFolder(path.join(root, 'src', 'public'), 'public')

requirePackagedAsset(manifest.icon, 'icon')

for (const [index, theme] of (manifest.contributes?.themes || []).entries()) {
	requirePackagedAsset(theme.path, `contributes.themes[${index}].path`)
}
archive.writeZip(path.join(root, archiveName))

const archivePath = path.join(root, archiveName)
const sizeKilobytes = (fs.statSync(archivePath).size / 1024).toFixed(1)
console.log(`[${manifest.displayName || manifest.name}] Created ${archiveName} (${sizeKilobytes} KB)`)