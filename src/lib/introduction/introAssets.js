/** Legacy asset (unused on intro/methodology; intro uses SURVEY_RESULTS_SRC). */
export const INTRO_BACKGROUND_SRC = '/intro-background.png';
export const SURVEY_RESULTS_SRC = '/SurveyResults.png';

/** Survey chart visible on intro scrolly before “The Survey” slide. */
export const SURVEY_BG_OPACITY_PRE_SURVEY = 0.15;
/** Scale of survey chart before “The Survey” (shrunken, centered). */
export const SURVEY_BG_SCALE_PRE_SURVEY = 0.78;

/**
 * Survey chart sizing at full scale; never larger than the viewport.
 */
export const INTRO_CHART_IMAGE_CLASS =
	'intro-survey-chart h-auto w-auto max-h-[min(96dvh,96dvw,100dvh,100dvw)] max-w-[min(96dvh,96dvw,100dvh,100dvw)] object-contain';
