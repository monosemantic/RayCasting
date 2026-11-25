// Level definitions and level building on top of the original Scene class.
//
// Map legend:
//   wall chars ('#', '=', '%', 'E', ...) -> texture given by the level's `walls` palette
//   '.' floor       'S' player start     'c' gold coin       'X' exit
//   'b' barrel (solid decor)   'p' pillar (solid decor)   'l' hanging green lamp
//   'h' guardian patrolling horizontally   'v' guardian patrolling vertically

interface ZoneDef {
  name: string;
  subtitle: string;
  texture: string; // texture used to paint the zone on the world map
  accent: string;
  floor1: [number, number, number];
  floor2: [number, number, number];
  ceiling1: [number, number, number];
  ceiling2: [number, number, number];
}

interface LevelDef {
  id: string;
  name: string;
  zone: number;
  map: string[];
  walls: Record<string, string>;
  startDir: number; // radians, 0 = east, PI/2 = south
  timeLimit: number; // seconds
  parTime: number; // seconds, finishing faster earns a star
  coinsRequired: number;
  guardianSpeed: number; // cells per second
  intro: string;
}

const DIR_E = 0;
const DIR_S = Math.PI * 0.5;
const DIR_W = Math.PI;
const DIR_N = Math.PI * 1.5;

// Zone 0 reuses the original floor/ceiling colors of the prototype.
const ZONES: ZoneDef[] = [
  {
    name: "Les Cachots",
    subtitle: "Pierre grise et mousse",
    texture: "greystone",
    accent: "#5fb3b3",
    floor1: [0.094, 0.144, 0.144],
    floor2: [0.188, 0.238, 0.238],
    ceiling1: [0.144, 0.094, 0.094],
    ceiling2: [0.238, 0.188, 0.188],
  },
  {
    name: "Les Salles Bleues",
    subtitle: "Pierre bleue et boiseries",
    texture: "bluestone",
    accent: "#6f9bff",
    floor1: [0.07, 0.1, 0.16],
    floor2: [0.14, 0.18, 0.28],
    ceiling1: [0.1, 0.1, 0.14],
    ceiling2: [0.2, 0.2, 0.27],
  },
  {
    name: "Le Donjon Pourpre",
    subtitle: "Brique rouge et pierre pourpre",
    texture: "purplestone",
    accent: "#c27bff",
    floor1: [0.12, 0.08, 0.14],
    floor2: [0.22, 0.15, 0.26],
    ceiling1: [0.15, 0.07, 0.07],
    ceiling2: [0.27, 0.14, 0.14],
  },
];

const LEVELS: LevelDef[] = [
  {
    id: "l1",
    name: "La Cour des Cachots",
    zone: 0,
    walls: { "#": "greystone", "=": "mossy", E: "eagle" },
    startDir: DIR_E,
    timeLimit: 120,
    parTime: 35,
    coinsRequired: 4,
    guardianSpeed: 0,
    intro: "Apprends à te déplacer dans les couloirs. Aucun gardien ici.",
    map: [
      "#############",
      "#S..c.#..c..#",
      "#.###.=.##..#",
      "#.#c..E...#.#",
      "#.#.###.#.#c#",
      "#...#c..#...#",
      "###.#.###.#.#",
      "#c....l...#X#",
      "#############",
    ],
  },
  {
    id: "l2",
    name: "Le Couloir Moussu",
    zone: 0,
    walls: { "#": "mossy", "=": "greystone", E: "eagle" },
    startDir: DIR_E,
    timeLimit: 130,
    parTime: 50,
    coinsRequired: 5,
    guardianSpeed: 0.9,
    intro: "Un gardien spectral patrouille. Son contact te coûte un cœur.",
    map: [
      "###############",
      "#S.c.#....c...#",
      "#.##.#.####.#.#",
      "#.#c.....h..#c#",
      "#.#.###.##.##.#",
      "#...=c#..c#...#",
      "###.#.#.###.#.#",
      "#c..#.l...#.#.#",
      "#.###.###.#.#.#",
      "#....c..#...#X#",
      "###############",
    ],
  },
  {
    id: "l3",
    name: "La Salle des Bannières",
    zone: 0,
    walls: { "#": "greystone", "=": "mossy", E: "eagle" },
    startDir: DIR_E,
    timeLimit: 140,
    parTime: 80,
    coinsRequired: 6,
    guardianSpeed: 1.0,
    intro: "Deux gardiens surveillent les bannières. Observe leurs rondes.",
    map: [
      "#################",
      "#S..#.....c.....#",
      "#.#.E.#####.###.#",
      "#.#c..#...#.#c..#",
      "#.#####.#.#.#.###",
      "#...c...#..h....#",
      "###.###.#####.#.#",
      "#c#...#.....#.#.#",
      "#.###.=.###.#.#.#",
      "#..v..#.#c#...#c#",
      "#.#.###.#.#####.#",
      "#.#..c....l....X#",
      "#################",
    ],
  },
  {
    id: "l4",
    name: "Le Hall Bleu",
    zone: 1,
    walls: { "#": "bluestone", "=": "colorstone", W: "wood" },
    startDir: DIR_E,
    timeLimit: 150,
    parTime: 90,
    coinsRequired: 6,
    guardianSpeed: 1.1,
    intro: "Les salles bleues sont plus vastes. Ne te perds pas.",
    map: [
      "###################",
      "#S....#.....#....c#",
      "#.###.#.###.#.###.#",
      "#.#c#...#c#...#...#",
      "#.#.#####.#####.#.#",
      "#...h.......W...#.#",
      "###.#.###.#.#.###.#",
      "#c..#.#c..#.#.#c..#",
      "#.###.#.###.#.#.###",
      "#.....=...h.#.....#",
      "#.#########.#####.#",
      "#......c..l.....bX#",
      "###################",
    ],
  },
  {
    id: "l5",
    name: "La Galerie de Bois",
    zone: 1,
    walls: { "#": "wood", "=": "bluestone", "%": "colorstone" },
    startDir: DIR_S,
    timeLimit: 165,
    parTime: 120,
    coinsRequired: 6,
    guardianSpeed: 1.2,
    intro: "Les boiseries cachent des recoins remplis d'or.",
    map: [
      "#####################",
      "#S..#.......#......c#",
      "#.#.#.#####.#.####..#",
      "#.#...#c..#...#..#..#",
      "#.#####.#.#####.#.#.#",
      "#........#..h...#...#",
      "#####.=.#######.###.#",
      "#c..#.#...c...#...#.#",
      "#.#.#.#######.###.#.#",
      "#.#...%..h..#...#.#.#",
      "#.#####.###.###.#.#.#",
      "#...c.#...#...#..c#c#",
      "#.###.###.#.#.#####.#",
      "#.....b...#.#.l....X#",
      "#####################",
    ],
  },
  {
    id: "l6",
    name: "L'Arsenal",
    zone: 1,
    walls: { "#": "colorstone", "=": "bluestone", W: "wood" },
    startDir: DIR_E,
    timeLimit: 170,
    parTime: 130,
    coinsRequired: 7,
    guardianSpeed: 1.3,
    intro: "Tonneaux et piliers encombrent l'arsenal. Trois gardiens rôdent.",
    map: [
      "#####################",
      "#S......#.....c.....#",
      "#.#####.#.###.#####.#",
      "#.#c..#...#.p...#c..#",
      "#.#.#.#####.###.#.###",
      "#...#...h.....W.#...#",
      "###.###.#####.#.###.#",
      "#c....#.#c....#...#.#",
      "#.###.#.#.#######.#.#",
      "#.#b.....v..c#....#.#",
      "#.#.#####.##.#.####.#",
      "#.#...c.#..h.......c#",
      "#.###.#.#.########.##",
      "#.....#.p...l......X#",
      "#####################",
    ],
  },
  {
    id: "l7",
    name: "Le Donjon Pourpre",
    zone: 2,
    walls: { "#": "purplestone", "=": "redbrick", E: "eagle" },
    startDir: DIR_E,
    timeLimit: 180,
    parTime: 150,
    coinsRequired: 8,
    guardianSpeed: 1.4,
    intro: "Le cœur de la forteresse. Les gardiens y sont plus rapides.",
    map: [
      "#######################",
      "#S.....#.....c.#......#",
      "#.####.#.#####.#.####.#",
      "#.#c.#...#...#...#c...#",
      "#.#.######.#.#####.####",
      "#.#....h...#....=....c#",
      "#.#.######.###.##.###.#",
      "#...#c...#...#..#.#c..#",
      "###.#.##.###.##.#.#.###",
      "#c..#..#..v#..#...#...#",
      "#.####.###.##.#####.#.#",
      "#....#..c#....E..h..#.#",
      "#.##.###.#.########.#.#",
      "#..c.......c.l....p..X#",
      "#######################",
    ],
  },
  {
    id: "l8",
    name: "La Salle du Trône",
    zone: 2,
    walls: { "#": "redbrick", "=": "purplestone", E: "eagle" },
    startDir: DIR_E,
    timeLimit: 200,
    parTime: 165,
    coinsRequired: 9,
    guardianSpeed: 1.5,
    intro: "L'épreuve finale. Rassemble le trésor et quitte la forteresse.",
    map: [
      "#######################",
      "#c....#...c...#......c#",
      "#.###.#.#####.#.####..#",
      "#.#...#.#...h.#.#c.#..#",
      "#.#.###.#.#####.#.##.##",
      "#.#...h.#...E...#.....#",
      "#.#####.###.#.###.###.#",
      "#.....#...#.#.#c..#...#",
      "#####.###.#.#.#.###.#.#",
      "#c..#.....#...#...#.#c#",
      "#.#.#####.###.#.#.#.#.#",
      "#.#c..=.h.....#.#..c#.#",
      "#.###.#####.#.#.#####.#",
      "#...#..c..#.#.#.....h.#",
      "###.#####.#.#.#####.#.#",
      "#S..b.....l.#..c..p..X#",
      "#######################",
    ],
  },
];

// Hard-coded scene of the original prototype, kept as the "Mode libre".
function buildOriginalScene(textures: Record<string, Tile>): { scene: Scene; player: Player } {
  const wall1 = textures["eagle"] ?? RGBA.purple();
  const wall2 = textures["mossy"] ?? RGBA.purple();
  const wall3 = textures["greystone"] ?? RGBA.purple();
  const scene: Scene = new Scene([
    [null, null, wall1, wall2, null, null, null, null, null],
    [null, null, null, wall3, null, null, null, null, null],
    [null, wall1, wall2, wall1, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
  ]);
  const player = new Player(scene.size().mul(new Vector2(0.7, 0.63)), Math.PI * 1.25);
  return { scene, player };
}

const EXIT_FLOOR_OPEN = new RGBA(0.04, 0.26, 0.1, 1);
const EXIT_FLOOR_LOCKED = new RGBA(0.26, 0.05, 0.05, 1);
const EXIT_CEILING_OPEN = new RGBA(0.08, 0.3, 0.12, 1);
const EXIT_CEILING_LOCKED = new RGBA(0.22, 0.06, 0.06, 1);

// Scene of a game level. It extends the engine Scene without changing it:
// - the outside of the map and solid decor (barrels, pillars) block movement,
// - the exit cell gets a green (open) or red (locked) floor and ceiling.
class LevelScene extends Scene {
  solid: Uint8Array;
  exitX = -1;
  exitY = -1;
  exitOpen = false;

  constructor(walls: Array<Array<Tile>>, zone: ZoneDef) {
    super(walls);
    this.solid = new Uint8Array(this.width * this.height);
    this.floor1 = new RGBA(...zone.floor1, 1);
    this.floor2 = new RGBA(...zone.floor2, 1);
    this.ceiling1 = new RGBA(...zone.ceiling1, 1);
    this.ceiling2 = new RGBA(...zone.ceiling2, 1);
  }

  isWall(p: Vector2): boolean {
    if (!this.contains(p)) return true;
    if (super.isWall(p)) return true;
    return this.solid[Math.floor(p.y) * this.width + Math.floor(p.x)] === 1;
  }

  getFloor(p: Vector2): Tile | undefined {
    if (Math.floor(p.x) === this.exitX && Math.floor(p.y) === this.exitY) {
      return this.exitOpen ? EXIT_FLOOR_OPEN : EXIT_FLOOR_LOCKED;
    }
    return super.getFloor(p);
  }

  getCeiling(p: Vector2): Tile | undefined {
    if (Math.floor(p.x) === this.exitX && Math.floor(p.y) === this.exitY) {
      return this.exitOpen ? EXIT_CEILING_OPEN : EXIT_CEILING_LOCKED;
    }
    return super.getCeiling(p);
  }
}

interface DecorDef {
  pos: Vector2;
  texture: string;
  blocking: boolean;
}

interface GuardianDef {
  pos: Vector2;
  axis: Vector2;
}

interface BuiltLevel {
  scene: LevelScene;
  start: Vector2;
  coins: Vector2[];
  decor: DecorDef[];
  guardians: GuardianDef[];
  exit: Vector2;
}

function buildLevel(def: LevelDef, textures: Record<string, Tile>): BuiltLevel {
  const zone = ZONES[def.zone]!;
  const rows: Array<Array<Tile>> = [];
  const coins: Vector2[] = [];
  const decor: DecorDef[] = [];
  const guardians: GuardianDef[] = [];
  const solidCells: Array<[number, number]> = [];
  let start = new Vector2(1.5, 1.5);
  let exit = new Vector2(-1, -1);

  def.map.forEach((line, y) => {
    const row: Array<Tile> = [];
    for (let x = 0; x < line.length; ++x) {
      const ch = line[x]!;
      const center = new Vector2(x + 0.5, y + 0.5);
      const wallTexture = def.walls[ch];
      if (wallTexture !== undefined) {
        row.push(textures[wallTexture] ?? RGBA.purple());
        continue;
      }
      row.push(null);
      switch (ch) {
        case "S":
          start = center;
          break;
        case "c":
          coins.push(center);
          break;
        case "X":
          exit = center;
          break;
        case "b":
          decor.push({ pos: center, texture: "barrel", blocking: true });
          solidCells.push([x, y]);
          break;
        case "p":
          decor.push({ pos: center, texture: "pillar", blocking: true });
          solidCells.push([x, y]);
          break;
        case "l":
          decor.push({ pos: center, texture: "greenlight", blocking: false });
          break;
        case "h":
          guardians.push({ pos: center, axis: new Vector2(1, 0) });
          break;
        case "v":
          guardians.push({ pos: center, axis: new Vector2(0, 1) });
          break;
      }
    }
    rows.push(row);
  });

  const scene = new LevelScene(rows, zone);
  for (const [x, y] of solidCells) scene.solid[y * scene.width + x] = 1;
  scene.exitX = Math.floor(exit.x);
  scene.exitY = Math.floor(exit.y);
  // The exit lamp marks the way out from afar.
  decor.push({ pos: exit, texture: "greenlight", blocking: false });
  return { scene, start, coins, decor, guardians, exit };
}
