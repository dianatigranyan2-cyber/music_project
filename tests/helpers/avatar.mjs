import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';

const require=createRequire(import.meta.url);
const source=await readFile(new URL('../../src/components/Profile/Avatar.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const compiledModule={exports:{}};
function TestLink({children,...props}) { return React.createElement('a',props,children); }
new Function('require','module','exports',compiled)(name=>name==='next/link'?{default:TestLink}:name.endsWith('.css')?{default:{image:'avatarImage',fill:'avatarFill',fallback:'avatarFallback',profileLink:'profileLink'}}:require(name),compiledModule,compiledModule.exports);
export const {Avatar}=compiledModule.exports;
