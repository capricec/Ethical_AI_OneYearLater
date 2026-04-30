import chatgptFollowups from '../../../data/chatgpt_scale_followup_responses.json';
import claudeFollowups from '../../../data/claude_scale_followup_responses.json';
import deepseekFollowups from '../../../data/deepseek_scale_followup_responses.json';
import geminiFollowups from '../../../data/gemini_scale_followup_responses.json';
import grokFollowups from '../../../data/grok_scale_followup_responses.json';

/** @type {Record<string, { id: string, response: string }[]>} */
const BY_KEY = {
	chatgpt: chatgptFollowups,
	claude: claudeFollowups,
	deepseek: deepseekFollowups,
	gemini: geminiFollowups,
	grok: grokFollowups
};

/** @type {Map<string, Map<string, string>>} */
const cache = new Map();

/**
 * @param {string} key
 * @returns {Map<string, string>}
 */
function mapForKey(key) {
	let m = cache.get(key);
	if (!m) {
		const rows = BY_KEY[key];
		m = new Map();
		if (Array.isArray(rows)) {
			for (const r of rows) {
				if (r?.id) m.set(String(r.id), String(r.response ?? ''));
			}
		}
		cache.set(key, m);
	}
	return m;
}

/** `fundModel` from compiled data → followup JSON bucket. */
const FUND_MODEL_TO_FOLLOWUP_KEY = {
	ChatGPT: 'chatgpt',
	Claude: 'claude',
	DeepSeek: 'deepseek',
	Gemini: 'gemini',
	Grok: 'grok'
};

/**
 * All-models view uses Claude followups until product specifies otherwise.
 * @param {string | null | undefined} fundModel
 * @returns {keyof typeof BY_KEY}
 */
export function followupDatasetKeyForModel(fundModel) {
	if (fundModel == null || String(fundModel).trim() === '') return 'claude';
	return FUND_MODEL_TO_FOLLOWUP_KEY[String(fundModel)] ?? 'claude';
}

/**
 * @param {string} itemId e.g. `23_1`
 * @param {number} scaleStep integer on statement scale (e.g. 1–6)
 * @param {string | null | undefined} fundModel
 * @returns {string | null}
 */
export function getFollowupResponseText(itemId, scaleStep, fundModel) {
	const key = followupDatasetKeyForModel(fundModel);
	const id = `${String(itemId).trim()}_v${scaleStep}`;
	const text = mapForKey(key).get(id);
	return text != null && text !== '' ? text : null;
}

/**
 * Map a value from **display** space (viz / spikes: reversed items are already flipped in `itemMeans`)
 * to **raw** survey scale for followup ids `…_v1`–`…_v6` (JSON matches raw prompts).
 * @param {number} displayValue
 * @param {{ scaleMin?: unknown, scaleMax?: unknown, reverse?: unknown }} item
 */
function displayMeanToRawForFollowup(displayValue, item) {
	const a = Number(item?.scaleMin);
	const b = Number(item?.scaleMax);
	const lo = Math.min(a, b);
	const hi = Math.max(a, b);
	if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(displayValue)) return displayValue;
	if (item?.reverse) return lo + hi - displayValue;
	return displayValue;
}

/**
 * Midpoint-split step mapping:
 * - below midpoint => floor
 * - at/above midpoint => ceil
 * This keeps upper-half values (e.g. 5.2 on 1-6) in the stronger label bin.
 * @param {number} value
 * @param {number} lo
 * @param {number} hi
 */
function stepFromValueMidpointSplit(value, lo, hi) {
	if (!Number.isFinite(value) || !Number.isFinite(lo) || !Number.isFinite(hi)) return lo;
	const clamped = Math.max(lo, Math.min(hi, value));
	const mid = (lo + hi) / 2;
	const stepped = clamped < mid ? Math.floor(clamped) : Math.ceil(clamped);
	return Math.max(lo, Math.min(hi, stepped));
}

/**
 * Consensus mean is in the same space as spike tips (`itemMeans`). Followup JSON keys use **raw** scale
 * steps, so for reversed statements we invert before rounding (see `computeStatementsViz` reverse).
 * @param {number | null} consensusDisplay
 * @param {{ scaleMin?: unknown, scaleMax?: unknown, reverse?: unknown }} item
 */
export function followupScaleStepFromConsensus(consensusDisplay, item) {
	const a = Number(item?.scaleMin);
	const b = Number(item?.scaleMax);
	const lo = Math.min(a, b);
	const hi = Math.max(a, b);
	if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 1;
	const midpointRaw = Math.ceil((lo + hi) / 2);
	if (consensusDisplay === null || !Number.isFinite(consensusDisplay)) return midpointRaw;
	const raw = displayMeanToRawForFollowup(consensusDisplay, item);
	if (!Number.isFinite(raw)) return midpointRaw;
	return stepFromValueMidpointSplit(raw, lo, hi);
}
