import { afterEach, describe, expect, it, vi } from "vitest";

// Mock vscode before importing the module under test. Each test resets the
// mock via vi.doMock so we can vary app name / installed extensions per case.
const vscodeMock = vi.hoisted(() => ({
	env: { appName: "Visual Studio Code" },
	extensions: {
		getExtension: vi.fn<(id: string) => { isActive: boolean } | undefined>(),
	},
}));

vi.mock("vscode", () => vscodeMock);

async function load() {
	vi.resetModules();
	return await import("./ai-detect");
}

const SAW_AI = { sawAiEdit: true };
const NO_AI = { sawAiEdit: false };

afterEach(() => {
	vscodeMock.env.appName = "Visual Studio Code";
	vscodeMock.extensions.getExtension.mockReset();
});

describe("installedAiTool", () => {
	it("returns cursor when the host app is Cursor, regardless of extensions", async () => {
		vscodeMock.env.appName = "Cursor";
		const { installedAiTool } = await load();
		expect(installedAiTool()).toBe("cursor");
	});

	it("returns windsurf when the host app is Windsurf", async () => {
		vscodeMock.env.appName = "Windsurf";
		const { installedAiTool } = await load();
		expect(installedAiTool()).toBe("windsurf");
	});

	it("returns copilot when github.copilot is active", async () => {
		vscodeMock.extensions.getExtension.mockImplementation((id) =>
			id === "github.copilot" ? { isActive: true } : undefined,
		);
		const { installedAiTool } = await load();
		expect(installedAiTool()).toBe("copilot");
	});

	it("returns claude-code when anthropic.claude-code is active", async () => {
		vscodeMock.extensions.getExtension.mockImplementation((id) =>
			id === "anthropic.claude-code" ? { isActive: true } : undefined,
		);
		const { installedAiTool } = await load();
		expect(installedAiTool()).toBe("claude-code");
	});

	it("ignores inactive extensions", async () => {
		vscodeMock.extensions.getExtension.mockImplementation((id) =>
			id === "github.copilot" ? { isActive: false } : undefined,
		);
		const { installedAiTool } = await load();
		expect(installedAiTool()).toBeNull();
	});
});

describe("detectAITool", () => {
	it("reports nothing when Copilot is installed but unused", async () => {
		// The regression this whole split exists for: Copilot activates at
		// startup, so presence alone used to mark every single beat as AI.
		vscodeMock.extensions.getExtension.mockImplementation((id) =>
			id === "github.copilot" ? { isActive: true } : undefined,
		);
		const { detectAITool } = await load();
		expect(detectAITool(NO_AI)).toBeNull();
	});

	it("reports nothing for hand-typed code inside Cursor", async () => {
		vscodeMock.env.appName = "Cursor";
		const { detectAITool } = await load();
		expect(detectAITool(NO_AI)).toBeNull();
	});

	it("names the tool once a generated edit was seen", async () => {
		vscodeMock.extensions.getExtension.mockImplementation((id) =>
			id === "github.copilot" ? { isActive: true } : undefined,
		);
		const { detectAITool } = await load();
		expect(detectAITool(SAW_AI)).toBe("copilot");
	});

	it("names cursor for a generated edit inside Cursor", async () => {
		vscodeMock.env.appName = "Cursor";
		const { detectAITool } = await load();
		expect(detectAITool(SAW_AI)).toBe("cursor");
	});

	it("stays null when an AI edit happened but nothing nameable is installed", async () => {
		// We still send the AI line counts on the beat — we just refuse to
		// invent a tool name.
		const { detectAITool } = await load();
		expect(detectAITool(SAW_AI)).toBeNull();
	});
});
