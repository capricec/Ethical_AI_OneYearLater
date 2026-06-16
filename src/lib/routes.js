import { appPath, pathWithoutBase } from '$lib/appPaths.js';

/** Site route paths (without base) — keep nav links and redirects in sync. */
export const ROUTE_INTRO = '/';
export const ROUTE_TOOL = '/tool';
export const ROUTE_IDEOLOGY_PROFILE = '/ideology-profile';
export const ROUTE_METHODOLOGY = '/methodology';

/** Query param to auto-open the ideology quiz on `/ideology-profile`. */
export const IDEOLOGY_QUIZ_QUERY = 'quiz';

/** @returns {string} */
export function ideologyProfileQuizHref() {
	return `${appPath(ROUTE_IDEOLOGY_PROFILE)}?${IDEOLOGY_QUIZ_QUERY}=1`;
}

/** @param {URLSearchParams} searchParams */
export function isIdeologyQuizDeepLink(searchParams) {
	if (!searchParams.has(IDEOLOGY_QUIZ_QUERY)) return false;
	const value = searchParams.get(IDEOLOGY_QUIZ_QUERY);
	return value === null || value === '' || value === '1' || value === 'true';
}

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
export function isIdeologyProfileRoute(pathname) {
	return pathWithoutBase(pathname) === ROUTE_IDEOLOGY_PROFILE;
}

/** @param {string} pathname */
export function isMethodologyRoute(pathname) {
	return pathWithoutBase(pathname) === ROUTE_METHODOLOGY;
}
