---
name: "Jotstead"
description: "A calm, compact workspace that puts content before controls."
colors:
  action-blue: "#256b86"
  action-blue-dark: "#8ec5db"
  action-text: "#ffffff"
  action-text-dark: "#182329"
  canvas: "#ffffff"
  sidebar: "#f6f6f4"
  text: "#292b2c"
  muted: "#626661"
  faint: "#6d706b"
  hover: "#f0f1ee"
  selected: "#e7eae5"
  line: "#e3e5e0"
  panel: "#ffffff"
  canvas-dark: "#191b1c"
  sidebar-dark: "#202223"
  text-dark: "#e5e6e3"
  muted-dark: "#b0b4ad"
  faint-dark: "#a2a79f"
  hover-dark: "#292c2d"
  selected-dark: "#303634"
  line-dark: "#353a38"
  panel-dark: "#222526"
  code: "#f7f6f3"
  code-dark: "#242424"
  danger: "#c84444"
  danger-dark: "#eb7a7a"
  tag-blue-bg: "#d3e5ef"
  tag-blue-text: "#25546a"
  tag-blue-bg-dark: "#203848"
  tag-blue-text-dark: "#b6dcee"
typography:
  chrome:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
    fontSize: "14px"
  editor:
    fontSize: "16px"
    lineHeight: 1.5
  document-title:
    fontSize: "32px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  database-title:
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  home-title:
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  editor-heading-1:
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.45px"
  editor-heading-2:
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.35px"
  editor-heading-3:
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  compact-control:
    fontSize: "13px"
  property-label:
    fontSize: "12px"
  document-serif:
    fontFamily: 'Georgia, "Times New Roman", serif'
  document-mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
rounded:
  field: "4px"
  control: "6px"
  container: "8px"
  dialog: "12px"
spacing:
  tight: "4px"
  compact: "6px"
  field: "8px"
  row: "12px"
  section: "16px"
  document: "24px"
  content: "32px"
  writing: "48px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.action-text}"
    rounded: "{rounded.control}"
    padding: "6px 11px"
    typography: "{typography.chrome}"
  button-primary-dark:
    backgroundColor: "{colors.action-blue-dark}"
    textColor: "{colors.action-text-dark}"
    rounded: "{rounded.control}"
  button-subtle:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "6px 8px"
    typography: "{typography.chrome}"
  button-icon:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    width: "32px"
    height: "32px"
  input:
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "8px"
    typography: "{typography.chrome}"
  navigation-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 8px"
  chip-blue:
    backgroundColor: "{colors.tag-blue-bg}"
    textColor: "{colors.tag-blue-text}"
    rounded: "{rounded.field}"
    padding: "2px 7px"
    typography: "{typography.property-label}"
  database-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.container}"
    padding: "14px"
    width: "100%"
    typography: "{typography.chrome}"
  view-tab:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "8px 9px"
    typography: "{typography.compact-control}"
  property-select:
    rounded: "{rounded.field}"
    padding: "5px 7px"
    typography: "{typography.property-label}"
---

# Design System: Jotstead

## Overview

**Creative North Star: "The Quiet Workbench"**

Jotstead is a flat, neutral working surface: calm enough for long writing sessions, compact enough for real databases. White and softly neutral light surfaces become charcoal in dark mode; a restrained blue identifies action, focus and editable state. The interface uses the platform system sans family, while documents retain their own serif, mono, size and width preferences.

Content comes before controls. Navigation has one dominant current location, with quieter duplicate shortcuts. Working surfaces rely on rows, readable type and modest borders; contextual menus and dialogs carry secondary controls. Documents can hold expressive content, covers and images without making the surrounding workspace decorative.

**Key Characteristics:**

- Flat neutral surfaces with restrained blue action and focus.
- Compact system sans chrome; expressive document preferences.
- One dominant navigation selection and progressive controls.
- Monochrome regular-weight Phosphor icons across page surfaces.
- Immediate repeated interactions, visible keyboard focus and reduced motion.

## Colors

The palette is white, softly neutral and charcoal, with one muted blue action accent. Frontmatter records the effective values; dark-suffixed entries describe the dark theme rather than a second brand palette.

### Primary

- **Action Blue:** primary actions, caret, selection tint and focus outlines. Dark mode uses the lighter blue with dark action text.
- **Blue property tag:** a pale category fill with a deeper readable label; dark mode changes both fill and text. This is content categorization, not a second action accent.

### Neutral

- **Canvas / Panel:** the writing surface and overlay interiors. The light theme shares white for both; dark panels sit slightly above the charcoal canvas in tone.
- **Sidebar:** a quiet navigation surface, separated with a thin line.
- **Text / Muted / Faint:** main content, supporting chrome and placeholders. Use the effective theme variables rather than inherited pre-redesign values.
- **Hover / Selected / Line:** distinct hover, current-location and divider treatments.
- **Code:** a subdued content block surface inherited from the editor styles.
- **Danger:** errors and destructive action labels. Other property tag categories retain their source-specific semantic colors; do not use them as workspace accents.

**The One Current Location Rule.** Use the selected fill for the current main navigation or tree location. A duplicate favorite shortcut may use stronger text without another selected fill.

## Typography

**Chrome Font:** the platform system sans stack in `typography.chrome`.
**Document Fonts:** inherit the chrome family by default; optional Georgia serif and system mono stacks remain available within the document.

**Character:** familiar, practical and readable. Hierarchy comes from size, weight and spacing; chrome has no separate display face.

### Hierarchy

- **Document title:** `document-title`; compact, strong and tightly tracked. It inherits the document's font choice.
- **Database title:** `database-title`; smaller than a document title so rows arrive sooner.
- **Home title:** `home-title`; the same family and weight language as document titles.
- **Editor headings:** `editor-heading-1`, `editor-heading-2`, `editor-heading-3`; a descending reading hierarchy inside user content.
- **Editor body:** `editor`; comfortable line height for writing. Small-text documents use the chrome-sized body.
- **Chrome:** `chrome`; navigation, buttons and ordinary fields.
- **Compact control / Property label:** `compact-control` and `property-label`; toolbars, cells and metadata. Database numbers use tabular figures.

At the narrow-screen breakpoint, document titles become (28px), database titles (25px), and Home titles (28px). Editor headings become (26px), (22px) and (19px). Coarse-pointer native fields use (16px) text.

**The Chrome Stays Native Rule.** Use the system sans family for workspace controls. Apply serif and mono choices within documents rather than introducing a separate display face for chrome.

## Layout

The shell fills the dynamic viewport and splits into a fixed desktop sidebar (240px) and a flexible workspace. The topbar is (54px) tall. The sidebar scrolls independently of content; the page area owns content scrolling.

Documents are centered with a maximum width (740px), top padding from `spacing.writing`, and desktop side space for block controls. The effective desktop document width is `calc(100% - 128px)`. Full-width pages remove the maximum. Home uses a centered maximum (820px). Database pages have no maximum width and use `calc(100% - 64px)`; their title/icon row is a (40px) icon column, (8px) gap and flexible title. The database icon itself is (28px).

Database toolbars wrap with a minimum height (46px). Table headers are (36px) and rows (42px), with horizontal dividers rather than vertical cell lines; the name column starts at (240px). The table scrolls horizontally when needed. Board columns have a minimum width (240px) and use a subdued sidebar-toned background.

At (900px) and below, database tools occupy their own line. At (767px) and below, the sidebar becomes a fixed drawer (265px) with a dim backdrop; the topbar respects safe-area insets. Documents use `calc(100% - 48px)` and (28px) top padding; databases use `calc(100% - 32px)` and (24px) top padding; Home uses `calc(100% - 40px)`. Native inputs and several frequent navigation, icon, menu and date controls grow for coarse pointers; this is selector-specific, not a claim that every control already has a (44px) target.

**The Content First Rule.** Keep the working content visually dominant. Use compact titles and toolbars on data surfaces; reserve spacious reading geometry for documents.

## Elevation & Depth

Working surfaces are flat. Sidebar tone, hover/selection fills and thin borders convey structure. Database cards explicitly have no shadow. Menus and dialogs share the source `--shadow`; mobile sidebar elevation uses the same token. Backdrops provide modal separation. The source also retains a faint shadow on the narrow-screen editor toolbar; it is an edge separator rather than a general card treatment. Exact shadows are in the sidecar extensions.

**The Flat at Rest Rule.** Use neutral tone and thin borders for working surfaces. Reserve the overlay shadow for menus, dialogs and the mobile sidebar.

## Shapes

Use gently rounded controls and restrained rectangular surfaces. The frontmatter radius roles reflect native fields/tags, buttons/rows, cards/menus and dialogs respectively. Inputs use a thin divider-colored border; database cell fields usually remove that border. Page titles are borderless with square corners. Home page lists use square-edged rows and horizontal dividers. Avoid pill silhouettes for ordinary controls; switches and small status dots keep their existing specialized geometry.

## Components

### Buttons

Compact and direct. Primary buttons use the blue action fill, medium weight (500), and minimum height (32px); the database New variant uses (6px 10px) padding. Subtle actions use muted text; icon buttons are centered, labeled, and normally (32px) square. Pressed ordinary buttons use the selected fill; primary press dims with `brightness(0.9)`. Disabled buttons use opacity (0.5) and a not-allowed cursor. The sidecar reproduces the current primary hover, including the legacy inherited hover color; that value is not promoted into a palette token.

### Inputs / Fields

Native inputs, selects, dates and checkboxes share the workspace language. Ordinary fields use the field radius and padding. Property text fields use (5px 6px) padding and compact-control text; category selects use (5px 7px), a (100px) minimum and (180px) maximum width. Table cells and row details render the same property component. Dates show a readable button label until editing opens the native date input. Checkboxes are (16px) with the blue accent.

Focus uses a blue outline (2px) offset outward (2px). Cell inputs, cell selects and database search place that outline inside the field with offset (-2px). Title focus uses the blue outline with offset (5px).

### Navigation

Quiet, compact and predictable. Desktop main navigation rows are (36px); tree rows have a minimum (34px). Favorites and Private collapse independently. The main New page action is a neutral panel-colored row with a thin border. The current tree location gets selected fill; its duplicate favorite uses stronger text. Tree actions appear for hover and keyboard focus; use accessible labels and preserve context while browsing.

### Chips / Tags

Small category labels with the field radius, property-label text and (2px 7px) padding. Category colors remain semantic and readable across themes. Native category selects use these fills rather than a separate bespoke picker skin.

### Cards / Containers

Database cards use panel fill, a thin line border, container radius and (14px) padding. Names wrap at long words and use weight (550); metadata is small and muted. Hover uses the hover fill and focus uses the shared outline. Cards stay flat at rest. They represent actual database records, not decorative dashboard modules.

### Database views and toolbar

The compact view strip defaults to the existing Table, Board and Calendar views. Other views live in the picker; selecting another view brings it into the compact strip. View buttons use compact-control text, control radius and a neutral active fill with weight (600). Tools and search sit beside the strip or wrap below it. Property visibility lives in a native checkbox menu. Secondary filter, sort and layout controls appear on demand.

### Page icons and document links

Use monochrome, regular-weight Phosphor SVG icons through the shared page-icon component, including navigation, database records, document headers and live page links. Stored legacy icons map to this catalog with a document/database fallback. Typical navigation icons are (18px), breadcrumb icons (16px), Home list icons (20px), document headers (56px), and database headers (28px). The searchable picker uses selected fill for its pressed option. Live page links preserve their page-link marker and pair the monochrome icon with a text link.

### Menus, dialogs and editing controls

Menus use panel fill, the container radius, (6px) padding and the overlay shadow; buttons have minimum height (34px) and compact-control text. Dialogs use the dialog radius, (22px) padding and sticky title row; narrow-screen padding becomes `spacing.section`. Menu Escape closes and returns focus to the trigger; native dialogs provide modal behavior. Block controls occupy the desktop gutter at (-66px). Narrow screens use the fixed editing toolbar. Active formatting and available history actions follow editor state rather than a static snapshot.

**The State Before Motion Rule.** Make hover, press, selection and keyboard focus readable immediately. Honor reduced motion; do not turn the unused easing declaration into a transition requirement.

Repeated navigation and editing interactions have no imposed transition. The source's only explicit transform transition is the details disclosure (0.1s), with saving/loading pulses where applicable. Its inherited CSS disclosure glyph is residual implementation drift, not a page-icon or interface-icon standard. Reduced-motion styles disable animations and transitions and force automatic scrolling; the duration fallback is (0.01ms). An unused `--ease-ui` declaration is not a motion standard.

## Do's and Don'ts

### Do:

- **Do** use the source light/dark semantic variables for working surfaces, text, dividers and focus.
- **Do** keep one dominant sidebar selection and use monochrome Phosphor page icons consistently.
- **Do** share native property fields between table cells and row details, with readable date display and a native editor.
- **Do** place block controls in the desktop editing gutter and use the mobile editing toolbar on narrow screens.
- **Do** preserve document font, small-text, full-width, cover and image preferences.
- **Do** retain visible focus, accessible labels, disabled states and the coarse-pointer field sizing.

### Don't:

- **Don't** introduce decorative dashboard cards or a display font into workspace chrome.
- **Don't** expand every database view into the default toolbar; use the existing view picker.
- **Don't** use emoji or typographic glyphs as new interface or page icons.
- **Don't** use shadows to lift ordinary database cards or working rows.
- **Don't** require hover to reach essential controls or add animated navigation.

The effective visual authority is `src/app/workspace-ui.css`, imported after `src/app/globals.css` in the root layout, plus the shared UI, page-icon and property components. This document records the shipped redesign at commit `327a1f4`; inherited values overridden by the workspace stylesheet are not competing tokens.
