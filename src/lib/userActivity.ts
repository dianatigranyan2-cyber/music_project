type ActivityResult = { error: unknown | null };
interface ActivityOptions {
  write: (signal: AbortSignal) => PromiseLike<ActivityResult>;
  available: () => boolean;
  warn: (message: string) => void;
  now?: () => number;
  timeoutMs?: number;
}

function describeFailure(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Ошибка без описания';
  const value = error as Record<string, unknown>;
  return ['name', 'code', 'message'].map(key => typeof value[key] === 'string' ? value[key] : '')
    .filter(Boolean).join(': ').slice(0, 500) || 'Ошибка без описания';
}

/** Last-seen updates are best effort; a disconnected tab must not block the app. */
export function createActivityUpdater({write, available, warn, now = Date.now, timeoutMs = 10_000}: ActivityOptions) {
  let disposed = false;
  let pending: AbortController | null = null;
  let lastSuccess: number | null = null;
  let lastFailure = '';

  const touch = async () => {
    if (disposed || pending || !available() || (lastSuccess !== null && now() - lastSuccess < 25_000)) return;
    const controller = new AbortController();
    pending = controller;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const {error} = await write(controller.signal);
      if (controller.signal.aborted) throw new Error('Превышено время ожидания сервера');
      if (error) throw error;
      if (!disposed) { lastSuccess = now(); lastFailure = ''; }
    } catch (error) {
      if (disposed || !available()) return;
      const description = controller.signal.aborted ? 'Превышено время ожидания сервера' : describeFailure(error);
      if (description !== lastFailure) warn(`Не удалось сохранить время посещения: ${description}. Повторим при восстановлении связи или следующем обновлении активности.`);
      lastFailure = description;
    } finally {
      clearTimeout(timeout);
      if (pending === controller) pending = null;
    }
  };
  return {touch, dispose: () => { disposed = true; pending?.abort(); }};
}
