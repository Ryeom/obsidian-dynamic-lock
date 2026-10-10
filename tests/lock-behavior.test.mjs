import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

class Events {
  listeners = new Map();
  on(name, callback) {
    const callbacks = this.listeners.get(name) ?? new Set();
    callbacks.add(callback);
    this.listeners.set(name, callbacks);
    return { off: () => callbacks.delete(callback) };
  }
  trigger(name, ...args) {
    for (const callback of this.listeners.get(name) ?? []) callback(...args);
  }
}

function element() {
  const classes = new Set();
  return {
    classes, children: [], text: '',
    addClass: name => classes.add(name),
    removeClass: (...names) => names.forEach(name => classes.delete(name)),
    empty() { this.children = []; },
    createSpan() { const child = element(); this.children.push(child); return child; },
    setText(text) { this.text = text; }, setCssProps() {},
  };
}

class MarkdownView {
  constructor(file, workspace) {
    this.file = file;
    this.workspace = workspace;
    this.mode = 'source';
    this.leaf = { view: this, tabHeaderEl: element() };
    this.writes = 0;
  }
  getMode() { return this.mode; }
  getState() { return { file: this.file.path, mode: this.mode }; }
  async setState(state) {
    this.writes++;
    this.mode = state.mode;
    this.workspace.trigger('layout-change');
    if (this.delay) await this.delay;
  }
}

class Plugin {
  commands = [];
  events = [];
  addSettingTab() {}
  addStatusBarItem() { return element(); }
  addCommand(command) { this.commands.push(command); }
  registerDomEvent() {}
  registerEvent(event) { this.events.push(event); }
  async loadData() { return this.saved; }
  async saveData(data) { this.saved = structuredClone(data); }
}
const { outputFiles } = await build({
  entryPoints: ['src/main.ts'], bundle: true, write: false, platform: 'node',
  format: 'cjs', external: ['obsidian'],
});
let appLanguage = 'en';
const notices = [];
const context = {
  module: { exports: {} }, console: { debug() {}, error: console.error },
  require: () => ({
    Plugin, MarkdownView, Notice: class { constructor(message) { notices.push(message); } }, setIcon() {},
    getLanguage: () => appLanguage,
    PluginSettingTab: class {}, AbstractInputSuggest: class {}, TFolder: class {},
  }),
};
vm.runInNewContext(outputFiles[0].text, context);
const DynamicLockPlugin = context.module.exports.default;

async function fixture(settings = {}) {
  const workspace = new Events();
  const metadataCache = new Events();
  const vault = new Events();
  const caches = new Map();
  metadataCache.getFileCache = file => caches.get(file.path);
  const views = ['one.md', 'two.md'].map(path => new MarkdownView({ path, stat: {
    ctime: Date.now(), mtime: Date.now(),
  } }, workspace));
  workspace.getLeavesOfType = () => views.map(view => view.leaf);
  workspace.onLayoutReady = callback => { workspace.ready = callback; };
  const plugin = new DynamicLockPlugin();
  plugin.saved = { rules: [], folderRules: [], ...settings };
  plugin.app = { workspace, metadataCache, vault };
  await plugin.onload();
  workspace.ready();
  await setImmediate();
  return { plugin, workspace, metadataCache, vault, caches, views };
}

async function command(plugin, id) {
  await plugin.commands.find(command => command.id === id).callback();
  await setImmediate();
}

test('saved global lock applies at startup, to both open panes', async () => {
  const { views } = await fixture({ globalMode: 'force-reading' });
  assert.deepEqual(views.map(view => view.mode), ['preview', 'preview']);
});

test('global commands update every pane and reading stays enforced', async () => {
  const { plugin, views, workspace } = await fixture();
  await command(plugin, 'set-global-mode-reading');
  assert.deepEqual(views.map(view => view.mode), ['preview', 'preview']);
  views[1].mode = 'source';
  workspace.trigger('layout-change');
  await setImmediate();
  assert.equal(views[1].mode, 'preview');
  await command(plugin, 'set-global-mode-editing');
  assert.deepEqual(views.map(view => view.mode), ['source', 'source']);
});

test('frontmatter changes update all views of that file, including inactive views', async () => {
  const { views, caches, metadataCache } = await fixture({
    rules: [{ attribute: 'status', value: 'done', mode: 'preview' }],
  });
  const duplicate = new MarkdownView(views[1].file, views[1].workspace);
  views.push(duplicate);
  caches.set('two.md', { frontmatter: { status: 'done' } });
  metadataCache.trigger('changed', views[1].file);
  await setImmediate();
  assert.deepEqual(views.map(view => view.mode), ['source', 'preview', 'preview']);
});

test('settings apply immediately; explicit file lock outranks global editing', async () => {
  const { plugin, views } = await fixture();
  views[1].file.path = 'Archive/two.md';
  plugin.settings.folderRules = [{ path: 'Archive', mode: 'preview' }];
  await plugin.saveSettings();
  assert.equal(views[1].mode, 'preview');
  await command(plugin, 'set-global-mode-editing');
  assert.deepEqual(views.map(view => view.mode), ['source', 'preview']);
});

test('manual mode on unmatched files survives tab switches; navigation applies defaults', async () => {
  const { plugin, views, workspace } = await fixture({ defaultMode: 'source' });
  views[0].mode = 'preview';
  workspace.trigger('active-leaf-change');
  workspace.trigger('file-open', views[0].file);
  await setImmediate();
  assert.equal(views[0].mode, 'preview');
  views[0].file = { ...views[0].file, path: 'new.md' };
  workspace.trigger('file-open', views[0].file);
  await setImmediate();
  assert.equal(views[0].mode, 'source');
  plugin.settings.defaultMode = 'preview';
  await plugin.saveSettings();
  assert.deepEqual(views.map(view => view.mode), ['preview', 'preview']);
});

test('late metadata and folder moves re-evaluate open notes', async () => {
  const { views, caches, metadataCache, vault } = await fixture({
    rules: [{ attribute: 'status', value: 'done', mode: 'preview' }],
    folderRules: [{ path: 'Archive', mode: 'preview' }],
  });
  caches.set('one.md', { frontmatter: { status: 'done' } });
  metadataCache.trigger('changed', views[0].file);
  views[1].file.path = 'Archive/two.md';
  vault.trigger('rename', views[1].file, 'two.md');
  await setImmediate();
  assert.deepEqual(views.map(view => view.mode), ['preview', 'preview']);
});

test('overlapping updates serialize per view and finish with the latest setting', async () => {
  const { plugin, views } = await fixture();
  let release;
  views[0].delay = new Promise(resolve => { release = resolve; });
  plugin.settings.globalMode = 'force-reading';
  const first = plugin.saveSettings();
  await setImmediate();
  plugin.settings.globalMode = 'force-editing';
  const second = plugin.saveSettings();
  release();
  await Promise.all([first, second]);
  assert.deepEqual(views.map(view => view.mode), ['source', 'source']);
  assert.equal(views[0].writes, 2);
});

test('unload clears icons and queued updates do not restore them', async () => {
  const { plugin, views, workspace } = await fixture({ globalMode: 'force-reading' });
  assert.ok(views[0].leaf.tabHeaderEl.classes.has('dynamic-lock-locked'));
  views[0].mode = 'source';
  workspace.trigger('layout-change');
  plugin.onunload();
  await setImmediate();
  assert.equal(views[0].mode, 'source');
  for (const view of views) assert.equal(view.leaf.tabHeaderEl.classes.size, 0);
});


test('removing a matching property restores the configured default without repeated resets', async () => {
  const { views, caches, metadataCache } = await fixture({
    defaultMode: 'source',
    rules: [{ attribute: 'status', value: 'done', mode: 'preview' }],
  });
  caches.set('one.md', { frontmatter: { status: 'done' } });
  metadataCache.trigger('changed', views[0].file);
  await setImmediate();
  assert.equal(views[0].mode, 'preview');
  caches.set('one.md', { frontmatter: { status: 'draft' } });
  metadataCache.trigger('changed', views[0].file);
  await setImmediate();
  assert.equal(views[0].mode, 'source');
  views[0].mode = 'preview';
  metadataCache.trigger('changed', views[0].file);
  await setImmediate();
  assert.equal(views[0].mode, 'preview');
});


test('Korean app language translates commands, status, and notices while preserving command IDs', async () => {
  appLanguage = 'ko';
  try {
    const { plugin } = await fixture();
    assert.deepEqual(Array.from(plugin.commands, c => [c.id, c.name]), [
      ['cycle-global-mode', '전역 모드 전환'],
      ['set-global-mode-auto', '전역 모드를 자동으로 설정'],
      ['set-global-mode-reading', '전역 잠금 설정 (읽기)'],
      ['set-global-mode-editing', '전역 모드를 편집으로 설정'],
    ]);
    for (const [id, status, notice] of [
      ['set-global-mode-reading', '잠금', '읽기'],
      ['set-global-mode-editing', '편집', '편집'],
      ['set-global-mode-auto', '자동', '자동'],
    ]) {
      await command(plugin, id);
      assert.equal(plugin.statusBarItem.children.at(-1).text.trim(), status);
      assert.equal(notices.at(-1), `Dynamic Lock: ${notice} 모드로 전환했어요.`);
    }
  } finally {
    appLanguage = 'en';
  }
});
