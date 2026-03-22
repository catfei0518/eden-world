(() => {
  // node_modules/simplex-noise/dist/esm/simplex-noise.js
  var SQRT3 = /* @__PURE__ */ Math.sqrt(3);
  var SQRT5 = /* @__PURE__ */ Math.sqrt(5);
  var F2 = 0.5 * (SQRT3 - 1);
  var G2 = (3 - SQRT3) / 6;
  var F3 = 1 / 3;
  var G3 = 1 / 6;
  var F4 = (SQRT5 - 1) / 4;
  var G4 = (5 - SQRT5) / 20;
  var fastFloor = (x) => Math.floor(x) | 0;
  var grad2 = /* @__PURE__ */ new Float64Array([
    1,
    1,
    -1,
    1,
    1,
    -1,
    -1,
    -1,
    1,
    0,
    -1,
    0,
    1,
    0,
    -1,
    0,
    0,
    1,
    0,
    -1,
    0,
    1,
    0,
    -1
  ]);
  function createNoise2D(random = Math.random) {
    const perm = buildPermutationTable(random);
    const permGrad2x = new Float64Array(perm).map((v) => grad2[v % 12 * 2]);
    const permGrad2y = new Float64Array(perm).map((v) => grad2[v % 12 * 2 + 1]);
    return function noise2D(x, y) {
      let n0 = 0;
      let n1 = 0;
      let n2 = 0;
      const s = (x + y) * F2;
      const i = fastFloor(x + s);
      const j = fastFloor(y + s);
      const t = (i + j) * G2;
      const X0 = i - t;
      const Y0 = j - t;
      const x0 = x - X0;
      const y0 = y - Y0;
      let i1, j1;
      if (x0 > y0) {
        i1 = 1;
        j1 = 0;
      } else {
        i1 = 0;
        j1 = 1;
      }
      const x1 = x0 - i1 + G2;
      const y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2;
      const y2 = y0 - 1 + 2 * G2;
      const ii = i & 255;
      const jj = j & 255;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 >= 0) {
        const gi0 = ii + perm[jj];
        const g0x = permGrad2x[gi0];
        const g0y = permGrad2y[gi0];
        t0 *= t0;
        n0 = t0 * t0 * (g0x * x0 + g0y * y0);
      }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 >= 0) {
        const gi1 = ii + i1 + perm[jj + j1];
        const g1x = permGrad2x[gi1];
        const g1y = permGrad2y[gi1];
        t1 *= t1;
        n1 = t1 * t1 * (g1x * x1 + g1y * y1);
      }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 >= 0) {
        const gi2 = ii + 1 + perm[jj + 1];
        const g2x = permGrad2x[gi2];
        const g2y = permGrad2y[gi2];
        t2 *= t2;
        n2 = t2 * t2 * (g2x * x2 + g2y * y2);
      }
      return 70 * (n0 + n1 + n2);
    };
  }
  function buildPermutationTable(random) {
    const tableSize = 512;
    const p = new Uint8Array(tableSize);
    for (let i = 0; i < tableSize / 2; i++) {
      p[i] = i;
    }
    for (let i = 0; i < tableSize / 2 - 1; i++) {
      const r = i + ~~(random() * (256 - i));
      const aux = p[i];
      p[i] = p[r];
      p[r] = aux;
    }
    for (let i = 256; i < tableSize; i++) {
      p[i] = p[i - 256];
    }
    return p;
  }

  // src/world/MapGenerator.ts
  var GameMap = class {
    constructor(width = 100, height = 50, seed = Date.now()) {
      this.tiles = [];
      this.riverTiles = /* @__PURE__ */ new Set();
      this.width = width;
      this.height = height;
      const simpleRng = () => {
        seed = seed * 1103515245 + 12345 & 2147483647;
        return seed / 2147483647;
      };
      this.noise2D = createNoise2D(simpleRng);
    }
    fbm(x, y, octaves, freq, persist) {
      let value = 0;
      let amp = 1;
      let maxVal = 0;
      for (let i = 0; i < octaves; i++) {
        value += amp * this.noise2D(x * freq, y * freq);
        maxVal += amp;
        amp *= persist;
        freq *= 2;
      }
      return (value / maxVal + 1) / 2;
    }
    generate() {
      this.tiles = [];
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      this.generateRivers(centerX, centerY);
      const oceanSides = this.selectOceanSides();
      for (let y = 0; y < this.height; y++) {
        const row = [];
        for (let x = 0; x < this.width; x++) {
          const baseNoise = this.fbm(x * 0.04, y * 0.04, 4, 1, 0.5);
          const detailNoise = this.fbm(x * 0.1, y * 0.1, 2, 1, 0.5);
          let height = baseNoise * 0.7 + detailNoise * 0.3;
          const moisture = this.fbm(x * 0.03 + 500, y * 0.03, 3, 1, 0.5);
          const temperature = this.fbm(x * 0.02 + 1e3, y * 0.02, 2, 1, 0.5);
          const leftDist = x;
          const rightDist = this.width - 1 - x;
          const topDist = y;
          const bottomDist = this.height - 1 - y;
          let isOcean = false;
          const maxOceanDepth = 15;
          for (const side of oceanSides) {
            let dist = 0;
            if (side === "left") dist = leftDist;
            if (side === "right") dist = rightDist;
            if (side === "top") dist = topDist;
            if (side === "bottom") dist = bottomDist;
            const edgeNoise = this.fbm(x * 0.2, y * 0.2, 2, 2, 0.5);
            const oceanLimit = maxOceanDepth + edgeNoise * 5;
            if (dist < oceanLimit) {
              isOcean = true;
            }
          }
          if (isOcean) {
            height = 0.1;
          }
          const type = this.getTileType(height, moisture, temperature, x, y);
          row.push({ type, height, moisture, temperature });
        }
        this.tiles.push(row);
      }
      this.addBeachBorder();
    }
    // 随机选择相邻的两边
    selectOceanSides() {
      const adjacentPairs = [
        ["left", "top"],
        ["left", "bottom"],
        ["right", "top"],
        ["right", "bottom"],
        ["top", "bottom"],
        // 上下也是相邻的
        ["left", "right"]
        // 左右也是相邻的（形成左海+右海）
      ];
      const index = Math.floor(this.fbm(Date.now(), 0, 1, 1, 1) * adjacentPairs.length);
      return adjacentPairs[index % adjacentPairs.length];
    }
    generateRivers(cx, cy) {
      const numRivers = 2;
      for (let i = 0; i < numRivers; i++) {
        let x = cx;
        let y = cy;
        const dir = i === 0 ? 1 : -1;
        for (let step = 0; step < 50; step++) {
          this.riverTiles.add(`${Math.floor(x)},${Math.floor(y)}`);
          const noiseVal = this.noise2D(x * 0.2, y * 0.2);
          if (noiseVal > 0.2) {
            x += dir * 0.7;
            y += 0.6;
          } else if (noiseVal < -0.2) {
            x -= dir * 0.3;
            y += 0.8;
          } else {
            y += 1;
          }
          if (x < 10 || x > this.width - 10 || y > this.height - 10) {
            break;
          }
        }
      }
    }
    addBeachBorder() {
      for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
          const tile = this.tiles[y][x];
          if (tile.type === "ocean" /* OCEAN */) {
            const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
            for (const [nx, ny] of neighbors) {
              if (this.tiles[ny][nx].type !== "ocean" /* OCEAN */) {
                this.tiles[ny][nx].type = "beach" /* BEACH */;
              }
            }
          }
        }
      }
    }
    getTileType(h, m, t, x, y) {
      if (this.riverTiles.has(`${x},${y}`)) {
        return "river" /* RIVER */;
      }
      if (h < 0.2) {
        return "ocean" /* OCEAN */;
      }
      if (h < 0.3) {
        return "lake" /* LAKE */;
      }
      if (h > 0.78) {
        return "mountain" /* MOUNTAIN */;
      }
      if (h > 0.65) {
        return "hill" /* HILL */;
      }
      if (t > 0.75 && m < 0.3) {
        return "desert" /* DESERT */;
      }
      if (m > 0.6 && t > 0.25 && t < 0.7) {
        return "forest" /* FOREST */;
      }
      if (h < 0.35 && m > 0.7) {
        return "swamp" /* SWAMP */;
      }
      if (m > 0.4) {
        return "grass" /* GRASS */;
      }
      return "plain" /* PLAIN */;
    }
    getTile(x, y) {
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
      return this.tiles[y][x];
    }
    getSize() {
      return { width: this.width, height: this.height };
    }
    printASCII() {
      const chars = {
        ocean: "~",
        lake: "~",
        swamp: "%",
        plain: ".",
        grass: ",",
        desert: "*",
        forest: "T",
        mountain: "^",
        hill: "n",
        cave: "o",
        river: "=",
        beach: "|"
      };
      let out = "";
      for (let y = 0; y < Math.min(50, this.height); y++) {
        for (let x = 0; x < Math.min(100, this.width); x++) {
          out += chars[this.tiles[y][x].type] || "?";
        }
        out += "\n";
      }
      return out;
    }
  };

  // src/renderer/CharacterRenderer.ts
  var CHARACTER_SIZE = 32;
  var Character = class {
    constructor(type, x, y) {
      this.targetX = null;
      this.targetY = null;
      this.type = type;
      this.x = x;
      this.y = y;
      this.pixelX = x * 64 + 16;
      this.pixelY = y * 64 + 16;
      this.direction = "down";
      this.state = "idle";
    }
    // 设置目标位置（AI决策）
    setTarget(x, y) {
      this.targetX = x;
      this.targetY = y;
      this.state = "walking";
    }
    // 更新位置
    update() {
      if (this.targetX === null || this.targetY === null) {
        this.state = "idle";
        return;
      }
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.5) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.targetX = null;
        this.targetY = null;
        this.state = "idle";
      } else {
        const speed = 0.05;
        this.x += dx / dist * speed;
        this.y += dy / dist * speed;
        if (Math.abs(dx) > Math.abs(dy)) {
          this.direction = dx > 0 ? "right" : "left";
        } else {
          this.direction = dy > 0 ? "down" : "up";
        }
      }
      this.pixelX = this.x * 64 + 16;
      this.pixelY = this.y * 64 + 16;
    }
  };
  var CharacterManager = class {
    constructor(map) {
      this.characters = [];
      this.textureCache = /* @__PURE__ */ new Map();
      // 素材映射
      this.ASSETS = {
        "adam": "img/\u4E9A\u5F53.png",
        "eve": "img/\u590F\u5A03.png"
      };
      this.map = map;
    }
    // 初始化角色
    init() {
      const adam = new Character("adam", 50, 25);
      this.characters.push(adam);
      const eve = new Character("eve", 51, 25);
      this.characters.push(eve);
      this.loadTextures();
    }
    // 加载角色素材
    async loadTextures() {
      for (const [type, path] of Object.entries(this.ASSETS)) {
        await this.loadTexture(type, path);
      }
    }
    loadTexture(type, path) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.textureCache.set(type, img);
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load character texture: ${path}`);
          resolve();
        };
        img.src = path;
      });
    }
    // 检查地形是否可通行
    isWalkable(x, y) {
      const tile = this.map.getTile(x, y);
      if (!tile) return false;
      const blocked = [
        "ocean" /* OCEAN */,
        "lake" /* LAKE */,
        "river" /* RIVER */,
        "mountain" /* MOUNTAIN */,
        "swamp" /* SWAMP */,
        "cave" /* CAVE */
      ];
      return !blocked.includes(tile.type);
    }
    // 更新所有角色
    update() {
      for (const character of this.characters) {
        if (character.state === "idle" && Math.random() < 0.02) {
          const directions = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
          ];
          for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
          }
          for (const dir of directions) {
            const newX = Math.floor(character.x + dir.dx);
            const newY = Math.floor(character.y + dir.dy);
            if (this.isWalkable(newX, newY)) {
              character.setTarget(newX, newY);
              break;
            }
          }
        }
        character.update();
      }
    }
    // 渲染所有角色
    render(ctx) {
      for (const character of this.characters) {
        const texture = this.textureCache.get(character.type);
        if (!texture) continue;
        const drawX = character.pixelX - CHARACTER_SIZE / 2;
        const drawY = character.pixelY - CHARACTER_SIZE / 2;
        ctx.drawImage(
          texture,
          drawX,
          drawY,
          CHARACTER_SIZE,
          CHARACTER_SIZE
        );
      }
    }
    // 获取所有角色
    getCharacters() {
      return this.characters;
    }
  };

  // src/renderer/ItemRenderer.ts
  var Item = class {
    constructor(type, x, y, layer) {
      this.type = type;
      this.x = x;
      this.y = y;
      this.layer = layer;
      this.pixelX = x * 64 + 32;
      this.pixelY = y * 64 + 32;
    }
  };
  var ItemManager = class {
    constructor(map) {
      this.items = [];
      this.textureCache = /* @__PURE__ */ new Map();
      this.ASSETS = {
        "tree": "img/\u6811.png",
        "bush": "img/\u704C\u6728.png",
        "rock": "img/\u77F3\u5934.png",
        "stick": "img/\u6728\u68CD.png",
        "berry": "img/\u6D46\u679C.png",
        "flower": "img/\u82B1.png",
        "branch": "img/\u6811\u679D.png"
      };
      this.SIZES = {
        "ground": 40,
        "low": 48,
        "high": 64
      };
      this.map = map;
    }
    generate() {
      const mapSize = this.map.getSize();
      for (let y = 0; y < mapSize.height; y++) {
        for (let x = 0; x < mapSize.width; x++) {
          const tile = this.map.getTile(x, y);
          if (!tile) continue;
          this.generateItemsForTile(tile.type, x, y);
        }
      }
      this.loadTextures();
    }
    generateItemsForTile(tileType, x, y) {
      const rand = Math.random();
      switch (tileType) {
        case "forest" /* FOREST */:
          if (rand < 0.12) {
            this.items.push(new Item("tree", x, y, "high"));
          } else if (rand < 0.22) {
            this.items.push(new Item("bush", x, y, "low"));
          } else if (rand < 0.28) {
            this.items.push(new Item("branch", x, y, "ground"));
          } else if (rand < 0.35) {
            this.items.push(new Item("berry", x, y, "ground"));
          }
          break;
        case "grass" /* GRASS */:
          if (rand < 0.05) {
            this.items.push(new Item("flower", x, y, "ground"));
          } else if (rand < 0.1) {
            this.items.push(new Item("berry", x, y, "ground"));
          } else if (rand < 0.13) {
            this.items.push(new Item("branch", x, y, "ground"));
          }
          break;
        case "plain" /* PLAIN */:
          if (rand < 0.15) {
            this.items.push(new Item("stick", x, y, "ground"));
          } else if (rand < 0.22) {
            this.items.push(new Item("flower", x, y, "ground"));
          } else if (rand < 0.28) {
            this.items.push(new Item("branch", x, y, "ground"));
          }
          break;
        case "hill" /* HILL */:
          if (rand < 0.08) {
            this.items.push(new Item("rock", x, y, "ground"));
          } else if (rand < 0.14) {
            this.items.push(new Item("bush", x, y, "low"));
          } else if (rand < 0.18) {
            this.items.push(new Item("branch", x, y, "ground"));
          }
          break;
        case "mountain" /* MOUNTAIN */:
          if (rand < 0.1) {
            this.items.push(new Item("rock", x, y, "ground"));
          } else if (rand < 0.15) {
            this.items.push(new Item("branch", x, y, "ground"));
          }
          break;
      }
    }
    async loadTextures() {
      for (const [type, path] of Object.entries(this.ASSETS)) {
        await this.loadTexture(type, path);
      }
    }
    loadTexture(type, path) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.textureCache.set(type, img);
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed: ${path}`);
          resolve();
        };
        img.src = path;
      });
    }
    getItems() {
      return this.items;
    }
    getTexture(type) {
      return this.textureCache.get(type);
    }
    getSize(layer) {
      return this.SIZES[layer];
    }
  };

  // src/main.ts
  var TILE_SIZE = 64;
  var SCALE = 1.35;
  var CONFIG = {
    map: { width: 100, height: 50, seed: 12345 },
    viewport: {
      width: Math.floor(window.innerWidth),
      height: Math.floor(window.innerHeight * 0.95)
    },
    game: { tickRate: 1e3 / 30 }
  };
  var TERRAIN_TEXTURES = {
    ["plain" /* PLAIN */]: "img/64x64\u50CF\u7D20\u8349\u5E73\u539F.png",
    ["grass" /* GRASS */]: "img/64x64\u50CF\u7D20\u8349\u5730\u6625.png",
    ["desert" /* DESERT */]: "img/64x64\u50CF\u7D20\u6C99\u6F20.png",
    ["forest" /* FOREST */]: "img/64x64\u50CF\u7D20\u68EE\u6797\u6625\u590F.png",
    ["ocean" /* OCEAN */]: "img/\u6D77\u6D0B.png",
    ["lake" /* LAKE */]: "img/\u6E56\u6CCA\u6625\u590F\u79CB.png",
    ["river" /* RIVER */]: "img/\u6CB3\u6D41.png",
    ["swamp" /* SWAMP */]: "img/\u6CBC\u6CFD.png",
    ["mountain" /* MOUNTAIN */]: "img/\u5C71\u5730.png",
    ["hill" /* HILL */]: "img/\u5C71\u4E18.png",
    ["cave" /* CAVE */]: "img/\u77F3\u5934.png",
    ["beach" /* BEACH */]: "img/\u6C99\u6EE9.png"
  };
  var textureCache = /* @__PURE__ */ new Map();
  async function loadTextures() {
    const promises = [];
    for (const [type, path] of Object.entries(TERRAIN_TEXTURES)) {
      promises.push(loadTexture(type, path));
    }
    promises.push(loadTexture("adam", "img/\u4E9A\u5F53.png"));
    promises.push(loadTexture("eve", "img/\u590F\u5A03.png"));
    await Promise.all(promises);
  }
  function loadTexture(type, path) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        textureCache.set(type, img);
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed: ${path}`);
        resolve();
      };
      img.src = path;
    });
  }
  async function main() {
    console.log("\u{1F30D} \u4F0A\u7538\u4E16\u754C \u542F\u52A8\u4E2D...");
    const map = new GameMap(CONFIG.map.width, CONFIG.map.height, CONFIG.map.seed);
    map.generate();
    console.log("\u2705 \u5730\u56FE\u751F\u6210\u5B8C\u6210");
    await loadTextures();
    console.log("\u2705 \u7EB9\u7406\u52A0\u8F7D\u5B8C\u6210");
    const characterManager = new CharacterManager(map);
    characterManager.init();
    console.log("\u2705 \u89D2\u8272\u521D\u59CB\u5316\u5B8C\u6210");
    const itemManager = new ItemManager(map);
    itemManager.generate();
    console.log("\u2705 \u7269\u54C1\u521D\u59CB\u5316\u5B8C\u6210");
    const canvas = document.createElement("canvas");
    canvas.width = CONFIG.viewport.width;
    canvas.height = CONFIG.viewport.height;
    canvas.style.imageRendering = "pixelated";
    const ctx = canvas.getContext("2d");
    const container = document.getElementById("game-container");
    if (container) {
      container.innerHTML = "";
      container.appendChild(canvas);
    }
    let cameraX = 0, cameraY = 0, zoom = 1;
    let zoomLevel = "NORMAL";
    const ZOOM_LEVELS = { FAR: 0.25, NORMAL: 1, CLOSE: 4 };
    cameraX = (CONFIG.map.width * TILE_SIZE - CONFIG.viewport.width) / 2;
    cameraY = (CONFIG.map.height * TILE_SIZE - CONFIG.viewport.height) / 2;
    const keys = /* @__PURE__ */ new Set();
    let isDragging = false, lastX = 0, lastY = 0;
    window.addEventListener("keydown", (e) => {
      keys.add(e.key);
      if (e.key === "1") {
        zoomLevel = "FAR";
        zoom = ZOOM_LEVELS.FAR;
      }
      if (e.key === "2") {
        zoomLevel = "NORMAL";
        zoom = ZOOM_LEVELS.NORMAL;
      }
      if (e.key === "3") {
        zoomLevel = "CLOSE";
        zoom = ZOOM_LEVELS.CLOSE;
      }
    });
    window.addEventListener("keyup", (e) => keys.delete(e.key));
    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    canvas.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      cameraX -= (e.clientX - lastX) / zoom;
      cameraY -= (e.clientY - lastY) / zoom;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    canvas.addEventListener("mouseup", () => isDragging = false);
    canvas.addEventListener("mouseleave", () => isDragging = false);
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const mouseMapX = cameraX + e.offsetX / zoom;
      const mouseMapY = cameraY + e.offsetY / zoom;
      if (e.deltaY < 0) {
        if (zoomLevel === "FAR") {
          zoomLevel = "NORMAL";
          zoom = ZOOM_LEVELS.NORMAL;
        } else if (zoomLevel === "NORMAL") {
          zoomLevel = "CLOSE";
          zoom = ZOOM_LEVELS.CLOSE;
        }
      } else {
        if (zoomLevel === "CLOSE") {
          zoomLevel = "NORMAL";
          zoom = ZOOM_LEVELS.NORMAL;
        } else if (zoomLevel === "NORMAL") {
          zoomLevel = "FAR";
          zoom = ZOOM_LEVELS.FAR;
        }
      }
      cameraX = mouseMapX - e.offsetX / zoom;
      cameraY = mouseMapY - e.offsetY / zoom;
    });
    function render() {
      const mapSize = map.getSize();
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, CONFIG.viewport.width, CONFIG.viewport.height);
      const startTileX = Math.floor(cameraX / TILE_SIZE);
      const startTileY = Math.floor(cameraY / TILE_SIZE);
      const tilesX = Math.ceil(CONFIG.viewport.width / (TILE_SIZE * zoom)) + 2;
      const tilesY = Math.ceil(CONFIG.viewport.height / (TILE_SIZE * zoom)) + 2;
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-cameraX, -cameraY);
      const SCALED_SIZE = TILE_SIZE * SCALE;
      const OFFSET = (SCALED_SIZE - TILE_SIZE) / 2;
      for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
          const tileX = startTileX + x;
          const tileY = startTileY + y;
          if (tileX < 0 || tileX >= mapSize.width || tileY < 0 || tileY >= mapSize.height) continue;
          const tile = map.getTile(tileX, tileY);
          if (!tile) continue;
          const texture = textureCache.get(tile.type);
          if (!texture) continue;
          ctx.drawImage(texture, tileX * TILE_SIZE - OFFSET, tileY * TILE_SIZE - OFFSET, SCALED_SIZE, SCALED_SIZE);
        }
      }
      const items = itemManager.getItems();
      for (const item of items) {
        if (item.layer !== "ground") continue;
        const tex = itemManager.getTexture(item.type);
        if (!tex) continue;
        const size = itemManager.getSize(item.layer);
        ctx.drawImage(tex, item.pixelX - size / 2, item.pixelY - size / 2, size, size);
      }
      for (const item of items) {
        if (item.layer !== "low") continue;
        const tex = itemManager.getTexture(item.type);
        if (!tex) continue;
        const size = itemManager.getSize(item.layer);
        ctx.drawImage(tex, item.pixelX - size / 2, item.pixelY - size / 2, size, size);
      }
      for (const item of items) {
        if (item.layer !== "high") continue;
        const tex = itemManager.getTexture(item.type);
        if (!tex) continue;
        const size = itemManager.getSize(item.layer);
        ctx.drawImage(tex, item.pixelX - size / 2, item.pixelY - size / 2, size, size);
      }
      const characters = characterManager.getCharacters();
      for (const char of characters) {
        const charTex = textureCache.get(char.type);
        if (!charTex) continue;
        ctx.drawImage(charTex, char.pixelX - CHARACTER_SIZE / 2, char.pixelY - CHARACTER_SIZE / 2, CHARACTER_SIZE, CHARACTER_SIZE);
      }
      ctx.restore();
    }
    setInterval(() => {
      characterManager.update();
      const speed = 10;
      if (keys.has("ArrowLeft") || keys.has("a")) cameraX -= speed / zoom;
      if (keys.has("ArrowRight") || keys.has("d")) cameraX += speed / zoom;
      if (keys.has("ArrowUp") || keys.has("w")) cameraY -= speed / zoom;
      if (keys.has("ArrowDown") || keys.has("s")) cameraY += speed / zoom;
      const maxX = CONFIG.map.width * TILE_SIZE - CONFIG.viewport.width / zoom;
      const maxY = CONFIG.map.height * TILE_SIZE - CONFIG.viewport.height / zoom;
      cameraX = Math.max(0, Math.min(maxX, cameraX));
      cameraY = Math.max(0, Math.min(maxY, cameraY));
      render();
    }, CONFIG.game.tickRate);
    render();
    console.log("\u2705 \u6E38\u620F\u542F\u52A8\u5B8C\u6210");
  }
  main().catch(console.error);
  window.edenWorld = { version: "0.6.0-alpha" };
})();
