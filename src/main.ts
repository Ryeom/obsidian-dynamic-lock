import { App, Editor, MarkdownView, Modal, Notice, Plugin, setIcon } from 'obsidian';
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
			await this.setGlobalMode(modes[nextIndex]!);
		});

		// Add Commands
		this.addCommand({
			id: 'cycle-global-mode',
			name: 'Cycle Global Mode',
			callback: async () => {
				const modes: Array<MyPluginSettings['globalMode']> = ['auto', 'force-reading', 'force-editing'];
				const currentIndex = modes.indexOf(this.settings.globalMode || 'auto');
				const nextIndex = (currentIndex + 1) % modes.length;
				await this.setGlobalMode(modes[nextIndex]!);
			}
		});

		this.addCommand({
			id: 'set-global-mode-auto',
			name: 'Set Global Mode to Auto',
			callback: async () => this.setGlobalMode('auto')
		});

		this.addCommand({
			id: 'set-global-mode-reading',
			name: 'Set Global Lock (Reading)',
			callback: async () => this.setGlobalMode('force-reading')
		});

		this.addCommand({
			id: 'set-global-mode-editing',
			name: 'Set Global Mode to Editing',
			callback: async () => this.setGlobalMode('force-editing')
		});

		this.registerEvent(this.app.workspace.on('file-open', async (file) => {
			if (!file) return;

			// Handle 'force' modes
			const { globalMode, defaultMode, rules } = this.settings;

			// 1. Force Reading (Strong Lock) - Overrides EVERYTHING
			if (globalMode === 'force-reading') {
				await this.setFileViewMode('preview', true);
				return;
			}

			// 2. Frontmatter Rules (Exceptions / Safe Mode)
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache && cache.frontmatter) {
				for (const rule of rules) {
					// Check if attribute exists and matches value
					// We compare as string to be safe, or loose equality
					if (cache.frontmatter[rule.attribute] == rule.value) {
						await this.setFileViewMode(rule.mode, rule.mode === 'preview');
						return;
					}
				}
			}

			// 3. Folder Rules (Exceptions / Safe Mode)
			// Find matching rules
			if (this.settings.folderRules) {
				const matchingFolderRules = this.settings.folderRules.filter(rule =>
					file.path.startsWith(rule.path)
				);

				if (matchingFolderRules.length > 0) {
					// Sort by path length descending (Longest Prefix Match)
					matchingFolderRules.sort((a, b) => b.path.length - a.path.length);
					await this.setFileViewMode(matchingFolderRules[0]!.mode, matchingFolderRules[0]!.mode === 'preview');
					return;
				}
			}

			// 4. Time-based Lock (Implicit Rule)
			if (this.settings.timeLockEnabled) {
				const stat = file.stat;
				if (stat) {
					const now = Date.now();
					const targetTime = this.settings.timeLockMetric === 'mtime' ? stat.mtime : stat.ctime;
					const ageDays = (now - targetTime) / (1000 * 60 * 60 * 24);

					if (ageDays > this.settings.timeLockDays) {
						await this.setFileViewMode('preview', true);
						return;
					}
				}
			}

			// 5. Force Editing (Weak Lock / Work Mode)
			// If no specific rules matched, allow editing if global mode is editing
			if (globalMode === 'force-editing') {
				await this.setFileViewMode('source');
				return;
			}

			// 6. Default Fallback
			if (defaultMode !== 'keep') {
				await this.setFileViewMode(defaultMode, defaultMode === 'preview');
			}
		}));
	}

	async setFileViewMode(mode: 'source' | 'preview', locked: boolean = false) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const state = view.getState();
		if (state.mode !== mode) {
			await view.setState({ ...state, mode: mode }, { history: false });
		}

		// Update Tab Header Icon
		const leaf = view.leaf;
		// @ts-ignore - tabHeaderEl is not in the public definition but exists
		const tabHeader = leaf.tabHeaderEl as HTMLElement;

		if (tabHeader) {
			if (locked && mode === 'preview') {
				tabHeader.addClass('dynamic-lock-locked');
			} else {
				tabHeader.removeClass('dynamic-lock-locked');
			}
		}
	}

	onunload() {
		if (this.statusBarItem) {
			this.statusBarItem.remove();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateStatusBar();
	}

	async setGlobalMode(mode: MyPluginSettings['globalMode']) {
		this.settings.globalMode = mode;
		await this.saveSettings();
		new Notice(`Dynamic Lock: Switched to ${mode}`);

		// Re-evaluate current file
		const file = this.app.workspace.getActiveFile();
		if (file) {
			// Trigger the file-open logic manually
			this.app.workspace.trigger('file-open', file);
		}
	}

	updateStatusBar() {
		if (!this.statusBarItem) return;

		this.statusBarItem.empty();

		// Icon
		let iconName = 'sparkles';
		let text = ' Auto';
		let cls = '';

		switch (this.settings.globalMode) {
			case 'auto':
				iconName = 'sparkles';
				text = ' Auto';
				break;
			case 'force-reading':
				iconName = 'lock';
				text = ' Locked';
				cls = 'mod-error';
				break;
			case 'force-editing':
				iconName = 'lock-open';
				text = ' Editing';
				cls = 'mod-success';
				break;
		}

		// Obsidian API: setIcon(parent, iconId)
		// We create a span for the icon
		const iconSpan = this.statusBarItem.createSpan({ cls: 'status-bar-item-icon' });
		setIcon(iconSpan, iconName);
		// Add margin to icon for spacing
		iconSpan.style.marginRight = '4px';

		// Text
		const textSpan = this.statusBarItem.createSpan({ cls: 'status-bar-item-segment' });
		textSpan.setText(text);
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
