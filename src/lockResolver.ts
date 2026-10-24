import { App, TFile } from 'obsidian';
import { DynamicLockSettings, FolderRule, Rule, ViewMode } from './types';

export type RuleLockReason =
	| { type: 'property'; attribute: string; value: string }
	| { type: 'folder'; path: string };

/**
 * Determines the required view mode for a file based on the priority system:
 * 1. Global Force Reading
 * 2. Frontmatter Rules
 * 3. Folder Rules (longest prefix match)
 * 4. Time-based Lock
 * 5. Global Force Editing
 * 6. No match → returns null
 */
export function resolveViewRule(
	app: App,
	file: TFile,
	settings: DynamicLockSettings
	): { mode: ViewMode; locked: boolean; lockReason?: RuleLockReason } | null {
	const { globalMode, rules, folderRules } = settings;

	// Global Reading chooses the mode first, but a matching per-file rule can
	// still enforce its read-only setting.
	if (globalMode === 'force-reading') {
		console.debug('[DynamicLock] Rule matched: Global force-reading');
		const lockReason = resolveMatchingRuleLockReason(app, file, rules, folderRules);
		return { mode: 'preview', locked: lockReason !== null, lockReason: lockReason ?? undefined };
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
				const lockReason = rule.mode === 'preview' && (rule.locked ?? rule.keepReading) === true
					? { type: 'property' as const, attribute: rule.attribute, value: rule.value }
					: undefined;
				return { mode: rule.mode, locked: lockReason !== undefined, lockReason };
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
			const lockReason = matched.mode === 'preview' && (matched.locked ?? matched.keepReading) === true
				? { type: 'folder' as const, path: matched.path }
				: undefined;
			return { mode: matched.mode, locked: lockReason !== undefined, lockReason };
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
				return { mode: 'preview', locked: false };
			}
		}
	}

	// 5. Force Editing
	if (globalMode === 'force-editing') {
		console.debug('[DynamicLock] Rule matched: Global force-editing');
		return { mode: 'source', locked: false };
	}

	// 6. No match
	console.debug('[DynamicLock] No rule matched, returning null', {
		file: file.path
	});
	return null;
}

function resolveMatchingRuleLockReason(
	app: App,
	file: TFile,
	rules: Rule[],
	folderRules: FolderRule[]
): RuleLockReason | null {
	const cache = app.metadataCache.getFileCache(file);
	if (cache?.frontmatter) {
		for (const rule of rules) {
			if (String(cache.frontmatter[rule.attribute]) === rule.value) {
				return rule.mode === 'preview' && (rule.locked ?? rule.keepReading) === true
					? { type: 'property', attribute: rule.attribute, value: rule.value }
					: null;
			}
		}
	}

	const matchingFolders = folderRules.filter(rule => {
		const normalizedPath = rule.path.endsWith('/') ? rule.path : rule.path + '/';
		return file.path.startsWith(normalizedPath);
	});
	if (matchingFolders.length === 0) return null;

	matchingFolders.sort((a, b) => b.path.length - a.path.length);
	const matchingFolder = matchingFolders[0]!;
	return matchingFolder.mode === 'preview' && (matchingFolder.locked ?? matchingFolder.keepReading) === true
		? { type: 'folder', path: matchingFolder.path }
		: null;
}
