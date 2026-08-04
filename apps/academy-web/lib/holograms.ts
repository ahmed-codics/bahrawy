export type HoloObject = {
  id: number;
  glyph: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
  duration: number;
  delay: number;
  depth: number;
};

export type HeroSymbol = {
  id: number;
  glyph: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
  duration: number;
  delay: number;
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GLYPHS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'L',
  'M',
  'N',
  'O',
  'P',
  'R',
  'S',
  'T',
  'U',
  'W',
  'Y',
  '?',
  '❝',
  '✎',
  '★',
];

const WORDS = [
  'ABC',
  'Grammar',
  'Vocabulary',
  'Speaking',
  'Listening',
  'Writing',
  'Reading',
  'English',
  'Speech',
  'Essay',
];

const round = (n: number, p: number) => Number(n.toFixed(p));

export const HOLO_OBJECTS: HoloObject[] = (() => {
  const rand = mulberry32(20260804);
  const list: HoloObject[] = [];
  for (let i = 0; i < 48; i++) {
    const isWord = rand() < 0.28;
    const depth = 1 + Math.floor(rand() * 4);
    list.push({
      id: i,
      glyph: isWord
        ? WORDS[Math.floor(rand() * WORDS.length)]
        : GLYPHS[Math.floor(rand() * GLYPHS.length)],
      x: round(rand() * 100, 1),
      y: round(rand() * 100, 1),
      size: Math.round(16 + rand() * 34),
      rotate: Math.round(rand() * 56 - 28),
      duration: round(9 + rand() * 13, 1),
      delay: round(-rand() * 12, 1),
      depth,
    });
  }
  return list;
})();

export const HERO_SYMBOLS: HeroSymbol[] = [
  { id: 1, glyph: 'Grammar', x: 4, y: 6, size: 220, rotate: -14, duration: 20, delay: 0 },
  { id: 2, glyph: 'ABC', x: 78, y: 8, size: 300, rotate: 10, duration: 26, delay: -6 },
  { id: 3, glyph: '?', x: 62, y: 40, size: 260, rotate: -8, duration: 18, delay: -3 },
  { id: 4, glyph: '✎', x: 8, y: 52, size: 190, rotate: 18, duration: 23, delay: -9 },
  { id: 5, glyph: 'Reading', x: 70, y: 74, size: 200, rotate: -10, duration: 21, delay: -4 },
  { id: 6, glyph: '❝', x: 30, y: 80, size: 240, rotate: 6, duration: 25, delay: -11 },
];
