import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import createPanZoom from "panzoom";
import { ZoomModal } from "./ZoomModal";

const disposeMock = vi.fn();
const moveToMock = vi.fn();
const smoothZoomMock = vi.fn();
const zoomAbsMock = vi.fn();

vi.mock("panzoom", () => ({
  default: vi.fn(() => ({
    dispose: disposeMock,
    moveTo: moveToMock,
    smoothZoom: smoothZoomMock,
    zoomAbs: zoomAbsMock,
  })),
}));

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

describe("ZoomModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("uses a subtle backdrop", () => {
    render(<ZoomModal content={{ type: "image", src: "/diagram.svg" }} onClose={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: "Zoom viewer" });
    expect(dialog).toHaveClass("bg-black/20");
  });

  it("renders a theme-aware panel that fills the viewport", () => {
    render(<ZoomModal content={{ type: "svg", svg: "<svg><path /></svg>" }} onClose={() => {}} />);

    const panel = screen.getByRole("dialog", { name: "Zoom viewer" }).querySelector(".shadow-2xl");
    expect(panel).toHaveClass("bg-gh-bg");
    expect(panel).toHaveClass("border-gh-border");
    expect(panel).toHaveClass("w-[calc(100vw-64px)]");
    expect(panel).toHaveClass("h-[calc(100vh-64px)]");
  });

  it("centers a large Mermaid SVG in the viewport", async () => {
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      top: 0,
      bottom: 800,
      left: 0,
      right: 1200,
      width: 1200,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    })) as typeof Element.prototype.getBoundingClientRect;

    render(
      <ZoomModal
        content={{
          type: "svg",
          svg: '<svg viewBox="0 0 2000 1000"><path /></svg>',
        }}
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      // scale = min((1200-96)/2000, (800-96)/1000) = min(0.552, 0.704) = 0.552
      expect(zoomAbsMock).toHaveBeenCalledWith(0, 0, 0.552);
      // centered: x = (1200 - 2000*0.552)/2 = 48, y = (800 - 1000*0.552)/2 = 124
      expect(moveToMock).toHaveBeenCalledWith(48, 124);
    });
  });

  it("initializes panzoom with Option-wheel zoom", () => {
    render(<ZoomModal content={{ type: "image", src: "/diagram.svg" }} onClose={() => {}} />);

    expect(createPanZoom).toHaveBeenCalledTimes(1);
    const options = vi.mocked(createPanZoom).mock.calls[0][1];
    expect(options?.beforeWheel?.({ altKey: false } as WheelEvent)).toBe(true);
    expect(options?.beforeWheel?.({ altKey: true } as WheelEvent)).toBe(false);
  });

  it("exposes zoom, reset, and open controls", () => {
    render(<ZoomModal content={{ type: "image", src: "/diagram.svg" }} onClose={() => {}} />);

    fireEvent.click(screen.getByTitle("Zoom in"));
    fireEvent.click(screen.getByTitle("Zoom out"));
    fireEvent.click(screen.getByTitle("Reset zoom"));

    expect(smoothZoomMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTitle("Open image")).toHaveAttribute("href", "/diagram.svg");
  });

  it("does not expose manual pan buttons", () => {
    render(<ZoomModal content={{ type: "image", src: "/diagram.svg" }} onClose={() => {}} />);

    expect(screen.queryByTitle("Pan up")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Pan left")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Pan down")).not.toBeInTheDocument();
  });
});
