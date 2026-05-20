/**
 * Introduction scrolly copy and layout config.
 * Background: `static/intro-background.png`
 */

import { ROUTE_TOOL } from '$lib/routes.js';

export { INTRO_BACKGROUND_SRC } from '$lib/introduction/introAssets.js';

/**
 * @typedef {object} IntroQuestionPlacement
 * @property {string} text
 * @property {string} [top]
 * @property {string} [left]
 * @property {string} [right]
 * @property {string} [bottom]
 * @property {string} [debateId] — `debates.json` id; connector lines use `source_items` (statement spikes)
 */

/** @typedef {'title' | 'prose' | 'models' | 'survey' | 'questions' | 'results'} IntroSlideType */

/**
 * @typedef {object} IntroSlide
 * @property {string} id
 * @property {IntroSlideType} type
 * @property {string} [title]
 * @property {string[]} [paragraphs]
 * @property {{ label: string, href: string }} [cta]
 * @property {string[]} [questions]
 * @property {IntroQuestionPlacement[]} [questionPlacements]
 * @property {string} [defaultHoveredDebateId] — fallback debate on load (questions slide)
 * @property {string} [defaultHoveredDebateIdDesktop]
 * @property {string} [defaultHoveredDebateIdMobile]
 */

/** @type {IntroSlide[]} */
export const INTRO_SLIDES = [
	{
		id: 'title',
		type: 'title',
		title: 'The Everyday Ethics of AI.'
	},
	{
		id: 'opening',
		type: 'prose',
		paragraphs: [
			'Every day, AI models answer millions of ordinary questions. Beneath their answers are ethics, assumptions about what matters, what is fair, and what should be done.',
			'To explore this underlying layer, I spent a year asking five models a series of daily questions drawn from the World Values Survey.'
		]
	},
	{
		id: 'models',
		type: 'models',
		title: 'The Models'
	},
	{
		id: 'method',
		type: 'prose',
		paragraphs: [
			'Because the models are probabilistic and not deterministic, their answers on any given day may not be the same as the next.',
			'But by averaging their survey answers over a course of a year I hope to get the general gist of where these models ethics truly lie.'
		]
	},
	{
		id: 'survey',
		type: 'survey',
		title: 'The Survey'
	},
	{
		id: 'results',
		type: 'prose',
		paragraphs: [
			'Though the results from the World Values Survey are telling themselves, ethical questions are rarely about a single value. Real-life dilemmas involve competing priorities like freedom versus security, fairness versus merit, or personal autonomy versus family responsibility.',
			'To further understand how these values impact the responses each model gives to everyday questions, each AI model was assigned its average survey score across several values, then asked to respond to everyday ethical dilemmas shaped by those competing priorities.'
		],
		cta: { label: 'Enter the tool', href: ROUTE_TOOL }
	},
	
	{
		id: 'questions',
		type: 'questions',
		title: 'The Questions',
		defaultHoveredDebateIdDesktop: 'speech_vs_harm',
		defaultHoveredDebateIdMobile: 'income_inequality',
		questionPlacements: [
			{
				text: 'Should I have an abortion?',
				debateId: 'abortion_decision',
				top: '14%',
				left: '7%'
			},
			{
				text: 'Should people be stopped from spreading misinformation or is that free speech?',
				debateId: 'speech_vs_harm',
				bottom: '16%',
				right: '3%'
			},
			{
				text: 'Is it okay that some people earn vastly more than others?',
				debateId: 'income_inequality',
				top: '24%',
				right: '3%'
			},
			{
				text: 'Should I stay in my marriage or leave?',
				debateId: 'family_divorce',
				bottom: '25%',
				left: '15%'
			}
		]
	}
];
