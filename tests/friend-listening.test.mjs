import test from 'node:test';
import assert from 'node:assert/strict';
import {friendPosition,listeningTrack,validMusicId} from '../src/lib/friendListening.ts';
import {presentNotification} from '../src/lib/notifications.ts';
test('friend synchronization uses server time and monotonic elapsed time, and freezes on pause',()=>{
 const activity={playing:true,position:10,anchoredAt:'2026-10-15T10:00:00Z'};
 assert.equal(friendPosition(activity,'2026-10-15T10:00:02Z',500),12.5);
 assert.equal(friendPosition({...activity,playing:false},'2026-10-15T10:00:02Z',10000),10);
 assert.equal(friendPosition(activity,'2026-10-15T09:59:00Z'),10);
 assert.equal(friendPosition(activity,'2026-10-15T10:00:02Z',500,11),11);
});
test('friends display real available music only while it is actually playing',()=>{
 const track={id:'a'};assert.equal(listeningTrack({playing:true,trackId:'a'},[track]),track);
 assert.equal(listeningTrack({playing:false,trackId:'a'},[track]),undefined);
 assert.equal(listeningTrack({playing:true,trackId:'unpublished'},[track]),undefined);
 assert.equal(validMusicId('1'),false);assert.equal(validMusicId('00000000-0000-4000-8000-000000000001'),true);
});
test('a friend joining listening has its own bell notification and opens friends',()=>{
 assert.deepEqual(presentNotification({type:'music_listener_joined',payload:{}}),{icon:'🎧',text:'присоединяется к вашему прослушиванию',href:'/friends'});
});
