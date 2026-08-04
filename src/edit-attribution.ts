// Decides, for each document change, whether a human typed it or a tool
// generated it — and counts the lines either way.
//
// Why this exists: `detectAITool()` used to report an AI tool as soon as its
// extension was *installed and active*. Copilot activates at startup whether or
// not you use it, so every beat came back `aiTool: copilot`, and no other
// assistant was ever detected. Presence is not usage.
//
// The signal we actually have is the shape of the edit. A person types one
// character at a time; an assistant drops a whole block in a single atomic
// change. That distinction is imperfect but it is *evidence*, and it is the
// same idea WakaTime's `--ai-line-changes` is built on.
//
// Deliberately conservative: when in doubt, call it human. Over-reporting AI
// would make the headline number ("how much of my code did AI write?") a lie in
// the flattering direction, which is the worst way to be wrong.
//
// No `vscode` import here on purpose — this is the part worth unit-testing.

/** An insert of at least this many lines, in one change, reads as generated. */
export const AI_MIN_INSERT_LINES = 2;

/** …or this many characters on a single line (a long generated statement). */
export const AI_MIN_INSERT_CHARS = 80;

/** One entry of `TextDocumentChangeEvent.contentChanges`. */
export type DocumentChange = {
	/** Text this change inserted ("" for a pure deletion). */
	insertedText: string;
	/** Lines spanned by the replaced range, minus one (0 for a single line). */
	removedLineCount: number;
	/** Characters the replaced range covered. */
	removedCharCount: number;
};

export type ChangeEvent = {
	changes: DocumentChange[];
	/** True for undo/redo — a replay of authorship, not new authorship. */
	isUndoRedo?: boolean;
	/** Clipboard contents, when readable. Used to tell a paste from a generation. */
	clipboard?: string | null;
};

export type EditSource = "human" | "ai" | "ignored";

export type EventAttribution = {
	source: EditSource;
	linesAdded: number;
	linesRemoved: number;
};

function countLines(text: string): number {
	if (text === "") return 0;
	return text.split("\n").length - 1;
}

/**
 * Classify one change event and count its lines.
 *
 * Rules, in order:
 *   - undo/redo             → ignored (already attributed the first time)
 *   - nothing inserted      → human (deleting is an act of authorship, and no
 *                             assistant deletes without inserting)
 *   - several changes at once → human (multi-cursor edits, find & replace and
 *                             format-on-save all look like this; assistants
 *                             apply one contiguous edit)
 *   - insert matches clipboard → human (a paste is the user's decision, even
 *                             when the text originally came from a chat window)
 *   - one big atomic insert → ai
 *   - otherwise             → human
 */
export function attributeChange(event: ChangeEvent): EventAttribution {
	const { changes, isUndoRedo, clipboard } = event;

	let linesAdded = 0;
	let linesRemoved = 0;
	for (const c of changes) {
		linesAdded += countLines(c.insertedText);
		linesRemoved += c.removedLineCount;
	}

	if (isUndoRedo) return { source: "ignored", linesAdded: 0, linesRemoved: 0 };
	if (changes.length === 0) {
		return { source: "ignored", linesAdded: 0, linesRemoved: 0 };
	}

	const human: EventAttribution = { source: "human", linesAdded, linesRemoved };

	if (changes.length > 1) return human;

	const change = changes[0];
	if (change.insertedText === "") return human;

	if (clipboard && clipboard.length > 0 && change.insertedText === clipboard) {
		return human;
	}

	const insertedLines = countLines(change.insertedText);
	const looksGenerated =
		insertedLines >= AI_MIN_INSERT_LINES ||
		change.insertedText.length >= AI_MIN_INSERT_CHARS;

	return looksGenerated
		? { source: "ai", linesAdded, linesRemoved }
		: human;
}

export type EditTotals = {
	linesAdded: number;
	linesDeleted: number;
	aiLinesAdded: number;
	aiLinesDeleted: number;
	/** True when at least one change in the window looked generated. */
	sawAiEdit: boolean;
};

const EMPTY: EditTotals = {
	linesAdded: 0,
	linesDeleted: 0,
	aiLinesAdded: 0,
	aiLinesDeleted: 0,
	sawAiEdit: false,
};

/**
 * Accumulates attributed edits per file between heartbeats.
 *
 * `drain(entity)` returns the totals since the last drain and resets them, so
 * each beat reports the work done in its own window rather than a running
 * lifetime total.
 */
export class EditAccumulator {
	private byEntity = new Map<string, EditTotals>();

	record(entity: string, event: ChangeEvent): EventAttribution {
		const attribution = attributeChange(event);
		if (attribution.source === "ignored") return attribution;

		const totals = this.byEntity.get(entity) ?? { ...EMPTY };
		totals.linesAdded += attribution.linesAdded;
		totals.linesDeleted += attribution.linesRemoved;
		if (attribution.source === "ai") {
			totals.aiLinesAdded += attribution.linesAdded;
			totals.aiLinesDeleted += attribution.linesRemoved;
			totals.sawAiEdit = true;
		}
		this.byEntity.set(entity, totals);
		return attribution;
	}

	peek(entity: string): EditTotals {
		return this.byEntity.get(entity) ?? { ...EMPTY };
	}

	drain(entity: string): EditTotals {
		const totals = this.byEntity.get(entity);
		if (!totals) return { ...EMPTY };
		this.byEntity.delete(entity);
		return totals;
	}

	clear() {
		this.byEntity.clear();
	}
}
