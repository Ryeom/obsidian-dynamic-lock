import { App, MarkdownView, Notice, setIcon, TFile, WorkspaceLeaf } from 'obsidian';
import { DynamicLockSettings, ViewMode } from './types';
import { getRequiredViewMode } from './lockResolver';

export interface ViewControllerDeps {
	app: App;
	getSettings: () => DynamicLockSettings;
	saveSettings: () => Promise<void>;
	statusBarItem: HTMLElement;
}

export class ViewController {
	private app: App;
	private getSettings: () => DynamicLockSettings;
	private saveSettings: () => Promise<void>;
	private statusBarItem: HTMLElement;
	private lastFilePerLeaf = new WeakMap<WorkspaceLeaf, TFile>();

	constructor(deps: ViewControllerDeps) {
		this.app = deps.app;
		this.getSettings = deps.getSettings;
		this.saveSettings = deps.saveSettings;
		this.statusBarItem = deps.statusBarItem;
	}

	async processFileMode(file: TFile): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const leaf = view.leaf;
		const settings = this.getSettings();
		const requiredMode = getRequiredViewMode(this.app, file, settings);

		if (requiredMode) {
			await this.setFileViewMode(requiredMode);
		} else {
			const lastFile = this.lastFilePerLeaf.get(leaf);
			const isNavigation = lastFile?.path !== file.path;

			if (isNavigation && settings.defaultMode !== 'keep') {
				await this.setFileViewMode(settings.defaultMode);
			} else {
				this.updateTabLockIcon(view, view.getMode() === 'preview');
			}
		}

		this.lastFilePerLeaf.set(leaf, file);
	}

	async setFileViewMode(mode: ViewMode): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const state = view.getState();
		if (state.mode !== mode) {
			await view.setState({ ...state, mode }, { history: false });
		}

		this.updateTabLockIcon(view, mode === 'preview');
	}

	updateTabLockIcon(view: MarkdownView, locked: boolean): void {
		const leaf = view.leaf;
		// @ts-ignore - tabHeaderEl exists but not in type definition
		const tabHeader = leaf.tabHeaderEl as HTMLElement;

		if (tabHeader) {
			if (locked) {
				tabHeader.addClass('dynamic-lock-locked');
			} else {
				tabHeader.removeClass('dynamic-lock-locked');
			}
		}
	}

	async setGlobalMode(mode: DynamicLockSettings['globalMode']): Promise<void> {
		const settings = this.getSettings();
		settings.globalMode = mode;
		await this.saveSettings();
		new Notice(`Dynamic Lock: Switched to ${mode}`);

		const file = this.app.workspace.getActiveFile();
		if (file) {
			this.app.workspace.trigger('file-open', file);
		}
	}

	updateStatusBar(): void {
		if (!this.statusBarItem) return;

		this.statusBarItem.empty();
		this.statusBarItem.removeClass('mod-error', 'mod-success');

		const settings = this.getSettings();
		let iconName = 'sparkles';
		let text = ' Auto';

		switch (settings.globalMode) {
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
		iconSpan.setCssProps({ 'margin-right': '4px' });

		const textSpan = this.statusBarItem.createSpan({ cls: 'status-bar-item-segment' });
		textSpan.setText(text);
	}

	handleViewUpdate(): void {
		const file = this.app.workspace.getActiveFile();
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!file || !view) return;

		const settings = this.getSettings();
		const requiredMode = getRequiredViewMode(this.app, file, settings);

		if (requiredMode && view.getMode() !== requiredMode) {
			void this.setFileViewMode(requiredMode);
		} else {
			this.updateTabLockIcon(view, view.getMode() === 'preview');
		}
	}
}
