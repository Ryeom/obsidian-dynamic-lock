# Dynamic Lock for Obsidian

[한국어](docs/README_KO.md)

Open Markdown notes in Reading or Editing mode based on their properties, folder, or age. **Once a note is open, switch modes freely.**

Keep reference notes ready to read and working drafts ready to edit, without switching modes every time you open them.

## When it's useful

- Open notes in `References/` in Reading mode and notes in `Drafts/` in Editing mode.
- Open finished notes with `status: done` in Reading mode.
- Open journal entries older than 30 days in Reading mode, based on their creation date.

You can switch any of these notes to Editing when you need to make a change. Dynamic Lock controls the view mode; it does not prevent editing or make files read-only.

## Quick start

1. Open **Settings → Dynamic Lock** and find **Folder rules**.
2. Select **Add folder rule**, choose your reference folder, and set its mode to **Reading**.
3. Leave the global mode on **Auto**, then open a note in that folder.
4. Switch it to Editing using Obsidian's normal mode toggle whenever you need to write. Switching tabs preserves your choice.

By default, there are no rules, and **Default mode** is **Keep current**. Add a rule or choose a default mode to start changing how notes open.

## Rules and global modes

Folder and property rules can select either Reading or Editing mode. Age rules select Reading mode after the configured number of days, using the file's creation or last modified date.

Select the status bar item to cycle through the global modes, or use the command palette:

| Status bar label | Behavior when opening a note |
| :--- | :--- |
| **Auto** | Apply rules. If none match, use **Default mode**. |
| **Locked** | Open in Reading mode, regardless of rules. You can still switch to Editing afterward. |
| **Editing** | Apply rules first; open in Editing mode if none match. |

When several rules apply, the first match in this order decides the mode:

1. Global **Locked** mode → Reading.
2. **Frontmatter rules** → the first matching property rule in the settings list.
3. **Folder rules** → the most specific matching folder, including its subfolders.
4. **Time-based lock** → Reading if the note is older than the configured period.
5. Global **Editing** mode → Editing.
6. **Default mode** → Keep current, Reading, or Editing.

### What happens after opening a note?

Your manual Reading/Editing choice is preserved when switching tabs or updating note properties. If you haven't switched modes manually, a change to the matching rule can update the view mode.

Opening another file in the tab, reopening a note, or reloading the plugin applies the configured modes again. Changing a plugin setting or selecting a global mode also reapplies the configuration to all open Markdown notes.

The status bar shows the **global mode**. A lock icon on a note's tab shows that the note is currently in **Reading mode**, including when you selected Reading manually.

## Installation

Requires Obsidian **1.4.10** or later.

1. Open **Settings → Community plugins** and turn off **Restricted mode** if needed.
2. Select **Browse** and search for `Dynamic Lock`.
3. Select **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Ryeom/obsidian-dynamic-lock/releases/latest).
2. Create `<vault>/.obsidian/plugins/dynamic-lock/` and copy the three files into it.
3. Reload Obsidian and enable **Dynamic Lock** in **Settings → Community plugins**.

## Commands

You can assign hotkeys to these commands in **Settings → Hotkeys**.

| Command | Action |
| :--- | :--- |
| `Cycle global mode` | Cycle through Auto → Locked → Editing. |
| `Set global mode to auto` | Apply rules and the configured default mode. |
| `Set global lock (reading)` | Apply Reading mode to open notes and use it for newly opened notes. |
| `Set global mode to editing` | Apply rules, with Editing as the fallback. |

You can still switch individual notes between Reading and Editing after using any of these commands.

## Translations

Settings, commands, status bar text, and notices follow the Obsidian app language. English and Korean are included. On older Obsidian versions without the language API (before 1.8.7), the plugin uses English.

To add a language, copy `src/i18n/locales/en.json` to `<language-code>.json` in the same folder, then translate the values without changing the keys. Use lowercase Obsidian language codes, such as `ja.json` or `pt-br.json`. Run `npm run build`: all locale JSON files are discovered automatically and included in `main.js`; no import list or separate translation files are needed for installation. After installing the rebuilt plugin, reload it.

Regional translations fall back to the base language and then English. Missing, empty, or non-string values also fall back. Translations only change display text; saved rule values, command IDs, mode values, and existing hotkeys stay the same. Reload the plugin after changing the Obsidian language to update command names.
