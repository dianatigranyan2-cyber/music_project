import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const source=await readFile(new URL('../../src/components/Profile/Avatar.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const compiledModule={exports:{}};
new Function('require','module','exports',compiled)(name=>name.endsWith('.css')?{default:{image:'avatarImage',fill:'avatarFill',fallback:'avatarFallback'}}:require(name),compiledModule,compiledModule.exports);
export const {Avatar}=compiledModule.exports;
