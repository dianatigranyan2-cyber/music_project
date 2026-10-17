import {MoodPage} from '../../../../components/Music/MoodPage';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <MoodPage id={id}/>;}
