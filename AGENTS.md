# Repository Notes

This repository is a fork of `github.com/k1LoW/mo`. Keep changes small and easy to rebase onto upstream.

## Fork Changes

- Added PlantUML diagram support in fenced Markdown code blocks via `plantuml-encoder` and the public PlantUML SVG server.
- PlantUML diagrams automatically use the `cyborg` theme when the app is in dark mode, unless the diagram already declares a `!theme`.
- Added a shared diagram zoom modal based on `panzoom` for Mermaid and PlantUML diagrams.
- The zoom modal uses a viewport-filling, theme-aware panel with centered auto-fit content, drag panning, and Option-wheel zooming.
- PlantUML zoom fetches SVG text for vector preview and falls back to opening the SVG image URL if the fetch fails.
- Mermaid zoom strips inline SVG size constraints before initializing panzoom so large diagrams fit and center correctly.

## Maintenance Guidance

- Preserve upstream structure and naming where possible.
- Prefer minimal frontend-only changes for diagram rendering unless server support is explicitly needed.
- Keep diagram behavior covered by component tests under `internal/frontend/src/components/`.
