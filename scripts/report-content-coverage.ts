import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { buildContentCoverage, contentCoverageMarkdown } from '../src/lib/content-coverage';
import { getBayAreaToday } from '../src/lib/monthly';

const { values } = parseArgs({ options: { start: { type: 'string' }, weeks: { type: 'string', default: '8' }, out: { type: 'string', default: 'artifacts/content-coverage' } }, allowPositionals: false });
const report = buildContentCoverage(MONTHLY_EVENTS, values.start || getBayAreaToday(), Number(values.weeks));
const directory = resolve(values.out!);
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'content-coverage.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(resolve(directory, 'content-coverage.md'), contentCoverageMarkdown(report));
console.log(`Coverage ${report.startDate}–${report.endDate}: ${report.window.total.uniqueEvents} events, ${report.window.total.eventDays} event-days; ${report.warnings.emptyCellCount} empty region/category/week cells, ${report.diagnostics.length} data diagnostics.`);
console.log(`Advisory only; no coverage target imposed. JSON and Markdown: ${directory}`);
if (process.env.GITHUB_ACTIONS === 'true' && (report.warnings.emptyCellCount || report.diagnostics.length)) console.log('::warning title=Editorial coverage review::The dated catalog has empty region/category/week cells or data diagnostics. See the content-coverage artifact; this advisory does not fail the release.');
