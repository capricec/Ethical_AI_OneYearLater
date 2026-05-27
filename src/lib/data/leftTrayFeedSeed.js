/**
 * Editable starter content for the left-tray message feed.
 * Update this file whenever you want to change the default entry experience text.
 */

/**
 * @typedef {'narration' | 'model'} LeftTrayMessageType
 *
 * @typedef {object} LeftTrayMessage
 * @property {string} id
 * @property {LeftTrayMessageType} type
 * @property {string} text
 * @property {string=} model
 * @property {'left' | 'right'=} side
 */

/** @type {LeftTrayMessage[]} */
export const LEFT_TRAY_FEED_SEED = [
	{
		id: 'intro-1',
		type: 'narration',
		text: 'Welcome to The Everyday Ethics of AI.'
	},
	{
		id: 'intro-1.2',
		type: 'narration',
		text: 'Select a question above or explore the value wheel. Gray areas show where the models had consensus, while colored regions reveal where ethics diverge.'
	},
	/*{
		id: 'intro-2',
		type: 'model',
		model: 'ChatGPT',
		side: 'left',
		text: 'I prioritize balancing individual freedom with social cohesion.'
	},
	{
		id: 'intro-3',
		type: 'model',
		model: 'Claude',
		side: 'right',
		text: 'I focus on fairness and human impact when tensions conflict.'
	},*/
	{
		id: 'intro-4',
		type: 'narration',
		text: 'As you explore, this conversation feed will continue to build.'
	}
];

/**
 * @typedef {object} LeftTrayFeedTiming
 * @property {number} beforeNarrationMs
 * @property {number} sectionTitleToNarrationMs
 * @property {number} narrationToModelsMs
 * @property {number} beforeSectionMs
 * @property {number} betweenModelMessagesMs
 */

/** Debate / compare feed — slower pacing for longer scenario and advice copy. */
export const LEFT_TRAY_DEBATE_FEED_TIMING = {
	beforeNarrationMs: 150,
	sectionTitleToNarrationMs: 150,
	narrationToModelsMs: 1500,
	beforeSectionMs: 150,
	betweenModelMessagesMs: 1500
};

/** @type {LeftTrayFeedTiming} */
export const LEFT_TRAY_DEBATE_FEED_TIMING_MOBILE = {
	beforeNarrationMs: 150,
	sectionTitleToNarrationMs: 150,
	narrationToModelsMs: 3000,
	beforeSectionMs: 1000,
	betweenModelMessagesMs: 3000
};

/** Value statement feed (radial statement, no question) — faster populate. */
export const LEFT_TRAY_VALUE_FEED_TIMING = {
	beforeNarrationMs: 150,
	sectionTitleToNarrationMs: 0,
	narrationToModelsMs: 300,
	beforeSectionMs: 120,
	betweenModelMessagesMs: 500
};

/** @type {LeftTrayFeedTiming} */
export const LEFT_TRAY_VALUE_FEED_TIMING_MOBILE = {
	beforeNarrationMs: 150,
	sectionTitleToNarrationMs: 0,
	narrationToModelsMs: 1100,
	beforeSectionMs: 350,
	betweenModelMessagesMs: 850
};

/** @deprecated Use LEFT_TRAY_DEBATE_FEED_TIMING */
export const LEFT_TRAY_FEED_TIMING = LEFT_TRAY_DEBATE_FEED_TIMING;

/** @deprecated Use LEFT_TRAY_DEBATE_FEED_TIMING_MOBILE */
export const LEFT_TRAY_FEED_TIMING_MOBILE = LEFT_TRAY_DEBATE_FEED_TIMING_MOBILE;

/**
 * @param {boolean} [mobile]
 * @returns {LeftTrayFeedTiming}
 */
export function leftTrayDebateFeedTimingForViewport(mobile = false) {
	return mobile ? LEFT_TRAY_DEBATE_FEED_TIMING_MOBILE : LEFT_TRAY_DEBATE_FEED_TIMING;
}

/**
 * @param {boolean} [mobile]
 * @returns {LeftTrayFeedTiming}
 */
export function leftTrayValueFeedTimingForViewport(mobile = false) {
	return mobile ? LEFT_TRAY_VALUE_FEED_TIMING_MOBILE : LEFT_TRAY_VALUE_FEED_TIMING;
}

/** @deprecated Use leftTrayDebateFeedTimingForViewport */
export function leftTrayFeedTimingForViewport(mobile = false) {
	return leftTrayDebateFeedTimingForViewport(mobile);
}

/**
 * Feed behavior mode when a radial statement is selected.
 * - `model_responses`: current behavior (narrator question + model follow-up chain)
 * - `topic_choices`: narrator prompt + selectable debate topics containing that statement
 */
export const LEFT_TRAY_FEED_MODE = 'model_responses';

/**
 * Content mode for model messages appended after statement selection.
 * - `followup_text`: use *_followup_responses copy
 * - `average_value`: show numeric mean as "Average Response: X.XX"
 */
export const LEFT_TRAY_MODEL_RESPONSE_MODE = 'average_value';

/**
 * Model bubble layout in the left feed.
 * - `split`: alternate left/right (current behavior)
 * - `center`: center all model bubbles
 */
export const LEFT_TRAY_MODEL_BUBBLE_LAYOUT = 'center';

/**
 * Returns a safe clone so store state cannot mutate the seed constants.
 * @returns {LeftTrayMessage[]}
 */
export function cloneLeftTrayFeedSeed() {
	return LEFT_TRAY_FEED_SEED.map((msg) => ({ ...msg }));
}
