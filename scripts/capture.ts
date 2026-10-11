/** Capture only real pointer play: no debug poses or board injection. */
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import process from "node:process";
import type { Engine } from "@clockwyrks/simple-2d";
import type { CascadeState, CascadeDebugApi } from "../src/game.ts";

type CaptureHost = typeof globalThis & {
  capture: Engine<CascadeState, CascadeDebugApi>;
};
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.CASCADE_URL ?? "http://localhost:5173");
  await page.waitForLoadState("networkidle");
  // An isolated engine for explicit frame timing. Production has no globals.
  await page.evaluate(async () => {
    // @ts-expect-error Vite serves these browser module URLs.
    const { createEngine, ConstantClock } =
      await import("/node_modules/@clockwyrks/simple-2d/dist/index.js");
    // @ts-expect-error Vite serves this source module URL.
    const { game, BACKGROUND } = await import("/src/game.ts");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100vw;height:100vh";
    document.body.replaceChildren(canvas);
    const engine = createEngine({
      canvas,
      width: 1280,
      height: 720,
      game,
      background: BACKGROUND,
      clock: new ConstantClock(1000 / 60),
    });
    await engine.initialize();
    (globalThis as CaptureHost).capture = engine;
    await engine.advance(1);
  });
  const advance = async (frames = 1) =>
    page.evaluate(
      (n) => (globalThis as CaptureHost).capture.advance(n),
      frames,
    );
  const click = async (x: number, y: number) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await advance();
    await page.mouse.up();
    await advance();
  };
  await mkdir("showcase", { recursive: true });
  await page.screenshot({ path: "showcase/title.png" });
  await page.keyboard.press("Enter");
  await advance();
  // Find a legal exposed move in a genuine random deal. Redeal through the HUD
  // if necessary; never pose a card, a win, or an outcome.
  let gesture: { from: number; to: number; y: number; ty: number } | null =
    null;
  for (let attempt = 0; attempt < 100 && !gesture; attempt++) {
    gesture = await page.evaluate(() => {
      const s = (globalThis as CaptureHost).capture.state;
      const red = (suit: string) => suit === "hearts" || suit === "diamonds";
      for (let i = 0; i < s.tableau.length; i++) {
        const card = s.tableau[i].at(-1)!;
        if (card.rank === 1)
          return { from: 224 + i * 122, to: 590, y: 180 + i * 24, ty: 24 };
        for (let j = 0; j < s.tableau.length; j++) {
          const target = s.tableau[j].at(-1)!;
          if (
            i !== j &&
            target.rank === card.rank + 1 &&
            red(card.suit) !== red(target.suit)
          )
            return {
              from: 224 + i * 122,
              to: 224 + j * 122,
              y: 180 + i * 24,
              ty: 180 + j * 24,
            };
        }
      }
      return null;
    });
    if (!gesture) await click(290, 698);
  }
  if (!gesture) throw new Error("No legal move found after 100 genuine deals");
  await click(250, 60); // Show the Draw Three fan.
  await page.evaluate(() =>
    (globalThis as CaptureHost).capture.startRecording(),
  );
  await advance(30);
  const { from, to, y, ty } = gesture;
  await page.mouse.move(from + 35, y + 45);
  await page.mouse.down();
  await advance();
  await advance(20);
  for (let i = 1; i <= 70; i++) {
    await page.mouse.move(
      from + 35 + ((to - from) * i) / 70,
      y + 45 + ((ty - y) * i) / 70,
    );
    await advance();
  }
  await advance(25);
  await page.mouse.up();
  await advance();
  await advance(33);
  const capture = await page.evaluate(() => {
    const e = (globalThis as CaptureHost).capture;
    const s = e.debug.snapshot(e.state);
    if (
      s.drag ||
      (!s.tableau.some((p) => p.length > 1 && p.at(-2)!.faceUp) &&
        !s.foundations.some((p) => p.length))
    )
      throw new Error("The live move did not land");
    return e.stopRecording();
  });
  await writeFile("showcase/play.json.gz", gzipSync(JSON.stringify(capture)));
  await page.screenshot({ path: "showcase/table.png" });
  // Touch follows the same pointer input route. The stock should turn again.
  const before = await page.evaluate(
    () => (globalThis as CaptureHost).capture.state.stock.length,
  );
  await page.dispatchEvent("canvas", "pointerdown", {
    pointerId: 31,
    pointerType: "touch",
    isPrimary: true,
    clientX: 250,
    clientY: 60,
    button: 0,
    buttons: 1,
  });
  await page.dispatchEvent("canvas", "pointerup", {
    pointerId: 31,
    pointerType: "touch",
    isPrimary: true,
    clientX: 250,
    clientY: 60,
    button: 0,
    buttons: 0,
  });
  await advance();
  const after = await page.evaluate(
    () => (globalThis as CaptureHost).capture.state.stock.length,
  );
  if (after !== before - 3) throw new Error("Touch stock turn failed");
  await page.setViewportSize({ width: 800, height: 900 });
  await advance();
  await page.keyboard.press("Backquote");
  await advance();
  const diagnostics = await page.evaluate(() =>
    (globalThis as CaptureHost).capture.diagnostics(),
  );
  if (diagnostics.some((d) => d.error))
    throw new Error("Diagnostic source failed");
  if (errors.length) throw new Error(errors.join("\n"));
  process.stdout.write(
    `Captured ${capture.frames.length} live frames; mouse, touch, resize and diagnostics passed.\n`,
  );
} finally {
  await browser.close();
}
