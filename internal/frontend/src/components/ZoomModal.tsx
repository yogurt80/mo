import { useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import createPanZoom from "panzoom";
import type { PanZoom } from "panzoom";

export type ZoomContent =
  | { type: "image"; src: string; alt?: string }
  | { type: "svg"; svg: string };

interface ZoomModalProps {
  content: ZoomContent;
  onClose: () => void;
}

export function ZoomModal({ content, onClose }: ZoomModalProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<PanZoom | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const fitToCenter = useCallback(() => {
    const el = contentRef.current;
    const vp = viewportRef.current;
    const pz = panzoomRef.current;
    if (!el || !vp || !pz) return;

    const size = measureContent(el);
    const vpRect = vp.getBoundingClientRect();
    const pad = 48;
    const aw = Math.max(1, vpRect.width - pad * 2);
    const ah = Math.max(1, vpRect.height - pad * 2);

    const scale = Math.min(aw / Math.max(size.width, 1), ah / Math.max(size.height, 1));

    pz.zoomAbs(0, 0, scale);
    pz.moveTo((vpRect.width - size.width * scale) / 2, (vpRect.height - size.height * scale) / 2);
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // Mermaid SVGs carry inline max-width and width="100%" that constrain
    // the rendered size. Strip those so the SVG renders at its viewBox
    // dimensions and panzoom can scale it properly.
    const svg = el.querySelector("svg");
    if (svg) {
      svg.style.maxWidth = "none";
      const viewBoxSize = parseViewBoxSize(svg.getAttribute("viewBox"));
      if (viewBoxSize) {
        svg.setAttribute("width", String(viewBoxSize.width));
        svg.setAttribute("height", String(viewBoxSize.height));
      }
    }

    const instance = createPanZoom(el, {
      bounds: true,
      boundsPadding: 0.1,
      maxZoom: 12,
      minZoom: 0.1,
      smoothScroll: false,
      zoomDoubleClickSpeed: 1,
      beforeWheel: (e) => !e.altKey,
    });
    panzoomRef.current = instance;

    const raf = requestAnimationFrame(fitToCenter);

    return () => {
      cancelAnimationFrame(raf);
      instance.dispose();
      panzoomRef.current = null;
    };
  }, [content, fitToCenter]);

  const zoomBy = (multiplier: number) => {
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    panzoomRef.current?.smoothZoom(vp.left + vp.width / 2, vp.top + vp.height / 2, multiplier);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-gh-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Zoom viewer"
    >
      <div className="relative h-screen w-screen bg-gh-bg">
        <button
          type="button"
          className="absolute right-3 top-3 z-20 flex items-center justify-center rounded-md p-1.5 cursor-pointer text-gh-text-secondary hover:bg-gh-bg-hover hover:text-gh-text transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          <svg
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="absolute right-3 bottom-3 z-20 flex gap-1">
          <Btn label="Zoom in" onClick={() => zoomBy(1.25)}>
            ⊕
          </Btn>
          <Btn label="Reset zoom" onClick={fitToCenter}>
            ↻
          </Btn>
          <Btn label="Zoom out" onClick={() => zoomBy(0.8)}>
            ⊖
          </Btn>
        </div>

        {content.type === "image" && (
          <a
            className="absolute left-3 bottom-3 z-20 rounded-md border border-gh-border bg-gh-bg-secondary px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover hover:text-gh-text"
            href={content.src}
            target="_blank"
            rel="noopener noreferrer"
            title="Open image"
          >
            Open
          </a>
        )}

        <div
          ref={viewportRef}
          className="h-full w-full cursor-grab overflow-hidden active:cursor-grabbing"
        >
          <div
            ref={contentRef}
            className="inline-block [&_svg]:block [&_svg]:max-w-none [&_img]:block [&_img]:max-w-none"
          >
            {content.type === "image" ? (
              <img
                src={content.src}
                alt={content.alt ?? ""}
                draggable={false}
                onLoad={fitToCenter}
              />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: content.svg }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex size-8 items-center justify-center rounded-md border border-gh-border bg-gh-bg-secondary text-sm leading-none text-gh-text-secondary shadow-sm hover:bg-gh-bg-hover hover:text-gh-text"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function measureContent(el: HTMLElement) {
  const img = el.querySelector("img");
  if (img) {
    return {
      width: img.naturalWidth || img.offsetWidth || 280,
      height: img.naturalHeight || img.offsetHeight || 180,
    };
  }

  const svg = el.querySelector("svg");
  if (svg) {
    const viewBoxSize = parseViewBoxSize(svg.getAttribute("viewBox"));
    if (viewBoxSize) {
      return viewBoxSize;
    }
    const w = svg.clientWidth || el.scrollWidth;
    const h = svg.clientHeight || el.scrollHeight;
    if (w && h) return { width: w, height: h };
  }

  return { width: el.scrollWidth || 280, height: el.scrollHeight || 180 };
}

function parseViewBoxSize(viewBox: string | null) {
  if (!viewBox) return null;

  const parts = viewBox.split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;

  return { width: parts[2], height: parts[3] };
}
