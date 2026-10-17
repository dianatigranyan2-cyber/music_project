import {SharedPlaylist} from '../../../../components/Music/SharedPlaylist';
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <SharedPlaylist token={token}/>;}
