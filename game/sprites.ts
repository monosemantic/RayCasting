// Billboard sprites drawn into the same ImageData as the original renderer.
// Uses the same projection as renderWallsToImageData: a column x looks along
// r1.lerp(r2, x / SCREEN_WIDTH) and a 1-unit tall wall at perpendicular
// distance d is SCREEN_HEIGHT / d pixels tall, centered on the horizon.

interface Billboard {
  pos: Vector2;
  texture: ImageData;
  width: number; // world units
  height: number; // world units
  z: number; // bottom height above the floor (floor = 0, ceiling = 1)
  emissive: boolean; // ignores distance shading
  scaleX: number; // horizontal squash, used for spinning coins
  alpha: number; // global opacity
}

class SpriteRenderer {
  private depth = new Float32Array(SCREEN_WIDTH);
  private player: Player | null = null;
  private scene: Scene | null = null;
  private dir = Vector2.zero();
  private r1 = Vector2.zero();
  private r2 = Vector2.zero();

  // Perpendicular distance to the wall seen in column x. Rays are only cast
  // for the columns actually covered by a sprite, then cached for the frame.
  private depthAt(x: number): number {
    let d = this.depth[x]!;
    if (d < 0) {
      const player = this.player!;
      const scene = this.scene!;
      const p = castRay(scene, player.position, this.r1.lerp(this.r2, x / SCREEN_WIDTH));
      const cell = scene.getWall(hittingCell(player.position, p));
      d = cell !== null && cell !== undefined ? p.sub(player.position).dot(this.dir) : 1e9;
      this.depth[x] = d;
    }
    return d;
  }

  render(imageData: ImageData, player: Player, scene: Scene, sprites: Billboard[]) {
    this.player = player;
    this.scene = scene;
    this.dir = Vector2.fromAngle(player.direction);
    [this.r1, this.r2] = player.fovRange();
    this.depth.fill(-1);

    const right = this.dir.rot90();
    const visible: Array<{ sprite: Billboard; depth: number; lateral: number }> = [];
    for (const sprite of sprites) {
      const v = sprite.pos.sub(player.position);
      const depth = v.dot(this.dir);
      if (depth < NEAR_CLIPPING_PLANE * 2 || depth > FAR_CLIPPING_PLANE) continue;
      visible.push({ sprite, depth, lateral: v.dot(right) });
    }
    // Painter's order: far sprites first.
    visible.sort((a, b) => b.depth - a.depth);
    for (const item of visible) this.drawSprite(imageData, item.sprite, item.depth, item.lateral);
  }

  private drawSprite(imageData: ImageData, s: Billboard, depth: number, lateral: number) {
    const tanHalf = Math.tan(FOV * 0.5);
    const unitWidth = SCREEN_WIDTH / (2 * depth * tanHalf);
    const centerX = (0.5 + lateral / (2 * depth * tanHalf)) * SCREEN_WIDTH;
    const pw = s.width * Math.max(0.05, s.scaleX) * unitWidth;
    const ph = (s.height * SCREEN_HEIGHT) / depth;
    const bottom = SCREEN_HEIGHT * 0.5 + ((0.5 - s.z) * SCREEN_HEIGHT) / depth;
    const top = bottom - ph;
    const left = centerX - pw * 0.5;

    const x0 = Math.max(0, Math.floor(left));
    const x1 = Math.min(SCREEN_WIDTH, Math.ceil(left + pw));
    const y0 = Math.max(0, Math.floor(top));
    const y1 = Math.min(SCREEN_HEIGHT, Math.ceil(bottom));
    if (x0 >= x1 || y0 >= y1) return;

    const tex = s.texture;
    const tw = tex.width;
    const th = tex.height;
    const src = tex.data;
    const dst = imageData.data;
    // Same falloff as textured walls (2 / distance, capped at 1).
    const shade = s.emissive ? 1 : Math.min(1, 2 / depth);

    for (let x = x0; x < x1; ++x) {
      if (depth >= this.depthAt(x)) continue;
      const tx = Math.min(tw - 1, Math.max(0, Math.floor(((x - left) / pw) * tw)));
      for (let y = y0; y < y1; ++y) {
        const ty = Math.min(th - 1, Math.max(0, Math.floor(((y - top) / ph) * th)));
        const si = (ty * tw + tx) * 4;
        const a = (src[si + 3]! / 255) * s.alpha;
        if (a < 0.03) continue;
        const di = (y * SCREEN_WIDTH + x) * 4;
        dst[di + 0] = dst[di + 0]! * (1 - a) + src[si + 0]! * shade * a;
        dst[di + 1] = dst[di + 1]! * (1 - a) + src[si + 1]! * shade * a;
        dst[di + 2] = dst[di + 2]! * (1 - a) + src[si + 2]! * shade * a;
      }
    }
  }
}

// --- Sprite textures --------------------------------------------------------

// The original sprite assets (barrel, pillar, greenlight) use black as the
// transparent color: make that explicit with the alpha channel.
function keyOutBlack(source: ImageData): ImageData {
  const out = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i]! + out.data[i + 1]! + out.data[i + 2]! < 24) out.data[i + 3] = 0;
  }
  return out;
}

function paintTexture(w: number, h: number, paint: (ctx: OffscreenCanvasRenderingContext2D) => void): ImageData {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("2D context is not supported");
  paint(ctx);
  return ctx.getImageData(0, 0, w, h);
}

function makeCoinTexture(): ImageData {
  return paintTexture(32, 32, (ctx) => {
    const g = ctx.createRadialGradient(12, 11, 2, 16, 16, 15);
    g.addColorStop(0, "#fff6c2");
    g.addColorStop(0.45, "#f5c542");
    g.addColorStop(1, "#a86f12");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(16, 16, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a5a0c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 16, 10.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#8a5a0c";
    ctx.font = "bold 13px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("R", 16, 17);
  });
}

function makeGuardianTexture(): ImageData {
  return paintTexture(64, 64, (ctx) => {
    const aura = ctx.createRadialGradient(32, 30, 6, 32, 32, 32);
    aura.addColorStop(0, "rgba(255,80,120,0.55)");
    aura.addColorStop(1, "rgba(255,40,90,0)");
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, 64, 64);
    // Hooded spectre body with a wavy hem.
    const body = ctx.createLinearGradient(0, 8, 0, 60);
    body.addColorStop(0, "#3b1030");
    body.addColorStop(1, "rgba(90,20,60,0.75)");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(14, 60);
    ctx.lineTo(14, 28);
    ctx.quadraticCurveTo(14, 8, 32, 8);
    ctx.quadraticCurveTo(50, 8, 50, 28);
    ctx.lineTo(50, 60);
    for (let i = 0; i < 4; ++i) {
      const x = 50 - i * 9;
      ctx.quadraticCurveTo(x - 2, 52, x - 4.5, 56);
      ctx.quadraticCurveTo(x - 7, 61, x - 9, 56);
    }
    ctx.closePath();
    ctx.fill();
    // Glowing eyes.
    for (const ex of [25, 39]) {
      const eye = ctx.createRadialGradient(ex, 26, 0, ex, 26, 6);
      eye.addColorStop(0, "#ffffff");
      eye.addColorStop(0.35, "#ff4d6d");
      eye.addColorStop(1, "rgba(255,77,109,0)");
      ctx.fillStyle = eye;
      ctx.beginPath();
      ctx.arc(ex, 26, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function makePortalTexture(open: boolean): ImageData {
  const [inner, outer] = open ? ["#c8ffd8", "#22b35a"] : ["#ffd0d0", "#b32222"];
  return paintTexture(48, 64, (ctx) => {
    const g = ctx.createRadialGradient(24, 32, 2, 24, 32, 26);
    g.addColorStop(0, inner);
    g.addColorStop(0.5, outer + "cc");
    g.addColorStop(1, outer + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(24, 32, 22, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = inner;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; ++i) {
      ctx.globalAlpha = 0.7 - i * 0.2;
      ctx.beginPath();
      ctx.ellipse(24, 32, 18 - i * 5, 27 - i * 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}
