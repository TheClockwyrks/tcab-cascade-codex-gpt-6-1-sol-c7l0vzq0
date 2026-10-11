import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import {
  BACKGROUND,
  color,
  columnPositions,
  contains,
  dropTarget,
  menuItemRect,
  visibleWaste,
} from "./game";
import type { CardState, CascadeState, FlyerState, Rect } from "./game";

const INK = "#173c35";
const CREAM = "#f6f0df";
const GOLD = "#d9bd7d";
const SYMBOLS = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
function box(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  fill: string,
  stroke?: string,
  radius = 8,
): void {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 18,
  fill = CREAM,
  font = "Arial",
  align: CanvasTextAlign = "left",
): void {
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
export function drawCard(
  ctx: CanvasRenderingContext2D,
  card: Pick<CardState, "rank" | "suit" | "faceUp">,
  x: number,
  y: number,
  lifted = false,
): void {
  ctx.save();
  ctx.shadowColor = "#041c2355";
  ctx.shadowBlur = lifted ? 18 : 5;
  ctx.shadowOffsetY = lifted ? 10 : 3;
  box(
    ctx,
    { x, y, w: C.CARD_W, h: C.CARD_H },
    card.faceUp ? CREAM : "#254e61",
    card.faceUp ? "#d9d4c2" : "#c1b790",
  );
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (!card.faceUp) {
    box(
      ctx,
      { x: x + 6, y: y + 6, w: C.CARD_W - 12, h: C.CARD_H - 12 },
      "#254e61",
      "#9fa88a",
      4,
    );
    ctx.strokeStyle = "#749195";
    ctx.lineWidth = 0.7;
    for (let i = 12; i < C.CARD_H - 10; i += 12) {
      ctx.beginPath();
      ctx.moveTo(x + 10, y + i);
      ctx.lineTo(x + C.CARD_W - 10, y + i);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(x + C.CARD_W / 2, y + C.CARD_H / 2);
    ctx.rotate(Math.PI / 4);
    box(ctx, { x: -22, y: -22, w: 44, h: 44 }, "#254e61", GOLD, 3);
    ctx.restore();
    text(
      ctx,
      "C",
      x + C.CARD_W / 2,
      y + C.CARD_H / 2,
      29,
      GOLD,
      "Georgia",
      "center",
    );
  } else {
    const tint = color(card) === "red" ? "#b24b42" : INK;
    const rank =
      card.rank === C.RANK_MIN
        ? "A"
        : card.rank === 11
          ? "J"
          : card.rank === 12
            ? "Q"
            : card.rank === C.RANK_MAX
              ? "K"
              : String(card.rank);
    text(ctx, rank, x + 9, y + 17, 22, tint, "Georgia");
    text(
      ctx,
      SYMBOLS[card.suit],
      x + card.rank.toString().length * 11 + 15,
      y + 17,
      18,
      tint,
      "Georgia",
    );
    text(
      ctx,
      SYMBOLS[card.suit],
      x + C.CARD_W / 2,
      y + 72,
      52,
      tint,
      "Georgia",
      "center",
    );
    ctx.save();
    ctx.translate(x + C.CARD_W, y + C.CARD_H);
    ctx.rotate(Math.PI);
    text(ctx, rank, 9, 17, 22, tint, "Georgia");
    text(
      ctx,
      SYMBOLS[card.suit],
      card.rank.toString().length * 11 + 15,
      17,
      18,
      tint,
      "Georgia",
    );
    ctx.restore();
  }
  ctx.restore();
}
function slot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  highlight = false,
): void {
  box(
    ctx,
    { x, y, w: C.CARD_W, h: C.CARD_H },
    highlight ? "#d9bd7d36" : "#082c2926",
    highlight ? GOLD : "#c7ddc03c",
  );
  text(
    ctx,
    label,
    x + C.CARD_W / 2,
    y + C.CARD_H / 2,
    25,
    highlight ? GOLD : "#b0c9b06b",
    "Georgia",
    "center",
  );
}
function button(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  selected: boolean,
  small = false,
): void {
  box(
    ctx,
    r,
    selected ? GOLD : "#173e3666",
    selected ? GOLD : "#d9bd7d55",
    small ? 4 : 6,
  );
  text(
    ctx,
    label,
    r.x + r.w / 2,
    r.y + r.h / 2,
    small ? 13 : 15,
    selected ? INK : CREAM,
    "Arial",
    "center",
  );
}
interface PaintCache {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  history: readonly FlyerState[];
  count: number;
}
const paints = new WeakMap<CanvasRenderingContext2D, PaintCache>();
function paintedLayer(
  ctx: CanvasRenderingContext2D,
  s: DeepReadonly<CascadeState>,
): void {
  if (typeof document === "undefined") {
    for (const f of s.trail) drawCard(ctx, { ...f, faceUp: true }, f.x, f.y);
    return;
  }
  let cache = paints.get(ctx);
  if (!cache) {
    const canvas = document.createElement("canvas");
    canvas.width = C.STAGE_W;
    canvas.height = C.STAGE_H;
    const context = canvas.getContext("2d");
    if (!context) return;
    cache = { canvas, context, history: [], count: 0 };
    paints.set(ctx, cache);
  }
  if (
    s.trail.length < cache.count ||
    (cache.count > 0 && s.trail[0] !== cache.history[0])
  ) {
    cache.context.clearRect(0, 0, C.STAGE_W, C.STAGE_H);
    cache.count = 0;
  }
  for (let i = cache.count; i < s.trail.length; i++) {
    const f = s.trail[i];
    drawCard(cache.context, { ...f, faceUp: true }, f.x, f.y);
  }
  cache.count = s.trail.length;
  cache.history = s.trail;
  if (cache.count) ctx.drawImage(cache.canvas, 0, 0);
}
function background(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  const glow = ctx.createRadialGradient(640, 260, 20, 640, 300, 780);
  glow.addColorStop(0, "#39705a50");
  glow.addColorStop(1, "#061e2510");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  ctx.strokeStyle = "#d9bd7d35";
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 18, C.STAGE_W - 36, C.STAGE_H - 36);
}
function menu(
  ctx: CanvasRenderingContext2D,
  s: DeepReadonly<CascadeState>,
  labels: readonly string[],
  small = false,
): void {
  labels.forEach((label, i) => {
    const r = menuItemRect(s, i);
    if (r)
      button(
        ctx,
        r,
        label +
          (s.screen === "playing" && i === 2
            ? s.muted
              ? "  OFF"
              : "  ON"
            : ""),
        s.menuIndex === i,
        small,
      );
  });
}
export function renderTable(
  s: DeepReadonly<CascadeState>,
  ctx: CanvasRenderingContext2D,
): void {
  ctx.save();
  background(ctx);
  if (s.screen === "title") {
    text(
      ctx,
      "A LITTLE ORDER. A BEAUTIFUL ENDING.",
      640,
      85,
      12,
      GOLD,
      "Arial",
      "center",
    );
    const cards: CardState[] = C.SUITS.map((suit, i) => ({
      id: i,
      suit,
      rank: C.RANK_MIN,
      faceUp: true,
    }));
    cards.forEach((card, i) => {
      ctx.save();
      ctx.translate(510 + i * 57, 120 + Math.abs(i - 1.5) * 9);
      ctx.rotate((i - 1.5) * 0.11);
      drawCard(ctx, card, 0, 0);
      ctx.restore();
    });
    text(ctx, C.TITLE_TEXT, 640, 332, 74, CREAM, "Georgia", "center");
    text(ctx, C.TAGLINE_TEXT, 640, 385, 15, GOLD, "Arial", "center");
    menu(ctx, s, C.TITLE_ITEMS);
    text(ctx, C.DEAL_MODE_LABEL, 640, 577, 12, GOLD, "Arial", "center");
    text(
      ctx,
      "Take your time. Find your rhythm.",
      640,
      654,
      15,
      "#a4beb0",
      "Georgia",
      "center",
    );
  } else if (s.screen === "howto") {
    text(ctx, "THE ART OF PATIENCE", 640, 88, 12, GOLD, "Arial", "center");
    text(ctx, "How to play", 640, 145, 51, CREAM, "Georgia", "center");
    const lessons = [
      [
        "01",
        "Build a home for every suit",
        "Fill the four foundations from ACE to KING, one suit at a time.",
      ],
      [
        "02",
        "Make room, one card at a time",
        "Build columns downward, alternating red and black. Only a KING fills a gap.",
      ],
      [
        "03",
        "Turn over new possibilities",
        "Click the STOCK to turn three cards. Play the front card; recycle when empty.",
      ],
      [
        "04",
        "Follow your hand",
        "Drag a card or a face-up run. DOUBLE-CLICK an exposed card to send it home.",
      ],
    ];
    lessons.forEach(([number, title, body], i) => {
      const y = 239 + i * 77;
      text(ctx, number, 230, y, 22, GOLD, "Georgia");
      text(ctx, title, 285, y, 23, CREAM, "Georgia");
      text(ctx, body, 285, y + 29, 16, "#b9cbbf");
    });
    menu(ctx, s, [C.HOWTO_BACK_LABEL]);
  } else {
    if (s.screen === "playing") {
      text(ctx, C.TITLE_TEXT, 64, 68, 23, CREAM, "Georgia");
      text(ctx, "P A T I E N C E", 64, 98, 10, GOLD);
      ctx.strokeStyle = "#d9bd7d55";
      ctx.beginPath();
      ctx.moveTo(64, 128);
      ctx.lineTo(174, 128);
      ctx.stroke();
      text(ctx, "One card", 64, 564, 18, "#b5c8b4", "Georgia");
      text(ctx, "at a time.", 64, 589, 18, "#b5c8b4", "Georgia");
      slot(ctx, C.STOCK_X, C.TOP_ROW_Y, s.stock.length ? "" : "↻");
      if (s.stock.length)
        drawCard(ctx, s.stock[s.stock.length - 1], C.STOCK_X, C.TOP_ROW_Y);
      slot(ctx, C.WASTE_X, C.TOP_ROW_Y, "·");
      const visible = Math.min(
        Math.max(0, visibleWaste(s) - (s.drag?.fromPile === "waste" ? 1 : 0)),
        s.waste.length,
      );
      if (visible) {
        s.waste
          .slice(0, -visible)
          .forEach((c) => drawCard(ctx, c, C.WASTE_X, C.TOP_ROW_Y));
        s.waste
          .slice(-visible)
          .forEach((c, i) =>
            drawCard(ctx, c, C.WASTE_X + i * C.WASTE_FAN, C.TOP_ROW_Y),
          );
      }
      s.tableau.forEach((p, i) => {
        slot(ctx, C.COLUMN_X[i], C.TABLEAU_Y, "K");
        const ys = columnPositions(p);
        p.forEach((c, j) => drawCard(ctx, c, C.COLUMN_X[i], ys[j]));
      });
    }
    paintedLayer(ctx, s);
    s.foundations.forEach((p, i) => {
      slot(ctx, C.FOUNDATION_X[i], C.TOP_ROW_Y, "A");
      if (p.length)
        drawCard(ctx, p[p.length - 1], C.FOUNDATION_X[i], C.TOP_ROW_Y);
    });
    s.flyers.forEach((f) => drawCard(ctx, { ...f, faceUp: true }, f.x, f.y));
    const target = dropTarget(s);
    if (target) {
      const x =
        target.pile === "foundation"
          ? C.FOUNDATION_X[target.index]
          : C.COLUMN_X[target.index];
      const y = target.pile === "foundation" ? C.TOP_ROW_Y : C.TABLEAU_Y;
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x - 3, y - 3, C.CARD_W + 6, C.CARD_H + 6, 10);
      ctx.stroke();
    }
    if (s.drag)
      s.drag.cards.forEach((c, i) =>
        drawCard(ctx, c, s.drag!.x, s.drag!.y + i * C.FACE_UP_OFFSET, true),
      );
    if (s.screen === "playing") {
      box(
        ctx,
        { x: 0, y: C.HUD_Y, w: C.STAGE_W, h: C.HUD_H },
        "#0a2d28",
        undefined,
        0,
      );
      menu(ctx, s, C.HUD_ITEMS, true);
      text(
        ctx,
        C.DEAL_MODE_LABEL,
        1056,
        C.HUD_Y + C.HUD_H / 2,
        12,
        GOLD,
        "Arial",
        "right",
      );
    } else if (s.cascadeDone) {
      box(ctx, { x: 425, y: 265, w: 430, h: 190 }, "#123e37ed", GOLD);
      text(ctx, C.WIN_TEXT, 640, 325, 55, CREAM, "Georgia", "center");
      text(
        ctx,
        "A beautiful finish. Click to begin again.",
        640,
        399,
        16,
        GOLD,
        "Arial",
        "center",
      );
    }
  }
  ctx.restore();
}
// Kept public to make the visual menu's hit contract testable without a browser.
export function pointInMenu(
  s: DeepReadonly<CascadeState>,
  i: number,
  x: number,
  y: number,
): boolean {
  const r = menuItemRect(s, i);
  return r ? contains(r, x, y) : false;
}
