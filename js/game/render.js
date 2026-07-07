// Renderer — reads world, never mutates. Neon-night alley: layered skyline
// silhouettes, sodium lamps, rain, wet-asphalt ground with reflections.
// Falls back to chunky colored shapes for any sprite not yet authored.
import { WORLD_W, WORLD_H } from '../engine/canvas.js';
import { GROUND_Y, ATTACKS, BESTIARY, KIT } from './world.js';
import { FX, drawFX } from '../engine/fx.js';
import { TAU } from '../engine/vec.js';

const SCALE = 3;

let BG = null;
function buildBG() {
  // two skyline silhouette bands, baked once
  const mk = (h, color, step, seedMul) => {
    const c = document.createElement('canvas');
    c.width = WORLD_W; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = color;
    let x = 0, i = 0;
    while (x < WORLD_W) {
      const bw = 40 + ((i * seedMul) % 70);
      const bh = h * 0.35 + ((i * 137 * seedMul) % (h * 0.6));
      g.fillRect(x, h - bh, bw, bh);
      // lit windows
      g.fillStyle = 'rgba(255,179,71,0.5)';
      for (let wy = h - bh + 8; wy < h - 10; wy += 14) {
        for (let wx = x + 5; wx < x + bw - 6; wx += 11) {
          if (((wx * 31 + wy * 17) % 7) < 2) g.fillRect(wx, wy, 4, 5);
        }
      }
      g.fillStyle = color;
      x += bw + 4 + ((i * 53) % 26);
      i++;
    }
    return c;
  };
  BG = {
    far: mk(300, '#232b3a', 50, 7),
    near: mk(360, '#1b1523', 60, 13),
  };
}

function drawSprite(ctx, frame, x, y, facing, scale = SCALE) {
  const img = facing < 0 ? frame.imgL : frame.img;
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h), w, h);
}

function pickFrame(frames, t, rate = 0.3) {
  return frames[Math.floor(t / rate) % frames.length];
}

// rain: deterministic streaks in screen space
function drawRain(ctx, view, w) {
  ctx.strokeStyle = 'rgba(159,196,232,0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const W = view.bgX1 - view.bgX0, H = view.bgY1 - view.bgY0;
  for (let i = 0; i < 46; i++) {
    const speed = 700 + (i * 53) % 300;
    const x = view.bgX0 + (((i * 211.7) - w.t * 60 - w.cam.x * 0.3) % W + W) % W;
    const y = view.bgY0 + (((i * 137.3) + w.t * speed) % H + H) % H;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 14);
  }
  ctx.stroke();
}

export function draw(view, w, S) {
  const ctx = view.ctx;
  if (!BG) buildBG();
  view.begin();
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  ctx.translate(FX.shakeX, FX.shakeY);

  // sky
  const grad = ctx.createLinearGradient(0, view.bgY0, 0, GROUND_Y);
  grad.addColorStop(0, '#12101f');
  grad.addColorStop(0.7, '#28203a');
  grad.addColorStop(1, '#3a2f45');
  ctx.fillStyle = grad;
  ctx.fillRect(view.bgX0, view.bgY0, view.bgX1 - view.bgX0, GROUND_Y - view.bgY0);
  // moon
  ctx.fillStyle = 'rgba(216,219,242,0.9)';
  ctx.beginPath(); ctx.arc(720, 90, 26, 0, TAU); ctx.fill();
  ctx.fillStyle = '#28203a';
  ctx.beginPath(); ctx.arc(730, 84, 22, 0, TAU); ctx.fill();

  // skyline parallax
  for (const [band, k, yy] of [[BG.far, 0.15, GROUND_Y - 290], [BG.near, 0.35, GROUND_Y - 250]]) {
    const xOff = -((w.cam.x * k) % WORLD_W);
    for (let r = -1; r <= 1; r++) ctx.drawImage(band, xOff + r * WORLD_W, yy);
  }

  // ================= world layer (camera x only) =================
  ctx.save();
  ctx.translate(-w.cam.x, 0);
  const vx0 = w.cam.x + view.bgX0, vx1 = w.cam.x + view.bgX1;

  // wet asphalt
  ctx.fillStyle = '#232b3a';
  ctx.fillRect(vx0, GROUND_Y, vx1 - vx0, view.bgY1 - GROUND_Y);
  ctx.fillStyle = 'rgba(159,196,232,0.07)';
  ctx.fillRect(vx0, GROUND_Y, vx1 - vx0, 3);
  // puddle glints
  for (let i = 0; i < 14; i++) {
    const px = ((i * 227) % Math.max(1, w.arena.w));
    if (px < vx0 - 60 || px > vx1 + 60) continue;
    ctx.fillStyle = `rgba(62,230,210,${0.05 + (i % 3) * 0.02})`;
    ctx.beginPath();
    ctx.ellipse(px, GROUND_Y + 26 + (i * 37) % 40, 34, 5, 0, 0, TAU);
    ctx.fill();
  }

  // props (lamps every ~400px cast pools of light)
  for (let lx = 200; lx < w.arena.w; lx += 420) {
    if (lx < vx0 - 100 || lx > vx1 + 100) continue;
    if (S.props && S.props.lamp) {
      const img = S.props.lamp;
      ctx.drawImage(img, lx - img.width * 1.5, GROUND_Y - img.height * 3, img.width * 3, img.height * 3);
    } else {
      ctx.fillStyle = '#4d4457';
      ctx.fillRect(lx - 3, GROUND_Y - 120, 6, 120);
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.arc(lx, GROUND_Y - 124, 8, 0, TAU); ctx.fill();
    }
    const pulse = 0.10 + Math.sin(w.t * 2 + lx) * 0.02;
    ctx.fillStyle = `rgba(255,179,71,${pulse})`;
    ctx.beginPath();
    ctx.moveTo(lx - 10, GROUND_Y - 118);
    ctx.lineTo(lx - 60, GROUND_Y + 4);
    ctx.lineTo(lx + 60, GROUND_Y + 4);
    ctx.lineTo(lx + 10, GROUND_Y - 118);
    ctx.closePath();
    ctx.fill();
  }

  // ---- foes ----
  for (const f of w.foes) {
    const B = BESTIARY[f.species];
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(f.x, GROUND_Y + 5, f.w * 0.55 * (1 - Math.min(0.5, (GROUND_Y - f.y) / 500)), 6, 0, 0, TAU);
    ctx.fill();

    const set = S[f.species];
    if (set) {
      let frame;
      if (f.state === 'tell') frame = set.tell ? set.tell[0] : set.idle[0];
      else if (f.state === 'attack') frame = set.lunge ? set.lunge[0] : (set.rush ? set.rush[0] : set.idle[0]);
      else if (f.state === 'down' || !f.onGround) frame = set.down ? set.down[0] : set.idle[0];
      else frame = pickFrame(set.idle, f.animT, 0.4);
      // tell flash: blink toward white at 6 Hz
      drawSprite(ctx, frame, f.x, f.y, f.facing);
      if (f.state === 'tell' && Math.floor(f.animT * 12) % 2 === 0) {
        ctx.globalAlpha = 0.5;
        drawSprite(ctx, { img: frame.white, imgL: frame.white }, f.x, f.y, f.facing);
        ctx.globalAlpha = 1;
      }
      if (f.hitFlash > 0) {
        ctx.globalAlpha = 0.85;
        drawSprite(ctx, { img: frame.white, imgL: frame.white }, f.x, f.y, f.facing);
        ctx.globalAlpha = 1;
      }
    } else {
      // fallback shape
      ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : (f.state === 'tell' && Math.floor(f.animT * 12) % 2 === 0 ? '#ffb347' : '#776a85');
      ctx.fillRect(f.x - f.w / 2, f.y - f.h, f.w, f.h);
    }

    // tell arc: where the hit will land
    if (f.state === 'tell') {
      ctx.strokeStyle = 'rgba(255,179,71,0.55)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      const reach = f.species === 'growler' ? 220 : 120;
      ctx.moveTo(f.x + f.facing * 20, GROUND_Y + 8);
      ctx.lineTo(f.x + f.facing * reach, GROUND_Y + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      // "!" over the head
      ctx.font = '900 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#1b1523';
      const by = f.y - f.h - 14 + Math.sin(f.animT * 18) * 2;
      ctx.strokeText('!', f.x, by);
      ctx.fillStyle = '#ffb347';
      ctx.fillText('!', f.x, by);
    }

    // hp bar (only when damaged)
    if (f.hp < f.maxHp) {
      const bw = 46;
      ctx.fillStyle = 'rgba(27,21,35,0.8)';
      ctx.fillRect(f.x - bw / 2 - 1, f.y - f.h - 10, bw + 2, 6);
      ctx.fillStyle = '#e05fd0';
      ctx.fillRect(f.x - bw / 2, f.y - f.h - 9, bw * Math.max(0, f.hp / f.maxHp), 4);
    }
  }

  // ---- player ----
  const p = w.player;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(p.x, GROUND_Y + 5, 20 * (1 - Math.min(0.5, (GROUND_Y - p.y) / 500)), 6, 0, 0, TAU);
  ctx.fill();

  const snig = S.snig;
  const blink = p.iframes > 0 && p.dashT <= 0 && Math.floor(p.iframes * 14) % 2 === 0;
  if (!blink) {
    if (snig) {
      let frame;
      if (p.atk) frame = snig[p.atk.def.anim] ? snig[p.atk.def.anim][p.atk.t > p.atk.def.startup ? Math.min(1, (snig[p.atk.def.anim].length - 1)) : 0] : snig.idle[0];
      else if (p.dashT > 0) frame = snig.run[0];
      else if (!p.onGround) frame = snig.air ? snig.air[0] : snig.idle[0];
      else if (p.state === 'run') frame = pickFrame(snig.run, p.animT, 0.14);
      else frame = pickFrame(snig.idle, p.animT, 0.45);
      drawSprite(ctx, frame, p.x, p.y, p.facing);
    } else {
      ctx.fillStyle = '#6fa3a8';
      ctx.fillRect(p.x - p.w / 2, p.y - p.h, p.w, p.h);
      ctx.fillStyle = '#e8b04a';
      ctx.fillRect(p.x + p.facing * 8, p.y - p.h - 6, 8, 8);
    }
  }

  // dash streak
  if (p.dashT > 0) {
    ctx.fillStyle = 'rgba(62,230,210,0.25)';
    for (let i = 1; i <= 3; i++) {
      ctx.fillRect(p.x - p.dashDir * i * 26 - p.w / 2, p.y - p.h + i * 3, p.w, p.h - i * 6);
    }
  }
  // umbrella guard bubble
  if (p.guardT > 0) {
    ctx.strokeStyle = 'rgba(159,196,232,0.9)';
    ctx.fillStyle = 'rgba(159,196,232,0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y - p.h / 2, 46, 0, TAU); ctx.fill(); ctx.stroke();
  }

  drawFX(ctx);
  ctx.restore(); // end camera

  // ================= screen-space =================
  drawRain(ctx, view, w);

  // arena tag
  ctx.font = '800 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(27,21,35,0.7)';
  const tagY = 22 - Math.min(0, view.bgY0 + 22);
  ctx.strokeText(w.arena.name, WORLD_W / 2, tagY);
  ctx.fillStyle = '#d8dbf2';
  ctx.fillText(w.arena.name, WORLD_W / 2, tagY);

  // combo counter
  if (p.combo >= 3) {
    ctx.font = '900 26px sans-serif';
    ctx.lineWidth = 5; ctx.strokeStyle = '#1b1523';
    ctx.strokeText(`${p.combo}×`, WORLD_W - 90, 70);
    ctx.fillStyle = p.combo >= 8 ? '#e05fd0' : '#3ee6d2';
    ctx.fillText(`${p.combo}×`, WORLD_W - 90, 70);
  }

  // slow-mo vignette on perfect dodge
  if (w.slowmoT > 0) {
    ctx.fillStyle = `rgba(62,230,210,${w.slowmoT * 0.18})`;
    ctx.fillRect(view.bgX0, view.bgY0, view.bgX1 - view.bgX0, view.bgY1 - view.bgY0);
  }

  ctx.restore(); // end shake

  if (FX.flash > 0) {
    ctx.fillStyle = `rgba(${FX.flashColor},${FX.flash})`;
    ctx.fillRect(view.bgX0, view.bgY0, view.bgX1 - view.bgX0, view.bgY1 - view.bgY0);
  }
}
