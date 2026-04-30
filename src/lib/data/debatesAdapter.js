/**
 * @typedef {object} DebateRecord
 * @property {string} debate_id
 * @property {string} question
 * @property {string} scenario
 * @property {string[]} source_items
 * @property {string[]} tensions
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function toTrimmedString(value) {
	return String(value ?? '').trim();
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toStringArray(value) {
	if (!Array.isArray(value)) return [];
	return value.map((v) => toTrimmedString(v)).filter(Boolean);
}

/**
 * Normalize raw debates JSON into a stable array shape.
 * @param {{ debates?: unknown } | null | undefined} raw
 * @returns {DebateRecord[]}
 */
export function normalizeDebates(raw) {
	const rows = Array.isArray(raw?.debates) ? raw.debates : [];
	/** @type {DebateRecord[]} */
	const out = [];
	for (const row of rows) {
		const debateId = toTrimmedString(row?.debate_id);
		if (!debateId) continue;
		out.push({
			debate_id: debateId,
			question: toTrimmedString(row?.question),
			scenario: toTrimmedString(row?.scenario),
			source_items: toStringArray(row?.source_items),
			tensions: toStringArray(row?.tensions ?? row?.primary_tensions)
		});
	}
	return out;
}

/**
 * @param {DebateRecord[]} debates
 * @returns {Map<string, DebateRecord>}
 */
export function debatesById(debates) {
	const map = new Map();
	for (const d of debates) map.set(d.debate_id, d);
	return map;
}

/**
 * UI-friendly topic selector options.
 * @param {DebateRecord[]} debates
 */
export function debateOptions(debates) {
	return debates.map((d) => ({
		id: d.debate_id,
		label: d.question || d.debate_id
	}));
}

/**
 * @param {DebateRecord | null | undefined} debate
 * @returns {string[]}
 */
export function sourceItemsForDebate(debate) {
	if (!debate) return [];
	return Array.from(new Set(toStringArray(debate.source_items)));
}

