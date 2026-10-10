import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';

const directory = await mkdtemp(path.join(tmpdir(), 'dynamic-lock-i18n-'));
after(() => rm(directory, { recursive: true, force: true }));
await cp('src/i18n', directory, { recursive: true });
// New languages must be discoverable without changing an import or language registry.
await writeFile(path.join(directory, 'locales/zz.json'), JSON.stringify({
  'defaultMode.name': 'New language',
  'mode.reading': 'Base reading',
  'mode.editing': 42,
}));
await writeFile(path.join(directory, 'locales/zz-region.json'), JSON.stringify({
  'defaultMode.name': 'Regional language',
  'mode.reading': '',
}));
const { outputFiles } = await build({
  entryPoints: [path.join(directory, 'index.ts')], bundle: true, write: false,
  platform: 'browser', format: 'cjs', external: ['obsidian'],
});
let appLanguage = 'en';
function loadModule(obsidian = { getLanguage: () => appLanguage }) {
  const context = {
    module: { exports: {} },
    require: name => {
      assert.equal(name, 'obsidian', 'Locale JSON must be bundled, not loaded through Node');
      return obsidian;
    },
  };
  vm.runInNewContext(outputFiles[0].text, context);
  return context.module.exports.createTranslator;
}
const createTranslator = loadModule();

test('follows the Obsidian language when the settings screen is rendered again', () => {
  appLanguage = 'ko';
  assert.equal(createTranslator()('defaultMode.name'), '기본 모드');
  appLanguage = 'en';
  assert.equal(createTranslator()('defaultMode.name'), 'Default mode');
});

test('regional codes fall back to the base language and unsupported languages to English', () => {
  assert.equal(createTranslator('KO_kr')('mode.reading'), '읽기');
  assert.equal(createTranslator('unsupported')('mode.reading'), 'Reading');
  assert.equal(createTranslator('')('mode.reading'), 'Reading');
});

test('new JSON files are automatically bundled, with regional and per-key fallback', () => {
  assert.equal(createTranslator('zz')('defaultMode.name'), 'New language');
  const t = createTranslator('zz-region');
  assert.equal(t('defaultMode.name'), 'Regional language');
  assert.equal(t('mode.reading'), 'Base reading');
  assert.equal(t('mode.editing'), 'Editing');
  assert.equal(t('rule.delete'), 'Delete rule');
});

test('older Obsidian versions without getLanguage can still render settings in English', () => {
  assert.equal(loadModule({})()('mode.reading'), 'Reading');
});

test('the included Korean translation covers every English message', async () => {
  const en = JSON.parse(await readFile('src/i18n/locales/en.json', 'utf8'));
  const ko = JSON.parse(await readFile('src/i18n/locales/ko.json', 'utf8'));
  assert.deepEqual(Object.keys(ko).sort(), Object.keys(en).sort());
  for (const value of Object.values(ko)) assert.ok(typeof value === 'string' && value.trim());
});
