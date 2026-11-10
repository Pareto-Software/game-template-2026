// Touch, mouse and pen taps on the game canvas (shared kit file – used by every game).
//
// touch.taps() – the taps of this frame, in game coordinates: [{ x, y }, …]
// Every finger counts separately, so several kids can tap at the same time.
// startGame() (kit/loop.ts) connects this to the canvas for you.

export interface Tap {
  x: number;
  y: number;
}

let waiting: Tap[] = [];
let current: Tap[] = [];

export const touch = {
  /** Taps that happened since the last update step. */
  taps(): Tap[] {
    return current;
  },

  /** Listen to taps on the canvas. width / height = the game's logical size. */
  attach(canvas: HTMLCanvasElement, width: number, height: number) {
    // No scrolling, zooming or text selection when kids tap fast.
    Object.assign(canvas.style, { touchAction: 'none', userSelect: 'none', webkitUserSelect: 'none' });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      waiting.push({
        x: ((e.clientX - r.left) / r.width) * width,
        y: ((e.clientY - r.top) / r.height) * height,
      });
    });
  },

  /** Called by the game loop before each update step. */
  beginFrame() {
    if (waiting.length) {
      current = waiting;
      waiting = [];
    }
  },

  /** Called by the game loop after each update step. */
  endFrame() {
    current = [];
  },
};
