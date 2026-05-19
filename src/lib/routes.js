/** Site route paths — keep nav links and redirects in sync. */
export const ROUTE_INTRO = '/';
export const ROUTE_TOOL = '/tool';
export const ROUTE_METHODOLOGY = '/methodology';

/** @param {string} pathname */
export function isIntroRoute(pathname) {
	return pathname === ROUTE_INTRO || pathname === '/introduction';
}

/** @param {string} pathname */
export function isToolRoute(pathname) {
	return pathname === ROUTE_TOOL;
}

/** @param {string} pathname */
export function isMethodologyRoute(pathname) {
	return pathname === ROUTE_METHODOLOGY;
}
