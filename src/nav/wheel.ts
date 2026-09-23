import { NAV_ITEMS, type NavItem } from './items';

export type SlotEmphasis = 'active' | 'near' | 'far';

export type WheelSlot = {
  offset: -2 | -1 | 0 | 1 | 2;
  angle: number;
  emphasis: SlotEmphasis;
  item: NavItem;
};

const SLOT_ANGLES: Record<number, number> = { [-2]: 8, [-1]: 26, [0]: 45, [1]: 64, [2]: 82 };
const SLOT_EMPHASIS: Record<number, SlotEmphasis> = { [-2]: 'far', [-1]: 'near', [0]: 'active', [1]: 'near', [2]: 'far' };
const CUT_ANGLES = [17, 35.5, 54.5, 73];

export function wrapIndex(i: number, n: number): number {
  return ((i % n) + n) % n;
}

export function slotsAround(i: number): WheelSlot[] {
  const n = NAV_ITEMS.length;
  return ([-2, -1, 0, 1, 2] as const).map((offset) => ({
    offset,
    angle: SLOT_ANGLES[offset],
    emphasis: SLOT_EMPHASIS[offset],
    item: NAV_ITEMS[wrapIndex(i + offset, n)],
  }));
}

export function cutFlags(i: number): [boolean, boolean, boolean, boolean] {
  const n = NAV_ITEMS.length;
  const offsets = [-2, -1, 0, 1, 2];
  return [0, 1, 2, 3].map((gap) => {
    const left = NAV_ITEMS[wrapIndex(i + offsets[gap], n)];
    const right = NAV_ITEMS[wrapIndex(i + offsets[gap + 1], n)];
    return left.group !== right.group;
  }) as [boolean, boolean, boolean, boolean];
}

export function cutAngle(gapIndex: 0 | 1 | 2 | 3): number {
  return CUT_ANGLES[gapIndex];
}

export function indexOfPath(pathname: string): number | null {
  const path = pathname.split('?')[0].split('#')[0];
  const idx = NAV_ITEMS.findIndex((it) => it.href === path);
  return idx === -1 ? null : idx;
}
