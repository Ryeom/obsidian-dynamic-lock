# 🔒 Dynamic Lock for Obsidian

> **Dynamically secure your workflow.**  
> Automatically switch between **Reading** and **Editing** modes based on file properties, folders, or time.

![Version](https://img.shields.io/badge/version-1.3.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

Move seamlessly between **writing** and **referencing**. Protect your finished notes from accidental edits while keeping your active drafts ready to write.

---

## ✨ Features

- **🧠 Smart Lock Logic**:
    - **Strong Lock (Reading)**: Permanently locks files for review or presentation.
    - **Safe Edit (Editing)**: Allows editing but respects explicit locks on archived files.
- **📂 Folder Rules**: Automatically lock files in specific folders (e.g., `Archives/`, `References/`). Supports Longest Prefix Match.
- **🏷️ Frontmatter Rules**: Lock individual files using metadata (e.g., `status: done`, `type: archive`).
- **⏳ Time-based Auto Lock**: Automatically lock old notes based on creation or modification date. (e.g., "Lock creation after 30 days").
- **🎨 Visual Cues**: 
    - **Status Bar**: See current global mode at a glance (✨ Auto, 🔒 Locked, 🔓 Editing).
    - **Tab Icon**: A 🔒 icon appears on the tab header of locked files.
- **⌨️ Hotkeys & Commands**: Cycle modes or toggle locks instantly via Command Palette.

---

## 🚀 How It Works

Dynamic Lock determines the view mode based on a **Priority System**:

1.  **Global Force Reading** (🔒): Overrides EVERYTHING. Useful for presentations.
2.  **Frontmatter Rules**: Explicit file-level control (`status: done` -> Reading).
3.  **Folder Rules**: Section-level control (`Archives/` -> Reading).
4.  **Time-based Lock**: (If enabled) Locks old files automatically.
5.  **Global Force Editing** (🔓): Forces Editing mode unless explicitly locked by rules above.
6.  **Default**: Fallback behavior (Keep current / Reading / Editing).

---

## 🛠️ Usage

### 1. Global Modes (Click Status Bar)
| Icon | Mode | Description |
| :--- | :--- | :--- | 
| ✨ | **Auto** | The **Smart Mode**. Follows all your defined rules. |
| 🔒 | **Reading** | **Presentation Mode**. Forces ALL files to Reading view. |
| 🔓 | **Editing** | **Work Mode**. Forces Editing view (except for explicitly locked folders/files). |

> **Tip**: You can assign a hotkey to `Dynamic Lock: Cycle Global Mode` for quick switching!

### 2. Time-based Locking ⏳
Forget about manually locking files. 
- Go to **Settings > Time-based Lock**.
- Enable it and set a period (e.g., **30 Days**).
- Choose **Creation Date** (good for Daily Notes/Diaries) or **Modified Date** (good for Wikis).

### 3. Visual Feedback
Locked files are instantly recognizable by the **Lock Icon (🔒)** next to the file title in the tab header.

---

## ⚙️ Installation

1.  Open **Settings > Community Plugins** in Obsidian.
2.  Turn off **Safe Mode**.
3.  Click **Browse** and search for `Dynamic Lock`.
4.  Click **Install** and then **Enable**.

### Manual Installation
1.  Download `main.js`, `manifest.json`, `styles.css` from the [Requests](https://github.com/Ryeom/obsidian-dynamic-lock/releases).
2.  Copy them to `<vault>/.obsidian/plugins/obsidian-dynamic-lock/`.
3.  Reload Obsidian.

---

## ⌨️ Commands

| Command | Action |
| :--- | :--- |
| `Cycle Global Mode` | Switch: Auto → Reading → Editing → ... |
| `Set Global Mode to Auto` | Reset to smart rules. |
| `Set Global Lock (Reading)` | Force strict reading mode. |
| `Set Global Mode to Editing` | Force editing mode. |

---

made with ❤️ by **Ryeom**
