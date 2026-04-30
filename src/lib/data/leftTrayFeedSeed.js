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
		text: 'Welcome to the LLM Debatonator 2000.'
	},
	{
		id: 'intro-1.1',
		type: 'narration',
		text: 'Over the course of a year the models answered a series of survey questions developed by the World Values Survey. These questions are intended to reveal the beliefs, values and motivations of its participants. These are the results of that research.'
	},
	{
		id: 'intro-1.2',
		type: 'narration',
		text: 'Select a topic and contestants below to start a debate. Or explore the Value Wheel to the right to find your own topic of interest. Grey spikes represent where models have consensus, so the larger more colorful areas are where debate will be most riveting. '
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
	betweenModelMessagesMs: 550
};

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
