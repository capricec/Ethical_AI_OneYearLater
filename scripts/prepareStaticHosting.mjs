/**
 * After `vite build`, make routes work on S3-style static hosts (originaldatum.com/EverydayEthics).
 *
 * - Ensures `tool/index.html` (not only `tool.html`) for `/EverydayEthics/tool/`.
 * - Writes extensionless redirect stubs under `.s3-stubs/` for keys like `EverydayEthics/tool`
 *   (S3 allows object `tool` alongside `tool/index.html`; the local filesystem does not).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, '..', 'build');
const stubsDir = path.join(buildDir, '.s3-stubs');
const base = (process.env.BASE_PATH ?? '/EverydayEthics').replace(/\/$/, '') || '';

/** @param {string} route e.g. `tool` */
function ensureRouteDir(route) {
	const dir = path.join(buildDir, route);
	const indexPath = path.join(dir, 'index.html');
	if (fs.existsSync(indexPath)) return;

	const flatHtml = path.join(buildDir, `${route}.html`);
	if (!fs.existsSync(flatHtml)) {
		console.warn(`prepareStaticHosting: no HTML for route "${route}"`);
		return;
	}

	fs.mkdirSync(dir, { recursive: true });
	fs.copyFileSync(flatHtml, indexPath);
	console.log(`prepareStaticHosting: ${route}.html → ${route}/index.html`);
}

/** @param {string} route */
function writeExtensionlessRedirectStub(route) {
	const target = `${base}/${route}/`;
	const stubPath = path.join(stubsDir, route);
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta http-equiv="refresh" content="0;url=${target}" />
	<link rel="canonical" href="${target}" />
	<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body><p><a href="${target}">Continue</a></p></body>
</html>
`;
	fs.mkdirSync(stubsDir, { recursive: true });
	fs.writeFileSync(stubPath, html, 'utf8');
}

const routes = ['tool', 'ideology-profile', 'methodology', 'introduction'];

for (const route of routes) {
	ensureRouteDir(route);
	writeExtensionlessRedirectStub(route);
}

console.log(`
prepareStaticHosting: done.

Deploy the build/ folder as usual, then upload extensionless redirects (S3 keys without trailing slash):

  aws s3 cp build/.s3-stubs/tool s3://YOUR_BUCKET/EverydayEthics/tool --content-type "text/html"
  aws s3 cp build/.s3-stubs/ideology-profile s3://YOUR_BUCKET/EverydayEthics/ideology-profile --content-type "text/html"
  aws s3 cp build/.s3-stubs/methodology s3://YOUR_BUCKET/EverydayEthics/methodology --content-type "text/html"
  aws s3 cp build/.s3-stubs/introduction s3://YOUR_BUCKET/EverydayEthics/introduction --content-type "text/html"

Or sync once: aws s3 sync build/.s3-stubs/ s3://YOUR_BUCKET/EverydayEthics/ --exclude "*" --include "tool" ...
`);
