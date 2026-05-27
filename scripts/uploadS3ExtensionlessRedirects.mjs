/**
 * Upload extensionless redirect objects after `npm run build`.
 *
 * Env:
 *   S3_BUCKET — required (e.g. originaldatum.com bucket name)
 *   S3_PREFIX — optional, default `EverydayEthics` (no leading/trailing slashes)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stubsDir = path.resolve(__dirname, '..', 'build', '.s3-stubs');
const bucket = process.env.S3_BUCKET?.trim();
const prefix = (process.env.S3_PREFIX ?? 'EverydayEthics').replace(/^\/|\/$/g, '');

if (!bucket) {
	console.error('uploadS3ExtensionlessRedirects: set S3_BUCKET to your deploy bucket name.');
	process.exit(1);
}

if (!fs.existsSync(stubsDir)) {
	console.error('uploadS3ExtensionlessRedirects: run npm run build first (missing build/.s3-stubs).');
	process.exit(1);
}

const routes = fs.readdirSync(stubsDir).filter((name) => !name.startsWith('.'));

for (const route of routes) {
	const local = path.join(stubsDir, route);
	const key = prefix ? `${prefix}/${route}` : route;
	const dest = `s3://${bucket}/${key}`;
	execFileSync(
		'aws',
		['s3', 'cp', local, dest, '--content-type', 'text/html; charset=utf-8', '--cache-control', 'max-age=300'],
		{ stdio: 'inherit' }
	);
	console.log(`uploaded ${dest}`);
}
