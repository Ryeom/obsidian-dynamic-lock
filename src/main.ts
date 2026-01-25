import { App, Editor, MarkdownView, Modal, Notice, Plugin, setIcon, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, DynamicLockSettingTab, ViewMode } from "./settings";

// Remember to rename these classes and interfaces!

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	statusBarItem: HTMLElement;

	getRequiredViewMode(file: TFile): ViewMode | null {
		const { globalMode, defaultMode, rules } = this.settings;

		// 1. Force Reading (Strong Lock)
		if (globalMode === 'force-reading') return 'preview';

		// 2. Frontmatter Rules
		const cache = this.app.metadataCache.getFileCache(file);
		if (cache && cache.frontmatter) {
			for (const rule of rules) {
				if (cache.frontmatter[rule.attribute] == rule.value) {
					return rule.mode;
				}
			}
		}

		// 3. Folder Rules
		if (this.settings.folderRules) {
			const matchingFolderRules = this.settings.folderRules.filter(rule =>
				file.path.startsWith(rule.path)
			);

			if (matchingFolderRules.length > 0) {
				matchingFolderRules.sort((a, b) => b.path.length - a.path.length);
				return matchingFolderRules[0]!.mode;
			}
		}

		// 4. Time-based Lock (Implicit Rule)
		if (this.settings.timeLockEnabled) {
			// @ts-ignore
			const stat = file.stat;
			if (stat) {
				const now = Date.now();
				const targetTime = this.settings.timeLockMetric === 'mtime' ? stat.mtime : stat.ctime;
				const ageDays = (now - targetTime) / (1000 * 60 * 60 * 24);

				if (ageDays > this.settings.timeLockDays) {
					return 'preview';
				}
			}
		}

		// 5. Force Editing
		if (globalMode === 'force-editing') return 'source';

		// 6. Default Fallback
		if (defaultMode !== 'keep') {
			return defaultMode;
		}

		return null;
	}

	async processFileMode(file: TFile) {
		const requiredMode = this.getRequiredViewMode(file);
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		if (requiredMode) {
			await this.setFileViewMode(requiredMode, requiredMode === 'preview');
		} else {
			// No rule matches, ensure icon is removed
			this.updateTabLockIcon(view, false);
		}
	}

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new DynamicLockSettingTab(this.app, this));

		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar();
		this.statusBarItem.onClickEvent(async () => {
			const modes: Array<MyPluginSettings['globalMode']> = ['auto', 'force-reading', 'force-editing'];
			const currentIndex = modes.indexOf(this.settings.globalMode || 'auto');
			const nextIndex = (currentIndex + 1) % modes.length;
			await this.setGlobalMode(modes[nextIndex]!);
		});

		// Commands...
		this.addCommand({
			id: 'cycle-global-mode', name: 'Cycle Global Mode', callback: async () => {
				const modes: ['auto', 'force-reading', 'force-editing'] = ['auto', 'force-reading', 'force-editing'];
				const currentIndex = modes.indexOf(this.settings.globalMode || 'auto');
				const nextIndex = (currentIndex + 1) % modes.length;
				await this.setGlobalMode(modes[nextIndex]!);
			}
		});
		this.addCommand({ id: 'set-global-mode-auto', name: 'Set Global Mode to Auto', callback: async () => this.setGlobalMode('auto') });
		this.addCommand({ id: 'set-global-mode-reading', name: 'Set Global Lock (Reading)', callback: async () => this.setGlobalMode('force-reading') });
		this.addCommand({ id: 'set-global-mode-editing', name: 'Set Global Mode to Editing', callback: async () => this.setGlobalMode('force-editing') });

		// Event: File Open
		this.registerEvent(this.app.workspace.on('file-open', async (file) => {
			if (!file) return;
			await this.processFileMode(file);
		}));

		// Event: Layout Change & Active Leaf Change
		// Using a debounced handler or just shared handler to catch mode switches.
		const handleViewUpdate = () => {
			const file = this.app.workspace.getActiveFile();
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!file || !view) return;

			// If user in Source mode, always remove icon
			// If user in Preview mode, check if it SHOULD be locked
			if (view.getMode() === 'source') {
				this.updateTabLockIcon(view, false);
			} else {
				const requiredMode = this.getRequiredViewMode(file);
				this.updateTabLockIcon(view, requiredMode === 'preview');
			}
		};

		this.registerEvent(this.app.workspace.on('layout-change', handleViewUpdate));
		this.registerEvent(this.app.workspace.on('active-leaf-change', handleViewUpdate));
		// Also listen to css-change in case of theme updates affecting icons? Unlikely needed.
	}

	async setFileViewMode(mode: ViewMode, locked: boolean = false) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const state = view.getState();
		if (state.mode !== mode) {
			await view.setState({ ...state, mode: mode }, { history: false });
		}

		this.updateTabLockIcon(view, locked);
	}

	updateTabLockIcon(view: MarkdownView, locked: boolean) {
		const leaf = view.leaf;
		// @ts-ignore - tabHeaderEl is not in the public definition but exists
		const tabHeader = leaf.tabHeaderEl as HTMLElement;

		if (tabHeader) {
			if (locked) {
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
