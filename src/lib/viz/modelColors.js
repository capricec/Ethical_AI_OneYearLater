/** Display order matches product mock */
export const MODEL_ORDER = ['ChatGPT', 'Claude', 'DeepSeek', 'Gemini', 'Grok'];

export const MODEL_COLORS = {
	ChatGPT: '#648FFF',
	Claude: '#785EF0',
	DeepSeek: '#DC267F',
	Gemini: '#FE6100',
	Grok: '#FFB000'
};

/** @param {string} fundModel */
export function modelColor(fundModel) {
	return MODEL_COLORS[fundModel] ?? '#E7E6E6';
}
