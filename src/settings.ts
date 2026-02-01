import { App, PluginSettingTab, Setting, ButtonComponent, AbstractInputSuggest, TFolder } from "obsidian";
import DynamicLockPlugin from "./main";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((file) => {
			if (file instanceof TFolder && file.path.toLowerCase().contains(lowerCaseInputStr)) {
				folders.push(file);
			}
		});

		return folders;
	}

	renderSuggestion(file: TFolder, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFolder): void {
		this.inputEl.value = file.path;
		this.inputEl.trigger("input");
		this.close();
	}
}

export type ViewMode = 'source' | 'preview';

export interface Rule {
	attribute: string;
	value: string;
	mode: ViewMode;
}

export interface FolderRule {
	path: string;
	mode: ViewMode;
}

export interface DynamicLockSettings {
	rules: Rule[];
	folderRules: FolderRule[];
	defaultMode: 'keep' | ViewMode;
	globalMode: 'auto' | 'force-reading' | 'force-editing';
	// Time-based Lock settings
	timeLockEnabled: boolean;
	timeLockDays: number;
	timeLockMetric: 'ctime' | 'mtime';
}

export const DEFAULT_SETTINGS: DynamicLockSettings = {
	rules: [],
	folderRules: [],
	defaultMode: 'keep',
	globalMode: 'auto',
	timeLockEnabled: false,
	timeLockDays: 30,
	timeLockMetric: 'ctime' // Default to Creation Time as per user preference
}

export class DynamicLockSettingTab extends PluginSettingTab {
	plugin: DynamicLockPlugin;

	constructor(app: App, plugin: DynamicLockPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Default Mode')
			.setDesc('Behavior when no rules match.')
			.addDropdown(dropdown => dropdown
				.addOption('keep', 'Keep Current')
				.addOption('source', 'Editing')
				.addOption('preview', 'Reading')
				.setValue(this.plugin.settings.defaultMode)
				.onChange(async (value) => {
					this.plugin.settings.defaultMode = value as 'keep' | ViewMode;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Time-based Lock')
			.setDesc('Automatically lock files older than a certain period.')
			.setHeading();

		new Setting(containerEl)
			.setName('Enable Time Lock')
			.setDesc('Turn on auto-locking for old notes.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.timeLockEnabled)
				.onChange(async (value) => {
					this.plugin.settings.timeLockEnabled = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide other opts
				}));

		if (this.plugin.settings.timeLockEnabled) {
			new Setting(containerEl)
				.setName('Review Period (Days)')
				.setDesc('Lock file if age exceeds this many days.')
				.addText(text => text
					.setValue(String(this.plugin.settings.timeLockDays))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.timeLockDays = num;
							await this.plugin.saveSettings();
						}
					}));

			new Setting(containerEl)
				.setName('Basis Date')
				.setDesc('Which date to use for age calculation.')
				.addDropdown(dropdown => dropdown
					.addOption('ctime', 'Creation Date')
					.addOption('mtime', 'Last Modified Date')
					.setValue(this.plugin.settings.timeLockMetric)
					.onChange(async (value) => {
						this.plugin.settings.timeLockMetric = value as 'ctime' | 'mtime';
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl)
			.setName('Rules')
			.setDesc('Define rules to dynamically switch modes based on file properties.')
			.setHeading();

		// Add Rule Button
		new Setting(containerEl)
			.addButton((btn: ButtonComponent) => {
				btn
					.setButtonText("Add Rule")
					.setCta()
					.onClick(async () => {
						this.plugin.settings.rules.push({
							attribute: "",
							value: "",
							mode: 'preview'
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});

		// Render Rules
		this.plugin.settings.rules.forEach((rule, index) => {
			new Setting(containerEl)
				.addText(text => text
					.setPlaceholder('Attribute (e.g. status)')
					.setValue(rule.attribute)
					.onChange(async (value) => {
						rule.attribute = value;
						await this.plugin.saveSettings();
					}))
				.addText(text => text
					.setPlaceholder('Value (e.g. done)')
					.setValue(rule.value)
					.onChange(async (value) => {
						rule.value = value;
						await this.plugin.saveSettings();
					}))
				.addDropdown(dropdown => dropdown
					.addOption('source', 'Editing')
					.addOption('preview', 'Reading')
					.setValue(rule.mode)
					.onChange(async (value) => {
						rule.mode = value as ViewMode;
						await this.plugin.saveSettings();
					}))
				.addExtraButton(cb => cb
					.setIcon("cross")
					.setTooltip("Delete Rule")
					.onClick(async () => {
						this.plugin.settings.rules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}));
		});

		new Setting(containerEl)
			.setName('Folder Rules')
			.setDesc('Define rules based on file path. Longest prefix match will be applied.')
			.setHeading();

		// Add Folder Rule Button
		new Setting(containerEl)
			.addButton((btn: ButtonComponent) => {
				btn
					.setButtonText("Add Folder Rule")
					.setCta()
					.onClick(async () => {
						this.plugin.settings.folderRules.push({
							path: "",
							mode: 'preview'
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});

		// Render Folder Rules
		this.plugin.settings.folderRules.forEach((rule, index) => {
			new Setting(containerEl)
				.addText(text => {
					text
						.setPlaceholder('Folder Path (e.g. Archives/)')
						.setValue(rule.path)
						.onChange(async (value) => {
							rule.path = value;
							await this.plugin.saveSettings();
						});
					new FolderSuggest(this.app, text.inputEl);
				})
				.addDropdown(dropdown => dropdown
					.addOption('source', 'Editing')
					.addOption('preview', 'Reading')
					.setValue(rule.mode)
					.onChange(async (value) => {
						rule.mode = value as ViewMode;
						await this.plugin.saveSettings();
					}))
				.addExtraButton(cb => cb
					.setIcon("cross")
					.setTooltip("Delete Rule")
					.onClick(async () => {
						this.plugin.settings.folderRules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}));
		});
	}
}
