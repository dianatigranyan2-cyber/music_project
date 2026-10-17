import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {AppIcon} from './helpers/app-icon.mjs';
const require=createRequire(import.meta.url);
let open=false;
const react={...React,useState:()=>[open,value=>{open=typeof value==='function'?value(open):value;}],useEffect(){},useId:()=>':actions:',useRef:()=>({current:null})};
const styles={__esModule:true,default:{wrapper:'wrapper',trigger:'trigger',menu:'menu',item:'item'}};
const source=await readFile(new URL('../src/components/Messages/ChatActions.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const compiledModule={exports:{}};
function BlockUser({placement}){return React.createElement('button',{'data-placement':placement},'Заблокировать');}
new Function('require','module','exports',code)(name=>name==='react'?react:name.endsWith('.css')?styles:name.endsWith('AppIcon')?{AppIcon}:name.endsWith('BlockUser')?{BlockUser}:require(name),compiledModule,compiledModule.exports);
const {ChatActions}=compiledModule.exports;
const props={peerId:'friend',name:'Друг',musicDisabled:false,onMusic(){}};
test('chat actions are hidden until the horizontal dots button opens them',()=>{
 open=false;let tree=ChatActions(props);const html=renderToStaticMarkup(tree);
 assert.match(html,/Действия чата/);assert.match(html,/⋯/);assert.doesNotMatch(html,/Отправить музыку|Заблокировать/);
 tree.props.children[0].props.onClick();tree=ChatActions(props);const expanded=renderToStaticMarkup(tree);
 assert.match(expanded,/aria-expanded="true"/);assert.match(expanded,/Отправить музыку/);assert.match(expanded,/Заблокировать/);assert.match(expanded,/data-placement="menu"/);
});
test('choosing music closes the menu and invokes the picker once',()=>{
 open=true;let calls=0;const tree=ChatActions({...props,onMusic(){calls++;}});
 tree.props.children[1].props.children[0].props.onClick();assert.equal(open,false);assert.equal(calls,1);
 open=true;assert.match(renderToStaticMarkup(ChatActions({...props,musicDisabled:true})),/disabled=""/);
});
