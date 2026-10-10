import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, DynamicLockSettings } from './types';
import { DynamicLockSettingTab } from './settings';
import { ViewController } from './viewController';
import { createTranslator } from './i18n';

export default class DynamicLockPlugin extends Plugin {
	settings: DynamicLockSettings;
	statusBarItem: HTMLElement;
	private viewController: ViewController;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new DynamicLockSettingTab(this.app, this));

		this.statusBarItem = this.addStatusBarItem();

		this.viewController = new ViewController({
			app: this.app,
			getSettings: () => this.settings,
			saveSettings: () => this.saveSettings(),
			statusBarItem: this.statusBarItem,
		});

		this.viewController.updateStatusBar();

		this.registerDomEvent(this.statusBarItem, 'click', async () => {
			const modes: Array<DynamicLockSettings['globalMode']> = ['auto', 'force-reading', 'force-editing'];
			const currentIndex = modes.indexOf(this.settings.globalMode || 'auto');
			const nextIndex = (currentIndex + 1) % modes.length;
			await this.viewController.setGlobalMode(modes[nextIndex]!);
		});

		this.registerCommands();
		this.registerEvents();
		this.app.workspace.onLayoutReady(() => this.viewController.refreshInBackground());
	}

	private registerCommands() {
		const t = createTranslator();
		this.addCommand({
			id: 'cycle-global-mode',
			name: t('command.cycle'),
			callback: async () => {
				const modes: ['auto', 'force-reading', 'force-editing'] = ['auto', 'force-reading', 'force-editing'];
				const currentIndex = modes.indexOf(this.settings.globalMode || 'auto');
				const nextIndex = (currentIndex + 1) % modes.length;
				await this.viewController.setGlobalMode(modes[nextIndex]!);
			}
		});

		this.addCommand({
			id: 'set-global-mode-auto',
			name: t('command.auto'),
			callback: async () => this.viewController.setGlobalMode('auto')
		});

		this.addCommand({
			id: 'set-global-mode-reading',
			name: t('command.reading'),
			callback: async () => this.viewController.setGlobalMode('force-reading')
		});

		this.addCommand({
			id: 'set-global-mode-editing',
			name: t('command.editing'),
			callback: async () => this.viewController.setGlobalMode('force-editing')
		});
	}

	private registerEvents() {
		this.registerEvent(this.app.workspace.on('file-open', () => {
			this.viewController.refreshInBackground();
		}));
		this.registerEvent(this.app.workspace.on('layout-change', () => {
			this.viewController.refreshInBackground();
		}));
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			this.viewController.refreshInBackground();
		}));
		this.registerEvent(this.app.metadataCache.on('changed', file => {
			this.viewController.refreshInBackground(file);
		}));
		this.registerEvent(this.app.vault.on('rename', () => {
			this.viewController.refreshInBackground();
		}));
	}

	onunload() {
		this.viewController?.dispose();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<DynamicLockSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.viewController?.updateStatusBar();
		await this.viewController?.refreshViews(undefined, true);
	}
}
