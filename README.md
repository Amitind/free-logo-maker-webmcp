# Free Logo Maker — WebMCP Demo

A standalone, open-source extract of the **Free SVG Logo Maker** from [allsvgicons.com/free-logo-maker/](https://allsvgicons.com/free-logo-maker/), created for the **OpenAI WebMCP Challenge**.

## What This Is

This repository contains a full-featured, client-side SVG logo designer instrumented with **WebMCP** (Web Model Context Protocol) tools. It enables AI agents (like Claude Code, ChatGPT with browse capabilities, or custom LLM browser extensions) to inspect, design, modify, and export SVG logos directly on the user's canvas in real time.

## Why WebMCP Fits Here

Instead of maintaining a separate headless API or server-side rendering pipeline for AI agents, WebMCP allows an AI agent to drive the **exact same canvas** that a human interacts with:
- **Shared Context:** The agent inspects the live visual state, safe-zone boundaries, and contrast ratios.
- **Bi-directional Interactivity:** Human users see live edits from the AI immediately on screen and can tweak them using the UI.
- **Zero Backend Infra:** Everything runs client-side in the browser using the public [Iconify API](https://api.iconify.design) for icon searches and downloads.

## Registered WebMCP Tools

The page registers 7 dedicated Logo Maker tools (plus the global `send_feedback` tool) on `document.modelContext`:

1. **`get_logo_maker_state`**: Inspect the canvas dimensions, layers, background config, brand presets catalog, templates, safe-zone violations, and contrast warnings.
2. **`update_logo_maker_state`**: Incrementally add, update, remove, or clear layers, tweak background styling, apply brand presets, or randomize styles.
3. **`replace_logo_maker_state`**: Replace the entire canvas state in a single call (all layers, background, and canvas size).
4. **`search_logo_icons`**: Search across 200,000+ open-source SVG icons via Iconify with query keywords and pack filters.
5. **`load_logo_maker_share`**: Load a logo design from an `asl1.` compressed share code, share URL, brand preset, or template ID.
6. **`get_logo_preview`**: Render and export the current canvas as raw SVG vector markup or as a small PNG data URI.
7. **`manage_saved_logos`**: Save, list, or load logo checkpoints in the browser's local "My logos" collection.

## Manual Testing via Browser Console

You can interact with the WebMCP tools directly in the browser developer console:

```javascript
// List all registered tools
const tools = document.modelContext.getRegisteredTools();
console.log(tools.map(t => t.name));

// Example 1: Get current canvas state
const state = await document.modelContext.callTool('get_logo_maker_state', {
  includeSvg: false,
});
console.log('Current state:', state);

// Example 2: Search for icons
const searchResults = await document.modelContext.callTool('search_logo_icons', {
  query: 'coffee',
  limit: 6,
});
console.log('Icons found:', searchResults.icons);

// Example 3: Update canvas with a new layer
await document.modelContext.callTool('update_logo_maker_state', {
  addLayers: [
    {
      iconName: 'ph:coffee-fill',
      scale: 1.5,
      fill: '#ffffff',
      overwriteFill: true,
    }
  ],
  background: {
    type: 'gradient',
    solidColor: '#3e2723',
    gradientColors: ['#3e2723', '#5d4037'],
    gradientDirection: 'to bottom',
    shape: 'squircle',
    borderRadius: 60,
  }
});
```

Alternatively, find tools by definition and execute:
```javascript
const tools = document.modelContext.getRegisteredTools();
const getTool = tools.find(t => t.name === 'get_logo_maker_state');
const result = await getTool.execute();
console.log(result);
```

## Getting Started

### Prerequisites

- Node.js >= 18.x
- [pnpm](https://pnpm.io/) >= 8.x

### Development

```bash
# Install dependencies
pnpm install

# Start local dev server
pnpm dev
```

Open `http://localhost:4321` in your browser.

### Production Build

```bash
pnpm build
```

The output will be built into the `./dist` folder ready for static deployment.

## Live Version

For the full production version featuring additional guides, showcase galleries, and icon collections, visit [allsvgicons.com/free-logo-maker/](https://allsvgicons.com/free-logo-maker/).

## License

[MIT](LICENSE) © 2026 Amit Yadav
