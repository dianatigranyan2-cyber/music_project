import assert from 'node:assert/strict';
import test from 'node:test';
import {createActivityUpdater} from '../src/lib/userActivity.ts';

test('hidden/offline activity is skipped; returning online writes and duplicate events are throttled', async()=>{
  let visible=false, online=true, clock=0, calls=0;
  const updater=createActivityUpdater({available:()=>visible&&online,now:()=>clock,warn:()=>assert.fail('unexpected warning'),write:async()=>{calls++;return {error:null};}});
  await updater.touch();assert.equal(calls,0);
  visible=true;online=false;await updater.touch();assert.equal(calls,0);
  online=true;await updater.touch();await updater.touch();assert.equal(calls,1);
  clock=30_000;await updater.touch();assert.equal(calls,2);
  updater.dispose();
});

test('failed requests retain diagnostics, retry, and report repeated failures only once until recovery',async()=>{
  let error={code:'42501',message:'permission denied'}, calls=0, clock=0;
  const warnings=[];
  const updater=createActivityUpdater({available:()=>true,now:()=>clock,warn:text=>warnings.push(text),write:async()=>{calls++;return {error};}});
  await updater.touch();await updater.touch();
  assert.equal(calls,2);assert.equal(warnings.length,1);assert.match(warnings[0],/42501: permission denied/);
  error=null;await updater.touch();
  clock=30_000;error={code:'42501',message:'permission denied'};await updater.touch();
  assert.equal(warnings.length,2);updater.dispose();
});

test('only one request may run; disposing cancels it without logging a navigation error',async()=>{
  let signal, finish, calls=0;
  const warnings=[];
  const updater=createActivityUpdater({available:()=>true,warn:text=>warnings.push(text),write:value=>{calls++;signal=value;return new Promise(resolve=>finish=resolve);}});
  const request=updater.touch();await updater.touch();assert.equal(calls,1);
  updater.dispose();assert.equal(signal.aborted,true);
  finish({error:new DOMException('aborted','AbortError')});await request;
  await updater.touch();assert.equal(calls,1);assert.deepEqual(warnings,[]);
});

test('a request interrupted after the tab becomes hidden does not report an app error',async()=>{
  let available=true, finish;
  const updater=createActivityUpdater({available:()=>available,warn:()=>assert.fail('hidden-tab failure was reported'),write:()=>new Promise(resolve=>finish=resolve)});
  const request=updater.touch();available=false;
  finish({error:new TypeError('Failed to fetch')});await request;updater.dispose();
});

test('timed-out requests are aborted and the next activity can retry successfully',async()=>{
  let calls=0;
  const warnings=[];
  const updater=createActivityUpdater({available:()=>true,timeoutMs:5,warn:text=>warnings.push(text),write:signal=>{
    calls++;if(calls>1)return Promise.resolve({error:null});
    return new Promise(resolve=>signal.addEventListener('abort',()=>resolve({error:new DOMException('aborted','AbortError')}),{once:true}));
  }});
  await updater.touch();assert.match(warnings[0],/время ожидания/);
  await updater.touch();assert.equal(calls,2);updater.dispose();
});
