import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, DynamicLockSettings } from './types';
import { DynamicLockSettingTab } from './settings';
import { ViewController } from './viewController';

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

		this.statusBarItem.onClickEvent(async () => {
			const modes: Array<DynamicLockSettings['globalMode']> = ['auto', 'force-reading', 'force-editing'];
			const currentIndex = modes.indexOf(this.settings.globalMode || 'auto');
			const nextIndex = (currentIndex + 1) % modes.length;
			await this.viewController.setGlobalMode(modes[nextIndex]!);
		});

		this.registerCommands();
		this.registerEvents();
	}

	private registerCommands() {
		this.addCommand({
			id: 'cycle-global-mode',
			name: 'Cycle global mode',
			callback: async () => {
				const modes: ['auto', 'force-reading', 'force-editing'] = ['auto', 'force-reading', 'force-editing'];
				const currentIndex = modes.indexOf(this.settings.globalMode || 'auto');
				const nextIndex = (currentIndex + 1) % modes.length;
				await this.viewController.setGlobalMode(modes[nextIndex]!);
			}
		});

		this.addCommand({
			id: 'set-global-mode-auto',
			name: 'Set global mode to auto',
			callback: async () => this.viewController.setGlobalMode('auto')
		});

		this.addCommand({
			id: 'set-global-mode-reading',
			name: 'Set global lock (reading)',
			callback: async () => this.viewController.setGlobalMode('force-reading')
		});

		this.addCommand({
			id: 'set-global-mode-editing',
			name: 'Set global mode to editing',
			callback: async () => this.viewController.setGlobalMode('force-editing')
		});
	}

	private registerEvents() {
		this.registerEvent(this.app.workspace.on('file-open', async (file) => {
			if (!file) return;
			await this.viewController.processFileMode(file);
		}));

		this.registerEvent(this.app.workspace.on('layout-change', () => {
			this.viewController.handleViewUpdate();
		}));

		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			this.viewController.handleViewUpdate();
		}));
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
		this.viewController?.updateStatusBar();
	}
}
