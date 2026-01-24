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

			// 1. Force Reading (Strong Lock) - Overrides EVERYTHING
			if (globalMode === 'force-reading') {
				await this.setFileViewMode('preview');
				return;
			}

			// 2. Frontmatter Rules (Exceptions / Safe Mode)
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache && cache.frontmatter) {
				for (const rule of rules) {
					const fileValue = cache.frontmatter[rule.attribute];
					// Check if attribute exists and matches value
					// We compare as string to be safe, or loose equality
					if (fileValue == rule.value) {
						await this.setFileViewMode(rule.mode);
						return;
					}
				}
			} else {
			}

			// 3. Folder Rules (Exceptions / Safe Mode)
			// Find matching rules
			const matchingFolderRules = this.settings.folderRules.filter(rule =>
				file.path.startsWith(rule.path)
			);

			if (matchingFolderRules.length > 0) {
				// Sort by path length descending (Longest Prefix Match)
				matchingFolderRules.sort((a, b) => b.path.length - a.path.length);
				await this.setFileViewMode(matchingFolderRules[0]!.mode);
				return;
			}

			// 4. Force Editing (Weak Lock / Work Mode)
			// If no specific rules matched, allow editing if global mode is editing
			if (globalMode === 'force-editing') {
				await this.setFileViewMode('source');
				return;
			}

			// 5. Default Fallback
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
