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
	private originalSetState = new Map<MarkdownView, MarkdownView['setState']>();
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
		const markdownViews = this.app.workspace.getLeavesOfType('markdown')
			.map(leaf => leaf.view)
			.filter((view): view is MarkdownView => view instanceof MarkdownView);
		const views = markdownViews.filter(view => view.file);
		this.releaseClosedViews(new Set(markdownViews));
		for (const view of views) this.installModeGuard(view);
		const updates = views
			.filter(view => !file || view.file?.path === file.path)
			.map(view => this.queueUpdate(view, applyDefault));
		await Promise.all(updates);
	}

	private releaseClosedViews(openViews: Set<MarkdownView>): void {
		for (const [view] of this.originalSetState) {
			if (!openViews.has(view)) this.originalSetState.delete(view);
		}
	}

	private installModeGuard(view: MarkdownView): void {
		if (this.originalSetState.has(view)) return;
		const originalSetState = view.setState.bind(view);
		this.originalSetState.set(view, originalSetState);
		view.setState = (state: unknown, result) => {
			const file = view.file;
			const rule = file ? resolveViewRule(this.app, file, this.getSettings()) : null;
			const requestedMode = typeof state === 'object' && state !== null && 'mode' in state
				? state.mode
				: undefined;
			if (requestedMode === 'source' && rule?.locked) {
				const t = createTranslator();
				const reason = rule.lockReason;
				const message = reason?.type === 'property'
					? t('notice.readOnly.property', { attribute: reason.attribute, value: reason.value })
					: reason?.type === 'folder'
						? t('notice.readOnly.folder', { path: reason.path })
						: t('notice.readOnly');
				new Notice(message);
				return Promise.resolve();
			}
			return originalSetState(state, result);
		};
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
		const locked = rule?.locked === true;
		const isNavigation = this.lastPathPerView.get(view) !== file.path;
		const ruleChanged = this.lastRequiredMode.get(view) !== requiredMode;
		if (isNavigation || applyDefault || locked) {
			this.manualModeViews.delete(view);
		} else if (this.lastModePerView.has(view) && this.lastModePerView.get(view) !== view.getMode()) {
			this.manualModeViews.add(view);
		}
		this.lastPathPerView.set(view, file.path);
		this.lastRequiredMode.set(view, requiredMode);

		const shouldApply = locked || isNavigation || applyDefault || (ruleChanged && !this.manualModeViews.has(view));
		const mode = shouldApply ? requiredMode ?? (settings.defaultMode !== 'keep' ? settings.defaultMode : null) : null;
		if (mode && view.getMode() !== mode) {
			await view.setState({ ...view.getState(), mode }, { history: false });
		}
		if (!this.disposed && view.file === file) {
			this.lastModePerView.set(view, view.getMode());
			this.updateTabLockIcon(view, locked);
		}
	}

	refreshInBackground(file?: TFile): void {
		void this.refreshViews(file);
	}

	dispose(): void {
		this.disposed = true;
		for (const [view, originalSetState] of this.originalSetState) {
			view.setState = originalSetState;
		}
		this.originalSetState.clear();
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView) {
				const tabHeader = (leaf.view.leaf as unknown as { tabHeaderEl: HTMLElement }).tabHeaderEl;
				tabHeader?.removeClass('dynamic-lock-locked', 'dynamic-lock-unlocked');
			}
		}
	}

	updateTabLockIcon(view: MarkdownView, locked: boolean): void {
		const leaf = view.leaf;
		const tabHeader = (leaf as unknown as { tabHeaderEl: HTMLElement }).tabHeaderEl;

		if (tabHeader) {
			tabHeader.removeClass('dynamic-lock-unlocked');
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
