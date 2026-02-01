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
	timeLockMetric: 'ctime',
};
