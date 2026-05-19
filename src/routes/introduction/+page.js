import { redirect } from '@sveltejs/kit';
import { ROUTE_INTRO } from '$lib/routes.js';

export function load() {
	redirect(308, ROUTE_INTRO);
}
