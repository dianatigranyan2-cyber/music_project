import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {AppIcon} from './helpers/app-icon.mjs';
import {filterMusic} from '../src/lib/musicLibrary.ts';

const require=createRequire(import.meta.url);
let open=false,context,effects=[],refIndex=0,focusCalls=0;
const listeners=new Map();
const root={current:{contains:target=>target==='inside'}};
const trigger={current:{focus:()=>focusCalls++}};
const react={...React,useState:()=>[open,value=>{open=value;}],useEffect:fn=>effects.push(fn),useRef:()=>refIndex++===0?root:trigger,useId:()=>':playlist-menu:'};
const source=await readFile(new URL('../src/components/Music/TrackActions.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const compiledModule={exports:{}};
new Function('require','module','exports',code)(name=>name==='react'?react:name==='next/link'?function TestLink({children,...props}){return React.createElement('a',props,children);}:name.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>key})}:name.endsWith('AppIcon')?{AppIcon}:name.endsWith('PersonalMusicContext')?{usePersonalMusic:()=>context}:require(name),compiledModule,compiledModule.exports);
const {PlaylistButton}=compiledModule.exports;
const track={id:'song',title:'Песня',source:'library'};
const render=()=>{refIndex=0;effects=[];return PlaylistButton({track});};
function reset(){
 open=false;focusCalls=0;listeners.clear();
 const playlist={id:'playlist',title:'Мой плейлист',trackIds:[]};const calls=[];
 context={data:{playlists:[playlist]},busy:false,loading:false,signedIn:true,error:'',mutate:async action=>{calls.push(action);playlist.trackIds=action.action==='add'?['song']:[];return true;}};
 return {playlist,calls};
}
function playlistButton(tree){
 let found;const walk=node=>{if(!React.isValidElement(node))return;if(node.type==='button'&&typeof node.props['aria-pressed']==='boolean')found=node;React.Children.forEach(node.props.children,walk);};walk(tree);return found;
}

test('the same playlist button adds then removes a song and remains available for a second press',async()=>{
 const {calls}=reset();render().props.children[0].props.onClick();assert.equal(open,true);
 let item=playlistButton(render());assert.equal(item.props['aria-pressed'],false);await item.props.onClick();
 item=playlistButton(render());assert.equal(item.props['aria-pressed'],true);assert.equal(item.props.disabled,false);assert.equal(open,true);await item.props.onClick();
 assert.deepEqual(calls,[{action:'add',playlistId:'playlist',trackId:'song'},{action:'remove',playlistId:'playlist',trackId:'song'}]);assert.equal(playlistButton(render()).props['aria-pressed'],false);
});
test('an outside press closes the menu, inside presses do not; Escape restores focus',()=>{
 reset();open=true;const previous=globalThis.document;
 globalThis.document={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type)=>listeners.delete(type)};
 try {
  const tree=render();const cleanup=effects[0]();assert.doesNotMatch(renderToStaticMarkup(tree),/Закрыть выбор плейлиста|✕/);
  listeners.get('pointerdown')({target:'inside'});assert.equal(open,true);listeners.get('pointerdown')({target:'outside'});assert.equal(open,false);
  open=true;listeners.get('keydown')({key:'Escape'});assert.equal(open,false);assert.equal(focusCalls,1);cleanup();assert.equal(listeners.size,0);
 } finally {globalThis.document=previous;}
});
test('failed changes keep the previous membership and show the error; pending changes disable toggles',async()=>{
 reset();open=true;context.mutate=async()=>{context.error='Не удалось сохранить';return false;};await playlistButton(render()).props.onClick();assert.equal(playlistButton(render()).props['aria-pressed'],false);assert.match(renderToStaticMarkup(render()),/Не удалось сохранить/);context.busy=true;assert.equal(playlistButton(render()).props.disabled,true);
});

const pageSource=await readFile(new URL('../src/app/playlists/page.tsx',import.meta.url),'utf8');
const pageCode=ts.transpileModule(pageSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const pageModule={exports:{}};
let stateIndex=0;
const states=['my','','playlist',null,false,''];
const pageReact={...React,useState:()=>[states[stateIndex++],()=>{}]};
new Function('require','module','exports',pageCode)(name=>{
 if(name==='react')return pageReact;
 if(name==='next/link')return function TestLink({children,...props}){return React.createElement('a',props,children);};
 if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>key})};
 if(name.endsWith('AppIcon'))return {AppIcon};
 if(name.endsWith('PersonalMusicContext'))return {usePersonalMusic:()=>context};
 if(name.endsWith('useMusicLibrary'))return {useMusicLibrary:()=>({library:{tracks:[track]},error:''})};
 if(name.endsWith('PlayerContext'))return {usePlayer:()=>({playTrack(){}})};
 if(name.endsWith('MusicLists'))return {MusicTracks:()=>null};
 if(name.endsWith('PlaylistDialog'))return {PlaylistDialog:({children})=>children};
 if(name.endsWith('PlaylistCover'))return {PlaylistCover:()=>React.createElement('span',null,'Playlist cover')};
 if(name.endsWith('SaveMusicButton'))return {SaveMusicButton:()=>null};
 if(name.endsWith('musicLibrary'))return {filterMusic};
 if(name.endsWith('SortablePlaylistTracks'))return {SortablePlaylistTracks:({trackIds})=>React.createElement('div',{'data-sortable-ids':trackIds.join(',')})};
 if(name.endsWith('PlaylistOptions'))return {PlaylistOptions:({children})=>React.createElement('details',null,React.createElement('summary',null,'⋯'),children)};
 return require(name);
},pageModule,pageModule.exports);

test('an opened playlist starts with its title, uses sortable songs and puts management in dots',()=>{
 reset();context.data.playlists[0].trackIds=['song'];stateIndex=0;
 const html=renderToStaticMarkup(React.createElement(pageModule.exports.default));
 assert.match(html,/<h1[^>]*>Мой плейлист<\/h1>/);assert.match(html,/data-sortable-ids="song"/);assert.match(html,/<summary>⋯<\/summary>/);
 assert.doesNotMatch(html,/Моя музыка|Любимые песни и личные подборки|Мои плейлисты \(|Playlist cover|type="file"|Загрузить обложку|Убрать из плейлиста|Выше:|Ниже:/);
 assert.match(html,/Изменить плейлист/);assert.match(html,/Удалить плейлист/);assert.match(html,/Включить доступ по ссылке/);
});
