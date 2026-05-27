import { pathWithoutBase } from '$lib/appPaths.js';

/** Site route paths (without base) — keep nav links and redirects in sync. */
export const ROUTE_INTRO = '/';
export const ROUTE_TOOL = '/tool';
export const ROUTE_METHODOLOGY = '/methodology';

/** @param {string} pathname */
export function isIntroRoute(pathname) {
	const p = pathWithoutBase(pathname);
	return p === ROUTE_INTRO || p === '/introduction';
}

/** @param {string} pathname */
export function isToolRoute(pathname) {
	return pathWithoutBase(pathname) === ROUTE_TOOL;
}

/** @param {string} pathname */
export function isMethodologyRoute(pathname) {
	return pathWithoutBase(pathname) === ROUTE_METHODOLOGY;
}
