/**
 * Introduction scrolly copy and layout config.
 * Background: `static/intro-background.png`
 */

import { ROUTE_TOOL } from '$lib/routes.js';

export const INTRO_BACKGROUND_SRC = '/intro-background.png';

/**
 * @typedef {object} IntroQuestionPlacement
 * @property {string} text
 * @property {string} [top]
 * @property {string} [left]
 * @property {string} [right]
 * @property {string} [bottom]
 */

/** @typedef {'title' | 'prose' | 'models' | 'questions' | 'results'} IntroSlideType */

/**
 * @typedef {object} IntroSlide
 * @property {string} id
 * @property {IntroSlideType} type
 * @property {string} [title]
 * @property {string[]} [paragraphs]
 * @property {{ label: string, href: string }} [cta]
 * @property {string[]} [questions]
 * @property {IntroQuestionPlacement[]} [questionPlacements]
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
			'To explore this underlying layer, I spent a year asking five models a daily series of questions drawn from the World Values Survey.'
		]
	},
	{
		id: 'method',
		type: 'prose',
		paragraphs: [
			'Because the models are probabilistic and not deterministic, their answers on any given day may not be the same as the next.',
			'But averaging their survey answers over a course of a year I hope to get the general gist of where these models ethics truly lie.'
		]
	},
	{
		id: 'models',
		type: 'models',
		title: 'The Models'
	},
	{
		id: 'questions',
		type: 'questions',
		title: 'The Questions',
		questionPlacements: [
			{
				text: 'Should I have an abortion?',
				top: '14%',
				left: '7%'
			},
			{
				text: 'On social media, should people be stopped from spreading misinformation or is that free speech?',
				top: '34%',
				right: '3%'
			},
			{
				text: 'Is it okay that some people earn vastly more than others?',
				top: '67%',
				left: '22%'
			},
			{
				text: 'Should I stay in my marriage or leave?',
				bottom: '18%',
				right: '20%'
			}
		]
	},
	{
		id: 'results',
		type: 'results',
		title: 'The Results',
		paragraphs: [
			'Ethical questions are multifaceted. They draw on a priority list of multiple values.',
			'For every ethical question, I have assigned each model its average survey results and asked it to answer based on those. So, you will see in their own words their average response to ordinary ethical dilemmas as well as what thresholds would change their responses.'
		],
		cta: { label: 'Enter the tool', href: ROUTE_TOOL }
	}
];
