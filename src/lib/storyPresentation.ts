export const STORY_FILTERS = {
  none: { label: 'Оригинал', css: 'none' },
  warm: { label: 'Тепло', css: 'sepia(.25) saturate(1.2) contrast(1.05)' },
  cool: { label: 'Прохлада', css: 'saturate(.85) hue-rotate(15deg) contrast(1.08)' },
  mono: { label: 'Чёрно-белый', css: 'grayscale(1) contrast(1.1)' },
  vintage: { label: 'Винтаж', css: 'sepia(.5) saturate(.75) contrast(.9)' },
} as const;
export const STORY_STICKERS = ['❤️', '✨', '🎵', '🎧', '🔥', '🌙', '☀️', '🦋', '🌸', '💜', '⭐', '🥰'] as const;
export type StoryLayer = {
  id: string; kind: 'text' | 'sticker' | 'music'; text: string;
  x: number; y: number; size: number; rotation: number;
  color: string; background: 'none' | 'dark' | 'light'; font: 'sans' | 'serif' | 'mono';
};
export type StoryPresentation = {
  version: 1;
  filter: keyof typeof STORY_FILTERS;
  media: { fit: 'cover' | 'contain'; zoom: number; x: number; y: number };
  layers: StoryLayer[];
};
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export function defaultStoryPresentation(): StoryPresentation {
  return { version: 1, filter: 'none', media: { fit: 'cover', zoom: 1, x: 50, y: 50 }, layers: [] };
}
const bounded = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Only allow known styles, plain text and bounded positions; never store arbitrary CSS or URLs. */
export function parseStoryPresentation(value: unknown): StoryPresentation | null {
  if (value === undefined || value && typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length) return defaultStoryPresentation();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.filter !== 'string' || !Object.hasOwn(STORY_FILTERS, v.filter) || !v.media || typeof v.media !== 'object' || !Array.isArray(v.layers) || v.layers.length > 20) return null;
  const m = v.media as Record<string, unknown>;
  if (!['cover', 'contain'].includes(m.fit as string) || !bounded(m.zoom, 1, 3) || !bounded(m.x, 0, 100) || !bounded(m.y, 0, 100)) return null;
  const ids = new Set<string>();
  let textLength = 0;
  let musicCount = 0;
  const layers: StoryLayer[] = [];
  for (const raw of v.layers) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const l = raw as Record<string, unknown>;
    if (typeof l.id !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(l.id) || ids.has(l.id)
      || !['text', 'sticker', 'music'].includes(l.kind as string) || typeof l.text !== 'string'
      || !bounded(l.x, 5, 95) || !bounded(l.y, 8, 92) || !bounded(l.size, 2, 24) || !bounded(l.rotation, -180, 180)
      || typeof l.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(l.color)
      || !['none', 'dark', 'light'].includes(l.background as string) || !['sans', 'serif', 'mono'].includes(l.font as string)) return null;
    if (l.kind === 'text') textLength += l.text.length;
    if (l.kind === 'sticker' && !STORY_STICKERS.some(sticker => sticker === l.text)) return null;
    if (l.kind === 'music' && (++musicCount > 1 || l.text !== '')) return null;
    if (textLength > 300) return null;
    ids.add(l.id);
    layers.push({ id: l.id, kind: l.kind as StoryLayer['kind'], text: l.text, x: l.x, y: l.y, size: l.size, rotation: l.rotation, color: l.color, background: l.background as StoryLayer['background'], font: l.font as StoryLayer['font'] });
  }
  return { version: 1, filter: v.filter as StoryPresentation['filter'], media: { fit: m.fit as 'cover' | 'contain', zoom: m.zoom, x: m.x, y: m.y }, layers };
}

export function newStoryLayer(kind: StoryLayer['kind'], id: string, text = ''): StoryLayer {
  return { id, kind, text, x: 50, y: kind === 'music' ? 70 : 45, size: kind === 'sticker' ? 16 : kind === 'music' ? 4 : 7, rotation: 0, color: '#ffffff', background: kind === 'sticker' ? 'none' : 'dark', font: 'sans' };
}

export function initialStoryPresentation(value: unknown, caption: string, hasMusic: boolean): StoryPresentation {
  const presentation = parseStoryPresentation(value) ?? defaultStoryPresentation();
  if (!hasMusic) presentation.layers = presentation.layers.filter(layer => layer.kind !== 'music');
  if (caption && !presentation.layers.some(layer => layer.kind === 'text')) presentation.layers.push({ ...newStoryLayer('text', 'legacy-caption', caption.slice(0, 300)), y: 78 });
  if (hasMusic && !presentation.layers.some(layer => layer.kind === 'music')) presentation.layers.push(newStoryLayer('music', 'legacy-music'));
  return presentation;
}
