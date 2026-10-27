import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cards,spreads} from '../src/data.ts';
import {localInterpretation} from '../src/services.ts';
import {isSavedReading,readingCards,readingMethod} from '../src/history.ts';

const method=spreads.find(s=>s.id==='triangle')!;
const selected=[cards[3],cards[4],cards[5]];
const valid={id:'abc',createdAt:'2026-01-01T10:00:00.000Z',question:'Devo mudar de emprego?',methodId:method.id,methodReason:'',cardIds:selected.map(c=>c.id),interpretation:localInterpretation({question:'Devo mudar de emprego?',method,selected})};

test('tiragem salva válida recupera método e cartas na ordem',()=>{
 assert.equal(isSavedReading(valid),true);
 assert.equal(readingMethod(valid).id,'triangle');
 assert.deepEqual(readingCards(valid).map(c=>c.name),selected.map(c=>c.name));
});

test('tiragens corrompidas ou inconsistentes são recusadas',()=>{
 for(const invalid of [null,{},{...valid,methodId:'inexistente'},{...valid,createdAt:'ontem'},{...valid,question:'  '},{...valid,cardIds:[3,4]},{...valid,cardIds:[3,4,999]},{...valid,cardIds:[3,3,4]},
  {...valid,interpretation:{...valid.interpretation,source:'outro'}},{...valid,interpretation:{...valid.interpretation,summary:''}},
  {...valid,interpretation:{...valid.interpretation,cards:valid.interpretation.cards.map((c,i)=>i===0?{...c,position:'Inventada'}:c)}},
  {...valid,interpretation:{...valid.interpretation,cards:valid.interpretation.cards.map((c,i)=>i===0?{...c,text:'x'.repeat(10001)}:c)}}])assert.equal(isSavedReading(invalid),false);
});
