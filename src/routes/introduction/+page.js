import { redirect } from '@sveltejs/kit';
import { appPath } from '$lib/appPaths.js';
import { ROUTE_INTRO } from '$lib/routes.js';

export function load() {
	redirect(308, appPath(ROUTE_INTRO));
}
