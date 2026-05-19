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
		text: 'Select a question below or explore the value wheel. Gray areas show where the models had consensus, while colored regions reveal where ethics diverge.'
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
 * Timing controls for streamed feed messages when a radial statement is selected.
 * Tweak these values to speed up / slow down the chain effect.
 */
export const LEFT_TRAY_FEED_TIMING = {
	beforeNarrationMs: 120,
	narrationToModelsMs: 450,
	beforeSectionMs: 450,
	betweenModelMessagesMs: 550
};

/** ~2× desktop — more time to read on narrow screens. */
export const LEFT_TRAY_FEED_TIMING_MOBILE = {
	beforeNarrationMs: 500,
	narrationToModelsMs: 1500,
	beforeSectionMs: 1500,
	betweenModelMessagesMs: 3000
};

/**
 * @param {boolean} [mobile]
 * @returns {typeof LEFT_TRAY_FEED_TIMING}
 */
export function leftTrayFeedTimingForViewport(mobile = false) {
	return mobile ? LEFT_TRAY_FEED_TIMING_MOBILE : LEFT_TRAY_FEED_TIMING;
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
