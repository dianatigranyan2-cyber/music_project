export const AUDIUS_PAGE_SIZE = 12;
export type AudiusAvailability = 'available' | 'review' | 'unavailable';
export interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  genre: string;
  sourceUrl: string;
  account: {name: string; handle: string; verified: boolean};
  license: string | null;
  copyright: string | null;
  artworkUrl: string | null;
  available: boolean | null;
  streamable: boolean | null;
  streamAccess: boolean | null;
  gated: boolean;
  hidden: boolean;
  deleted: boolean;
  restrictedApps: boolean;
}
export interface AudiusAssessment {
  status: AudiusAvailability;
  canPreview: boolean;
  reasons: string[];
}
export interface AudiusCheck {
  track: AudiusTrack;
  assessment: AudiusAssessment;
  checkedAt: string;
}
export const AUDIUS_STATUS_LABELS: Record<AudiusAvailability, string> = {
  available: 'Доступно для прослушивания',
  review: 'Нужна дополнительная проверка',
  unavailable: 'Прослушивание недоступно',
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, limit = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}
function boolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
function hasConditions(value: unknown): boolean {
  const conditions = record(value);
  return !!conditions && Object.keys(conditions).length > 0;
}
export function audiusArtworkUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(url.hostname)
      && !/\.(local|localhost|internal)$/i.test(url.hostname) ? url.href : null;
  } catch {return null;}
}
export function audiusTrackId(value: unknown): string | null {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(value) ? value : null;
}
export function audiusCanonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['audius.co', 'www.audius.co'].includes(url.hostname) || url.username || url.password || url.port || url.pathname.split('/').filter(Boolean).length < 2) return null;
    return 'https://audius.co' + url.pathname;
  } catch { return null; }
}
export function audiusInput(value: string): {kind: 'search' | 'url'; value: string} | null {
  const query = value.trim();
  if (/^https?:\/\//i.test(query)) {
    const url = query.length <= 2000 ? audiusCanonicalUrl(query) : null;
    return url ? {kind: 'url', value: url} : null;
  }
  return query.length >= 2 && query.length <= 200 ? {kind: 'search', value: query} : null;
}
export function normalizeAudiusTrack(value: unknown, accessInfo?: unknown): AudiusTrack | null {
  const row = record(value);
  const id = audiusTrackId(row?.id);
  const title = text(row?.title, 200);
  const user = record(row?.user);
  const handle = text(user?.handle, 100);
  const permalink = text(row?.permalink, 2000);
  const sourceUrl = audiusCanonicalUrl(permalink.startsWith('/') ? 'https://audius.co' + permalink : permalink);
  if (!row || !id || !title || !handle || !sourceUrl || typeof row.duration !== 'number' || !Number.isFinite(row.duration) || row.duration <= 0) return null;
  const info = record(accessInfo);
  const access = accessInfo === undefined ? record(row.access) : record(info?.access);
  const artwork = record(row.artwork);
  return {
    id, title, duration: Math.ceil(row.duration), genre: text(row.genre, 100), sourceUrl,
    account: {name: text(user?.name, 200) || handle, handle, verified: user?.is_verified === true},
    license: text(row.license) || null,
    copyright: text(row.copyright_line) || text(row.producer_copyright_line) || null,
    artworkUrl: audiusArtworkUrl(artwork?.['480x480']) ?? audiusArtworkUrl(artwork?.['150x150']),
    available: boolean(row.is_available), streamable: boolean(row.is_streamable),
    streamAccess: boolean(access?.stream),
    gated: row.is_stream_gated === true || info?.is_stream_gated === true || hasConditions(row.stream_conditions) || hasConditions(info?.stream_conditions) || Array.isArray(row.access_authorities) && row.access_authorities.length > 0,
    restrictedApps: Array.isArray(row.allowed_api_keys) && row.allowed_api_keys.length > 0,
    hidden: row.is_unlisted === true || row.is_scheduled_release === true,
    deleted: row.is_delete === true,
  };
}
export function assessAudiusTrack(track: AudiusTrack): AudiusAssessment {
  const reasons: string[] = [];
  if (track.deleted || track.available === false) reasons.push('Audius сообщает, что трек удалён или недоступен.');
  if (track.hidden) reasons.push('Трек скрыт или его публикация ещё не началась.');
  if (track.gated) reasons.push('У трека есть условия доступа: покупка, подписка или другое ограничение. В этой версии такие треки не воспроизводятся.');
  if (track.restrictedApps) reasons.push('Воспроизведение разрешено только выбранным приложениям. Доступ Melo не подтверждён.');
  if (track.streamable === false || track.streamAccess === false) reasons.push('Audius не разрешает открытое воспроизведение этого трека.');
  if (reasons.length) return {status: 'unavailable', canPreview: false, reasons};
  const canPreview = track.available === true && track.streamable === true && track.streamAccess === true;
  if (!canPreview) reasons.push('Audius не передал все сведения для подтверждения открытого воспроизведения.');
  if (!track.license) reasons.push('Лицензия в данных Audius не указана. Условия нужно уточнить.');
  return {
    status: reasons.length ? 'review' : 'available', canPreview,
    reasons: reasons.length ? reasons : ['По данным Audius трек доступен для открытого прослушивания.'],
  };
}
