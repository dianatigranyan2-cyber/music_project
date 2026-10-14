import { MusicLibrary } from '../../../../components/Music/MusicLibrary';
export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  return <MusicLibrary artistId={(await params).id} />;
}
