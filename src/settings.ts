import { App, PluginSettingTab, Setting, ButtonComponent } from "obsidian";
import MyPlugin from "./main";

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

export interface MyPluginSettings {
	rules: Rule[];
	folderRules: FolderRule[];
	defaultMode: 'keep' | ViewMode;
	globalMode: 'auto' | 'force-reading' | 'force-editing';
	// Time-based Lock settings
	timeLockEnabled: boolean;
	timeLockDays: number;
	timeLockMetric: 'ctime' | 'mtime';
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	rules: [],
	folderRules: [],
	defaultMode: 'keep',
	globalMode: 'auto',
	timeLockEnabled: false,
	timeLockDays: 30,
	timeLockMetric: 'ctime' // Default to Creation Time as per user preference
}

export class DynamicLockSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
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
						this.plugin.settings.timeLockDays = Number(value);
						await this.plugin.saveSettings();
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
			const div = containerEl.createDiv({ cls: 'dynamic-lock-rule-container' });
			// Styling can be done in styles.css, but for now we rely on default layout or simple styles if needed.
			// Ideally we want them in a row. Obsidian Settings usually stack, but we can try to put them in one Setting item or a div.

			// Using a Setting for each rule row
			const s = new Setting(containerEl)
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

			// Removing the default border if we want a tighter look, but standard is fine.
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
			const div = containerEl.createDiv({ cls: 'dynamic-lock-rule-container' });

			new Setting(containerEl)
				.addText(text => text
					.setPlaceholder('Folder Path (e.g. Archives/)')
					.setValue(rule.path)
					.onChange(async (value) => {
						rule.path = value;
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
						this.plugin.settings.folderRules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}));
		});
	}
}
