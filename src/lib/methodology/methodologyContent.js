/** World Values Survey — external reference in methodology copy. */
export const WORLD_VALUES_SURVEY_URL = 'https://www.worldvaluessurvey.org/';

/** Continuous methodology prose (mockups split across screens; one block on the page). */
export const METHODOLOGY_OPENING =
	'There were a couple problems I needed to solve to get to the core of what these models think about personal freedoms, gender roles, the role of government, etc.';

export const METHODOLOGY_PARAGRAPHS = [
	"I reconfigured the survey to be answerable by a chat interface and wrote a script that asked and recorded the models answers to these questions daily. Some parts of the survey weren't applicable to an AI model, so it isn't a full 1:1 replication.",
	'My second issue to overcome was that what the models say one day is not what they say the next. For this, I decided to ask the models the same questions repeatedly, and by generating a corpus of responses, I could average the answers and get the general gist of what a model thought.',
	'Third, how do the answers to the survey questions relate to the daily questions that users are posing to the AI models? For this I mapped out a system of value triads for any given question, allowing for the nuance that we all use when making decisions.',
	'Lastly, how do we bring those value triads to life to show how models truly are responding on average to ethical questions? To solve this, I prompted the models with their own average responses and told them to give advice given their values.'
];
