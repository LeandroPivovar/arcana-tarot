import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cards,spreads} from '../src/data.ts';
import {methodArticles} from '../src/content/methods.ts';
import {books} from '../src/content/books.ts';
import type {CardArticle,StudySource} from '../src/content/types.ts';
const articles:CardArticle[]=['major-arcana','wands-cups','swords-pentacles'].flatMap(name=>JSON.parse(readFileSync(new URL(`../src/content/${name}.json`,import.meta.url),'utf8')));
function words(value:unknown):number{if(typeof value==='string')return value.trim().split(/\s+/).length;if(Array.isArray(value))return value.reduce((sum,v)=>sum+words(v),0);if(value&&typeof value==='object')return Object.values(value).reduce<number>((sum,v)=>sum+words(v),0);return 0;}
function checkSources(sources:StudySource[]){assert.ok(sources.length>=2);for(const source of sources){assert.ok(source.book in books);assert.ok(source.note.length>15);assert.ok(source.pages.length>0);for(const p of source.pages)assert.ok(Number.isInteger(p)&&p>0&&p<=books[source.book].pages,`${source.book}: ${p}`);}}
test('cada uma das 78 cartas tem capítulo original de estudo com todos os campos',()=>{
 assert.equal(articles.length,78);assert.equal(new Set(articles.map(a=>a.id)).size,78);assert.deepEqual(articles.map(a=>a.id).sort((a,b)=>a-b),cards.map(c=>c.id));
 for(const article of articles){const label=cards[article.id].name;assert.ok(words(article)>=900,`${label}: capítulo curto (${words(article)})`);assert.ok(article.subtitle.length>20,label);assert.ok(article.overview.length>=2,label);assert.ok(article.symbolism.length>=5,label);for(const s of article.symbolism){assert.ok(s.title.length>3,label);assert.ok(s.text.length>150,label);}
  for(const key of ['professional','health','love','financial'] as const){assert.ok(article.domains[key].length>=2,`${label}/${key}`);assert.ok(words(article.domains[key])>=70,`${label}/${key}: conteúdo insuficiente`);}
  assert.ok(words(article.advice)>=60,label);assert.ok(words(article.shadow)>=70,label);assert.ok(article.study.questions.length>=3,label);assert.ok(article.study.exercise.length>90,label);assert.ok(article.study.connections.length>=2,label);for(const c of article.study.connections){assert.ok(c.cardId>=0&&c.cardId<78&&c.cardId!==article.id,label);assert.ok(c.text.length>50,label);}checkSources(article.sources);
 }
});
test('capítulos não reutilizam os mesmos parágrafos como preenchimento',()=>{
 const paragraphs=new Map<string,number>();for(const article of articles){for(const text of [...article.overview,...article.advice,...article.shadow,...Object.values(article.domains).flat()]){if(text.length<180)continue;assert.ok(!paragraphs.has(text),`Parágrafo repetido nas cartas ${paragraphs.get(text)} e ${article.id}`);paragraphs.set(text,article.id);}}
});
test('os nove métodos possuem estudo, posições alinhadas e exemplos coerentes',()=>{
 assert.equal(methodArticles.length,spreads.length);assert.equal(new Set(methodArticles.map(a=>a.id)).size,spreads.length);
 for(const method of spreads){const article=methodArticles.find(a=>a.id===method.id);assert.ok(article,method.name);assert.ok(words(article)>=950,`${method.name}: estudo curto`);assert.equal(article.positions.length,method.positions.length,method.name);assert.deepEqual(article.positions.map(p=>p.title),method.positions,method.name);assert.equal(article.example.cards.length,method.positions.length,method.name);assert.equal(new Set(article.example.cards.map(c=>c.cardId)).size,method.positions.length,method.name);article.example.cards.forEach((c,i)=>{assert.equal(c.position,method.positions[i]);assert.ok(c.cardId>=0&&c.cardId<78);assert.ok(c.interpretation.length>100);});assert.ok(article.introduction.length>=3);assert.ok(article.sequence.length>=3);assert.ok(article.practice.length>=2);assert.ok(article.pitfalls.length>=3);checkSources(article.sources);}
});
test('as sete obras fornecidas são representadas nas referências verificadas',()=>{
 const cited=new Set([...articles,...methodArticles].flatMap(a=>a.sources.map(s=>s.book)));assert.deepEqual([...cited].sort(),Object.keys(books).sort());
});
