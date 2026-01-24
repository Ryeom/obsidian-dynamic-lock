import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, DynamicLockSettingTab } from "./settings";

// Remember to rename these classes and interfaces!

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	statusBarItem: HTMLElement;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new DynamicLockSettingTab(this.app, this));

		// Add Status Bar Item
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar();
		this.statusBarItem.onClickEvent(async () => {
			const modes: Array<MyPluginSettings['globalMode']> = ['auto', 'force-reading', 'force-editing'];
			const currentIndex = modes.indexOf(this.settings.globalMode || 'auto');
			const nextIndex = (currentIndex + 1) % modes.length;
			this.settings.globalMode = modes[nextIndex]!;
			await this.saveSettings();
			new Notice(`Dynamic Lock: Switched to ${this.settings.globalMode}`);

			// Re-evaluate current file
			const file = this.app.workspace.getActiveFile();
			if (file) {
				// Trigger the file-open logic manually
				this.app.workspace.trigger('file-open', file);
			}
		});

		this.registerEvent(this.app.workspace.on('file-open', async (file) => {
			if (!file) return;

			// Handle 'force' modes
			const { globalMode, defaultMode, rules } = this.settings;

			if (globalMode === 'force-reading') {
				await this.setFileViewMode('preview');
				return;
			} else if (globalMode === 'force-editing') {
				await this.setFileViewMode('source');
				return;
			}

			// Handle 'auto' mode
			const cache = this.app.metadataCache.getFileCache(file);
			// Match rules
			if (cache && cache.frontmatter) {
				for (const rule of rules) {
					// Check if attribute exists and matches value
					// We compare as string to be safe, or loose equality
					if (cache.frontmatter[rule.attribute] == rule.value) {
						await this.setFileViewMode(rule.mode);
						return;
					}
				}
			}

			// No match, apply default
			if (defaultMode !== 'keep') {
				await this.setFileViewMode(defaultMode);
			}
		}));
	}

	async setFileViewMode(mode: 'source' | 'preview') {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const state = view.getState();
		if (state.mode !== mode) {
			await view.setState({ ...state, mode: mode }, { history: false });
		}
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateStatusBar();
	}

	updateStatusBar() {
		if (!this.statusBarItem) return;

		let text = 'Lock: ';
		switch (this.settings.globalMode) {
			case 'auto': text += 'Auto'; break;
			case 'force-reading': text += 'Reading'; break;
			case 'force-editing': text += 'Editing'; break;
		}
		this.statusBarItem.setText(text);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
