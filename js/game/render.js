// Renderer — reads world, never mutates. Neon-night alley: layered skyline
// silhouettes, sodium lamps, rain, wet-asphalt ground with reflections.
// Falls back to chunky colored shapes for any sprite not yet authored.
import { WORLD_W, WORLD_H } from '../engine/canvas.js';
import { GROUND_Y, ATTACKS, BESTIARY, KIT } from './world.js';
import { FORMS } from '../data/forms.js';
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

  // ---- move fields: snares, caltrops, vortices ----
  const ZONE_COL = { snare: '232,200,74', caltrops: '217,108,58', vortex: '61,106,148', rubble: '119,106,133' };
  for (const z of w.zones) {
    const col = ZONE_COL[z.type] || '150,150,150';
    const a = Math.min(0.5, z.t * 0.5);
    ctx.fillStyle = `rgba(${col},${a * 0.35})`;
    ctx.beginPath(); ctx.ellipse(z.x, GROUND_Y + 2, z.r, 12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${a})`;
    ctx.lineWidth = 2;
    if (z.type === 'snare') {
      for (let i = 0; i < 5; i++) {
        const zx = z.x + Math.sin(w.t * 9 + i * 2.3) * z.r * 0.7;
        ctx.beginPath(); ctx.moveTo(zx, GROUND_Y); ctx.lineTo(zx + 5, GROUND_Y - 10 - (i % 3) * 4); ctx.stroke();
      }
    } else if (z.type === 'caltrops') {
      ctx.fillStyle = `rgba(${col},${a})`;
      for (let i = 0; i < 7; i++) {
        const zx = z.x - z.r * 0.8 + (i / 6) * z.r * 1.6;
        ctx.beginPath(); ctx.moveTo(zx - 4, GROUND_Y); ctx.lineTo(zx, GROUND_Y - 9); ctx.lineTo(zx + 4, GROUND_Y); ctx.fill();
      }
    } else if (z.type === 'vortex') {
      ctx.beginPath(); ctx.ellipse(z.x, GROUND_Y - 6, z.r * 0.5 + Math.sin(w.t * 6) * 8, 10, 0, 0, TAU); ctx.stroke();
    }
  }
  // glass wards
  for (const pane of w.panes) {
    ctx.fillStyle = `rgba(159,196,232,${Math.min(0.3, pane.t * 0.3)})`;
    ctx.fillRect(pane.x - pane.w / 2, GROUND_Y - 90, pane.w, 90);
    ctx.strokeStyle = 'rgba(216,219,242,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pane.x - pane.w / 2, GROUND_Y - 90, pane.w, 90);
  }
  // litter decoy
  if (w.decoy) {
    ctx.fillStyle = '#4a5d3a';
    ctx.beginPath(); ctx.ellipse(w.decoy.x, GROUND_Y - 12, 16, 14, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1b1523'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#b9d48b';
    ctx.fillRect(w.decoy.x - 3, GROUND_Y - 30, 6, 6);
  }

  // ---- sabotage pylons ----
  for (const py of w.pylons) {
    if (py.hp <= 0) {
      // rubble
      ctx.fillStyle = '#3a2f45';
      ctx.fillRect(py.x - 20, GROUND_Y - 16, 40, 16);
      continue;
    }
    ctx.fillStyle = '#4d4457';
    ctx.fillRect(py.x - 12, GROUND_Y - 70, 24, 70);
    ctx.fillStyle = '#1b1523';
    ctx.fillRect(py.x - 15, GROUND_Y - 76, 30, 10);
    const hum = 0.5 + Math.sin(w.t * 6) * 0.3;
    ctx.fillStyle = `rgba(224,95,208,${hum})`;
    ctx.fillRect(py.x - 6, GROUND_Y - 64, 12, 12);
    ctx.strokeStyle = `rgba(224,95,208,${hum * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(py.x, GROUND_Y - 58, 20 + Math.sin(w.t * 3) * 4, 0, TAU); ctx.stroke();
    // hp pips
    ctx.fillStyle = 'rgba(27,21,35,0.8)';
    ctx.fillRect(py.x - 22, GROUND_Y - 92, 44, 6);
    ctx.fillStyle = '#e05fd0';
    ctx.fillRect(py.x - 21, GROUND_Y - 91, 42 * Math.max(0, py.hp / py.maxHp), 4);
  }

  // ---- heal cans ----
  for (const pk of w.pickups) {
    const bob = Math.sin(w.t * 4 + pk.x) * 3;
    ctx.fillStyle = '#e8b04a';
    ctx.fillRect(pk.x - 6, GROUND_Y - 16 + bob, 12, 14);
    ctx.fillStyle = '#f2ead9';
    ctx.fillRect(pk.x - 6, GROUND_Y - 16 + bob, 12, 4);
  }

  // ---- cages (rescue) ----
  for (const c of w.cages) {
    ctx.fillStyle = c.opened ? '#3a2f45' : '#4d4457';
    ctx.fillRect(c.x - 26, GROUND_Y - 56, 52, 56);
    ctx.strokeStyle = '#1b1523'; ctx.lineWidth = 3;
    for (let bx = c.x - 20; bx <= c.x + 20; bx += 10) {
      ctx.beginPath(); ctx.moveTo(bx, GROUND_Y - 54); ctx.lineTo(bx, GROUND_Y - (c.opened ? 30 : 2)); ctx.stroke();
    }
    if (!c.opened) {
      // eyes inside
      ctx.fillStyle = '#3ee6d2';
      ctx.fillRect(c.x - 8, GROUND_Y - 34, 4, 4);
      ctx.fillRect(c.x + 5, GROUND_Y - 34, 4, 4);
      // lock progress when being picked
      if (c.lockT < 6) {
        ctx.fillStyle = 'rgba(27,21,35,0.8)';
        ctx.fillRect(c.x - 24, GROUND_Y - 70, 48, 7);
        ctx.fillStyle = '#3ee6d2';
        ctx.fillRect(c.x - 23, GROUND_Y - 69, 46 * (1 - c.lockT / 6), 5);
      }
    }
  }

  // ---- the escorted friend ----
  if (w.friend) {
    const fr = w.friend;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(fr.x, GROUND_Y + 4, 14, 5, 0, 0, TAU); ctx.fill();
    const hop = Math.abs(Math.sin(w.t * 6)) * 5;
    ctx.fillStyle = '#7c9a5a';
    ctx.beginPath(); ctx.ellipse(fr.x, GROUND_Y - 12 - hop, 12, 11, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1b1523'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fr.x + 3, GROUND_Y - 17 - hop, 3, 3);
    if (fr.hp < fr.maxHp) {
      ctx.fillStyle = 'rgba(27,21,35,0.8)';
      ctx.fillRect(fr.x - 16, GROUND_Y - 40, 32, 5);
      ctx.fillStyle = '#7ef2e2';
      ctx.fillRect(fr.x - 15, GROUND_Y - 39, 30 * Math.max(0, fr.hp / fr.maxHp), 3);
    }
  }

  // ---- the trainer at the arena edge ----
  const figure = (tx, isKeeper) => {
    ctx.fillStyle = '#1b1523';
    ctx.fillRect(tx - 30, GROUND_Y - 26, 60, 26); // crate podium
    ctx.fillStyle = isKeeper ? '#d8dbf2' : '#3a2f45';
    // long coat silhouette
    ctx.beginPath();
    ctx.moveTo(tx - 12, GROUND_Y - 26);
    ctx.lineTo(tx - 9, GROUND_Y - 74);
    ctx.lineTo(tx + 9, GROUND_Y - 74);
    ctx.lineTo(tx + 12, GROUND_Y - 26);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(tx, GROUND_Y - 82, 8, 0, TAU); ctx.fill(); // head
    // gloves
    ctx.fillStyle = isKeeper ? '#e05fd0' : '#776a85';
    ctx.fillRect(tx - 14, GROUND_Y - 58, 5, 5);
    ctx.fillRect(tx + 9, GROUND_Y - 58, 5, 5);
  };
  if (w.trainer && w.trainer.fledT <= 0) figure(w.trainer.x, false);
  if (w.keeper && w.keeper.phase === 2) figure(1140, true);

  // ---- enemy & gadget projectiles ----
  for (const e of w.eshots) {
    if (e.type === 'spit') {
      ctx.fillStyle = '#7c9a5a';
      ctx.beginPath(); ctx.arc(e.x, e.y, 7, 0, TAU); ctx.fill();
    } else if (e.type === 'net') {
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
      ctx.strokeRect(e.x - 9, e.y - 9, 18, 18);
      ctx.beginPath(); ctx.moveTo(e.x - 9, e.y - 9); ctx.lineTo(e.x + 9, e.y + 9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.x + 9, e.y - 9); ctx.lineTo(e.x - 9, e.y + 9); ctx.stroke();
    } else if (e.type === 'potion') {
      ctx.fillStyle = '#e05fd0';
      ctx.fillRect(e.x - 5, e.y - 8, 10, 12);
      ctx.fillStyle = '#f2ead9';
      ctx.fillRect(e.x - 3, e.y - 12, 6, 5);
    } else if (e.type === 'ball') {
      const spin = w.t * 12;
      ctx.fillStyle = '#f2ead9';
      ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a8323e';
      ctx.beginPath(); ctx.arc(e.x, e.y, 9, spin, spin + Math.PI); ctx.fill();
      ctx.strokeStyle = '#1b1523'; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  // ---- foes ----
  for (const f of w.foes) {
    const B = BESTIARY[f.species];
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(f.x, GROUND_Y + 5, f.w * 0.55 * (1 - Math.min(0.5, (GROUND_Y - f.y) / 500)), 6, 0, 0, TAU);
    ctx.fill();

    const set = S[BESTIARY[f.species]?.sprite || f.species];
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

    // status pips
    if (f.asleepT > 0) {
      ctx.font = '700 14px sans-serif';
      ctx.fillStyle = '#d8dbf2';
      ctx.fillText('z', f.x + 12, f.y - f.h - 8 + Math.sin(w.t * 3) * 3);
      ctx.fillText('Z', f.x + 20, f.y - f.h - 16 + Math.sin(w.t * 3 + 1) * 3);
    }
    if (f.paralyzedT > 0) {
      ctx.fillStyle = '#e8c84a';
      ctx.fillRect(f.x - 10 + Math.sin(w.t * 20) * 6, f.y - f.h - 6, 4, 4);
    }
    if (f.burr) {
      ctx.fillStyle = '#7c9a5a';
      ctx.beginPath(); ctx.arc(f.x - f.w / 2 + 4, f.y - f.h + 6, 4, 0, TAU); ctx.fill();
    }
    if (f.ariaT > 0) {
      ctx.font = '700 13px sans-serif';
      ctx.fillStyle = f.ariaTag ? '#e05fd0' : '#8d93c8';
      ctx.fillText('♪', f.x - 14, f.y - f.h - 10);
    }

    // poise (armor) bar
    if (f.maxPoise > 0 && f.poise > 0) {
      const bw = 40;
      ctx.fillStyle = 'rgba(27,21,35,0.8)';
      ctx.fillRect(f.x - bw / 2 - 1, f.y - f.h - 18, bw + 2, 5);
      ctx.fillStyle = '#d8dbf2';
      ctx.fillRect(f.x - bw / 2, f.y - f.h - 17, bw * (f.poise / f.maxPoise), 3);
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

  const FDEF = FORMS[p.form] || FORMS.snig;
  const snig = S[FDEF.sprite] || S[p.species] || S.snig;
  // attunement glow
  if (w.attuned) {
    const EC = { static: '232,200,74', rain: '61,106,148', rust: '217,108,58', moon: '141,147,200' };
    const col = EC[FDEF.essence] || '62,230,210';
    ctx.fillStyle = `rgba(${col},${0.12 + Math.sin(w.t * 4) * 0.05})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y - p.h / 2, 40, 50, 0, 0, TAU); ctx.fill();
  }
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

  // trainer banner + remaining-team pips
  if (w.trainer && w.trainer.fledT <= 0) {
    const tr = w.trainer;
    ctx.font = '800 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(27,21,35,0.8)';
    ctx.strokeText(tr.def.name, WORLD_W / 2, 46);
    ctx.fillStyle = '#e05fd0';
    ctx.fillText(tr.def.name, WORLD_W / 2, 46);
    for (let i = 0; i < tr.row.length; i++) {
      ctx.fillStyle = i < tr.idx ? 'rgba(216,219,242,0.25)' : '#e05fd0';
      ctx.beginPath(); ctx.arc(WORLD_W / 2 - (tr.row.length - 1) * 9 + i * 18, 60, 5, 0, TAU); ctx.fill();
    }
  }
  // struggle prompt
  if (w.player.struggleNeed > 0) {
    ctx.fillStyle = 'rgba(27,21,35,0.55)';
    ctx.fillRect(view.bgX0, view.bgY0, view.bgX1 - view.bgX0, view.bgY1 - view.bgY0);
    ctx.font = '900 34px sans-serif';
    ctx.textAlign = 'center';
    const pump = 1 + Math.sin(w.t * 16) * 0.08;
    ctx.save();
    ctx.translate(WORLD_W / 2, 240);
    ctx.scale(pump, pump);
    ctx.lineWidth = 6; ctx.strokeStyle = '#1b1523';
    ctx.strokeText('MASH!', 0, 0);
    ctx.fillStyle = '#e05fd0';
    ctx.fillText('MASH!', 0, 0);
    ctx.restore();
    for (let i = 0; i < w.player.struggleNeed; i++) {
      ctx.fillStyle = '#e05fd0';
      ctx.beginPath(); ctx.arc(WORLD_W / 2 - (w.player.struggleNeed - 1) * 10 + i * 20, 270, 6, 0, TAU); ctx.fill();
    }
  }
  // the Keeper's beat: the world holds its breath
  if (w.keeper && w.keeper.beatT > 0) {
    ctx.fillStyle = `rgba(18,16,31,${0.3 + Math.sin(w.t * 2) * 0.05})`;
    ctx.fillRect(view.bgX0, view.bgY0, view.bgX1 - view.bgX0, view.bgY1 - view.bgY0);
  }

  // boss bar
  if (w.boss && w.boss.boss) {
    const b = w.boss;
    ctx.font = '800 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(27,21,35,0.8)';
    ctx.strokeText(b.boss.name, WORLD_W / 2, 46);
    ctx.fillStyle = '#e05fd0';
    ctx.fillText(b.boss.name, WORLD_W / 2, 46);
    const bw = 360;
    ctx.fillStyle = 'rgba(27,21,35,0.85)';
    ctx.fillRect(WORLD_W / 2 - bw / 2 - 2, 54, bw + 4, 12);
    ctx.fillStyle = '#e05fd0';
    ctx.fillRect(WORLD_W / 2 - bw / 2, 56, bw * Math.max(0, b.hp / b.maxHp), 8);
  }

  // mission objective line
  if (w.mission && !w.mission.done) {
    const def = w.mission.def;
    ctx.font = '700 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(27,21,35,0.7)';
    const line = def.type === 'sabotage'
      ? `pylons: ${w.pylons.filter(py => py.hp > 0).length} standing`
      : `wave ${Math.min(w.mission.wave + 1, def.waves.length)}/${def.waves.length}`;
    ctx.strokeText(line, WORLD_W / 2, 40);
    ctx.fillStyle = 'rgba(216,219,242,0.85)';
    ctx.fillText(line, WORLD_W / 2, 40);
  }

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
