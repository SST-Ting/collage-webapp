import fs from 'node:fs';
import path from 'node:path';

const svgPath = process.argv[2];
const requested = (process.argv[3] ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

if (!svgPath) {
  console.error('Usage: npm run inspect:svg -- "path/to/file.svg" "g320,g393"');
  process.exit(1);
}

const svg = fs.readFileSync(svgPath, 'utf8');
const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? null;
const groups = collectGroups(svg);

const selected = requested.length
  ? requested.map((item) => findGroup(groups, item)).filter(Boolean)
  : groups;

const missing = requested.filter((item) => !findGroup(groups, item));
const result = {
  file: path.resolve(svgPath),
  viewBox,
  groupCount: groups.length,
  requested,
  availableIdCount: groups.filter((group) => group.id).length,
  missing,
  groups: selected.map((group) => ({
    label: `g${group.index}`,
    sourceIndex: group.index,
    id: group.id,
    tag: group.tag.slice(0, 220),
    bbox: group.bbox,
  })),
};

console.log(JSON.stringify(result, null, 2));

function findGroup(groups, key) {
  const byId = groups.find((group) => group.id === key);
  if (byId) return byId;

  const index = Number(key.replace(/^g/i, ''));
  if (Number.isFinite(index)) return groups[index - 1] ?? null;
  return null;
}

function collectGroups(source) {
  const starts = [...source.matchAll(/<g\b[^>]*>/g)];
  return starts.map((match, zeroIndex) => {
    const start = match.index;
    const end = findMatchingGroupEnd(source, start);
    const content = end > start ? source.slice(start, end) : match[0];
    const id = match[0].match(/\bid="([^"]+)"/)?.[1] ?? null;
    return {
      index: zeroIndex + 1,
      id,
      tag: match[0],
      bbox: estimateBBox(content),
    };
  });
}

function findMatchingGroupEnd(source, start) {
  const tagRe = /<\/?g\b[^>]*>/g;
  tagRe.lastIndex = start;
  let depth = 0;
  for (const match of source.matchAll(tagRe)) {
    const tag = match[0];
    if (tag.startsWith('</g')) {
      depth -= 1;
      if (depth === 0) return match.index + tag.length;
    } else if (!tag.endsWith('/>')) {
      depth += 1;
    }
  }
  return -1;
}

function estimateBBox(content) {
  const points = [];

  for (const tag of content.matchAll(/<(?:rect|image)\b[^>]*>/g)) {
    const attrs = tag[0];
    const x = readNumber(attrs, 'x') ?? 0;
    const y = readNumber(attrs, 'y') ?? 0;
    const width = readNumber(attrs, 'width') ?? 0;
    const height = readNumber(attrs, 'height') ?? 0;
    points.push([x, y], [x + width, y + height]);
  }

  for (const tag of content.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) {
    const nums = [...tag[1].matchAll(/-?\d+(?:\.\d+)?/g)].map((n) => Number(n[0]));
    for (let i = 0; i < nums.length - 1; i += 2) {
      points.push([nums[i], nums[i + 1]]);
    }
  }

  if (!points.length) return null;

  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: round(minX),
    y: round(minY),
    width: round(maxX - minX),
    height: round(maxY - minY),
  };
}

function readNumber(attrs, name) {
  const value = attrs.match(new RegExp(`\\b${name}="(-?\\d+(?:\\.\\d+)?)"`))?.[1];
  return value === undefined ? null : Number(value);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
