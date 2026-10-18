export interface DragPoint { id: string; x: number; y: number }

export function createHoldToDrag(callbacks: {
  start: (point: DragPoint) => void;
  move: (x: number, y: number) => void;
  end: () => void;
  cancel: () => void;
}, timers = {set: (fn: () => void) => setTimeout(fn, 350), clear: (id: ReturnType<typeof setTimeout>) => clearTimeout(id)}) {
  let point: DragPoint | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  const clear = () => { if (timer !== null) timers.clear(timer); timer = null; };
  const cancel = () => {
    const wasActive = active;
    clear(); point = null; active = false;
    if (wasActive) callbacks.cancel();
  };
  return {
    begin(next: DragPoint) {
      cancel(); point = next;
      timer = timers.set(() => { timer = null; if (point) { active = true; callbacks.start(point); } });
    },
    move(x: number, y: number) {
      if (!point) return;
      if (!active && Math.hypot(x - point.x, y - point.y) > 8) { cancel(); return; }
      if (active) callbacks.move(x, y);
    },
    end() {
      const wasActive = active;
      clear(); point = null; active = false;
      if (wasActive) callbacks.end();
      return wasActive;
    },
    cancel,
    isActive: () => active,
  };
}

export function playlistOrderBefore(ids: string[], id: string, before: string | null): string[] {
  if (!ids.includes(id) || before === id || before !== null && !ids.includes(before)) return ids;
  const result = ids.filter(item => item !== id);
  result.splice(before === null ? result.length : result.indexOf(before), 0, id);
  return result;
}
