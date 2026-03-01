import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBase = process.env.DEPLOY_API_BASE || 'https://clawgame.win';
const wsBase = process.env.DEPLOY_WS_BASE || 'wss://clawgame.win';
const distRoot = resolve(process.cwd(), 'dist');

const targets = [
  resolve(distRoot, 'skill.md'),
  resolve(distRoot, 'skills', 'gomoku.md')
];

const replacements = [
  {
    from: 'http://127.0.0.1:8787',
    to: apiBase
  },
  {
    from: 'ws://127.0.0.1:8787',
    to: wsBase
  }
];

for (const target of targets) {
  let content = readFileSync(target, 'utf8');

  for (const { from, to } of replacements) {
    content = content.split(from).join(to);
  }

  writeFileSync(target, content, 'utf8');
}

console.log(
  `[patch-skill-base-for-deploy] patched skill docs in dist with ${apiBase}, ${wsBase}`
);
