import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildFullSurveyStatements } from '../src/lib/data/fullSurveyQuestion.js';

const root = resolve(process.cwd());
const encodingPath = resolve(root, 'data/statement_encoding.json');
const outPath = resolve(root, 'data/full_survey_statements.json');

const encoding = JSON.parse(await readFile(encodingPath, 'utf8'));
const statements = buildFullSurveyStatements(encoding);

await writeFile(
	outPath,
	`${JSON.stringify(
		{
			generated_at: new Date().toISOString(),
			statement_count: statements.length,
			statements
		},
		null,
		2
	)}\n`,
	'utf8'
);

console.log(`Wrote ${statements.length} statements to ${outPath}`);
