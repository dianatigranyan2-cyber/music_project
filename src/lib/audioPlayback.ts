import type { Track } from '../types';
import { isPlayableTrack } from './musicPlayback';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loading: boolean;
  error: string | null;
}
export const IDLE_PLAYBACK: PlaybackState = {
  isPlaying: false, currentTime: 0, duration: 0, loading: false, error: null,
};

/** One native media element owns playback and the clock, including in the background. */
export class AudioPlayback {
  private version = 0;
  private track: Track | null = null;
  private disposed = false;
  private state = { ...IDLE_PLAYBACK };
  private listeners: [string, EventListener][] = [];
  private pendingSeek: number | null = null;

  constructor(
    private audio: HTMLAudioElement,
    private onChange: (state: PlaybackState) => void,
    private onEnded: () => void = () => {},
  ) {
    const listen = (event: string, callback: () => void) => {
      this.listeners.push([event, callback]);
      audio.addEventListener(event, callback);
    };
    const clock = () => this.publish({
      currentTime: this.pendingSeek ?? (Number.isFinite(audio.currentTime) ? audio.currentTime : 0),
      duration: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : this.track?.duration ?? 0,
    });
    listen('timeupdate', clock);
    listen('durationchange', clock);
    listen('loadedmetadata', () => {
      if (this.pendingSeek !== null) {
        const target=this.pendingSeek;
        this.pendingSeek=null;
        this.seek(target);
      }
      clock();
    });
    listen('playing', () => this.publish({ isPlaying: true, loading: false, error: null }));
    listen('pause', () => this.publish({ isPlaying: false }));
    listen('waiting', () => this.publish({ loading: true }));
    listen('canplay', () => this.publish({ loading: false }));
    listen('ended', () => {
      this.publish({ isPlaying: false, loading: false });
      this.onEnded();
    });
    listen('error', () => this.publish({
      isPlaying: false, loading: false, error: 'Не удалось воспроизвести трек. Попробуйте ещё раз.',
    }));
  }
  private publish(patch: Partial<PlaybackState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }
  select(track: Track, autoplay = true, startTime = 0): boolean {
    if (this.disposed) return false;
    if (!isPlayableTrack(track)) {
      this.publish({ error: 'Этот трек пока недоступен для прослушивания.' });
      return false;
    }
    ++this.version;
    this.audio.pause();
    this.track = track;
    this.pendingSeek = Number.isFinite(startTime) ? Math.max(0,Math.min(startTime,track.duration)) : 0;
    if(this.pendingSeek===0)this.pendingSeek=null;
    this.audio.preload = autoplay ? 'auto' : 'metadata';
    this.audio.src = track.streamUrl!;
    this.audio.load();
    this.publish({ isPlaying: false, currentTime: this.pendingSeek ?? 0, duration: track.duration, loading: autoplay, error: null });
    // Called directly from a click to retain the browser's user activation.
    if(autoplay) this.play();
    return true;
  }
  play() {
    if (!this.track || this.disposed) return;
    const version = ++this.version;
    if (this.audio.error) this.audio.load();
    this.publish({ loading: true, error: null });
    void this.audio.play().catch((error: unknown) => {
      if (this.disposed || version !== this.version) return;
      const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
      this.publish({ isPlaying: false, loading: false, error: name === 'NotAllowedError'
        ? 'Нажмите ▶, чтобы начать воспроизведение.'
        : 'Не удалось воспроизвести трек. Попробуйте ещё раз.' });
    });
  }
  pause() {
    ++this.version;
    this.audio.pause();
    this.publish({ isPlaying: false, loading: false });
  }
  toggle() { if (this.audio.paused) this.play(); else this.pause(); }
  seek(seconds: number) {
    if (!this.track || !Number.isFinite(seconds)) return;
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : this.track.duration;
    try {
      const target=Math.max(0, Math.min(seconds, duration));
      if(this.audio.readyState===0){this.pendingSeek=target;this.publish({currentTime:target});return;}
      this.audio.currentTime = target;
      this.pendingSeek = null;
      this.publish({ currentTime: this.audio.currentTime });
    } catch { /* The stream may not be seekable yet. */ }
  }
  setVolume(percent: number) {
    if (Number.isFinite(percent)) this.audio.volume = Math.max(0, Math.min(percent / 100, 1));
  }
  setMuted(muted: boolean) { this.audio.muted = muted; }
  setRepeat(repeat: boolean) { this.audio.loop = repeat; }
  dispose() {
    this.disposed = true;
    ++this.version;
    for (const [event, listener] of this.listeners) this.audio.removeEventListener(event, listener);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
