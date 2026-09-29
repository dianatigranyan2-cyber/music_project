import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/AppShell/AppShell';

export const metadata: Metadata = {
  title: 'Melo — Социальная музыкальная платформа',
  description: 'Слушайте музыку вместе с друзьями в реальном времени, делитесь треками и общайтесь.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
