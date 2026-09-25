// ---- World: builds the tile grid from MAP data and answers spatial queries ---
const SOLID_CHARS = new Set(['#', 'I', 'D', '%']);
const ENTITY_CHARS = new Set(['P', 'B', 'H', '1', '2', '3', '4', 'S', '*', 'e', 'f', 's', 'c', 'g', 'a', 'r', 'j', 'k', 'X', 'Y', 'Z', 'L', 'N', 'W', 'Q', 'K', 'T', '+', 'h']);

class World {
  constructor(map) {
    this.map = map; this.w = map.width; this.h = map.height;
    this.tiles = new Uint8Array(this.w * this.h);
    this.entities = []; // {type, tx, ty, room, idx}
    this.closedGates = new Set();
    this.brokenWalls = [];
    this.build();
  }
  build() {
    const grid = []; for (let y = 0; y < this.h; y++) grid.push(new Array(this.w).fill('#'));
    for (const room of this.map.rooms) {
      const width = room.rows[0].length;
      room.rows.forEach((row, j) => {
        if (row.length !== width) throw new Error(`Room ${room.name} row ${j} has length ${row.length}, expected ${width}`);
        for (let i = 0; i < row.length; i++) {
          const ch = row[i]; if (ch === ' ') continue;
          const x = room.x + i, y = room.y + j;
          if (x < 0 || y < 0 || x >= this.w || y >= this.h) throw new Error(`Room ${room.name} out of bounds at ${x},${y}`);
          grid[y][x] = ch;
        }
      });
    }
    for (const r of (this.map.rects || [])) {
      const [x, y, w, h, ch] = r;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (y + j >= 0 && y + j < this.h && x + i >= 0 && x + i < this.w) grid[y + j][x + i] = ch || '.';
    }
    // Extract entities, keep a lore counter per room to bind text
    const loreByRoom = {};
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const ch = grid[y][x];
      if (ch === 'G') this.entities.push({ type: 'G', tx: x, ty: y, id: `G_${x}_${y}`, room: null }); // gate tiles stay tiles, but are also listed
      if (ENTITY_CHARS.has(ch)) {
        const room = this.roomAt(x, y);
        const ent = { type: ch, tx: x, ty: y, id: `${ch}_${x}_${y}`, room: room ? room.name : null };
        if (ch === 'L' && room) { const k = room.name; loreByRoom[k] = (loreByRoom[k] || 0); ent.text = (room.lore || [])[loreByRoom[k]] || '...'; loreByRoom[k]++; }
        this.entities.push(ent);
        grid[y][x] = '.';
      }
      this.tiles[y * this.w + x] = grid[y][x].charCodeAt(0);
    }
    // world border is always solid
    for (let x = 0; x < this.w; x++) { this.set(x, 0, '#'); this.set(x, this.h - 1, '#'); }
    for (let y = 0; y < this.h; y++) { this.set(0, y, '#'); this.set(this.w - 1, y, '#'); }
  }
  roomAt(x, y) {
    for (let i = this.map.rooms.length - 1; i >= 0; i--) {
      const r = this.map.rooms[i];
      if (x >= r.x && y >= r.y && x < r.x + r.rows[0].length && y < r.y + r.rows.length && r.rows[y - r.y][x - r.x] !== ' ') return r;
    }
    return null;
  }
  set(x, y, ch) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = ch.charCodeAt(0); }
  tile(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '#'; return String.fromCharCode(this.tiles[y * this.w + x]); }
  isSolid(x, y) { const c = this.tile(x, y); return SOLID_CHARS.has(c) || (c === 'G' && this.closedGates.has(x + ',' + y)); }
  isClingable(x, y) { const c = this.tile(x, y); return c === '#' || c === 'D' || (c === 'G' && this.closedGates.has(x + ',' + y)); }
  isBouncer(x, y) { return this.tile(x, y) === '%'; }
  closeGatesNear(rect) { for (const e of this.entities) if (e.type === 'G' && e.tx >= rect[0] - 2 && e.ty >= rect[1] - 2 && e.tx < rect[0] + rect[2] + 2 && e.ty < rect[1] + rect[3] + 2) this.closedGates.add(e.tx + ',' + e.ty); }
  openGates() { this.closedGates.clear(); }
  isOneWay(x, y) { return this.tile(x, y) === '='; }
  isHazard(x, y) { const c = this.tile(x, y); return c === '^' || c === '~'; }
  isSpike(x, y) { return this.tile(x, y) === '^'; }
  isVoid(x, y) { return this.tile(x, y) === '~'; }
  // Rect (px) overlaps any solid tile?
  rectSolid(x, y, w, h) {
    const x0 = Math.floor(x / TILE), y0 = Math.floor(y / TILE), x1 = Math.floor((x + w - 0.001) / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.isSolid(tx, ty)) return true;
    return false;
  }
  rectHas(x, y, w, h, pred) {
    const x0 = Math.floor(x / TILE), y0 = Math.floor(y / TILE), x1 = Math.floor((x + w - 0.001) / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (pred(tx, ty)) return true;
    return false;
  }
  areaAt(tx, ty) {
    for (const a of this.map.areas) for (const r of a.rects) if (tx >= r[0] && ty >= r[1] && tx < r[0] + r[2] && ty < r[1] + r[3]) return a.id;
    return this.map.areas[0].id;
  }
  areaInfo(id) { return this.map.areas.find((a) => a.id === id) || this.map.areas[0]; }
  inRect(tx, ty, r) { return tx >= r[0] && ty >= r[1] && tx < r[0] + r[2] && ty < r[1] + r[3]; }
  // Break a connected cluster of dash walls starting at a tile. Returns list of broken tiles.
  breakWall(tx, ty) {
    const out = []; const stack = [[tx, ty]]; const seen = new Set();
    while (stack.length) {
      const [x, y] = stack.pop(); const k = x + ',' + y; if (seen.has(k)) continue; seen.add(k);
      if (this.tile(x, y) !== 'D') continue;
      this.set(x, y, '.'); out.push([x, y]); this.brokenWalls.push([x, y]);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return out;
  }
  applyBroken(list) { for (const [x, y] of list) if (this.tile(x, y) === 'D') { this.set(x, y, '.'); this.brokenWalls.push([x, y]); } }
  findEntity(type) { return this.entities.find((e) => e.type === type); }
  entitiesOf(type) { return this.entities.filter((e) => e.type === type); }
}
