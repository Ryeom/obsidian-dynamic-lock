import { App, MarkdownView, Notice, setIcon, TFile } from 'obsidian';
import { DynamicLockSettings, ViewMode } from './types';
import { resolveViewRule } from './lockResolver';
import { createTranslator } from './i18n';

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
	private lastPathPerView = new WeakMap<MarkdownView, string>();
	private lastModePerView = new WeakMap<MarkdownView, string>();
	private manualModeViews = new WeakSet<MarkdownView>();
	private lastRequiredMode = new WeakMap<MarkdownView, ViewMode | null>();
	private updates = new Map<MarkdownView, {
		requested: boolean;
		applyDefault: boolean;
		promise: Promise<void>;
	}>();
	private disposed = false;

	constructor(deps: ViewControllerDeps) {
		this.app = deps.app;
		this.getSettings = deps.getSettings;
		this.saveSettings = deps.saveSettings;
		this.statusBarItem = deps.statusBarItem;
	}

	async refreshViews(file?: TFile, applyDefault = false): Promise<void> {
		if (this.disposed) return;
		const updates = this.app.workspace.getLeavesOfType('markdown')
			.map(leaf => leaf.view)
			.filter((view): view is MarkdownView => view instanceof MarkdownView)
			.filter(view => view.file && (!file || view.file.path === file.path))
			.map(view => this.queueUpdate(view, applyDefault));
		await Promise.all(updates);
	}

	private queueUpdate(view: MarkdownView, applyDefault: boolean): Promise<void> {
		const pending = this.updates.get(view);
		if (pending) {
			pending.requested = true;
			pending.applyDefault ||= applyDefault;
			return pending.promise;
		}

		// Mode changes can emit more layout events; coalesce them per view.
		const update = { requested: true, applyDefault, promise: Promise.resolve() };
		this.updates.set(view, update);
		update.promise = Promise.resolve().then(async () => {
			try {
				while (update.requested && !this.disposed) {
					const resetDefault = update.applyDefault;
					update.requested = false;
					update.applyDefault = false;
					await this.processView(view, resetDefault);
				}
			} finally {
				this.updates.delete(view);
			}
		}).catch((error: unknown) => {
			console.error('[DynamicLock] Failed to update view mode', error);
		});
		return update.promise;
	}

	private async processView(view: MarkdownView, applyDefault: boolean): Promise<void> {
		const file = view.file;
		if (!file) return;
		const settings = this.getSettings();
		const rule = resolveViewRule(this.app, file, settings);
		const requiredMode = rule?.mode ?? null;
		const keepReading = rule?.keepReading === true;
		const isNavigation = this.lastPathPerView.get(view) !== file.path;
		const ruleChanged = this.lastRequiredMode.get(view) !== requiredMode;
		if (isNavigation || applyDefault || keepReading) {
			this.manualModeViews.delete(view);
		} else if (this.lastModePerView.has(view) && this.lastModePerView.get(view) !== view.getMode()) {
			this.manualModeViews.add(view);
		}
		this.lastPathPerView.set(view, file.path);
		this.lastRequiredMode.set(view, requiredMode);

		const shouldApply = keepReading || isNavigation || applyDefault || (ruleChanged && !this.manualModeViews.has(view));
		const mode = shouldApply ? requiredMode ?? (settings.defaultMode !== 'keep' ? settings.defaultMode : null) : null;
		if (mode && view.getMode() !== mode) {
			await view.setState({ ...view.getState(), mode }, { history: false });
		}
		if (!this.disposed && view.file === file) {
			this.lastModePerView.set(view, view.getMode());
			this.updateTabLockIcon(view, view.getMode() === 'preview');
		}
	}

	refreshInBackground(file?: TFile): void {
		void this.refreshViews(file);
	}

	dispose(): void {
		this.disposed = true;
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView) {
				this.updateTabLockIcon(leaf.view, false);
			}
		}
	}

	updateTabLockIcon(view: MarkdownView, locked: boolean): void {
		const leaf = view.leaf;
		const tabHeader = (leaf as unknown as { tabHeaderEl: HTMLElement }).tabHeaderEl;

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
		const previousMode = settings.globalMode;
		settings.globalMode = mode;
		await this.saveSettings();

		console.debug('[DynamicLock] Global mode changed:', {
			from: previousMode,
			to: mode
		});

		new Notice(createTranslator()(`notice.${mode}`));
	}

	updateStatusBar(): void {
		if (!this.statusBarItem) return;

		this.statusBarItem.empty();
		this.statusBarItem.removeClass('mod-error', 'mod-success');

		const settings = this.getSettings();
		let iconName = 'sparkles';
		const t = createTranslator();
		this.statusBarItem.title = t(`tooltip.${settings.globalMode || 'auto'}`);
		let text = t('status.auto');

		switch (settings.globalMode) {
			case 'auto':
				iconName = 'sparkles';
				text = t('status.auto');
				break;
			case 'force-reading':
				iconName = 'lock';
				text = t('status.force-reading');
				this.statusBarItem.addClass('mod-error');
				break;
			case 'force-editing':
				iconName = 'lock-open';
				text = t('status.force-editing');
				this.statusBarItem.addClass('mod-success');
				break;
		}

		const iconSpan = this.statusBarItem.createSpan({ cls: 'status-bar-item-icon dynamic-lock-status-icon' });
		setIcon(iconSpan, iconName);

		const textSpan = this.statusBarItem.createSpan({ cls: 'status-bar-item-segment' });
		textSpan.setText(` ${text}`);
	}
}
