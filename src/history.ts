import { cards, spreads } from './data.ts';
import type { Spread, TarotCard } from './data.ts';
import type { Interpretation } from './services.ts';
import { api } from './api.ts';

// Readings belong to the signed-in account; the server validates them with this same check.
export type SavedReading={id:string;createdAt:string;question:string;methodId:string;methodReason:string;cardIds:number[];interpretation:Interpretation};
export const HISTORY_LIMIT=100;

function isText(value:unknown):value is string{return typeof value==='string'&&value.trim().length>0&&value.length<=10000;}
export function isSavedReading(item:any):item is SavedReading{
 const method=spreads.find(s=>s.id===item?.methodId);const reading=item?.interpretation;
 return !!method&&isText(item.id)&&isText(item.createdAt)&&!Number.isNaN(Date.parse(item.createdAt))&&isText(item.question)&&typeof item.methodReason==='string'
  &&Array.isArray(item.cardIds)&&item.cardIds.length===method.positions.length&&new Set(item.cardIds).size===item.cardIds.length&&item.cardIds.every((id:unknown)=>cards.some(c=>c.id===id))
  &&(reading?.source==='ai'||reading?.source==='local')&&isText(reading.summary)&&isText(reading.reflection)&&Array.isArray(reading.cards)&&reading.cards.length===item.cardIds.length
  &&reading.cards.every((c:any,i:number)=>c?.cardId===item.cardIds[i]&&isText(c.text)&&c.position===method.positions[i]);
}
export async function fetchHistory():Promise<SavedReading[]>{
 const data=await api<{readings:unknown[]}>('/api/readings');
 return Array.isArray(data?.readings)?data.readings.filter(isSavedReading):[];
}
export async function saveReading(input:{question:string;method:Spread;methodReason?:string;selected:TarotCard[];interpretation:Interpretation}):Promise<SavedReading>{
 const {notice:_notice,...interpretation}=input.interpretation;
 return api<SavedReading>('/api/readings',{method:'POST',body:{question:input.question.trim(),methodId:input.method.id,methodReason:input.methodReason||'',cardIds:input.selected.map(c=>c.id),interpretation}});
}
export function deleteReading(id:string):Promise<void>{return api<void>(`/api/readings/${encodeURIComponent(id)}`,{method:'DELETE'});}
export function clearHistory():Promise<void>{return api<void>('/api/readings',{method:'DELETE'});}
export function readingCards(item:SavedReading):TarotCard[]{return item.cardIds.map(id=>cards.find(c=>c.id===id)!);}
export function readingMethod(item:SavedReading):Spread{return spreads.find(s=>s.id===item.methodId)!;}
