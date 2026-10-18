import test from 'node:test';
import assert from 'node:assert/strict';
import {groupMessageReactions,MESSAGE_EMOJIS} from '../src/lib/messageInteractions.ts';
test('reaction counts are distinct per participant and removal or another message is excluded',()=>{
 const rows=[{message_id:'a',user_id:'me',emoji:'❤️'},{message_id:'a',user_id:'you',emoji:'❤️'},{message_id:'a',user_id:'me',emoji:'❤️'},{message_id:'b',user_id:'other',emoji:'🔥'},{message_id:'a',user_id:'gone',emoji:null}];
 assert.deepEqual(groupMessageReactions(rows,'a','me'),[{emoji:'❤️',count:2,mine:true}]);
 assert.deepEqual(groupMessageReactions(rows,'b','me'),[{emoji:'🔥',count:1,mine:false}]);
 assert.equal(MESSAGE_EMOJIS.length,8);
});
