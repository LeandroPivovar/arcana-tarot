import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {cards,spreads} from '../src/data.ts';
import {shuffleDeck,randomIndex,chooseMethod,interpretReading} from '../src/services.ts';

test('o baralho contém 78 cartas únicas, com imagens e significados',()=>{
 assert.equal(cards.length,78);assert.equal(new Set(cards.map(c=>c.id)).size,78);assert.equal(new Set(cards.map(c=>c.name)).size,78);
 assert.equal(cards.filter(c=>c.suit==='Arcanos maiores').length,22);
 for(const suit of ['Paus','Copas','Espadas','Ouros'])assert.equal(cards.filter(c=>c.suit===suit).length,14);
 for(const c of cards){assert.ok(existsSync(`public${c.image}`),c.name);assert.equal(c.keywords.length,3);assert.ok(c.message.length>50);}
});
test('nove métodos possuem todas as posições e coordenadas',()=>{
 assert.equal(spreads.length,9);assert.deepEqual(spreads.map(s=>s.positions.length),[1,3,3,5,5,7,10,7,4]);
 for(const s of spreads){assert.equal(s.positions.length,s.layout.length);assert.equal(new Set(s.positions).size,s.positions.length);for(const [x,y] of s.layout){assert.ok(x>0&&x<100&&y>0&&y<100);}}
});
test('Fisher-Yates preserva todas as cartas e não modifica a origem',()=>{
 const order=cards.map(c=>c.id);let changed=false;
 for(let n=0;n<20;n++){const deck=shuffleDeck();assert.equal(deck.length,78);assert.equal(new Set(deck.map(c=>c.id)).size,78);assert.deepEqual(deck.map(c=>c.id).sort((a,b)=>a-b),order);changed ||= deck.some((c,i)=>c.id!==order[i]);}
 assert.ok(changed);assert.deepEqual(cards.map(c=>c.id),order);assert.deepEqual(shuffleDeck([]),[]);
});
test('sorteio respeita limites e rejeita intervalos inválidos',()=>{
 for(const bound of [1,3,7,78])for(let i=0;i<100;i++){const n=randomIndex(bound);assert.ok(n>=0&&n<bound);}
 for(const bound of [0,-1,2.5,NaN,Infinity])assert.throws(()=>randomIndex(bound));
});
test('seleção local retorna um dos nove métodos',async()=>{for(let i=0;i<30;i++){const result=await chooseMethod('O que posso aprender?');assert.ok(spreads.includes(result.method));assert.equal(result.notice,undefined);}});
test('leitura local mantém cartas, posições e ordem em todos os métodos',async()=>{
 for(const method of spreads){const selected=shuffleDeck().slice(0,method.positions.length);const r=await interpretReading({question:'O que posso aprender?',method,selected});assert.equal(r.source,'local');assert.deepEqual(r.cards.map(c=>c.cardId),selected.map(c=>c.id));assert.deepEqual(r.cards.map(c=>c.position),method.positions);assert.ok(r.summary.length>40);assert.ok(r.reflection.length>20);}
});
test('integração aceita respostas válidas e recupera respostas inválidas ou falhas',async()=>{
 const original=globalThis.fetch;const method=spreads[1];const selected=cards.slice(0,3);const input={question:'Qual o próximo passo?',method,selected};
 try{
 let payload:any;
 globalThis.fetch=async (_url,init)=>{payload=JSON.parse(init!.body as string);return Response.json({methodId:'linear'})};
 assert.equal((await chooseMethod(input.question,'/api/method')).method.id,'linear');assert.equal(payload.methods.length,9);
 globalThis.fetch=async (_url,init)=>{payload=JSON.parse(init!.body as string);return Response.json({summary:'Uma leitura personalizada.',reflection:'Qual caminho você deseja explorar?',cards:selected.map((c,i)=>({cardId:c.id,position:method.positions[i],text:'Um conselho para refletir.'}))})};
 assert.equal((await interpretReading(input,'/api/interpret')).source,'ai');assert.equal(payload.cards[0].orientation,'upright');assert.equal(payload.question,input.question);
 for(const invalid of [{methodId:'inventado'},{summary:'incompleta',cards:[]},{summary:'x',reflection:'y',cards:[null,null,null]}]){
 globalThis.fetch=async()=>Response.json(invalid);assert.ok((await chooseMethod(input.question,'/api/method')).notice);const result=await interpretReading(input,'/api/interpret');assert.equal(result.source,'local');assert.ok(result.notice);
 }
 globalThis.fetch=async()=>{throw new Error('offline')};assert.ok((await chooseMethod(input.question,'/api/method')).notice);assert.equal((await interpretReading(input,'/api/interpret')).source,'local');
 }finally{globalThis.fetch=original;}
});
