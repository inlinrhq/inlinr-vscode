import { describe, expect, it } from "vitest";
import {
	attributeChange,
	type ChangeEvent,
	type DocumentChange,
	EditAccumulator,
} from "./edit-attribution";

function insert(text: string): DocumentChange {
	return { insertedText: text, removedLineCount: 0, removedCharCount: 0 };
}

function remove(lines: number, chars: number): DocumentChange {
	return { insertedText: "", removedLineCount: lines, removedCharCount: chars };
}

function event(changes: DocumentChange[], extra: Partial<ChangeEvent> = {}) {
	return { changes, ...extra };
}

describe("attributeChange", () => {
	it("treats a single typed character as human", () => {
		const r = attributeChange(event([insert("a")]));
		expect(r.source).toBe("human");
		expect(r.linesAdded).toBe(0);
	});

	it("treats an auto-closed pair as human", () => {
		expect(attributeChange(event([insert("()")])).source).toBe("human");
	});

	it("treats pressing Enter as human", () => {
		const r = attributeChange(event([insert("\n\t")]));
		expect(r.source).toBe("human");
		expect(r.linesAdded).toBe(1);
	});

	it("treats a deletion as human and counts removed lines", () => {
		const r = attributeChange(event([remove(3, 120)]));
		expect(r.source).toBe("human");
		expect(r.linesRemoved).toBe(3);
		expect(r.linesAdded).toBe(0);
	});

	it("treats a multi-line atomic insert as AI", () => {
		const block = "function add(a, b) {\n\treturn a + b;\n}\n";
		const r = attributeChange(event([insert(block)]));
		expect(r.source).toBe("ai");
		expect(r.linesAdded).toBe(3);
	});

	it("treats a long single-line completion as AI", () => {
		const long =
			"const activeMembers = team.members.filter(Boolean).map((m) => m.displayName).join(', ');";
		expect(long.length).toBeGreaterThanOrEqual(80);
		expect(attributeChange(event([insert(long)])).source).toBe("ai");
	});

	it("treats a paste as human even when the text is large", () => {
		// The text may well have come from a chat window, but the user chose to
		// paste it. Counting a paste as AI authorship would double-count code
		// copied between our own files.
		const block = "line one\nline two\nline three\n";
		const r = attributeChange(
			event([insert(block)], { clipboard: block }),
		);
		expect(r.source).toBe("human");
	});

	it("still calls it AI when the clipboard holds something else", () => {
		const block = "line one\nline two\nline three\n";
		const r = attributeChange(
			event([insert(block)], { clipboard: "unrelated" }),
		);
		expect(r.source).toBe("ai");
	});

	it("treats multi-cursor edits as human", () => {
		// Three cursors typing the same character — large total, tiny per change.
		const r = attributeChange(event([insert("x"), insert("x"), insert("x")]));
		expect(r.source).toBe("human");
	});

	it("treats format-on-save style multi-change events as human", () => {
		// A formatter rewrites many ranges at once; an assistant applies one.
		const changes = Array.from({ length: 12 }, () => insert("\n    "));
		expect(attributeChange(event(changes)).source).toBe("human");
	});

	it("ignores undo and redo", () => {
		const r = attributeChange(
			event([insert("a\nb\nc\n")], { isUndoRedo: true }),
		);
		expect(r).toEqual({ source: "ignored", linesAdded: 0, linesRemoved: 0 });
	});

	it("ignores an empty change list", () => {
		expect(attributeChange(event([])).source).toBe("ignored");
	});
});

describe("EditAccumulator", () => {
	it("splits totals between human and AI per file", () => {
		const acc = new EditAccumulator();
		acc.record("a.ts", event([insert("x")]));
		acc.record("a.ts", event([insert("one\ntwo\nthree\n")]));
		acc.record("b.ts", event([insert("y")]));

		const a = acc.peek("a.ts");
		expect(a.linesAdded).toBe(3);
		expect(a.aiLinesAdded).toBe(3);
		expect(a.sawAiEdit).toBe(true);

		const b = acc.peek("b.ts");
		expect(b.sawAiEdit).toBe(false);
		expect(b.aiLinesAdded).toBe(0);
	});

	it("counts deletions on both sides when the AI replaced a block", () => {
		const acc = new EditAccumulator();
		acc.record("a.ts", {
			changes: [
				{
					insertedText: "new one\nnew two\nnew three\n",
					removedLineCount: 5,
					removedCharCount: 200,
				},
			],
		});
		const totals = acc.peek("a.ts");
		expect(totals.linesAdded).toBe(3);
		expect(totals.linesDeleted).toBe(5);
		expect(totals.aiLinesAdded).toBe(3);
		expect(totals.aiLinesDeleted).toBe(5);
	});

	it("drain resets the window so each beat reports its own work", () => {
		const acc = new EditAccumulator();
		acc.record("a.ts", event([insert("one\ntwo\n")]));
		expect(acc.drain("a.ts").aiLinesAdded).toBe(2);
		expect(acc.drain("a.ts").aiLinesAdded).toBe(0);
		expect(acc.peek("a.ts").sawAiEdit).toBe(false);
	});

	it("drain of an untouched file is empty, not undefined", () => {
		expect(new EditAccumulator().drain("never.ts")).toEqual({
			linesAdded: 0,
			linesDeleted: 0,
			aiLinesAdded: 0,
			aiLinesDeleted: 0,
			sawAiEdit: false,
		});
	});

	it("ignored events leave the totals untouched", () => {
		const acc = new EditAccumulator();
		acc.record("a.ts", event([insert("a\nb\nc\n")], { isUndoRedo: true }));
		expect(acc.peek("a.ts")).toEqual({
			linesAdded: 0,
			linesDeleted: 0,
			aiLinesAdded: 0,
			aiLinesDeleted: 0,
			sawAiEdit: false,
		});
	});
});
