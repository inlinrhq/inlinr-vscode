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

async function loadDetect() {
	vi.resetModules();
	return (await import("./ai-detect")).detectAITool;
}

afterEach(() => {
	vscodeMock.env.appName = "Visual Studio Code";
	vscodeMock.extensions.getExtension.mockReset();
});

describe("detectAITool", () => {
	it("returns cursor when the host app is Cursor, regardless of extensions", async () => {
		vscodeMock.env.appName = "Cursor";
		const detectAITool = await loadDetect();
		expect(detectAITool()).toBe("cursor");
	});

	it("returns windsurf when the host app is Windsurf", async () => {
		vscodeMock.env.appName = "Windsurf";
		const detectAITool = await loadDetect();
		expect(detectAITool()).toBe("windsurf");
	});

	it("returns copilot when github.copilot is active", async () => {
		vscodeMock.extensions.getExtension.mockImplementation((id) =>
			id === "github.copilot" ? { isActive: true } : undefined,
		);
		const detectAITool = await loadDetect();
		expect(detectAITool()).toBe("copilot");
	});

	it("returns claude-code when anthropic.claude-code is active", async () => {
		vscodeMock.extensions.getExtension.mockImplementation((id) =>
			id === "anthropic.claude-code" ? { isActive: true } : undefined,
		);
		const detectAITool = await loadDetect();
		expect(detectAITool()).toBe("claude-code");
	});

	it("ignores inactive extensions", async () => {
		vscodeMock.extensions.getExtension.mockImplementation((id) =>
			id === "github.copilot" ? { isActive: false } : undefined,
		);
		const detectAITool = await loadDetect();
		expect(detectAITool()).toBeNull();
	});

	it("returns null when no AI signal is present", async () => {
		const detectAITool = await loadDetect();
		expect(detectAITool()).toBeNull();
	});
});
