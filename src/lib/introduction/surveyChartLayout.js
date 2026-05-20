/**
 * Geometry for connector lines on `static/SurveyResults.png`.
 * The PNG matches the live radial in `STATEMENT_ORDER_SUBSCALE` (one spike per statement).
 */

/** Fraction of image half-size to the inner edge of the outer label ring (plot disc). */
export const SURVEY_PLOT_RADIUS_FRAC = 0.76;

/**
 * Neutral ring on `SurveyResults.png`: where spikes branch in/out from baseline.
 * Fraction of rendered chart radius (`layout.half`), not plot-disc × inner fraction.
 * Tuned on PNG (live-tool math undershoots when combined with `SURVEY_PLOT_RADIUS_FRAC`).
 */
export const SURVEY_SPIKE_NEUTRAL_FRAC = 0.53;

/** @deprecated Use `SURVEY_SPIKE_NEUTRAL_FRAC`. */
export const SURVEY_SPIKE_TIP_FRAC = SURVEY_SPIKE_NEUTRAL_FRAC;

/** Min fraction of the questions slide visible before drawing connector lines. */
export const QUESTIONS_CONNECTOR_MIN_VISIBLE = 0.45;

/**
 * True when the questions slide is the primary viewport (lines should not show on other slides).
 * @param {Element | null | undefined} containerEl
 */
export function questionsSlideVisibleEnough(containerEl) {
	const slide = containerEl?.closest('[data-intro-slide="questions"]');
	if (!slide) return false;
	const rect = slide.getBoundingClientRect();
	const vh = window.innerHeight || 1;
	const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
	return visible / Math.max(1, rect.height) >= QUESTIONS_CONNECTOR_MIN_VISIBLE;
}

/**
 * Chart center and half-size in a container’s local coordinates, from the rendered survey image.
 * @param {Element | null | undefined} surveyImg
 * @param {Element | null | undefined} containerEl
 */
export function surveyChartLayoutInContainer(surveyImg, containerEl) {
	if (!surveyImg || !containerEl) return null;
	const ir = surveyImg.getBoundingClientRect();
	const cr = containerEl.getBoundingClientRect();
	if (ir.width < 1 || ir.height < 1) return null;
	return {
		cx: ir.left + ir.width / 2 - cr.left,
		cy: ir.top + ir.height / 2 - cr.top,
		half: Math.min(ir.width, ir.height) / 2,
		plotR: (Math.min(ir.width, ir.height) / 2) * SURVEY_PLOT_RADIUS_FRAC
	};
}

/**
 * Point on a spoke centerline at the neutral baseline (not the data-driven spike tip).
 * @param {{ cx: number, cy: number, half: number, plotR?: number }} layout
 * @param {number} angleRad
 * @param {number} [neutralFrac] — fraction of chart half-size (center → neutral ring)
 */
export function surveySpokePoint(
	layout,
	angleRad,
	neutralFrac = SURVEY_SPIKE_NEUTRAL_FRAC
) {
	const r = layout.half * neutralFrac;
	return {
		x: layout.cx + Math.cos(angleRad) * r,
		y: layout.cy + Math.sin(angleRad) * r
	};
}

/**
 * Inner edge of a question pill (toward chart center), vertically centered on the pill.
 * @param {HTMLElement} pillEl
 * @param {DOMRectReadOnly} containerRect
 * @param {import('./introductionSlides.js').IntroQuestionPlacement} placement
 */
export function questionPillInnerAnchor(pillEl, containerRect, placement) {
	const pr = pillEl.getBoundingClientRect();
	const anchorLeft = placement.right != null && placement.left == null;
	return {
		x1: (anchorLeft ? pr.left : pr.right) - containerRect.left,
		y1: pr.top + pr.height / 2 - containerRect.top
	};
}
