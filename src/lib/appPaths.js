import { asset, base, resolve } from '$app/paths';

/**
 * Prefix an app route with the configured base (e.g. `/EverydayEthics` on originaldatum.com).
 * @param {string} path App path such as `/`, `/tool`, `/methodology`
 */
export function appPath(path = '/') {
	return resolve(String(path ?? '').trim() || '/');
}

/**
 * Prefix a static asset path from `/static` (leading slash required).
 * @param {string} staticPath e.g. `/favicon.png`
 */
export function assetPath(staticPath) {
	return asset(String(staticPath ?? '').trim());
}

/**
 * Strip `paths.base` so route helpers can compare against `/`, `/tool`, etc.
 * @param {string} pathname `$page.url.pathname`
 */
export function pathWithoutBase(pathname) {
	const p = String(pathname ?? '');
	const b = base;
	if (!b) return p || '/';
	if (p === b || p === `${b}/`) return '/';
	if (p.startsWith(`${b}/`)) {
		let rest = p.slice(b.length) || '/';
		if (rest !== '/' && rest.endsWith('/')) rest = rest.slice(0, -1);
		return rest;
	}
	return p;
}
