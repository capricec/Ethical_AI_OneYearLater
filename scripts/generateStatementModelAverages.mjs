import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { computeStatementModelAverages } from '../src/lib/data/computeStatementModelAverages.js';

const root = resolve(process.cwd());
const encodingPath = resolve(root, 'data/statement_encoding.json');
const compiledPath = resolve(root, 'data/compiled_scaled_responses.json');
const outPath = resolve(root, 'data/statement_model_averages.json');

const encoding = JSON.parse(await readFile(encodingPath, 'utf8'));
const compiled = JSON.parse(await readFile(compiledPath, 'utf8'));

const rows = computeStatementModelAverages(encoding, compiled);

await writeFile(
	outPath,
	`${JSON.stringify(
		{
			generated_at: new Date().toISOString(),
			row_count: rows.length,
			rows
		},
		null,
		2
	)}\n`,
	'utf8'
);

console.log(`Wrote ${rows.length} rows to ${outPath}`);

