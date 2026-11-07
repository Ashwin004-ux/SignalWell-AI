# SignalWell AI — Design System

The interface pairs a calm research-oriented palette with clearer product hierarchy, responsive navigation, and accessible, understated depth. It should feel focused and modern without implying medical authority or adding decorative effects that obscure data.

## Color

- **Paper / canvas:** pale green-gray `#f4f7f5` for app backgrounds.
- **Ink:** deep charcoal-green for primary text and headings.
- **Forest:** `#122820` / `#245b49` for the brand sidebar and primary actions.
- **Signal green:** muted green for stable states, positive interactions, and focus.
- **Amber / brick:** reserved for monitor/elevated states; status is also labeled in text and with a glyph, never color alone.
- **Surfaces:** white cards with fine borders and low-contrast shadows for separation.

## Type

- Source Sans 3 for controls and body copy; Source Serif 4 for editorial headings.
- Use compact uppercase tracking sparingly for metadata and navigation group labels.
- Keep paragraphs at a readable line length and body text at comfortable line height.

## Layout and components

- Desktop dashboard uses a persistent dark forest sidebar, active-route treatment, and a lightweight context bar. Mobile keeps a compact, collapsible navigation.
- Cards use consistent rounded corners and restrained elevation. Primary buttons have clear hover, focus, disabled, and loading states.
- Use chart colors and labels consistently, with units and data-source notes visible near research data.
- Keep synthetic/demo data clearly identified and separate from live account records.

## Motion and accessibility

- Short transitions communicate interaction state; avoid large entrance animations.
- Respect `prefers-reduced-motion`, preserve visible keyboard focus, and ensure status labels are readable without color.
- Keep interactive targets clear on touch screens and avoid wrapping primary navigation actions on narrow viewports.
