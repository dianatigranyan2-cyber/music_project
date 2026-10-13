export interface NotificationActor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  actor: NotificationActor | null;
}

interface NotificationPresentation {
  icon: string;
  text: string;
  href: string | null;
}

type NotificationPresenter = (notification: AppNotification) => NotificationPresentation;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Add a presenter here when introducing a new event. The database type is text,
// so new kinds do not require changing an enum or rebuilding the inbox.
const presenters = new Map<string, NotificationPresenter>([
  ['story_like', ({ payload }) => ({
    icon: '❤️',
    text: 'нравится ваша история',
    href: typeof payload.story_id === 'string' && uuidPattern.test(payload.story_id)
      ? `/stories/${payload.story_id}`
      : null,
  })],
  ['friend_request_received', () => ({
    icon: '👋',
    text: 'отправляет вам заявку в друзья',
    href: '/friends?tab=requests',
  })],
  ['friend_request_accepted', () => ({
    icon: '🤝',
    text: 'принимает вашу заявку в друзья',
    href: '/friends',
  })],
]);

export function presentNotification(notification: AppNotification): NotificationPresentation {
  return presenters.get(notification.type)?.(notification) ?? {
    icon: '🔔',
    text: 'Новое уведомление',
    href: null,
  };
}

export function notificationActorName(notification: AppNotification): string {
  return notification.actor?.display_name?.trim()
    || notification.actor?.username
    || 'Пользователь';
}

export function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}
