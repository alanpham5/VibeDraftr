import "./loadEnv.js";
import fs from 'fs';
import path from 'path';
import { runDraft } from './src/engine/draft.js';

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

const league = getArg('--league') || 'NBA';
const strategy = getArg('--strategy');
const rounds = parseInt(getArg('--rounds') || '15', 10);

if (!['NBA', 'NHL'].includes(league)) {
  console.error('Error: --league must be NBA or NHL');
  process.exit(1);
}

const apiKeys = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY
};

const missing = Object.entries(apiKeys).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Missing API keys in .env: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`\nAI Fantasy Draft — ${league}`);
console.log(`   Rounds: ${rounds}`);
if (strategy) console.log(`   Strategy: ${strategy}`);
console.log('');

const config = {
  league,
  rounds,
  apiKeys,
  onStart: ({ draftOrder }) => {
    console.log(`Draft Order: ${draftOrder.join(' → ')}\n`);
  },
  onPick: ({ round, pick, aiName, player }) => {
    console.log(`Pick #${String(pick).padStart(2, '0')} (Round ${round}): ${aiName} selects ${player}`);
  },
  onError: ({ round, pick, aiName, message }) => {
    console.error(`[Error] Pick #${pick} (Round ${round}): ${aiName} — ${message}`);
  }
};
if (strategy) config.strategy = strategy;

try {
  const result = await runDraft(config);

  const outputDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'teams.json'), JSON.stringify(result.teams, null, 2));
  fs.writeFileSync(path.join(outputDir, 'draft_log.txt'), result.log.join('\n'));

  console.log('\nDraft complete!');
  console.log(`   Teams saved to output/teams.json`);
  console.log(`   Log saved to output/draft_log.txt\n`);

  for (const [ai, roster] of Object.entries(result.teams)) {
    console.log(`${ai}:`);
    roster.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    console.log('');
  }
} catch (err) {
  console.error(`Draft failed: ${err.message}`);
  process.exit(1);
}
