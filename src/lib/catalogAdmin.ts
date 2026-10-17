export const CATALOG_LICENSES: Record<string,string> = {
  'CC-BY-4.0':'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-SA-3.0':'https://creativecommons.org/licenses/by-sa/3.0/',
};
export function parseCatalogMetadata(value: unknown) {
  if(!value||typeof value!=='object')return null;
  const v=value as Record<string,unknown>;
  const fields=['title','artist','album','genre','source_url','attribution','license_code'] as const;
  if(fields.some(key=>typeof v[key]!=='string'))return null;
  const data=Object.fromEntries(fields.map(key=>[key,(v[key] as string).trim()])) as Record<typeof fields[number],string>;
  if(!data.title||data.title.length>200||!data.artist||data.artist.length>200||data.album.length>200||!data.genre||data.genre.length>100||data.attribution.length<21||data.attribution.length>3000||!CATALOG_LICENSES[data.license_code]||typeof v.is_published!=='boolean')return null;
  try{if(new URL(data.source_url).protocol!=='https:')return null;}catch{return null;}
  if(v.id!==null&&v.id!==undefined&&(typeof v.id!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v.id)))return null;
  return {...data,id:v.id??null,is_published:v.is_published,license_url:CATALOG_LICENSES[data.license_code]};
}
export function audioExtension(bytes: Uint8Array): 'mp3'|'m4a'|null {
  if(bytes.length<10000||bytes.length>52428800)return null;
  if(bytes[0]===73&&bytes[1]===68&&bytes[2]===51||bytes[0]===255&&(bytes[1]&224)===224)return 'mp3';
  if(String.fromCharCode(...bytes.slice(4,8))==='ftyp')return 'm4a';
  return null;
}
