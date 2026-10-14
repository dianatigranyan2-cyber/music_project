import { MusicLibrary } from '../../../../components/Music/MusicLibrary';
export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  return <MusicLibrary albumId={(await params).id} />;
}
