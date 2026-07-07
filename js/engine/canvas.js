// DPR-aware LANDSCAPE canvas (OFF-LEASH is a side-view brawler).
// Fixed virtual world (WORLD_W x WORLD_H), letterboxed/scaled to fill the screen.
// All gameplay is in world coordinates; we map pointer -> world.
export const WORLD_W = 960;
export const WORLD_H = 540;

export class CanvasView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.scale = 1;
    this.offX = 0;
    this.offY = 0;
    this.cssW = 0;
    this.cssH = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    this.cssW = cssW; this.cssH = cssH;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';

    // contain-fit the world so the whole arena is always visible; letterbox
    // margins are painted by the rainy-skyline background so it reads full-bleed
    const sx = cssW / WORLD_W;
    const sy = cssH / WORLD_H;
    this.scale = Math.min(sx, sy);
    this.offX = (cssW - WORLD_W * this.scale) / 2;
    this.offY = (cssH - WORLD_H * this.scale) / 2;
    this.dpr = dpr;
    // letterbox margins in world units (negative -> beyond the world rect)
    this.bgX0 = -this.offX / this.scale;
    this.bgY0 = -this.offY / this.scale;
    this.bgX1 = WORLD_W - this.bgX0;
    this.bgY1 = WORLD_H - this.bgY0;
  }

  begin() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.offX, this.dpr * this.offY);
  }

  toWorld(clientX, clientY) {
    return {
      x: (clientX - this.offX) / this.scale,
      y: (clientY - this.offY) / this.scale,
    };
  }
}
