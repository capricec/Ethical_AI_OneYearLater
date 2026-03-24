/**
 * @param {unknown} subscaleKey — snake_case id from encoding (e.g. gender_roles)
 */
export function subscaleDisplayName(subscaleKey) {
	const k = String(subscaleKey ?? '').trim();
	if (!k) return 'Uncategorized';
	return k
		.split('_')
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(' ');
}
