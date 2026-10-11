# Cascade

A quiet game of Draw Three Klondike solitaire, with a lively finish: complete all four foundations and watch the cards arc, bounce, and paint the felt. Everything runs in your browser. Cards, screens, and sounds are generated in code; there are no downloaded assets or services.

Install dependencies with `npm ci`. Start development with `npm run dev`, then open the address Vite prints. Create the static production site with `npm run build`; serve the contents of `dist/` with any static server. The build works at the root of a site or under a sub-path. `npm run preview` serves the production build locally.

Drag exposed cards or face-up runs between columns. Columns build downward in alternating colors; only Kings fill empty columns. Build foundations from Ace to King in one suit. Double-click an exposed card to send it to a foundation. Click the stock to turn three cards; only the frontmost waste card is playable. Click the empty stock to recycle the waste, with unlimited passes. Touch uses the same gestures.

Use the bottom controls to start a new game, return to the menu, or toggle sound. Navigate menus with Up/W and Down/S, confirm with Enter or Space, and leave the instructions with Escape. Backtick toggles the read-only diagnostics overlay. After winning, click anywhere to begin again.

Run the checks with `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test`. The tests cover deals, waste sets, legal and refused moves, pointer transactions, keyboard menus, audio registration, simulation, and canvas rendering.

The player showcase is in `showcase/`. Its replay contains a real pointer move from a random deal, captured with the engine recorder. To refresh the screenshots and replay, run the development server, then run `node scripts/capture.ts` in another terminal (Node 24 or newer). Set `CASCADE_URL` if the server uses a different address. The script also checks mouse input, touch input, resizing, and diagnostics in the project's Chromium.

The implementation exposes its automation API only through the engine handle: `engine.debug.snapshot(engine.state)` reads the table; `engine.apply(s => engine.debug.turnStock(s))` runs the stock rules. No game API is installed on the production page.
