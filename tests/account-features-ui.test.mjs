import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {AppIcon} from './helpers/app-icon.mjs';
import {passwordProblem} from '../src/lib/passwords.ts';
import {authErrorMessage} from '../src/lib/authErrors.ts';
import {parseMusicMessage,musicMessageContent} from '../src/lib/musicMessages.ts';
const require=createRequire(import.meta.url);
let auth={user:null,loading:false};let library={tracks:[]};let following=null;let PasswordInput;
async function load(path){
 const source=await readFile(new URL(path,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const compiledModule={exports:{}};
 const dependencies=name=>{
  if(name.endsWith('AppIcon'))return {AppIcon};
  if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  if(name==='next/link')return function TestLink({children,...props}){return React.createElement('a',props,children);};
  if(name==='next/navigation')return {useRouter:()=>({push(){}})};
  if(name.endsWith('AuthContext'))return {useAuth:()=>auth};
  if(name.endsWith('useMusicLibrary'))return {useMusicLibrary:()=>({library,error:''})};
  if(name.endsWith('PlayerContext'))return {usePlayer:()=>({playTrack(){},listeningControl:following})};
  if(name.endsWith('PasswordInput'))return {PasswordInput};
  if(name.endsWith('passwords'))return {passwordProblem};
  if(name.endsWith('authErrors'))return {authErrorMessage};
  if(name.endsWith('musicMessages'))return {parseMusicMessage};
  if(name.endsWith('supabase/client'))return {createClient:()=>{throw new Error('No live auth requests in UI tests');}};
  return require(name);
 };
 new Function('require','module','exports',code)(dependencies,compiledModule,compiledModule.exports);return compiledModule.exports;
}
({PasswordInput}=await load('../src/components/Auth/PasswordInput.tsx'));
const RegisterPage=(await load('../src/app/register/page.tsx')).default;
const LoginPage=(await load('../src/app/login/page.tsx')).default;
const {ResetPasswordForm}=await load('../src/app/reset-password/ResetPasswordForm.tsx');
const {MusicMessageCard}=await load('../src/components/Messages/MusicMessageCard.tsx');
const render=(component,props={})=>renderToStaticMarkup(React.createElement(component,props));
test('registration offers two independently labelled, hidden password fields with eye controls',()=>{
 const html=render(RegisterPage);assert.equal((html.match(/type="password"/g)||[]).length,2);assert.equal((html.match(/aria-label="Показать пароль"/g)||[]).length,2);assert.match(html,/for="password-confirmation"/);assert.equal((html.match(/autoComplete="new-password"/g)||[]).length,2);
});
test('login exposes password recovery and preserves current-password autofill',()=>{
 const html=render(LoginPage);assert.match(html,/href="\/forgot-password"/);assert.match(html,/autoComplete="current-password"/);assert.match(html,/aria-label="Показать пароль"/);
});
test('expired recovery does not allow changing a logged-in account password',()=>{
 auth={user:{id:'me'},loading:false};const html=render(ResetPasswordForm,{expired:true});assert.match(html,/Ссылка недействительна/);assert.doesNotMatch(html,/<form/);assert.match(html,/href="\/forgot-password"/);auth={user:null,loading:false};assert.doesNotMatch(render(ResetPasswordForm,{expired:false}),/<form/);
});
test('song cards resolve real catalog data, handle removal and respect the listening host',()=>{
 const id='00000000-0000-4000-8000-000000000001';const content=musicMessageContent({kind:'track',id});library={tracks:[{id,title:'Real song',artist:'Real artist',coverUrl:'/real-cover.png'}]};
 const html=render(MusicMessageCard,{content});assert.match(html,/Real song/);assert.match(html,/Real artist/);assert.match(html,/src="\/real-cover.png"/);assert.match(html,/aria-label="Слушать: Real song"/);assert.doesNotMatch(html,/disabled=/);
 following={id:'host'};assert.match(render(MusicMessageCard,{content}),/disabled=/);following=null;library={tracks:[]};assert.match(render(MusicMessageCard,{content}),/Трек больше недоступен/);
});
