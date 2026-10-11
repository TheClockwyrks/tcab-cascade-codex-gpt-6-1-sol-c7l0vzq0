import { describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import {
  advanceCascade,
  columnPositions,
  debug,
  game,
  initialState,
  menuItemRect,
} from "./game";
import type { CascadeState, PileKind, Suit } from "./game";
import * as C from "./constants";
import { drawCard, pointInMenu, renderTable } from "./presentation";

function add(
  s: CascadeState,
  kind: PileKind,
  index: number,
  suit: Suit,
  rank: number,
  faceUp = true,
): CascadeState {
  return debug.addCard(s, kind, index, suit, rank, faceUp);
}
function api(edges: string[] = []) {
  let muted = false;
  return {
    input: {
      pressed: (name: string) => edges.includes(name),
      pointerSamples: () => [],
    },
    audio: {
      play: vi.fn(),
      muted: () => muted,
      setMuted: (value: boolean) => {
        muted = value;
      },
    },
  } as unknown as UpdateApi;
}
function freeze(s: CascadeState): CascadeState {
  function visit(value: unknown): void {
    if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
      Object.freeze(value);
    }
  }
  visit(s);
  return s;
}

describe("the deal and Draw Three", () => {
  it("initializes the entire title state, exactly four bindings and ten distinct cues", () => {
    const register = vi.fn(),
      define = vi.fn(),
      diagnostic = vi.fn();
    const [s, d] = game.initialize({
      input: { register },
      audio: { define },
      diagnostics: { register: diagnostic },
    } as unknown as InitApi<CascadeState>) as [CascadeState, typeof debug];
    expect(s.screen).toBe("title");
    expect(d.version).toBe(C.CASCADE_DEBUG_VERSION);
    expect(register.mock.calls.map((c) => c[0])).toEqual(
      Object.keys(C.MENU_BINDINGS),
    );
    expect(define.mock.calls.map((c) => c[0])).toEqual(Object.values(C.CUES));
    expect(diagnostic.mock.calls.length).toBeGreaterThanOrEqual(18);
    const dealt = debug.deal(s);
    for (const [, read] of diagnostic.mock.calls)
      expect(() => read(dealt)).not.toThrow();
  });
  it("deals each suit/rank exactly once, keeps identities unique and turns only column tips", () => {
    const old = freeze(initialState());
    const s = debug.deal(old);
    const all = [...s.stock, ...s.tableau.flat()];
    expect(all).toHaveLength(C.DECK_SIZE);
    expect(new Set(all.map((c) => c.id)).size).toBe(C.DECK_SIZE);
    expect(new Set(all.map((c) => `${c.suit}:${c.rank}`)).size).toBe(
      C.DECK_SIZE,
    );
    expect(s.stock).toHaveLength(C.DEAL_STOCK_CARDS);
    expect(s.tableau.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    s.tableau.forEach((p) =>
      expect(p.map((c) => c.faceUp)).toEqual(
        p.map((_, i) => i === p.length - 1),
      ),
    );
    expect(old.stock).toEqual([]);
  });
  it("turns the top first, remembers partial sets, and recycles in the same order", () => {
    let s = initialState();
    for (let rank = 1; rank <= 5; rank++)
      s = add(s, "stock", 0, "clubs", rank, false);
    s = debug.turnStock(s);
    expect(s.waste.map((c) => c.rank)).toEqual([5, 4, 3]);
    expect(s.wasteSets).toEqual([3]);
    s = debug.turnStock(s);
    expect(s.waste.map((c) => c.rank)).toEqual([5, 4, 3, 2, 1]);
    expect(s.wasteSets).toEqual([3, 2]);
    const ids = s.waste.map((c) => c.id);
    s = debug.turnStock(s);
    expect(s.stock.every((c) => !c.faceUp)).toBe(true);
    expect(s.wasteSets).toEqual([]);
    s = debug.turnStock(debug.turnStock(s));
    expect(s.waste.map((c) => c.id)).toEqual(ids);
  });
  it("falls back to older sets only after committed moves, and rejects hidden waste", () => {
    let s = add(initialState(), "waste", 0, "hearts", 2);
    s = debug.addWasteSet(s, 1);
    s = add(s, "waste", 0, "clubs", 1);
    s = debug.addWasteSet(s, 1);
    const [moved, ok] = debug.autoMove(s, "waste", 0);
    expect(ok).toBe(true);
    expect(moved.wasteSets).toEqual([1]);
    expect(debug.snapshot(moved).wasteVisibleCount).toBe(1);
    expect(debug.autoMove(debug.clearWasteSets(s), "waste", 0)[1]).toBe(false);
  });
});
describe("move rules and transactions", () => {
  it("accepts an Ace into any empty foundation, then only its suit's next rank", () => {
    let s = add(initialState(), "tableau", 0, "hearts", 1);
    let result = debug.move(s, "tableau", 0, 0, "foundation", 3);
    expect(result[1]).toBe(true);
    s = result[0];
    s = add(s, "tableau", 0, "clubs", 2);
    expect(debug.autoMove(s, "tableau", 0)[1]).toBe(false);
    s = debug.clearPile(s, "tableau", 0);
    s = add(s, "tableau", 0, "hearts", 2);
    result = debug.autoMove(s, "tableau", 0);
    expect(result[1]).toBe(true);
    expect(result[0].foundations[3].map((c) => c.rank)).toEqual([1, 2]);
  });
  it("moves alternating descending runs, exposes exactly one card, and preserves the original", () => {
    let s = add(initialState(), "tableau", 0, "clubs", 4, false);
    s = add(s, "tableau", 0, "hearts", 8);
    s = add(s, "tableau", 0, "spades", 7);
    s = add(s, "tableau", 1, "clubs", 9);
    const old = freeze(s);
    const [next, ok] = debug.move(old, "tableau", 0, 1, "tableau", 1);
    expect(ok).toBe(true);
    expect(next.tableau[1].map((c) => c.rank)).toEqual([9, 8, 7]);
    expect(next.tableau[0][0].faceUp).toBe(true);
    expect(old.tableau[0][0].faceUp).toBe(false);
    const [gated] = debug.move(
      debug.setAutoFlip(s, false),
      "tableau",
      0,
      1,
      "tableau",
      1,
    );
    expect(gated.tableau[0][0].faceUp).toBe(false);
  });
  it("refuses malformed runs, facedown sources, same piles and non-Kings in empty columns", () => {
    let s = add(initialState(), "tableau", 0, "clubs", 8);
    s = add(s, "tableau", 0, "spades", 7);
    s = add(s, "tableau", 1, "hearts", 9);
    expect(debug.move(s, "tableau", 0, 0, "tableau", 1)).toEqual([s, false]);
    s = debug.clearPile(s, "tableau", 0);
    s = add(s, "tableau", 0, "clubs", 8, false);
    expect(debug.move(s, "tableau", 0, 0, "tableau", 1)[1]).toBe(false);
    s = debug.setCardFaceUp(s, s.tableau[0][0].id, true);
    expect(debug.move(s, "tableau", 0, 0, "tableau", 0)[1]).toBe(false);
    expect(debug.move(s, "tableau", 0, 0, "tableau", 2)[1]).toBe(false);
    s = debug.clearPile(s, "tableau", 0);
    s = add(s, "tableau", 0, "hearts", C.RANK_MAX);
    expect(debug.move(s, "tableau", 0, 0, "tableau", 2)[1]).toBe(true);
  });
  it("takes only the waste's top and never accepts cards into draw piles or foundation runs", () => {
    let s = add(initialState(), "waste", 0, "hearts", 1);
    s = add(s, "waste", 0, "clubs", 1);
    s = debug.addWasteSet(s, 2);
    expect(debug.move(s, "waste", 0, 0, "foundation", 0)[1]).toBe(false);
    expect(debug.move(s, "waste", 0, 1, "stock", 0)[1]).toBe(false);
    expect(debug.move(s, "waste", 0, 1, "waste", 0)[1]).toBe(false);
    s = add(s, "tableau", 0, "hearts", 2);
    s = add(s, "tableau", 0, "clubs", 1);
    expect(debug.move(s, "tableau", 0, 0, "foundation", 0)[1]).toBe(false);
  });
  it("lets a foundation card return to a column but not to another foundation", () => {
    let s = add(initialState(), "foundation", 0, "clubs", 1);
    s = add(s, "tableau", 0, "hearts", 2);
    expect(debug.autoMove(s, "foundation", 0)[1]).toBe(false);
    expect(debug.move(s, "foundation", 0, 0, "foundation", 1)[1]).toBe(false);
    expect(debug.move(s, "foundation", 0, 0, "tableau", 0)[1]).toBe(true);
  });
  it("wins immediately on the last legal move and honors the win gate", () => {
    let s = { ...initialState(), screen: "playing" as const };
    C.SUITS.forEach((suit, i) => {
      for (let rank = C.RANK_MIN; rank <= C.RANK_MAX; rank++)
        if (i !== 3 || rank !== C.RANK_MAX)
          s = add(s, "foundation", i, suit, rank) as typeof s;
    });
    s = add(s, "tableau", 0, "clubs", C.RANK_MAX) as typeof s;
    expect(
      debug.autoMove(debug.setWinDetect(s, false), "tableau", 0)[0].screen,
    ).toBe("playing");
    const [won, ok] = debug.autoMove(s, "tableau", 0);
    expect(ok).toBe(true);
    expect(won.screen).toBe("won");
    expect(won.launchClock).toBe(C.LAUNCH_INTERVAL);
    expect(won.tableau.flat()).toEqual([]);
  });
});
describe("pointer and menus", () => {
  it("lifts immediately without flipping, maintains grab offset and restores a rejected drop", () => {
    let s = { ...initialState(), screen: "playing" as const };
    s = add(s, "tableau", 0, "clubs", 3, false) as typeof s;
    s = add(s, "tableau", 0, "hearts", 2) as typeof s;
    const down = debug.pointerDown(
      s,
      C.COLUMN_X[0] + 13,
      C.TABLEAU_Y + C.FACE_DOWN_OFFSET + 17,
    );
    expect(down.drag?.x).toBe(C.COLUMN_X[0]);
    expect(down.tableau[0]).toHaveLength(1);
    expect(down.tableau[0][0].faceUp).toBe(false);
    const moved = debug.pointerMove(down, 117, 490);
    expect(moved.drag?.x).toBe(104);
    const up = debug.pointerUp(moved, 117, 490);
    expect(up.tableau).toEqual(s.tableau);
    expect(up.drag).toBeNull();
    expect(up.pendingEvents).toContain(C.CUES.reject);
  });
  it("uses the leading card center for legal drops and highlights before release", () => {
    let s = { ...initialState(), screen: "playing" as const };
    s = add(s, "tableau", 0, "hearts", 8) as typeof s;
    s = add(s, "tableau", 1, "clubs", 9) as typeof s;
    s = debug.pointerDown(s, C.COLUMN_X[0] + 10, C.TABLEAU_Y + 10) as typeof s;
    s = debug.pointerMove(s, C.COLUMN_X[1] + 10, C.TABLEAU_Y + 20) as typeof s;
    expect(s.dropTarget).toEqual({ pile: "tableau", index: 1 });
    s = debug.pointerUp(s, s.pointer.x, s.pointer.y) as typeof s;
    expect(s.tableau[1]).toHaveLength(2);
  });
  it("keeps waste set counts during a lift, click and rejection", () => {
    let s = { ...initialState(), screen: "playing" as const };
    s = add(s, "waste", 0, "clubs", 1) as typeof s;
    s = debug.addWasteSet(s, 1) as typeof s;
    const down = debug.pointerDown(s, C.WASTE_X + 10, C.TOP_ROW_Y + 10);
    expect(down.waste).toEqual([]);
    expect(down.wasteSets).toEqual([1]);
    expect(
      debug.pointerUp(down, C.WASTE_X + 10, C.TOP_ROW_Y + 10).wasteSets,
    ).toEqual([1]);
  });
  it("sends a playable card home on the second press and makes its release inert", () => {
    let s = { ...initialState(), screen: "playing" as const };
    s = add(s, "tableau", 0, "hearts", 1) as typeof s;
    const x = C.COLUMN_X[0] + 20,
      y = C.TABLEAU_Y + 20;
    s = debug.pointerUp(debug.pointerDown(s, x, y), x, y) as typeof s;
    s = debug.pointerDown({ ...s, simTime: 0.2 }, x, y) as typeof s;
    expect(s.drag).toBeNull();
    expect(s.foundations[0]).toHaveLength(1);
    expect(debug.pointerUp(s, x, y).foundations).toEqual(s.foundations);
    expect(s.lastPress?.at).toBe(0.2);
  });
  it("processes stock press and release inside a single engine frame", () => {
    const s = debug.setScreen(debug.deal(initialState()), "playing");
    const a = api();
    a.input.pointerSamples = () =>
      ["down", "up"].map((type) => ({
        type: type as "down" | "up",
        x: C.STOCK_X + 10,
        y: C.TOP_ROW_Y + 10,
        id: 1,
        primary: true,
        device: "touch",
        button: "primary",
        buttons: [],
      }));
    const next = game.update(freeze(s), a, 0.01);
    expect(next.waste).toHaveLength(C.TURN_COUNT);
    expect(a.audio.play).toHaveBeenCalledWith(C.CUES.turn);
  });
  it("drives every menu by keyboard, gives movement priority, remembers title selection and toggles the bus", () => {
    let s = game.update(
      initialState(),
      api([C.MENU_UP, C.MENU_DOWN, C.MENU_CONFIRM]),
      0.1,
    );
    expect(s.menuIndex).toBe(1);
    expect(s.screen).toBe("title");
    s = game.update(s, api([C.MENU_CONFIRM]), 0.1);
    expect(s.screen).toBe("howto");
    expect(s.titleIndex).toBe(1);
    s = game.update(s, api([C.MENU_BACK]), 0.1);
    expect(s.menuIndex).toBe(1);
    expect(s.screen).toBe("title");
    const a = api([C.MENU_CONFIRM]);
    s = game.update(
      debug.setMenuIndex(debug.setScreen(s, "playing"), 2),
      a,
      0.1,
    );
    expect(s.muted).toBe(true);
    expect(a.audio.muted()).toBe(true);
    expect(menuItemRect(debug.setScreen(s, "won"), 0)).toBeNull();
    expect(menuItemRect(s, 99)).toBeNull();
  });
  it("activates controls only when both edges land in their region", () => {
    const s = initialState();
    const r = menuItemRect(s, 1)!;
    const down = debug.pointerDown(s, r.x + 10, r.y + 10);
    expect(down.menuIndex).toBe(1);
    expect(debug.pointerUp(down, 0, 0).screen).toBe("title");
    const next = debug.pointerUp(down, r.x + 10, r.y + 10);
    expect(next.screen).toBe("howto");
    expect(pointInMenu(s, 1, r.x + 10, r.y + 10)).toBe(true);
  });
});
describe("cascade and debug contract", () => {
  it("integrates velocity before motion, bounces at the floor, paints then retires", () => {
    let s = debug.addFlyer(
      initialState(),
      "clubs",
      1,
      100,
      C.FLOOR_Y - 1,
      200,
      100,
    );
    const id = s.flyers[0].id;
    s = advanceCascade(s, 0.1);
    expect(s.flyers[0]).toMatchObject({
      x: 120,
      y: C.FLOOR_Y,
      vx: 200,
      vy: -(100 + C.GRAVITY * 0.1) * C.BOUNCE_DAMP,
    });
    expect(s.trailStamps).toBe(1);
    s = debug.setFlyerPosition(s, id, C.STAGE_W + 1, 10);
    s = advanceCascade(s, 0);
    expect(s.flyers).toEqual([]);
    expect(s.trailStamps).toBe(2);
    expect(s.cascadeDone).toBe(false);
  });
  it("launches in foundation order, keeps card ids, leaves fresh launches unmoved and ends only after 52", () => {
    let s = debug.setScreen(initialState(), "won");
    C.SUITS.forEach((suit, i) => {
      for (let rank = 1; rank <= C.RANK_MAX; rank++)
        s = add(s, "foundation", i, suit, rank);
    });
    s = debug.setLaunchClock(s, C.LAUNCH_INTERVAL);
    s = advanceCascade(s, C.LAUNCH_INTERVAL * 3);
    expect(s.launched).toBe(4);
    expect(s.flyers.map((f) => f.suit)).toEqual([...C.SUITS]);
    expect(
      s.flyers.every((f) => f.y === C.TOP_ROW_Y && f.rank === C.RANK_MAX),
    ).toBe(true);
    s = advanceCascade(s, 20);
    expect(s.launched).toBe(C.DECK_SIZE);
    s = advanceCascade(s, 20);
    expect(s.flyers).toEqual([]);
    expect(s.cascadeDone).toBe(true);
  });
  it("gates launching and painting independently while existing flyers continue", () => {
    let s = debug.setScreen(initialState(), "won");
    s = add(s, "foundation", 0, "clubs", 1);
    s = debug.addFlyer(s, "hearts", 1, 100, 10, 200, 0);
    s = debug.setLaunchClock(s, 0.1);
    s = debug.setLaunching(s, false);
    s = debug.setTrailPainting(s, false);
    const next = advanceCascade(s, 0.1);
    expect(next.flyers[0].x).toBe(120);
    expect(next.launchClock).toBe(0.1);
    expect(next.foundations[0]).toHaveLength(1);
    expect(next.trailStamps).toBe(0);
  });
  it("carries horizontal distance and simulation time equally over subdivided intervals", () => {
    const s = debug.addFlyer(initialState(), "clubs", 1, 100, 10, 200, 0);
    const a = api();
    const one = game.update(s, a, 1);
    let many = s;
    for (let i = 0; i < 60; i++) many = game.update(many, a, 1 / 60);
    expect(one.flyers[0].x).toBeCloseTo(many.flyers[0].x);
    expect(one.simTime).toBeCloseTo(many.simTime);
  });
  it("reconcile is pure and idempotent and poses do not advance clocks or run systems", () => {
    let s = debug.addFlyer(initialState(), "clubs", 1, -200, 900, 50, 100);
    s = add(s, "tableau", 0, "hearts", 1, false);
    s = debug.setScreen(s, "playing");
    const old = freeze(s);
    const first = debug.reconcile(old);
    expect(debug.reconcile(first)).toEqual(first);
    expect(first).toEqual(old);
    expect(debug.snapshot(old).flyers[0].y).toBe(900);
    expect(debug.reset({ ...s, muted: true })).toEqual(initialState(true));
    expect(debug.clearTable(s).flyers).toEqual(s.flyers);
  });
  it("fails loudly for invalid addresses and missing entities and draws both signed speed ranges", () => {
    const s = initialState();
    expect(() => debug.clearPile(s, "foundation", 4)).toThrow();
    expect(() => debug.removeCard(s, 99)).toThrow();
    expect(() => debug.setFlyerVelocity(s, 99, 0, 0)).toThrow();
    expect(() => debug.addWasteSet(s, 1.1)).toThrow();
    expect(() => add(s, "stock", 0, "clubs", 14)).toThrow();
    const values = Array.from({ length: 1000 }, () => debug.drawLaunchVx(s));
    expect(values.some((x) => x > 0)).toBe(true);
    expect(values.some((x) => x < 0)).toBe(true);
    expect(
      values.every(
        (x) => Math.abs(x) >= C.LAUNCH_VX_MIN && Math.abs(x) <= C.LAUNCH_VX_MAX,
      ),
    ).toBe(true);
  });
});
describe("presentation", () => {
  it("compresses long columns uniformly and restores natural offsets after shortening", () => {
    let s = initialState();
    for (let rank = 0; rank < 20; rank++) s = add(s, "tableau", 0, "clubs", 1);
    const ys = columnPositions(s.tableau[0]);
    expect(ys[19] + C.CARD_H).toBeCloseTo(C.COLUMN_BOTTOM_LIMIT);
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(C.FACE_UP_OFFSET_MIN);
    expect(columnPositions(s.tableau[0].slice(0, 3))).toEqual([
      C.TABLEAU_Y,
      C.TABLEAU_Y + C.FACE_UP_OFFSET,
      C.TABLEAU_Y + 2 * C.FACE_UP_OFFSET,
    ]);
  });
  it("draws all screens, faces, backs, a held run and a painted finish on a real canvas without mutating state", () => {
    const canvas = createCanvas(C.STAGE_W, C.STAGE_H);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    for (const screen of ["title", "howto", "playing", "won"] as const) {
      let s = debug.setScreen(debug.deal(initialState()), screen);
      s = { ...s, cascadeDone: screen === "won" };
      const before = debug.snapshot(s);
      renderTable(freeze(s), ctx);
      expect(debug.snapshot(s)).toEqual(before);
    }
    C.SUITS.forEach((suit, i) =>
      drawCard(ctx, { suit, rank: i + 10, faceUp: true }, i * C.CARD_W, 0),
    );
    drawCard(ctx, { suit: "clubs", rank: 1, faceUp: false }, 0, C.CARD_H);
    let s = debug.setScreen(debug.deal(initialState()), "playing");
    const y = columnPositions(s.tableau[0])[0];
    s = debug.pointerDown(s, C.COLUMN_X[0] + 10, y + 10);
    renderTable(s, ctx);
    s = advanceCascade(debug.addFlyer(s, "clubs", 1, 100, 100, 20, 0), 0.1);
    renderTable(s, ctx);
    expect(canvas.toBuffer("image/png").length).toBeGreaterThan(10000);
  });
});

describe("posed state resumes through the normal systems", () => {
  it("detects a complete posed board only when stepping, and keeps the launch clock running while cards finish flying", () => {
    let s = debug.setScreen(initialState(), "playing");
    C.SUITS.forEach((suit, index) => {
      for (let rank = C.RANK_MIN; rank <= C.RANK_MAX; rank++)
        s = add(s, "foundation", index, suit, rank);
    });
    expect(debug.reconcile(s).screen).toBe("playing");
    expect(game.update(debug.setWinDetect(s, false), api(), 0.1).screen).toBe(
      "playing",
    );
    const won = game.update(s, api(), 0.1);
    expect(won.screen).toBe("won");
    expect(won.launched).toBe(1);
    expect(won.flyers[0].y).toBe(C.TOP_ROW_Y);
    const flying = debug.clearTable(won);
    expect(advanceCascade(flying, 0.1).launchClock).toBeCloseTo(
      flying.launchClock + 0.1,
    );
  });
  it("edits individual entities without running unrelated systems or recycling ids", () => {
    let s = add(initialState(), "waste", 0, "hearts", 5);
    s = add(s, "waste", 0, "clubs", 4);
    s = debug.addWasteSet(s, 2);
    const cardId = s.waste[0].id;
    s = debug.removeCard(s, cardId);
    expect(s.wasteSets).toEqual([1]);
    expect(s.waste[0].rank).toBe(4);
    s = debug.addFlyer(s, "clubs", 2, 120, 130, 20, 30);
    const id = s.flyers[0].id;
    s = debug.setFlyerVelocity(s, id, 40, 50);
    s = debug.setFlyerPosition(s, id, 200, 300);
    expect(s.flyers[0]).toMatchObject({ id, x: 200, y: 300, vx: 40, vy: 50 });
    s = advanceCascade(s, 0.1);
    const cleared = debug.clearTrail(s);
    expect(cleared.trailStamps).toBe(0);
    expect(cleared.flyers).toEqual(s.flyers);
    expect(cleared.simTime).toBe(s.simTime);
    expect(debug.removeFlyer(cleared, id).flyers).toEqual([]);
    expect(debug.clearFlyers(cleared).flyers).toEqual([]);
    const next = add(cleared, "stock", 0, "hearts", 1);
    expect(next.stock[0].id).toBeGreaterThan(id);
    expect(() => debug.setCardFaceUp(next, cardId, true)).toThrow();
  });
});

it("delivers a debug HUD sound gesture through the engine audio bus and then mirrors external mute changes", () => {
  const a = api();
  let s = debug.setScreen(initialState(), "playing");
  const r = debug.menuItemRect(s, 2)!;
  s = debug.pointerUp(
    debug.pointerDown(s, r.x + 10, r.y + 10),
    r.x + 10,
    r.y + 10,
  );
  s = game.update(s, a, 0.01);
  expect(a.audio.muted()).toBe(true);
  expect(s.muted).toBe(true);
  a.audio.setMuted(false);
  expect(game.update(s, a, 0.01).muted).toBe(false);
});
