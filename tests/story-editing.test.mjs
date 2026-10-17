import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const modules = new Map();
for (const file of ['personalMusic','storyPresentation','storyEditing']) {
  const source = await readFile(new URL('../src/lib/' + file + '.ts', import.meta.url), 'utf8');
  const compiledModule = { exports: {} };
  new Function('require','module','exports', ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(name => modules.get(name.replace('./','')) ?? require(name), compiledModule, compiledModule.exports);
  modules.set(file, compiledModule.exports);
}
const { parseStoryDraft, validateStoryFile } = modules.get('storyEditing');
const { parseStoryPresentation, defaultStoryPresentation, initialStoryPresentation, newStoryLayer } = modules.get('storyPresentation');
const owner = '00000000-0000-4000-8000-000000000001';
const track = '00000000-0000-4000-8000-000000000002';
const draft = { caption: '  Текст  ', mediaPath: owner + '/photo.png', mediaType: 'image', musicTrackId: track, musicStart: 30, musicDuration: 15 };
test('story edits keep explicit clip limits and reject foreign paths and malformed music', () => {
  assert.equal(parseStoryDraft(draft, owner).caption, 'Текст');
  for (const change of [{caption:'x'.repeat(301)},{mediaPath:'other/photo.png'},{mediaPath:owner+'/../photo.png'},{musicTrackId:'bad'},{musicDuration:16},{musicDuration:0},{musicStart:-1},{musicStart:1.5},{mediaType:'html'}]) assert.equal(parseStoryDraft({...draft,...change},owner),null);
  assert.deepEqual(parseStoryDraft({...draft,musicTrackId:null},owner),{...draft,caption:'Текст',musicTrackId:null,musicStart:0,musicDuration:15,presentation:defaultStoryPresentation()});
});

test('visual story data round-trips layout, crop, filters and styles without arbitrary CSS', () => {
  const presentation = { ...defaultStoryPresentation(), filter:'warm', media:{fit:'cover',zoom:1.8,x:30,y:65}, layers:[{...newStoryLayer('text','text','Привет'),x:25,y:35,color:'#c084fc',rotation:12},newStoryLayer('sticker','sticker','❤️'),newStoryLayer('music','music')] };
  assert.deepEqual(parseStoryDraft({...draft,presentation},owner).presentation,presentation);
  for(const change of [{filter:'url(https://bad)'},{media:{fit:'cover',zoom:4,x:50,y:50}},{layers:[{...presentation.layers[0],color:'red;display:none'}]},{layers:[{...presentation.layers[0],x:Infinity}]},{layers:[{...presentation.layers[0],y:-1}]},{layers:[{...presentation.layers[0],font:'url(bad)'}]},{layers:[{...presentation.layers[0],text:'x'.repeat(301)}]},{layers:[newStoryLayer('sticker','a','<script>')]},{layers:[newStoryLayer('music','a'),newStoryLayer('music','b')]},{layers:[newStoryLayer('text','same'),newStoryLayer('text','same')]}]) assert.equal(parseStoryPresentation({...presentation,...change}),null);
  assert.equal(parseStoryDraft({...draft,musicTrackId:null,presentation},owner),null);
  assert.equal(parseStoryPresentation({...presentation,layers:Array.from({length:21},(_,i)=>newStoryLayer('sticker','id'+i,'✨'))}),null);
});

test('old stories acquire editable captions and music stickers; removed tracks leave no stale music layer', () => {
  const legacy=initialStoryPresentation({},'Старый текст',true);
  assert.equal(legacy.layers.find(layer=>layer.kind==='text').text,'Старый текст');
  assert.equal(legacy.layers.filter(layer=>layer.kind==='music').length,1);
  assert.deepEqual(initialStoryPresentation(legacy,'Старый текст',true),legacy);
  assert.equal(initialStoryPresentation(legacy,'Старый текст',false).layers.filter(layer=>layer.kind==='music').length,0);
  assert.equal(legacy.layers.length,2);
});
test('story uploads reject disguised media, empty and oversized files', async () => {
  assert.equal(await validateStoryFile(new File([new Uint8Array([137,80,78,71,13,10,26,10])],'photo.png',{type:'image/png'})),null);
  assert.equal(await validateStoryFile(new File([new Uint8Array([0,0,0,20,102,116,121,112])],'video.mp4',{type:'video/mp4'})),null);
  assert.ok(await validateStoryFile(new File(['<script>bad</script>'],'photo.png',{type:'image/png'})));
  assert.ok(await validateStoryFile(new File([],'empty.png',{type:'image/png'})));
  assert.ok(await validateStoryFile({size:51*1024*1024}));
});
