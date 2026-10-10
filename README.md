# Dynamic Lock for Obsidian

[한국어로 볼래요](docs/README_KO.md)

> **Dynamically secure your workflow.**
> Automatically switch between **Reading** and **Editing** modes based on file properties, folders, or time.

![Version](https://img.shields.io/badge/version-1.3.4-blue) ![License](https://img.shields.io/badge/license-MIT-green)

Move seamlessly between **writing** and **referencing**. Protect your finished notes from accidental edits while keeping your active drafts ready to write.

---

## Features

- **Smart Lock Logic**:
    - **Strong Lock (Reading)**: Keeps all open Markdown notes in Reading mode for review or presentation.
    - **Safe Edit (Editing)**: Allows editing but respects explicit locks on archived files.
- **Folder Rules**: Automatically lock files in specific folders (e.g., `Archives/`, `References/`). Supports Longest Prefix Match.
- **Frontmatter Rules**: Lock individual files using metadata (e.g., `status: done`, `type: archive`).
- **Time-based Auto Lock**: Automatically lock old notes based on creation or modification date. (e.g., "Lock creation after 30 days").
- **Visual Cues**:
    - **Status Bar**: See current global mode at a glance (Auto, Locked, Editing).
    - **Tab Icon**: A lock icon appears on the tab header whenever you are in **Reading Mode**.
- **Hotkeys & Commands**: Cycle modes or toggle locks instantly via Command Palette.

---

## How It Works

Dynamic Lock determines the view mode based on a **Priority System**:

1.  **Global Force Reading**: Overrides EVERYTHING. Useful for presentations.
2.  **Frontmatter Rules**: Explicit file-level control (`status: done` -> Reading).
3.  **Folder Rules**: Section-level control (`Archives/` -> Reading).
4.  **Time-based Lock**: (If enabled) Locks old files automatically.
5.  **Global Force Editing**: Forces Editing mode.
6.  **Auto Mode**:
    - **Strict Rules**: Locks files matching the rules above.
    - **Free Navigation**: Newly opened files use **Default mode** when no rule matches (initially **Keep current**).
    - **Tab Persistence**: Switching tabs preserves your manual mode (Reading/Editing) for files without a matching rule.

---

Rules are reapplied to open notes when properties, settings, or folder paths change, and when the plugin starts. Matching rules remain enforced when switching view modes. When a rule stops matching, the configured **Default mode** applies; **Keep current** leaves the view as it is.

## Usage

### 1. Global Modes (Click Status Bar)
| Icon | Mode | Description |
| :--- | :--- | :--- |
| Auto | **Auto** | The **Smart Mode**. Locks matched files, keeps others editable, and remembers your tab state. |
| Locked | **Reading** | **Presentation Mode**. Forces ALL files to Reading view. |
| Editing | **Editing** | **Work Mode**. Forces Editing view (resets manual reading checks). |

> **Tip**: You can assign a hotkey to `Dynamic Lock: Cycle global mode` for quick switching!

### 2. Time-based Locking
Forget about manually locking files.
- Go to **Settings > Time-based Lock**.
- Enable it and set a period (e.g., **30 Days**).
- Choose **Creation Date** (good for Daily Notes/Diaries) or **Modified Date** (good for Wikis).

### 3. Visual Feedback
Locked status is clear and intuitive:
- **Lock Icon**: Appears on the tab header whenever the file is in **Reading Mode** (whether enforced by rule or set manually).
- **No Icon**: The file is in **Editing Mode**.

---

## Installation

1.  Open **Settings > Community Plugins** in Obsidian.
2.  Turn off **Restricted Mode**.
3.  Click **Browse** and search for `Dynamic Lock`.
4.  Click **Install** and then **Enable**.

### Manual Installation
1.  Download `main.js`, `manifest.json`, `styles.css` from the [Releases](https://github.com/Ryeom/obsidian-dynamic-lock/releases).
2.  Copy them to `<vault>/.obsidian/plugins/obsidian-dynamic-lock/`.
3.  Reload Obsidian.

---

## Translations

Settings, commands, status bar text, and notices follow the Obsidian app language. English and Korean are included. On older Obsidian versions without the language API (before 1.8.7), the plugin uses English.

To add a language, copy `src/i18n/locales/en.json` to `<language-code>.json` in the same folder, then translate the values without changing the keys. Use lowercase Obsidian language codes, such as `ja.json` or `pt-br.json`. Run `npm run build`: all locale JSON files are discovered automatically and included in `main.js`; no import list or separate translation files are needed for installation. After installing the rebuilt plugin, reload it.

Regional translations fall back to the base language and then English. Missing, empty, or non-string values also fall back. Translations only change display text; saved rule values, command IDs, mode values, and existing hotkeys stay the same. Reload the plugin after changing the Obsidian language to update command names.

## Commands

| Command | Action |
| :--- | :--- |
| `Cycle global mode` | Switch: Auto → Reading → Editing → ... |
| `Set global mode to auto` | Reset to smart rules. |
| `Set global lock (reading)` | Force strict reading mode. |
| `Set global mode to editing` | Force editing mode. |

---

made by **Ryeom**
