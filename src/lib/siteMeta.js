/** Production origin — matches deploy target in svelte.config.js. */
export const SITE_ORIGIN = 'https://originaldatum.com';

/** App base path on production (no trailing slash). */
export const SITE_BASE_PATH = '/EverydayEthics';

export const SITE_URL = `${SITE_ORIGIN}${SITE_BASE_PATH}/`;

export const SITE_TITLE = 'The Everyday Ethics of AI';

export const SITE_DESCRIPTION =
	'Every day, AI models answer millions of ordinary questions. Beneath their answers are ethics—assumptions about what matters, what is fair, and what should be done. A year-long study asking five models daily questions from the World Values Survey.';

export const SITE_OG_IMAGE_PATH = '/og-image.png';

export const SITE_OG_IMAGE_URL = `${SITE_ORIGIN}${SITE_BASE_PATH}${SITE_OG_IMAGE_PATH}`;

export const SITE_OG_IMAGE_ALT =
	'The Everyday Ethics of AI — comparing how AI models answer everyday ethical questions.';
