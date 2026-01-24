# Obsidian Dynamic Lock

**Dynamic Lock** is an Obsidian plugin that automatically switches between **Reading** and **Editing** modes based on file properties (Frontmatter), folder paths, or a global lock switch.

It allows you to protect your finished notes from accidental edits while keeping your active drafts ready for writing.

## Features

### 1. 🛡️ Dynamic View Mode
Automatically sets the view mode when you open a file based on:
- **Frontmatter Attributes**: Define rules like `status: done` -> **Reading**.
- **Folder Paths**: Define rules like `Archives/` -> **Reading**.
- **Default Mode**: Set a fallback mode for files that don't match any rules.

### 2. 🔐 Global Mode Switcher (Smart Lock)
A status bar item allows you to quickly toggle the global lock state.

| Mode | Icon/Text | Description | Behavior |
| :--- | :--- | :--- | :--- |
| **Auto** | `Lock: Auto` | **Default** | Follows your defined Frontmatter and Folder rules. |
| **Reading** | `Lock: Reading` | **Strong Lock** | **Forces ALL files to Reading mode.** (Overrides all rules). Useful for presentations or review. |
| **Editing** | `Lock: Editing` | **Safe Edit** | Forces files to Editing mode, **EXCEPT** those with explicit "Reading" rules. Protects your archived/locked notes even in edit mode. |

### 3. 📂 Folder Rules with Priority
- Supports **Longest Prefix Match**.
- You can set `A/` to **Reading** (Archive), but exception `A/Drafts/` to **Editing**.
- Files in `A/Drafts/` will open in Editing mode because the more specific path wins.

## Priority Logic

The plugin decides the mode in this order:

1.  **Global Force Reading** 🥇 (Strongest)
2.  **Frontmatter Rules** 🥈
3.  **Folder Rules** 🥉 (Longest Prefix Match)
4.  **Global Force Editing** 🛡️ (Respects Read rules above)
5.  **Default Settings**

## Installation

### Via BRAT (Recommended)
1.  Install **BRAT** from the Community Plugins in Obsidian.
2.  Open BRAT settings -> **Add Beta plugin**.
3.  Enter the repository URL: `https://github.com/Ryeom/obsidian-dynamic-lock`.
4.  Enable the plugin in Community Plugins.

### Manual Installation
1.  Clone this repository into your vault's `.obsidian/plugins/` directory.
2.  Run `npm install` and `npm run build`.
3.  Enable the plugin in Obsidian settings.

## Configuration

Go to **Settings > Dynamic Lock**:

- **Default Mode**: Reading / Editing / Keep Current.
- **Rules**: Add pairs of Attribute + Value -> Mode.
    - Example: `type: diary` -> `Editing`.
- **Folder Rules**: Add Folder Path -> Mode.
    - Example: `Resources/` -> `Reading`.

## License

MIT
