# Visual thesis: the request trail as a paper-cut diorama

API Scenario Patch turns an invisible sequence of network exchanges into a small,
reviewable artifact. The site presents that idea as a **paper-cut diorama**: layered
request slips cross a deep ink workbench, pass behind a redaction shutter, and emerge
as a stitched Git patch. The layers explain capture, masking, and review; they are not
decorative cards around generic marketing copy.

## Palette

The palette comes from a night-time printmaker's bench rather than a software
dashboard. It is deliberately single-mode: the dark table makes the pale paper layers
legible and keeps the product world cohesive.

| Token | Value | Role |
| --- | --- | --- |
| Bench ink | `#111815` | page background |
| Deep moss | `#17221d` | raised work surfaces |
| Cut paper | `#f4edda` | primary text and paper shapes |
| Kraft | `#d4bea0` | muted text, rules, secondary paper |
| Vermilion | `#f06a4f` | primary action and redaction marks |
| Acid thread | `#c9f27b` | success, extracted variables, focus |
| Ochre | `#e4b95c` | caution and replay warning |
| Error | `#ff8b7a` | validation and failure |

All text pairings meet WCAG AA. Focus uses a two-layer acid-thread and ink outline so
it remains visible on both paper and bench surfaces. Status never relies on color alone.

## Type

- **Headings:** Georgia, Cambria, `Times New Roman`, serif. Its editorial cuts make the
  generated patch feel like a document under review, without shipping a font payload.
- **Utility/body/code:** `ui-monospace`, SFMono-Regular, Consolas, `Liberation Mono`,
  monospace. One system family ties commands, variables, and prose back to the terminal.

The scale is 16 / 18 / 22 / 32 / clamp(44–72) px, with 1.55 body leading and a 68ch
reading measure. Numbers use tabular figures.

## Space and shape

An 8px base rhythm with 4px micro-adjustments. Sections use 72–120px vertical space;
controls are at least 44px. Paper pieces have small 2–8px radii, clipped corners, and
hard 6–12px offset shadows. This avoids the floating, evenly-rounded framework-card
look. Dotted stitch lines and registration marks repeat across the experience.

On a 390px screen, the diorama becomes a vertical procession; the command rail stacks,
nonessential margin annotations disappear, and no information depends on horizontal
scroll except literal code samples.

## Interaction grammar and motion

Copy controls briefly change from “Copy” to “Copied”. Demo steps reveal in document
order and the generated patch stays in the same visual place. Paper layers enter with
a 220ms vertical transform and opacity, as if set down on the bench; hover shifts are
no more than 2px. Nothing loops.

With `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed and
state changes are instant. Depth remains through overlap, color, cut edges, and shadows.

## Original asset plan and provenance

- `site/public/paper-cut-api-flow.webp`: generated specifically for this product with
  `/opt/fleet/lib/gen-image.sh` (factory-image deployment), then locally resized and
  encoded to WebP at no more than 300 KB. Prompt: “Wide editorial paper-cut diorama on
  a deep forest-green printmaker bench; three cream HTTP request slips move through a
  coral redaction gate and become a neat stitched Git patch, tiny lime variable tags,
  layered cardstock fibers, tactile side lighting, restrained technical composition,
  ample dark negative space, no people, no logos, no readable text, no watermark.”
  Generated imagery is used as an original project asset under the factory generation
  service terms.
- Icons (copy, check, terminal marks) are hand-authored inline SVG or CSS geometry in
  this repository and licensed with the project under MIT.

