import { cards, spreads } from './data.ts';
import type { Spread, TarotCard } from './data.ts';
import { api, AuthRequiredError } from './api.ts';
export type ReadingInput={question:string;method:Spread;selected:TarotCard[]};
export type Interpretation={source:'local'|'ai';summary:string;cards:{cardId:number;position:string;text:string}[];reflection:string;notice?:string};
export function randomIndex(length:number):number {
 if(!Number.isSafeInteger(length)||length<1||length>0x100000000)throw new Error('Intervalo inválido');
 const limit=0x100000000-(0x100000000%length);let value:number;
 do {value=crypto.getRandomValues(new Uint32Array(1))[0];} while(value>=limit);
 return value%length;
}
export function shuffleDeck(deck:TarotCard[]=cards):TarotCard[]{const result=[...deck];for(let i=result.length-1;i>0;i--){const j=randomIndex(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;}
// A missing or expired session is rethrown so the app can ask the person to sign in instead of falling back.
const post=(endpoint:string,body:unknown)=>api<unknown>(endpoint,{method:'POST',body,timeout:35000});
export async function chooseMethod(question:string,endpoint?:string):Promise<{method:Spread;reason?:string;source:'ai'|'random';notice?:string}>{
 if(endpoint){try {const data=await post(endpoint,{question,methods:spreads.map(({id,name,positions})=>({id,name,positions}))}) as {methodId?:string;reason?:string};const method=spreads.find(s=>s.id===data.methodId);if(!method)throw new Error('Método inválido');return {method,source:'ai',reason:typeof data.reason==='string'?data.reason:undefined};}catch(error){if(error instanceof AuthRequiredError)throw error;return {method:spreads[randomIndex(spreads.length)],source:'random',notice:'Não foi possível consultar a IA. Escolhemos um método aleatório para você continuar.'};}}
 return {method:spreads[randomIndex(spreads.length)],source:'random'};
}
export function localInterpretation(input:ReadingInput):Interpretation {
 const {method,selected}=input;
 return {source:'local',summary:`Para explorar sua pergunta, a ${method.name} reúne ${selected.length===1?'uma perspectiva':`${selected.length} perspectivas`}. ${selected[0].name} abre a leitura com os temas de ${selected[0].keywords.join(', ')}. Observe como os símbolos conversam com a sua experiência e use cada posição como ponto de partida para refletir.`,cards:selected.map((card,i)=>({cardId:card.id,position:method.positions[i],text:card.message})),reflection:`Ao pensar na sua pergunta, qual atitude pequena e possível se conecta com ${selected[selected.length-1].keywords[0]}?`};
}
export async function interpretReading(input:ReadingInput,endpoint?:string):Promise<Interpretation>{
 if(endpoint){try {
 const data=await post(endpoint,{question:input.question,method:{id:input.method.id,name:input.method.name,positions:input.method.positions},cards:input.selected.map((c,i)=>({id:c.id,name:c.name,position:input.method.positions[i],orientation:'upright'})),locale:'pt-BR'}) as Omit<Interpretation,'source'>;
 if(typeof data.summary!=='string'||!data.summary.trim()||typeof data.reflection!=='string'||!data.reflection.trim()||!Array.isArray(data.cards)||data.cards.length!==input.selected.length||data.cards.some((c,i)=>c.cardId!==input.selected[i].id||c.position!==input.method.positions[i]||typeof c.text!=='string'||!c.text.trim()))throw new Error('Resposta inválida');
 return {source:'ai',summary:data.summary,cards:data.cards,reflection:data.reflection};
 }catch(error){if(error instanceof AuthRequiredError)throw error;return {...localInterpretation(input),notice:'O serviço de interpretação está indisponível. Exibimos os significados locais das cartas.'};}}
 return localInterpretation(input);
}
