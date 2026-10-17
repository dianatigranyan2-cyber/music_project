export type MusicMessage={kind:'track'|'playlist';id:string};
export function musicMessageContent(item:MusicMessage):string {
  return `♫ Melo · ${item.kind==='track'?'Трек':'Плейлист'}\nmelo:${item.kind}:${item.id}`;
}
export function parseMusicMessage(content:string):MusicMessage|null {
  const match=/^♫ Melo · (?:Трек|Плейлист)\nmelo:(track|playlist):([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.exec(content);
  return match?{kind:match[1].toLowerCase() as MusicMessage['kind'],id:match[2]}:null;
}
