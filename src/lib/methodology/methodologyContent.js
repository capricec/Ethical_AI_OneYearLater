/** World Values Survey — external reference in methodology copy. */
export const WORLD_VALUES_SURVEY_URL = 'https://www.worldvaluessurvey.org/';

/** Intro before section blocks. */
export const METHODOLOGY_OPENING = '';

/**
 * @typedef {object} MethodologySection
 * @property {string} id
 * @property {string} title
 * @property {string[]} paragraphs
 * @property {boolean} [includeWorldValuesLink]
 */

/** @type {MethodologySection[]} */
export const METHODOLOGY_SECTIONS = [
	{
		id: 'problem',
		title: 'The Problem',
		paragraphs: [
			'AI models are becoming deeply embedded in everyday life. They answer questions, shape opinions, filter information, and increasingly act as interpreters of truth for millions of people. While these systems are often presented as neutral or unbiased, recent controversies  (cough cough “South African genocide” claims surrounding Grok for one) have made me wonder what is really going on inside these models.',
			'The problem is that most AI companies are not fully transparent about the forces shaping these systems. The public cannot meaningfully inspect the training data, reinforcement methods, moderation policies, or system prompts that influence model behavior. Without that transparency, it becomes difficult to evaluate the underlying values embedded within these models.'
		]
	},
	{
		id: 'models',
		title: 'The Models',
		paragraphs: [
			'This project focuses on five of the most widely used conversational AI models today: OpenAI’s ChatGPT, Anthropic’s Claude, DeepSeek, Google’s Gemini, and xAI’s Grok.',
			'These models evolve quickly, with new versions and safety updates released regularly. But while the outputs may change, I believe the underlying foundations remain relatively stable. The companies behind these systems still operate from the same institutional incentives, cultural assumptions, and philosophical frameworks that guide how their models are made.'
		]
	},
	{
		id: 'survey',
		title: 'The Survey',
		paragraphs: [
			"To measure ethics through a more academically grounded framework, I turned to the World Values Survey, an international research program that studies social, political, economic, religious, and cultural values across countries and populations.",
            "I adapted the survey into a format that could be answered through a chat interface and built a script to ask the models these questions daily while recording their responses over time. Some questions were modified or excluded where they did not meaningfully apply to an AI system, so it is not a strict 1:1 replication."
		]
	},
	{
		id: 'data',
		title: 'The Data',
		paragraphs: [
			'AI models do not always give the same answer to the same question. Responses can shift over time due to probablities, model updates, changing safety policies, or differences in conversational context.',
			'To account for this, I repeatedly asked the models the same questions over an extended period of time. By generating a large corpus of responses, I could average the results and identify broader patterns rather than relying on any single answer. The goal was not to capture a perfect or definitive position, but the general tendencies and value signals that consistently emerged across repeated interactions.'
		]
	},
	{
		id: 'questions',
		title: 'The Questions',
		paragraphs: [
			'The survey results are interesting in themselves, but they do not tell the full story. A model may express certain values in the abstract while responding differently when those values are applied to real world situations.',
			'To capture this, I mapped each question to a set of value triads drawn from different parts of the survey, allowing multiple values to be represented at once. I then fed each model its average survey scores across these values and asked it to respond to everyday ethical dilemmas shaped by those competing priorities. This made it possible to analyze not just what a model says in principle, but how it balances competing priorities in practice.',
			'The goal was to move beyond static classifications and examine how values are actually prioritized in context.'
		]
	},
	{
		id: 'quiz',
		title: 'The Quiz',
		paragraphs: [
			'The survey provides a structured way to measure values, but most people encounter values through decisions and tradeoffs.',
			'To make these patterns more accessible, I developed a short value-alignment quiz based on the survey results. Rather than asking users to complete the full survey, the quiz presents a series of tradeoffs and ethical judgments that capture the value dimensions where the models differ most. Each response is mapped back to the underlying survey framework, allowing a users answers to be compared directly against the average value profiles of each model.'
		]
	}
];
