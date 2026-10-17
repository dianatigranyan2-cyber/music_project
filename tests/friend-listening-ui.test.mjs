import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {Avatar} from './helpers/avatar.mjs';
const css=await readFile(new URL('../src/components/FriendCard/FriendCard.module.css',import.meta.url),'utf8');
const styles=Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m=>[m[1],m[1]]));
const require=createRequire(import.meta.url);let following=null;let canJoin=true;let listeners=[];const calls=[];
const state=()=>({following,listeners,friends:[{id:'friend',canJoin}],busy:false,follow:id=>calls.push(['follow',id]),leave:()=>calls.push(['leave'])});
async function load(path){
 const source=await readFile(new URL(path,import.meta.url),'utf8');const compiledModule={exports:{}};
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',compiled)(name=>name.endsWith('FriendListeningContext')?{useFriendListening:state}:name.endsWith('Avatar')?{Avatar}:name.endsWith('.css')?styles:require(name),compiledModule,compiledModule.exports);
 return compiledModule.exports;
}
const {FriendCard}=await load('../src/components/FriendCard/FriendCard.tsx');
const friend={id:'friend',name:'Друг',username:'friend',avatarUrl:'/default-avatar.png',isOnline:true,currentTrack:{id:'song',title:'Песня',artist:'Исполнитель',coverUrl:'/music-placeholder.svg'}};
const button=node=>{if(!React.isValidElement(node))return null;if(node.type==='button'&&node.props.className?.includes('listenTogetherBtn'))return node;for(const child of React.Children.toArray(node.props.children)){const result=button(child);if(result)return result;}return null;};
test('listening together attaches to the friend ID, even when another friend plays the same song',()=>{
 following={id:'other-friend'};canJoin=true;calls.length=0;
 const view=FriendCard({friend});assert.match(renderToStaticMarkup(view),/Слушать вместе/);button(view).props.onClick();assert.deepEqual(calls,[['follow','friend']]);
});
test('the joined friend has a disconnect action instead of replaying the song locally',()=>{
 following={id:'friend'};calls.length=0;const view=FriendCard({friend});assert.match(renderToStaticMarkup(view),/Отключиться/);button(view).props.onClick();assert.deepEqual(calls,[['leave']]);
});
test('disabled joining and idle friends do not offer an active join button',()=>{
 following=null;canJoin=false;assert.equal(button(FriendCard({friend})).props.disabled,true);assert.match(renderToStaticMarkup(FriendCard({friend})),/Совместное прослушивание отключено/);
 assert.equal(button(FriendCard({friend:{...friend,currentTrack:undefined}})),null);
});
test('a friend connected to my playback shows listens with you until they disconnect',()=>{
 following=null;listeners=[{id:'friend',name:'Друг'}];
 for(const item of [friend,{...friend,currentTrack:undefined}]){
  const view=FriendCard({friend:item});const html=renderToStaticMarkup(view);
  assert.match(html,/Слушает с вами/);assert.doesNotMatch(html,/Сейчас ничего не слушает/);assert.equal(button(view),null);
 }
 listeners=[];assert.match(renderToStaticMarkup(FriendCard({friend:{...friend,currentTrack:undefined}})),/Сейчас ничего не слушает/);
});
