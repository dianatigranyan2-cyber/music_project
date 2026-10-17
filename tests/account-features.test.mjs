import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordProblem} from '../src/lib/passwords.ts';
import {authErrorMessage} from '../src/lib/authErrors.ts';
import {parseCatalogMetadata,audioExtension} from '../src/lib/catalogAdmin.ts';
import {parseMusicMessage,musicMessageContent} from '../src/lib/musicMessages.ts';
test('password confirmation compares exact values and enforces limits',()=>{
 assert.equal(passwordProblem('six123','six123'),null);
 for(const [password,confirm] of [['short','short'],['six123','Six123'],['six123','six123 '],['a'.repeat(73),'a'.repeat(73)]])assert.ok(passwordProblem(password,confirm));
});
test('auth errors distinguish same password, email quota, expired links and network failures',()=>{
 assert.match(authErrorMessage({code:'same_password'},'password'),/совпадает с прежним/);
 assert.doesNotMatch(authErrorMessage({code:'same_password'},'password'),/истекла/);
 assert.match(authErrorMessage({code:'over_email_send_rate_limit',status:429},'recovery'),/Лимит отправки писем/);
 assert.doesNotMatch(authErrorMessage({code:'over_email_send_rate_limit'},'recovery'),/проверьте адрес/i);
 assert.match(authErrorMessage({code:'email_address_not_authorized'},'recovery'),/недоступна/);
 assert.match(authErrorMessage({code:'bad_code_verifier'},'password'),/том же браузере/);
 assert.match(authErrorMessage({name:'AuthRetryableFetchError'},'recovery'),/интернет/);
 assert.doesNotMatch(authErrorMessage({message:'SECRET'},'password'),/SECRET/);
});
test('catalog requires real metadata and a supported license',()=>{
 const good={title:' Song ',artist:' Artist ',album:'',genre:'Поп',source_url:'https://example.org/license',attribution:'Artist — Song, CC BY 4.0, original source above',license_code:'CC-BY-4.0',is_published:true};
 assert.equal(parseCatalogMetadata(good).title,'Song');
 for(const patch of [{artist:''},{title:'x'.repeat(201)},{source_url:'javascript:alert(1)'},{source_url:'http://example.org'},{license_code:'unknown'},{is_published:'true'},{attribution:'unknown'},{id:'broken'}])assert.equal(parseCatalogMetadata({...good,...patch}),null);
});
test('audio upload checks content signature and file size',()=>{
 const mp3=new Uint8Array(10000);mp3.set([73,68,51]);assert.equal(audioExtension(mp3),'mp3');
 const m4a=new Uint8Array(10000);m4a.set([102,116,121,112],4);assert.equal(audioExtension(m4a),'m4a');
 assert.equal(audioExtension(new Uint8Array(10000)),null);assert.equal(audioExtension(mp3.slice(0,10)),null);
});
test('music cards encode IDs only and do not trust sender titles, images or URLs',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 for(const kind of ['track','playlist'])assert.deepEqual(parseMusicMessage(musicMessageContent({kind,id})),{kind,id});
 for(const content of ['https://evil.test',musicMessageContent({kind:'track',id})+'\nspoof',musicMessageContent({kind:'track',id:'javascript:alert(1)'})])assert.equal(parseMusicMessage(content),null);
});
