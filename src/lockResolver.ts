import { App, TFile } from 'obsidian';
import { DynamicLockSettings, ViewMode } from './types';

/**
 * Determines the required view mode for a file based on the priority system:
 * 1. Global Force Reading
 * 2. Frontmatter Rules
 * 3. Folder Rules (longest prefix match)
 * 4. Time-based Lock
 * 5. Global Force Editing
 * 6. No match → returns null
 */
export function getRequiredViewMode(
	app: App,
	file: TFile,
	settings: DynamicLockSettings
): ViewMode | null {
	const { globalMode, rules, folderRules } = settings;

	// 1. Force Reading (Strong Lock)
	if (globalMode === 'force-reading') {
		console.debug('[DynamicLock] Rule matched: Global force-reading');
		return 'preview';
	}

	// 2. Frontmatter Rules
	const cache = app.metadataCache.getFileCache(file);
	if (cache?.frontmatter) {
		for (const rule of rules) {
			if (String(cache.frontmatter[rule.attribute]) === rule.value) {
				console.debug('[DynamicLock] Rule matched: Frontmatter', {
					file: file.path,
					rule: `${rule.attribute}=${rule.value}`,
					mode: rule.mode
				});
				return rule.mode;
			}
		}
	}

	// 3. Folder Rules (longest prefix match)
	if (folderRules?.length) {
		const matchingRules = folderRules.filter(rule => {
			const normalizedPath = rule.path.endsWith('/') ? rule.path : rule.path + '/';
			return file.path.startsWith(normalizedPath);
		});

		if (matchingRules.length > 0) {
			matchingRules.sort((a, b) => b.path.length - a.path.length);
			const matched = matchingRules[0]!;
			console.debug('[DynamicLock] Rule matched: Folder (longest prefix)', {
				file: file.path,
				folderRule: matched.path,
				mode: matched.mode
			});
			return matched.mode;
		}
	}

	// 4. Time-based Lock
	if (settings.timeLockEnabled) {
		const stat = (file as unknown as { stat: { ctime: number; mtime: number } }).stat;
		if (stat) {
			const now = Date.now();
			const targetTime = settings.timeLockMetric === 'mtime' ? stat.mtime : stat.ctime;
			const ageDays = (now - targetTime) / (1000 * 60 * 60 * 24);

			if (ageDays > settings.timeLockDays) {
				console.debug('[DynamicLock] Rule matched: Time-based lock', {
					file: file.path,
					ageDays: Math.floor(ageDays),
					threshold: settings.timeLockDays,
					metric: settings.timeLockMetric
				});
				return 'preview';
			}
		}
	}

	// 5. Force Editing
	if (globalMode === 'force-editing') {
		console.debug('[DynamicLock] Rule matched: Global force-editing');
		return 'source';
	}

	// 6. No match
	console.debug('[DynamicLock] No rule matched, returning null', {
		file: file.path
	});
	return null;
}
