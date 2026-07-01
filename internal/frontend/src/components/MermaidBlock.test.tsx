import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MermaidBlock, PlantUmlBlock } from "./MarkdownViewer";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

vi.mock("plantuml-encoder", () => ({
  default: {
    encode: vi.fn(() => "encoded-plantuml"),
  },
}));

import mermaid from "mermaid";
import plantumlEncoder from "plantuml-encoder";

const writeTextMock = vi.fn().mockResolvedValue(undefined);
const writeMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  writeTextMock.mockClear();
  writeMock.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: writeTextMock, write: writeMock },
    writable: true,
    configurable: true,
  });
  vi.stubGlobal("fetch", vi.fn());
});

describe("MermaidBlock", () => {
  it("shows copy button when mermaid renders successfully", async () => {
    vi.mocked(mermaid.render).mockResolvedValue({
      svg: "<svg>diagram</svg>",
      bindFunctions: undefined,
      diagramType: "flowchart",
    });

    render(<MermaidBlock code="graph TD; A-->B" />);

    await waitFor(() => {
      expect(screen.getByTitle("Copy code")).toBeInTheDocument();
    });
  });

  it("shows copy button in fallback mode when rendering fails", async () => {
    vi.mocked(mermaid.render).mockRejectedValue(new Error("parse error"));

    render(<MermaidBlock code="invalid mermaid" />);

    await waitFor(() => {
      expect(screen.getByTitle("Copy code")).toBeInTheDocument();
    });
    expect(screen.getByText("invalid mermaid")).toBeInTheDocument();
  });

  it("copies original mermaid code to clipboard on click", async () => {
    vi.mocked(mermaid.render).mockResolvedValue({
      svg: "<svg>diagram</svg>",
      bindFunctions: undefined,
      diagramType: "flowchart",
    });

    render(<MermaidBlock code="graph TD; A-->B" />);

    await waitFor(() => {
      expect(screen.getByTitle("Copy code")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Copy code"));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("graph TD; A-->B");
    });
  });

  it("shows image copy button when mermaid renders successfully", async () => {
    vi.mocked(mermaid.render).mockResolvedValue({
      svg: "<svg>diagram</svg>",
      bindFunctions: undefined,
      diagramType: "flowchart",
    });

    render(<MermaidBlock code="graph TD; A-->B" />);

    await waitFor(() => {
      expect(screen.getByTitle("Copy image")).toBeInTheDocument();
    });
  });

  it("does not show image copy button when rendering fails", async () => {
    vi.mocked(mermaid.render).mockRejectedValue(new Error("parse error"));

    render(<MermaidBlock code="invalid mermaid" />);

    await waitFor(() => {
      expect(screen.getByTitle("Copy code")).toBeInTheDocument();
    });
    expect(screen.queryByTitle("Copy image")).not.toBeInTheDocument();
  });

  it("calls navigator.clipboard.write on image copy button click", async () => {
    vi.mocked(mermaid.render).mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">diagram</svg>',
      bindFunctions: undefined,
      diagramType: "flowchart",
    });

    // Mock URL.createObjectURL / revokeObjectURL (not available in jsdom)
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();

    // Mock ClipboardItem (not available in jsdom)
    const originalClipboardItem = globalThis.ClipboardItem;
    vi.stubGlobal(
      "ClipboardItem",
      class MockClipboardItem {
        types: string[];
        items: Record<string, Blob>;
        constructor(items: Record<string, Blob>) {
          this.items = items;
          this.types = Object.keys(items);
        }
        getType(type: string) {
          return Promise.resolve(this.items[type]);
        }
      },
    );

    // Mock Image to trigger onload
    const originalImage = globalThis.Image;
    vi.stubGlobal(
      "Image",
      class MockImage {
        naturalWidth = 100;
        naturalHeight = 100;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src = "";
        get src() {
          return this._src;
        }
        set src(val: string) {
          this._src = val;
          setTimeout(() => this.onload?.(), 0);
        }
      },
    );

    // Mock canvas via createElement
    const mockBlob = new Blob(["png"], { type: "image/png" });
    const mockCtx = { drawImage: vi.fn(), scale: vi.fn() };
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tag: string, options?: ElementCreationOptions) => {
        if (tag === "canvas") {
          return {
            width: 0,
            height: 0,
            getContext: () => mockCtx,
            toBlob: (cb: (b: Blob | null) => void) => cb(mockBlob),
          } as unknown as HTMLCanvasElement;
        }
        return origCreateElement(tag, options);
      },
    );

    render(<MermaidBlock code="graph TD; A-->B" />);

    await waitFor(() => {
      expect(screen.getByTitle("Copy image")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Copy image"));

    await waitFor(() => {
      expect(writeMock).toHaveBeenCalledTimes(1);
    });

    globalThis.Image = originalImage;
    globalThis.ClipboardItem = originalClipboardItem;
    vi.mocked(document.createElement).mockRestore();
  });
});

describe("PlantUmlBlock", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders a PlantUML server SVG image", () => {
    render(<PlantUmlBlock code={"@startuml\nAlice -> Bob\n@enduml"} />);

    expect(screen.getByAltText("PlantUML diagram")).toHaveAttribute(
      "src",
      "https://www.plantuml.com/plantuml/svg/encoded-plantuml",
    );
    expect(screen.getByTitle("Copy code")).toBeInTheDocument();
  });

  it("opens zoom with fetched PlantUML SVG", async () => {
    const onZoom = vi.fn();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<svg>plantuml</svg>"),
    } as Response);
    render(<PlantUmlBlock code={"@startuml\nAlice -> Bob\n@enduml"} onZoom={onZoom} />);

    fireEvent.click(screen.getByTitle("Zoom"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("https://www.plantuml.com/plantuml/svg/encoded-plantuml");
      expect(onZoom).toHaveBeenCalledWith({ type: "svg", svg: "<svg>plantuml</svg>" });
    });
  });

  it("falls back to the PlantUML image URL when SVG fetch fails", async () => {
    const onZoom = vi.fn();
    vi.mocked(fetch).mockRejectedValue(new Error("cors"));
    render(<PlantUmlBlock code={"@startuml\nAlice -> Bob\n@enduml"} onZoom={onZoom} />);

    fireEvent.click(screen.getByTitle("Zoom"));

    await waitFor(() => {
      expect(onZoom).toHaveBeenCalledWith({
        type: "image",
        src: "https://www.plantuml.com/plantuml/svg/encoded-plantuml",
        alt: "PlantUML diagram",
      });
    });
  });

  it("uses the dark PlantUML server format in dark mode", () => {
    document.documentElement.setAttribute("data-theme", "dark");

    render(<PlantUmlBlock code={"@startuml\nAlice -> Bob\n@enduml"} />);

    expect(screen.getByAltText("PlantUML diagram")).toHaveAttribute(
      "src",
      "https://www.plantuml.com/plantuml/dsvg/encoded-plantuml",
    );
    expect(plantumlEncoder.encode).toHaveBeenCalledWith("@startuml\nAlice -> Bob\n@enduml");
  });

  it("does not override an explicit PlantUML theme", () => {
    document.documentElement.setAttribute("data-theme", "dark");

    render(<PlantUmlBlock code={"!theme plain\n@startuml\nAlice -> Bob\n@enduml"} />);

    expect(plantumlEncoder.encode).toHaveBeenCalledWith(
      "!theme plain\n@startuml\nAlice -> Bob\n@enduml",
    );
  });
});
