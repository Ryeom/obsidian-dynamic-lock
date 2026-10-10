import { App, PluginSettingTab, Setting, ButtonComponent, AbstractInputSuggest, TFolder } from "obsidian";
import DynamicLockPlugin from "./main";
import { ViewMode } from "./types";
import { createTranslator } from "./i18n";

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
		this.inputEl.value = file.path.endsWith('/') ? file.path : file.path + '/';
		this.inputEl.trigger("input");
		this.close();
	}
}

export class DynamicLockSettingTab extends PluginSettingTab {
	plugin: DynamicLockPlugin;

	constructor(app: App, plugin: DynamicLockPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const t = createTranslator();

		containerEl.empty();

		new Setting(containerEl)
			.setName(t('defaultMode.name'))
			.setDesc(t('defaultMode.description'))
			.addDropdown(dropdown => dropdown
				.addOption('keep', t('mode.keep'))
				.addOption('source', t('mode.editing'))
				.addOption('preview', t('mode.reading'))
				.setValue(this.plugin.settings.defaultMode)
				.onChange(async (value) => {
					this.plugin.settings.defaultMode = value as 'keep' | ViewMode;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('timeLock.heading'))
			.setDesc(t('timeLock.description'))
			.setHeading();

		new Setting(containerEl)
			.setName(t('timeLock.enabled.name'))
			.setDesc(t('timeLock.enabled.description'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.timeLockEnabled)
				.onChange(async (value) => {
					this.plugin.settings.timeLockEnabled = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.timeLockEnabled) {
			new Setting(containerEl)
				.setName(t('timeLock.days.name'))
				.setDesc(t('timeLock.days.description'))
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
				.setName(t('timeLock.metric.name'))
				.setDesc(t('timeLock.metric.description'))
				.addDropdown(dropdown => dropdown
					.addOption('ctime', t('timeLock.metric.created'))
					.addOption('mtime', t('timeLock.metric.modified'))
					.setValue(this.plugin.settings.timeLockMetric)
					.onChange(async (value) => {
						this.plugin.settings.timeLockMetric = value as 'ctime' | 'mtime';
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl)
			.setName(t('frontmatter.heading'))
			.setDesc(t('frontmatter.description'))
			.setHeading();

		new Setting(containerEl)
			.addButton((btn: ButtonComponent) => {
				btn
					.setButtonText(t('frontmatter.add'))
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

		this.plugin.settings.rules.forEach((rule, index) => {
			new Setting(containerEl)
				.addText(text => text
					.setPlaceholder(t('frontmatter.attributePlaceholder'))
					.setValue(rule.attribute)
					.onChange(async (value) => {
						rule.attribute = value;
						await this.plugin.saveSettings();
					}))
				.addText(text => text
					.setPlaceholder(t('frontmatter.valuePlaceholder'))
					.setValue(rule.value)
					.onChange(async (value) => {
						rule.value = value;
						await this.plugin.saveSettings();
					}))
				.addDropdown(dropdown => dropdown
					.addOption('source', t('mode.editing'))
					.addOption('preview', t('mode.reading'))
					.setValue(rule.mode)
					.onChange(async (value) => {
						rule.mode = value as ViewMode;
						await this.plugin.saveSettings();
					}))
				.addExtraButton(cb => cb
					.setIcon("cross")
					.setTooltip(t('rule.delete'))
					.onClick(async () => {
						this.plugin.settings.rules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}));
		});

		new Setting(containerEl)
			.setName(t('folder.heading'))
			.setDesc(t('folder.description'))
			.setHeading();

		new Setting(containerEl)
			.addButton((btn: ButtonComponent) => {
				btn
					.setButtonText(t('folder.add'))
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

		this.plugin.settings.folderRules.forEach((rule, index) => {
			new Setting(containerEl)
				.addText(text => {
					text
						.setPlaceholder(t('folder.pathPlaceholder'))
						.setValue(rule.path)
						.onChange(async (value) => {
							rule.path = value;
							await this.plugin.saveSettings();
						});
					new FolderSuggest(this.app, text.inputEl);
				})
				.addDropdown(dropdown => dropdown
					.addOption('source', t('mode.editing'))
					.addOption('preview', t('mode.reading'))
					.setValue(rule.mode)
					.onChange(async (value) => {
						rule.mode = value as ViewMode;
						await this.plugin.saveSettings();
					}))
				.addExtraButton(cb => cb
					.setIcon("cross")
					.setTooltip(t('rule.delete'))
					.onClick(async () => {
						this.plugin.settings.folderRules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}));
		});
	}
}
