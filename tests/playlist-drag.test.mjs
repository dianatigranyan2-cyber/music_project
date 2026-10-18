import test from 'node:test';
import assert from 'node:assert/strict';
import {createHoldToDrag,playlistOrderBefore} from '../src/lib/holdToDrag.ts';

function setup(){
 let fire=null;const events=[];
 const control=createHoldToDrag({start:point=>events.push(['start',point.id]),move:(x,y)=>events.push(['move',x,y]),end:()=>events.push(['save']),cancel:()=>events.push(['cancel'])},{set:fn=>{fire=fn;return 1;},clear:()=>{fire=null;}});
 return {control,events,hold:()=>fire?.()};
}
test('a normal tap never starts reordering or saves a new order',()=>{
 const {control,events,hold}=setup();control.begin({id:'a',x:20,y:40});assert.equal(control.end(),false);hold();assert.deepEqual(events,[]);
});
test('scrolling before the hold delay cancels dragging without blocking the scroll',()=>{
 const {control,events,hold}=setup();control.begin({id:'a',x:20,y:40});control.move(20,60);hold();assert.equal(control.isActive(),false);assert.deepEqual(events,[]);
});
test('holding activates dragging and releasing commits exactly once',()=>{
 const {control,events,hold}=setup();control.begin({id:'a',x:20,y:40});assert.equal(control.isActive(),false);hold();control.move(20,180);assert.equal(control.isActive(),true);assert.equal(control.end(),true);control.end();assert.deepEqual(events,[['start','a'],['move',20,180],['save']]);
});
test('cancelled gestures do not save and cannot activate later',()=>{
 const {control,events,hold}=setup();control.begin({id:'a',x:0,y:0});control.cancel();hold();assert.deepEqual(events,[]);control.begin({id:'b',x:0,y:0});hold();control.cancel();control.end();assert.deepEqual(events,[['start','b'],['cancel']]);
});
test('moving a song up, down or to the end keeps all tracks including unavailable ones',()=>{
 const ids=['a','unavailable','b','c'];assert.deepEqual(playlistOrderBefore(ids,'c','a'),['c','a','unavailable','b']);assert.deepEqual(playlistOrderBefore(ids,'a','c'),['unavailable','b','a','c']);assert.deepEqual(playlistOrderBefore(ids,'a',null),['unavailable','b','c','a']);assert.deepEqual(ids,['a','unavailable','b','c']);
 for(const [id,before] of [['missing','b'],['a','missing'],['a','a']])assert.deepEqual(playlistOrderBefore(ids,id,before),ids);
});
