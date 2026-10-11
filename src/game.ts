import type { Game, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { renderTable } from "./presentation";

export type Screen = "title" | "howto" | "playing" | "won";

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

export type PileKind = "stock" | "waste" | "foundation" | "tableau";

export interface CardState {
  readonly id: number;
  readonly suit: Suit;
  readonly rank: number;
  readonly faceUp: boolean;
}

export interface DragState {
  readonly cards: readonly CardState[];
  readonly fromPile: "waste" | "foundation" | "tableau";
  readonly fromIndex: number;
  readonly x: number;
  readonly y: number;
}

export interface DropTargetState {
  readonly pile: "foundation" | "tableau";
  readonly index: number;
}

export interface PointerState {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}

export interface PressState {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}

export interface FlyerState {
  readonly id: number;
  readonly suit: Suit;
  readonly rank: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

export interface CascadeState {
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly titleIndex: number;

  readonly stock: readonly CardState[];
  readonly waste: readonly CardState[];
  readonly wasteSets: readonly number[];
  readonly foundations: readonly (readonly CardState[])[];
  readonly tableau: readonly (readonly CardState[])[];

  readonly drag: DragState | null;
  readonly dropTarget: DropTargetState | null;
  readonly pointer: PointerState;
  readonly lastPress: PressState | null;

  readonly autoFlip: boolean;
  readonly winDetect: boolean;
  readonly launching: boolean;
  readonly trailPainting: boolean;

  readonly launchClock: number;
  readonly launched: number;
  readonly flyers: readonly FlyerState[];
  readonly cascadeDone: boolean;
  readonly trailStamps: number;

  readonly nextId: number;
  readonly simTime: number;
  readonly muted: boolean;
}

// Drawing history is a resource for the persistent painted layer. Event names
// describe the transitions since the last engine frame, including debug gestures.
export interface CascadeState {
  readonly trail: readonly FlyerState[];
  readonly pendingEvents: readonly (C.CueName | "toggle-sound")[];
}
type State = DeepReadonly<CascadeState>;
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export type MovablePile = Exclude<PileKind, "stock">;
export interface CascadeDebugApi {
  readonly version: number;
  reset(s: State): CascadeState;
  snapshot(s: State): ReturnType<typeof snapshot>;
  reconcile(s: State): CascadeState;
  menuItemRect(s: State, index: number): Rect | null;
  setScreen(s: State, screen: Screen): CascadeState;
  setMenuIndex(s: State, index: number): CascadeState;
  setTitleIndex(s: State, index: number): CascadeState;
  addCard(
    s: State,
    pile: PileKind,
    index: number,
    suit: Suit,
    rank: number,
    faceUp: boolean,
  ): CascadeState;
  removeCard(s: State, id: number): CascadeState;
  setCardFaceUp(s: State, id: number, faceUp: boolean): CascadeState;
  clearPile(s: State, pile: PileKind, index: number): CascadeState;
  clearTable(s: State): CascadeState;
  addWasteSet(s: State, count: number): CascadeState;
  clearWasteSets(s: State): CascadeState;
  deal(s: State): CascadeState;
  turnStock(s: State): CascadeState;
  move(
    s: State,
    fromPile: PileKind,
    fromIndex: number,
    fromRow: number,
    toPile: PileKind,
    toIndex: number,
  ): [CascadeState, boolean];
  autoMove(s: State, pile: PileKind, index: number): [CascadeState, boolean];
  pointerDown(s: State, x: number, y: number): CascadeState;
  pointerMove(s: State, x: number, y: number): CascadeState;
  pointerUp(s: State, x: number, y: number): CascadeState;
  setAutoFlip(s: State, enabled: boolean): CascadeState;
  setWinDetect(s: State, enabled: boolean): CascadeState;
  setLaunching(s: State, enabled: boolean): CascadeState;
  setTrailPainting(s: State, enabled: boolean): CascadeState;
  addFlyer(
    s: State,
    suit: Suit,
    rank: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): CascadeState;
  setFlyerPosition(s: State, id: number, x: number, y: number): CascadeState;
  setFlyerVelocity(s: State, id: number, vx: number, vy: number): CascadeState;
  removeFlyer(s: State, id: number): CascadeState;
  clearFlyers(s: State): CascadeState;
  setLaunchClock(s: State, seconds: number): CascadeState;
  clearTrail(s: State): CascadeState;
  drawLaunchVx(s: State): number;
}
export const BACKGROUND = "#123e37";
const emptyPiles = (count: number): CardState[][] =>
  Array.from({ length: count }, () => []);
export function initialState(muted = false): CascadeState {
  return {
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    stock: [],
    waste: [],
    wasteSets: [],
    foundations: emptyPiles(C.FOUNDATION_COUNT),
    tableau: emptyPiles(C.TABLEAU_COLUMNS),
    drag: null,
    dropTarget: null,
    pointer: { x: 0, y: 0, down: false },
    lastPress: null,
    autoFlip: true,
    winDetect: true,
    launching: true,
    trailPainting: true,
    launchClock: 0,
    launched: 0,
    flyers: [],
    cascadeDone: false,
    trailStamps: 0,
    nextId: 1,
    simTime: 0,
    muted,
    trail: [],
    pendingEvents: [],
  };
}
function cue(s: State, ...names: C.CueName[]): CascadeState {
  return { ...s, pendingEvents: [...s.pendingEvents, ...names] };
}
export function color(card: Pick<CardState, "suit">): "red" | "black" {
  return card.suit === "hearts" || card.suit === "diamonds" ? "red" : "black";
}
function integer(n: number, min = 0, max = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`Invalid integer: ${n}`);
}
function cardValue(suit: Suit, rank: number): void {
  if (!C.SUITS.includes(suit)) throw new Error("Invalid suit");
  integer(rank, C.RANK_MIN, C.RANK_MAX);
}
export function pile(
  s: State,
  kind: PileKind,
  index: number,
): readonly CardState[] {
  integer(
    index,
    0,
    kind === "foundation"
      ? C.FOUNDATION_COUNT - 1
      : kind === "tableau"
        ? C.TABLEAU_COLUMNS - 1
        : 0,
  );
  switch (kind) {
    case "stock":
      return s.stock;
    case "waste":
      return s.waste;
    case "foundation":
      return s.foundations[index];
    case "tableau":
      return s.tableau[index];
    default:
      throw new Error("Invalid pile");
  }
}
function put(
  s: State,
  kind: PileKind,
  index: number,
  cards: readonly CardState[],
): CascadeState {
  pile(s, kind, index);
  if (kind === "stock" || kind === "waste") return { ...s, [kind]: cards };
  const key = kind === "foundation" ? "foundations" : "tableau";
  return { ...s, [key]: s[key].map((p, i) => (i === index ? cards : p)) };
}
function shrinkSets(s: State): CascadeState {
  const sets = [...s.wasteSets];
  if (sets.length) {
    sets[sets.length - 1]--;
    if (sets[sets.length - 1] <= 0) sets.pop();
  }
  return { ...s, wasteSets: sets };
}
export function visibleWaste(s: State): number {
  return s.wasteSets[s.wasteSets.length - 1] ?? 0;
}
export function columnPositions(cards: readonly CardState[]): number[] {
  const preceding = cards.slice(0, -1);
  const down = preceding.filter((c) => !c.faceUp).length;
  const up = preceding.length - down;
  const spacing = up
    ? Math.max(
        C.FACE_UP_OFFSET_MIN,
        Math.min(
          C.FACE_UP_OFFSET,
          (C.COLUMN_BOTTOM_LIMIT -
            C.TABLEAU_Y -
            C.CARD_H -
            down * C.FACE_DOWN_OFFSET) /
            up,
        ),
      )
    : C.FACE_UP_OFFSET;
  let y: number = C.TABLEAU_Y;
  return cards.map((c) => {
    const pos = y;
    y += c.faceUp ? spacing : C.FACE_DOWN_OFFSET;
    return pos;
  });
}
export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}
export function menuItemRect(s: State, index: number): Rect | null {
  if (!Number.isInteger(index) || index < 0) return null;
  if (s.screen === "title" && index < C.TITLE_ITEMS.length)
    return { x: 490, y: 414 + index * 64, w: 300, h: 50 };
  if (s.screen === "howto" && index === 0)
    return { x: 490, y: 590, w: 300, h: 50 };
  if (s.screen === "playing" && index < C.HUD_ITEMS.length)
    return { x: C.STOCK_X + index * 155, y: C.HUD_Y, w: 140, h: C.HUD_H };
  return null;
}
function menuAt(s: State, x: number, y: number): number {
  for (let i = 0; i < C.HUD_ITEMS.length; i++) {
    const r = menuItemRect(s, i);
    if (r && contains(r, x, y)) return i;
  }
  return -1;
}
function isRun(cards: readonly CardState[]): boolean {
  return (
    cards.length > 0 &&
    cards.every(
      (c, i) =>
        c.faceUp &&
        (i === 0 ||
          (cards[i - 1].rank === c.rank + 1 &&
            color(cards[i - 1]) !== color(c))),
    )
  );
}
function accepts(
  s: State,
  cards: readonly CardState[],
  from: PileKind,
  target: PileKind,
  index: number,
): boolean {
  const p = pile(s, target, index);
  const top = p[p.length - 1];
  const lead = cards[0];
  if (!isRun(cards)) return false;
  if (target === "foundation")
    return (
      from !== "foundation" &&
      cards.length === 1 &&
      (!top
        ? lead.rank === C.RANK_MIN
        : top.faceUp &&
          top.suit === lead.suit &&
          top.rank + 1 === lead.rank &&
          top.rank < C.RANK_MAX)
    );
  if (target === "tableau")
    return !top
      ? lead.rank === C.RANK_MAX
      : top.faceUp && top.rank === lead.rank + 1 && color(top) !== color(lead);
  return false;
}
function afterMove(
  s: State,
  from: PileKind,
  index: number,
  target: PileKind,
): CascadeState {
  let next: CascadeState = { ...s };
  if (from === "waste") next = shrinkSets(next);
  if (from === "tableau" && next.autoFlip) {
    const p = next.tableau[index];
    const top = p[p.length - 1];
    if (top && !top.faceUp)
      next = cue(
        put(next, "tableau", index, [
          ...p.slice(0, -1),
          { ...top, faceUp: true },
        ]),
        C.CUES.flip,
      );
  }
  if (target === "foundation") next = cue(next, C.CUES.home);
  return checkWin(next);
}
function checkWin(s: State): CascadeState {
  let next: CascadeState = { ...s };
  const complete = next.foundations.every(
    (p) =>
      p.length === C.RANK_MAX &&
      p.every((c, i) => c.rank === i + C.RANK_MIN && c.suit === p[0].suit),
  );
  if (
    next.screen !== "won" &&
    next.winDetect &&
    complete &&
    new Set(next.foundations.map((p) => p[0].suit)).size === C.FOUNDATION_COUNT
  ) {
    next = cue(
      {
        ...next,
        screen: "won",
        stock: [],
        waste: [],
        wasteSets: [],
        tableau: emptyPiles(C.TABLEAU_COLUMNS),
        drag: null,
        dropTarget: null,
        launchClock: C.LAUNCH_INTERVAL,
        cascadeDone: false,
      },
      C.CUES.win,
    );
  }
  return next;
}
export function move(
  s: State,
  from: PileKind,
  fi: number,
  row: number,
  to: PileKind,
  ti: number,
): [CascadeState, boolean] {
  const source = pile(s, from, fi);
  pile(s, to, ti);
  integer(row, 0, source.length - 1);
  const cards = source.slice(row);
  if (
    from === "stock" ||
    (from === to && fi === ti) ||
    (from !== "tableau" && row !== source.length - 1) ||
    (from === "waste" && !visibleWaste(s)) ||
    !accepts(s, cards, from, to, ti)
  )
    return [{ ...s }, false];
  let next = put(s, from, fi, source.slice(0, row));
  next = put(next, to, ti, [...pile(next, to, ti), ...cards]);
  return [afterMove(next, from, fi, to), true];
}
export function autoMove(
  s: State,
  kind: PileKind,
  index: number,
): [CascadeState, boolean] {
  const p = pile(s, kind, index);
  const top = p[p.length - 1];
  if (
    (kind !== "waste" && kind !== "tableau") ||
    !top?.faceUp ||
    (kind === "waste" && !visibleWaste(s))
  )
    return [{ ...s }, false];
  for (let i = 0; i < C.FOUNDATION_COUNT; i++)
    if (accepts(s, [top], kind, "foundation", i))
      return move(s, kind, index, p.length - 1, "foundation", i);
  return [{ ...s }, false];
}
export function deal(s: State): CascadeState {
  let id = s.nextId;
  const deck: CardState[] = C.SUITS.flatMap((suit) =>
    Array.from({ length: C.RANK_MAX }, (_, i) => ({
      id: id++,
      suit,
      rank: i + C.RANK_MIN,
      faceUp: false,
    })),
  );
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  let offset = 0;
  const tableau = Array.from({ length: C.TABLEAU_COLUMNS }, (_, i) => {
    const p = deck
      .slice(offset, offset + i + 1)
      .map((c, j) => ({ ...c, faceUp: j === i }));
    offset += i + 1;
    return p;
  });
  return cue(
    {
      ...s,
      tableau,
      stock: deck.slice(C.DEAL_TABLEAU_CARDS),
      waste: [],
      wasteSets: [],
      foundations: emptyPiles(C.FOUNDATION_COUNT),
      launched: 0,
      trail: [],
      trailStamps: 0,
      nextId: id,
    },
    C.CUES.deal,
  );
}
export function turnStock(s: State): CascadeState {
  if (s.stock.length) {
    const count = Math.min(C.TURN_COUNT, s.stock.length);
    return cue(
      {
        ...s,
        stock: s.stock.slice(0, -count),
        waste: [
          ...s.waste,
          ...s.stock
            .slice(-count)
            .reverse()
            .map((c) => ({ ...c, faceUp: true })),
        ],
        wasteSets: [...s.wasteSets, count],
      },
      C.CUES.turn,
    );
  }
  if (s.waste.length)
    return cue(
      {
        ...s,
        stock: [...s.waste].reverse().map((c) => ({ ...c, faceUp: false })),
        waste: [],
        wasteSets: [],
      },
      C.CUES.recycle,
    );
  return { ...s };
}
function startGame(s: State): CascadeState {
  return {
    ...deal(s),
    screen: "playing",
    menuIndex: 0,
    drag: null,
    dropTarget: null,
    flyers: [],
    cascadeDone: false,
    launchClock: 0,
  };
}
function activate(s: State): CascadeState {
  if (s.screen === "title") {
    const next = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 0
      ? startGame(next)
      : { ...next, screen: "howto", menuIndex: 0 };
  }
  if (s.screen === "howto" || (s.screen === "playing" && s.menuIndex === 1))
    return { ...s, screen: "title", menuIndex: s.titleIndex };
  if (s.screen === "playing" && s.menuIndex === 0) return startGame(s);
  if (s.screen === "playing" && s.menuIndex === 2)
    return {
      ...s,
      muted: !s.muted,
      pendingEvents: [...s.pendingEvents, "toggle-sound"],
    };
  return { ...s };
}
interface Hit {
  kind: MovablePile;
  index: number;
  row: number;
  x: number;
  y: number;
}
function hitCard(s: State, x: number, y: number): Hit | null {
  for (let i = C.TABLEAU_COLUMNS - 1; i >= 0; i--) {
    const p = s.tableau[i];
    const ys = columnPositions(p);
    for (let j = p.length - 1; j >= 0; j--)
      if (
        contains({ x: C.COLUMN_X[i], y: ys[j], w: C.CARD_W, h: C.CARD_H }, x, y)
      )
        return {
          kind: "tableau",
          index: i,
          row: j,
          x: C.COLUMN_X[i],
          y: ys[j],
        };
  }
  for (let i = 0; i < C.FOUNDATION_COUNT; i++)
    if (
      s.foundations[i].length &&
      contains(
        { x: C.FOUNDATION_X[i], y: C.TOP_ROW_Y, w: C.CARD_W, h: C.CARD_H },
        x,
        y,
      )
    )
      return {
        kind: "foundation",
        index: i,
        row: s.foundations[i].length - 1,
        x: C.FOUNDATION_X[i],
        y: C.TOP_ROW_Y,
      };
  const n = Math.min(visibleWaste(s), s.waste.length);
  for (let j = n - 1; j >= 0; j--) {
    const px = C.WASTE_X + j * C.WASTE_FAN;
    if (contains({ x: px, y: C.TOP_ROW_Y, w: C.CARD_W, h: C.CARD_H }, x, y))
      return j === n - 1
        ? {
            kind: "waste",
            index: 0,
            row: s.waste.length - 1,
            x: px,
            y: C.TOP_ROW_Y,
          }
        : null;
  }
  return null;
}
export function dropTarget(s: State): DropTargetState | null {
  if (!s.drag) return null;
  const d = s.drag;
  const x = d.x + C.CARD_W / 2;
  const y = d.y + C.CARD_H / 2;
  for (let i = 0; i < C.FOUNDATION_COUNT; i++)
    if (
      contains(
        { x: C.FOUNDATION_X[i], y: C.TOP_ROW_Y, w: C.CARD_W, h: C.CARD_H },
        x,
        y,
      ) &&
      accepts(s, d.cards, d.fromPile, "foundation", i) &&
      d.fromPile !== "foundation"
    )
      return { pile: "foundation", index: i };
  for (let i = 0; i < C.TABLEAU_COLUMNS; i++) {
    const ys = columnPositions(s.tableau[i]);
    const h =
      (ys.length ? ys[ys.length - 1] : C.TABLEAU_Y) + C.CARD_H - C.TABLEAU_Y;
    if (
      contains({ x: C.COLUMN_X[i], y: C.TABLEAU_Y, w: C.CARD_W, h }, x, y) &&
      !(d.fromPile === "tableau" && d.fromIndex === i) &&
      accepts(s, d.cards, d.fromPile, "tableau", i)
    )
      return { pile: "tableau", index: i };
  }
  return null;
}
function reconcile(s: State): CascadeState {
  return { ...s, dropTarget: dropTarget(s) };
}
export function pointerMove(s: State, x: number, y: number): CascadeState {
  const index = menuAt(s, x, y);
  return reconcile({
    ...s,
    menuIndex: index >= 0 ? index : s.menuIndex,
    pointer: { ...s.pointer, x, y },
    drag: s.drag
      ? {
          ...s.drag,
          x: s.drag.x + x - s.pointer.x,
          y: s.drag.y + y - s.pointer.y,
        }
      : null,
  });
}
export function pointerDown(s: State, x: number, y: number): CascadeState {
  let next = pointerMove(s, x, y);
  next = {
    ...next,
    pointer: { x, y, down: true },
    lastPress: { x, y, at: s.simTime },
  };
  if (s.screen === "won")
    return { ...startGame(next), pointer: { x, y, down: false } };
  if (s.screen !== "playing") return next;
  const hit = hitCard(s, x, y);
  if (!hit) return next;
  const p = pile(next, hit.kind, hit.index);
  if (!p[hit.row].faceUp) return next;
  const playable =
    (hit.kind === "waste" || hit.kind === "tableau") &&
    hit.row === p.length - 1;
  if (
    playable &&
    s.lastPress &&
    s.simTime - s.lastPress.at <= C.DOUBLE_CLICK_WINDOW &&
    Math.hypot(x - s.lastPress.x, y - s.lastPress.y) <= C.DOUBLE_CLICK_SLOP
  )
    return {
      ...autoMove(next, hit.kind, hit.index)[0],
      pointer: { x, y, down: false },
    };
  next = put(next, hit.kind, hit.index, p.slice(0, hit.row));
  return cue(
    reconcile({
      ...next,
      drag: {
        cards: p.slice(hit.row),
        fromPile: hit.kind,
        fromIndex: hit.index,
        x: hit.x,
        y: hit.y,
      },
    }),
    C.CUES.lift,
  );
}
export function pointerUp(s: State, x: number, y: number): CascadeState {
  let next = pointerMove(s, x, y);
  next = { ...next, pointer: { x, y, down: false } };
  if (!s.pointer.down || !s.lastPress) return next;
  const click =
    Math.hypot(x - s.lastPress.x, y - s.lastPress.y) <= C.DRAG_THRESHOLD;
  const d = next.drag;
  if (d) {
    const target = dropTarget(next);
    next = { ...next, drag: null, dropTarget: null };
    if (!click && target) {
      next = put(next, target.pile, target.index, [
        ...pile(next, target.pile, target.index),
        ...d.cards,
      ]);
      next = cue(
        afterMove(next, d.fromPile, d.fromIndex, target.pile),
        C.CUES.drop,
      );
    } else {
      next = put(next, d.fromPile, d.fromIndex, [
        ...pile(next, d.fromPile, d.fromIndex),
        ...d.cards,
      ]);
      if (!click) next = cue(next, C.CUES.reject);
    }
  }
  if (
    click &&
    s.screen === "playing" &&
    contains(
      { x: C.STOCK_X, y: C.TOP_ROW_Y, w: C.CARD_W, h: C.CARD_H },
      s.lastPress.x,
      s.lastPress.y,
    )
  )
    next = turnStock(next);
  const pressed = menuAt(s, s.lastPress.x, s.lastPress.y);
  const released = menuAt(s, x, y);
  if (pressed >= 0 && pressed === released)
    next = activate({ ...next, menuIndex: released });
  return next;
}
export function drawLaunchVx(): number {
  return (
    (C.LAUNCH_VX_MIN + Math.random() * (C.LAUNCH_VX_MAX - C.LAUNCH_VX_MIN)) *
    (Math.random() < 0.5 ? -1 : 1)
  );
}
export function advanceCascade(s: State, dt: number): CascadeState {
  let next: CascadeState = { ...s };
  const moved = s.flyers.map((f) => {
    let vy = f.vy + C.GRAVITY * dt;
    const x = f.x + f.vx * dt;
    let y = f.y + vy * dt;
    if (y >= C.FLOOR_Y && vy > 0) {
      y = C.FLOOR_Y;
      vy = -vy * C.BOUNCE_DAMP;
    }
    return { ...f, x, y, vy };
  });
  next = {
    ...next,
    flyers: moved.filter((f) => f.x + C.CARD_W >= 0 && f.x <= C.STAGE_W),
    trail: s.trailPainting ? [...s.trail, ...moved] : s.trail,
    trailStamps: s.trailStamps + (s.trailPainting ? moved.length : 0),
  };
  if (s.screen === "won" && s.launching && !s.cascadeDone) {
    let clock = s.launchClock + dt;
    let launched = s.launched;
    const foundations = s.foundations.map((p) => [...p]);
    const flyers = [...next.flyers];
    while (
      clock + Number.EPSILON >= C.LAUNCH_INTERVAL &&
      foundations.some((p) => p.length)
    ) {
      let index = launched % C.FOUNDATION_COUNT;
      while (!foundations[index].length)
        index = (index + 1) % C.FOUNDATION_COUNT;
      const c = foundations[index].pop()!;
      flyers.push({
        id: c.id,
        suit: c.suit,
        rank: c.rank,
        x: C.FOUNDATION_X[index],
        y: C.TOP_ROW_Y,
        vx: drawLaunchVx(),
        vy: C.LAUNCH_VY,
      });
      clock -= C.LAUNCH_INTERVAL;
      launched++;
    }
    next = { ...next, foundations, flyers, launchClock: clock, launched };
    if (launched > s.launched) next = cue(next, C.CUES.launch);
  }
  if (next.launched === C.DECK_SIZE && !next.flyers.length)
    next = { ...next, cascadeDone: true };
  return next;
}
function locate(
  s: State,
  id: number,
): { kind: PileKind; index: number; row: number } {
  for (const kind of ["stock", "waste", "foundation", "tableau"] as const) {
    const n =
      kind === "foundation"
        ? C.FOUNDATION_COUNT
        : kind === "tableau"
          ? C.TABLEAU_COLUMNS
          : 1;
    for (let index = 0; index < n; index++) {
      const row = pile(s, kind, index).findIndex((c) => c.id === id);
      if (row >= 0) return { kind, index, row };
    }
  }
  throw new Error(`Card ${id} does not exist`);
}
function editFlyer(
  s: State,
  id: number,
  edit: (f: FlyerState) => FlyerState | null,
): CascadeState {
  if (!s.flyers.some((f) => f.id === id))
    throw new Error(`Flyer ${id} does not exist`);
  return {
    ...s,
    flyers: s.flyers.flatMap((f) => (f.id === id ? (edit(f) ?? []) : f)),
  };
}
function snapshot(s: State) {
  const card = (c: CardState) => ({ ...c, color: color(c) });
  return {
    version: C.CASCADE_DEBUG_VERSION,
    screen: s.screen,
    menuIndex: s.menuIndex,
    titleIndex: s.titleIndex,
    dealMode: C.DEAL_MODE,
    turnCount: C.TURN_COUNT,
    dealModeLabel: C.DEAL_MODE_LABEL,
    muted: s.muted,
    autoFlip: s.autoFlip,
    winDetect: s.winDetect,
    launching: s.launching,
    trailPainting: s.trailPainting,
    stock: s.stock.map(card),
    waste: s.waste.map(card),
    wasteSets: [...s.wasteSets],
    wasteVisibleCount: visibleWaste(s),
    foundations: s.foundations.map((p) => p.map(card)),
    tableau: s.tableau.map((p) => p.map(card)),
    drag: s.drag ? { ...s.drag, cards: s.drag.cards.map(card) } : null,
    dropTarget: dropTarget(s),
    pointer: { ...s.pointer },
    lastPress: s.lastPress ? { ...s.lastPress } : null,
    launchClock: s.launchClock,
    launched: s.launched,
    flyers: s.flyers.map((f) => ({
      id: f.id,
      suit: f.suit,
      rank: f.rank,
      x: f.x,
      y: f.y,
      vx: f.vx,
      vy: f.vy,
    })),
    cascadeDone: s.cascadeDone,
    trailStamps: s.trailStamps,
    simTime: s.simTime,
  };
}
export const debug: CascadeDebugApi = {
  version: C.CASCADE_DEBUG_VERSION,
  reset: (s) => initialState(s.muted),
  snapshot,
  reconcile,
  menuItemRect,
  setScreen: (s, screen) => {
    if (!["title", "howto", "playing", "won"].includes(screen))
      throw new Error("Invalid screen");
    return { ...s, screen };
  },
  setMenuIndex: (s, menuIndex) => {
    integer(menuIndex);
    return { ...s, menuIndex };
  },
  setTitleIndex: (s, titleIndex) => {
    integer(titleIndex, 0, C.TITLE_ITEMS.length - 1);
    return { ...s, titleIndex };
  },
  addCard: (s, kind, index, suit, rank, faceUp) => {
    cardValue(suit, rank);
    return {
      ...put(s, kind, index, [
        ...pile(s, kind, index),
        { id: s.nextId, suit, rank, faceUp },
      ]),
      nextId: s.nextId + 1,
    };
  },
  removeCard: (s, id) => {
    const { kind, index, row } = locate(s, id);
    const next = put(
      s,
      kind,
      index,
      pile(s, kind, index).filter((_, i) => i !== row),
    );
    return kind === "waste" ? shrinkSets(next) : next;
  },
  setCardFaceUp: (s, id, faceUp) => {
    const { kind, index } = locate(s, id);
    return put(
      s,
      kind,
      index,
      pile(s, kind, index).map((c) => (c.id === id ? { ...c, faceUp } : c)),
    );
  },
  clearPile: (s, kind, index) => {
    const next = put(s, kind, index, []);
    return kind === "waste" ? { ...next, wasteSets: [] } : next;
  },
  clearTable: (s) => ({
    ...s,
    stock: [],
    waste: [],
    wasteSets: [],
    foundations: emptyPiles(C.FOUNDATION_COUNT),
    tableau: emptyPiles(C.TABLEAU_COLUMNS),
    drag: null,
    dropTarget: null,
  }),
  addWasteSet: (s, count) => {
    integer(count);
    return { ...s, wasteSets: [...s.wasteSets, count] };
  },
  clearWasteSets: (s) => ({ ...s, wasteSets: [] }),
  deal,
  turnStock,
  move,
  autoMove,
  pointerDown,
  pointerMove,
  pointerUp,
  setAutoFlip: (s, autoFlip) => ({ ...s, autoFlip }),
  setWinDetect: (s, winDetect) => ({ ...s, winDetect }),
  setLaunching: (s, launching) => ({ ...s, launching }),
  setTrailPainting: (s, trailPainting) => ({ ...s, trailPainting }),
  addFlyer: (s, suit, rank, x, y, vx, vy) => {
    cardValue(suit, rank);
    return {
      ...s,
      flyers: [...s.flyers, { id: s.nextId, suit, rank, x, y, vx, vy }],
      nextId: s.nextId + 1,
    };
  },
  setFlyerPosition: (s, id, x, y) => editFlyer(s, id, (f) => ({ ...f, x, y })),
  setFlyerVelocity: (s, id, vx, vy) =>
    editFlyer(s, id, (f) => ({ ...f, vx, vy })),
  removeFlyer: (s, id) => editFlyer(s, id, () => null),
  clearFlyers: (s) => ({ ...s, flyers: [] }),
  setLaunchClock: (s, launchClock) => ({ ...s, launchClock }),
  clearTrail: (s) => ({ ...s, trail: [], trailStamps: 0 }),
  drawLaunchVx,
};
export const game: Game<CascadeState, CascadeDebugApi> = {
  initialize(api) {
    for (const [name, keys] of Object.entries(C.MENU_BINDINGS))
      api.input.register(name, { keys: [...keys] });
    Object.values(C.CUES).forEach((name, i) =>
      api.audio.define(name, {
        wave: i % 2 ? "sine" : "triangle",
        freq: 180 + i * 67,
        freqTo: 110 + i * 92,
        gain: 0.09,
        durationMs: 55 + i * 12,
      }),
    );
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("deal mode", () => C.DEAL_MODE);
    api.diagnostics.register("stock", (s) => s.stock.length);
    api.diagnostics.register("waste", (s) => s.waste.length);
    for (let i = 0; i < C.FOUNDATION_COUNT; i++)
      api.diagnostics.register(
        `foundation ${i}`,
        (s) => s.foundations[i].length,
      );
    for (let i = 0; i < C.TABLEAU_COLUMNS; i++)
      api.diagnostics.register(`column ${i}`, (s) => s.tableau[i].length);
    api.diagnostics.register("in hand", (s) => s.drag !== null);
    api.diagnostics.register("held cards", (s) => s.drag?.cards.length ?? 0);
    api.diagnostics.register("launched", (s) => s.launched);
    api.diagnostics.register("flyers", (s) => s.flyers.length);
    return [initialState(), debug];
  },
  update(s, api, dt) {
    // A debug gesture completes immediately; its bus effect is delivered on
    // the next engine frame, where the engine exposes the audio controller.
    for (const event of s.pendingEvents)
      if (event === "toggle-sound") api.audio.setMuted(!api.audio.muted());
    let next: CascadeState = {
      ...s,
      simTime: s.simTime + dt,
      muted: api.audio.muted(),
    };
    for (const sample of api.input.pointerSamples())
      if (
        sample.primary &&
        (sample.type === "move" || sample.button === "primary")
      )
        next =
          sample.type === "down"
            ? pointerDown(next, sample.x, sample.y)
            : sample.type === "up"
              ? pointerUp(next, sample.x, sample.y)
              : pointerMove(next, sample.x, sample.y);
    next = keyboard(next, api);
    api.audio.setMuted(next.muted);
    if (next.screen === "playing") next = checkWin(next);
    next = advanceCascade(next, dt);
    for (const name of new Set(next.pendingEvents))
      if (name !== "toggle-sound") api.audio.play(name);
    return { ...next, pendingEvents: [], muted: api.audio.muted() };
  },
  render(s, api) {
    renderTable(s, api.ctx);
  },
};
function keyboard(s: State, api: UpdateApi): CascadeState {
  if (s.screen === "won") return { ...s };
  const count =
    s.screen === "title"
      ? C.TITLE_ITEMS.length
      : s.screen === "playing"
        ? C.HUD_ITEMS.length
        : 1;
  if (api.input.pressed(C.MENU_UP))
    return { ...s, menuIndex: (s.menuIndex + count - 1) % count };
  if (api.input.pressed(C.MENU_DOWN))
    return { ...s, menuIndex: (s.menuIndex + 1) % count };
  if (
    api.input.pressed(C.MENU_CONFIRM) ||
    (s.screen === "howto" && api.input.pressed(C.MENU_BACK))
  )
    return activate(s);
  return { ...s };
}
