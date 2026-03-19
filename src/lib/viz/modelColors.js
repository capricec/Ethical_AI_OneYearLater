/** Display order matches product mock */
export const MODEL_ORDER = ['ChatGPT', 'Claude', 'DeepSeek', 'Gemini', 'Grok'];

export const MODEL_COLORS = {
	ChatGPT: '#0f766e',
	Claude: '#14b8a6',
	DeepSeek: '#5eead4',
	Gemini: '#e11d48',
	Grok: '#fda4af'
};

/** @param {string} fundModel */
export function modelColor(fundModel) {
	return MODEL_COLORS[fundModel] ?? '#64748b';
}
