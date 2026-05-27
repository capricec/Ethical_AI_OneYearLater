/**
 * Radial value-axis labels: title-case + debate-specific renames (e.g. Tax Evasion).
 * Used on debate radial spokes, VALUE headers, and related copy.
 */

/** @param {string} tension */
export function normDebateTensionKey(tension) {
	return String(tension ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ');
}

/** Tensions whose spoke scale runs outer→inner (inverted) in debate radial. */
const DEBATE_TENSION_AXIS_FLIPPED = new Set(
	[
		'child welfare',
		'fair use of public resources',
		'fair use of government resources',
		'press independence',
		'educational gender equality',
		'social safety net'
	].map(normDebateTensionKey)
);

/** @type {Record<string, string>} */
const DEBATE_TENSION_DISPLAY_NAMES = {
	'tax honesty': 'Tax Evasion',
	'property rights': 'Property Theft',
	'civic honesty': 'Civic Dishonesty'
};

/** @param {string} tension */
export function debateTensionAxisFlipped(tension) {
	return DEBATE_TENSION_AXIS_FLIPPED.has(normDebateTensionKey(tension));
}

/**
 * Title-case tension label with debate-specific renames.
 * @param {string} tension
 */
export function formatDebateTensionLabel(tension) {
	const key = normDebateTensionKey(tension);
	if (!key) return '';
	const named = DEBATE_TENSION_DISPLAY_NAMES[key];
	if (named) return named;
	return key
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

/**
 * Label for a selected statement’s value axis — matches debate radial spoke titles when a
 * debate is active; otherwise uses `statement_encoding.json` `tension` on the item.
 * @param {{ item_id?: string, tension?: string } | null | undefined} item
 * @param {{ source_items?: string[], tensions?: string[], primary_tensions?: string[] } | null | undefined} [debate]
 */
export function radialTensionLabelForStatement(item, debate) {
	const itemId = String(item?.item_id ?? '').trim();
	if (debate && itemId) {
		const src = Array.isArray(debate.source_items)
			? debate.source_items.map((s) => String(s ?? '').trim()).filter(Boolean)
			: [];
		const idx = src.indexOf(itemId);
		if (idx >= 0) {
			const tensions = Array.isArray(debate.tensions)
				? debate.tensions
				: Array.isArray(debate.primary_tensions)
					? debate.primary_tensions
					: [];
			const debateTension = String(tensions[idx] ?? '').trim();
			if (debateTension) return formatDebateTensionLabel(debateTension);
		}
	}
	const encodingTension = String(item?.tension ?? '').trim();
	if (encodingTension) return formatDebateTensionLabel(encodingTension);
	return '';
}
