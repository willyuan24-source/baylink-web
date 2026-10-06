import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const candidate = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(candidate)) throw new Error('Missing immutable release commit');
await writeFile('public/release.json', JSON.stringify({ commit: candidate, builtAt: new Date().toISOString(), schema: 1 }) + '\n');
