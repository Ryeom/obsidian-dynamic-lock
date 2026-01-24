import { App, PluginSettingTab, Setting, ButtonComponent } from "obsidian";
import MyPlugin from "./main";

export type ViewMode = 'source' | 'preview';

export interface Rule {
	attribute: string;
	value: string;
	mode: ViewMode;
}

export interface MyPluginSettings {
	rules: Rule[];
	defaultMode: 'keep' | ViewMode;
	globalMode: 'auto' | 'force-reading' | 'force-editing';
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	rules: [],
	defaultMode: 'keep',
	globalMode: 'auto'
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
	}
}
