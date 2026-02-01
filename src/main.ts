import { MarkdownView, Notice, Plugin, setIcon, TFile, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, DynamicLockSettings, DynamicLockSettingTab, ViewMode } from "./settings";

export default class DynamicLockPlugin extends Plugin {
	settings: DynamicLockSettings;
	statusBarItem: HTMLElement;
	private lastFilePerLeaf = new WeakMap<WorkspaceLeaf, TFile>();

	getRequiredViewMode(file: TFile): ViewMode | null {
		const { globalMode, rules } = this.settings;

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
		// Removed: Now returns null if no specific rule matches.
		// The decision to use default mode or keep current mode is handled in processFileMode.

		return null;
	}

	async processFileMode(file: TFile) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const leaf = view.leaf;
		const requiredMode = this.getRequiredViewMode(file);

		if (requiredMode) {
			// Strict rule match (Lock, Folder, Time, Global Force)
			await this.setFileViewMode(requiredMode, requiredMode === 'preview');
		} else {
			// No strict rule - Logic to distinguish Navigation vs Tab Switch
			const lastFile = this.lastFilePerLeaf.get(leaf);
			const isNavigation = lastFile?.path !== file.path;

			if (isNavigation) {
				// New file opened in this leaf. 
				// Default behavior: Go to Editing, unless user explicitly set defaultMode to 'preview'
				const targetMode = this.settings.defaultMode === 'preview' ? 'preview' : 'source';
				// If defaultMode is 'keep', we treat navigation as "Unlock/Edit" by default for non-locked files.

				await this.setFileViewMode(targetMode, false);
			} else {
				// Same file (Tab switch to existing tab). 
				// Do NOTHING. Keep whatever mode the user set manually or was previously set.

				// Ensure icon matches current mode (Reading = Locked Icon)
				this.updateTabLockIcon(view, view.getMode() === 'preview');
			}
		}

		// Update state for next check
		this.lastFilePerLeaf.set(leaf, file);
	}

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new DynamicLockSettingTab(this.app, this));

		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar();
		this.statusBarItem.onClickEvent(async () => {
			const modes: Array<DynamicLockSettings['globalMode']> = ['auto', 'force-reading', 'force-editing'];
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

			// UX Change: Always show lock icon if in 'preview' (Reading) mode, 
			// regardless of whether it's forced or manual.
			this.updateTabLockIcon(view, view.getMode() === 'preview');
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

		// Force icon to match mode (UX decision: Reading = Locked Icon)
		// We defer to the 'locked' argument if provided for legacy reasons, 
		// BUT for this specific UX change, 'locked' should basically be 'isPreview'.
		// To be safe and consistent with the new UX:
		this.updateTabLockIcon(view, mode === 'preview');
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<DynamicLockSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateStatusBar();
	}

	async setGlobalMode(mode: DynamicLockSettings['globalMode']) {
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
		this.statusBarItem.removeClass('mod-error', 'mod-success');

		let iconName = 'sparkles';
		let text = ' Auto';

		switch (this.settings.globalMode) {
			case 'auto':
				iconName = 'sparkles';
				text = ' Auto';
				break;
			case 'force-reading':
				iconName = 'lock';
				text = ' Locked';
				this.statusBarItem.addClass('mod-error');
				break;
			case 'force-editing':
				iconName = 'lock-open';
				text = ' Editing';
				this.statusBarItem.addClass('mod-success');
				break;
		}

		const iconSpan = this.statusBarItem.createSpan({ cls: 'status-bar-item-icon' });
		setIcon(iconSpan, iconName);
		iconSpan.style.marginRight = '4px';

		const textSpan = this.statusBarItem.createSpan({ cls: 'status-bar-item-segment' });
		textSpan.setText(text);
	}
}
