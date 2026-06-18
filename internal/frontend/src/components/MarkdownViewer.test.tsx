import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownViewer } from "./MarkdownViewer";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

vi.mock("../hooks/useApi", () => ({
  fetchFileContent: vi.fn().mockResolvedValue({ content: "# Hello", baseDir: "/repo" }),
  openRelativeFile: vi.fn(),
}));

// jsdom has no layout, so stub getBoundingClientRect to position the scroll
// container at the top and the heading wherever a test wants it.
let scrollContainer: HTMLElement;
let headingRect: { top: number; bottom: number };
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 0,
    width: 0,
    height: bottom - top,
    x: 0,
    y: top,
  } as DOMRect;
}

function renderViewer(props: Partial<Parameters<typeof MarkdownViewer>[0]> = {}) {
  return render(
    <MarkdownViewer
      fileId="aaa11111"
      fileName="README.md"
      activeGroup="default"
      revision={0}
      onFileOpened={() => {}}
      onHeadingsChange={() => {}}
      isTocOpen={false}
      onTocToggle={() => {}}
      onRemoveFile={() => {}}
      isWide={false}
      fontSize="medium"
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  scrollContainer = document.createElement("div");
  headingRect = { top: 100, bottom: 150 };
  Element.prototype.getBoundingClientRect = function () {
    if (this === scrollContainer) return rect(0, 800);
    if (/^H[1-6]$/.test(this.tagName)) return rect(headingRect.top, headingRect.bottom);
    return rect(0, 0);
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

describe("MarkdownViewer file label", () => {
  it("renders 'Title - filename' outside the markdown body", async () => {
    renderViewer({
      title: "Project Readme",
      filePath: "/home/me/code/mo/docs/README.md",
    });

    const label = await screen.findByText("Project Readme - README.md");
    // Hover shows the absolute file path.
    expect(label).toHaveAttribute("title", "/home/me/code/mo/docs/README.md");
    // The label must not be part of the rendered markdown content.
    expect(label.closest(".markdown-body")).toBeNull();
  });

  it("falls back to the file name when the file has no title", async () => {
    renderViewer({ filePath: "/home/me/code/mo/docs/README.md" });

    const label = await screen.findByText("README.md");
    expect(label).toHaveAttribute("title", "/home/me/code/mo/docs/README.md");
  });

  it("uses the file name as the tooltip for uploaded files", async () => {
    renderViewer({ title: "Pasted", uploaded: true });

    const label = await screen.findByText("Pasted - README.md");
    expect(label).toHaveAttribute("title", "README.md");
  });

  it("keeps the sticky label hidden while the title is still on screen", async () => {
    headingRect = { top: 100, bottom: 150 }; // below the container top: visible
    renderViewer({ title: "Project Readme", scrollContainer });

    const label = await screen.findByText("Project Readme - README.md");
    expect(label).toHaveClass("opacity-0");
    expect(label).toHaveClass("pointer-events-none");
  });

  it("reveals the sticky label once the title has scrolled above the top", async () => {
    headingRect = { top: -60, bottom: -10 }; // scrolled above the container top
    renderViewer({ title: "Project Readme", scrollContainer });

    const label = await screen.findByText("Project Readme - README.md");
    expect(label).not.toHaveClass("opacity-0");
    expect(label).not.toHaveClass("pointer-events-none");
  });
});
