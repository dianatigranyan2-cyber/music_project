import type {Track} from '../types';
export interface FriendActivity {id:string;name:string;username:string;avatarUrl:string|null;trackId:string|null;playing:boolean;canJoin:boolean;position:number;anchoredAt:string|null}
export interface FollowState {id:string;name:string;trackId:string;playing:boolean;position:number;anchoredAt:string}
export interface FriendListeningState {friends:FriendActivity[];following:FollowState|null;listeners:{id:string;name:string;joinId:string}[];serverNow:string;preferences:{broadcast:boolean;allowFollow:boolean}}
export interface ListeningController {id:string;name:string;toggleSound:()=>void;soundEnabled:()=>boolean}
export const validMusicId=(id:unknown):id is string=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function friendPosition(activity:FollowState,serverNow:string,elapsedMs=0,duration=Infinity){return Math.max(0,Math.min(duration,activity.position+(activity.playing?Math.max(0,(Date.parse(serverNow)-Date.parse(activity.anchoredAt)+elapsedMs)/1000):0)));}
export function listeningTrack(activity:FriendActivity,tracks:Track[]){return activity.playing?tracks.find(t=>t.id===activity.trackId):undefined;}
