// Frontend prototype only. A future paid wallet must be enforced by the backend.
export const INITIAL_DEMO_CREDITS = 5;
export const CREDIT_PACKAGES = [
 { id: 'essencial', name: 'Primeiros passos', credits: 5, description: 'Um espaço para suas primeiras perguntas e reflexões.', featured: false },
 { id: 'explorar', name: 'Novas perspectivas', credits: 15, description: 'Mais oportunidades para escutar, refletir e descobrir caminhos.', featured: true },
 { id: 'jornada', name: 'Jornada completa', credits: 30, description: 'Para acompanhar diferentes momentos da sua jornada.', featured: false },
] as const;
type StorageLike = Pick<Storage,'getItem'|'setItem'>;
export const FREE_CREDIT_WAIT_MS = 24 * 60 * 60 * 1000;
type Wallet = { balance:number; charged:string[]; zeroSince:number|null };
export const walletKey=(userId:number)=>`arcana-demo-credits-v1:${userId}`;
function wallet(userId:number,storage:StorageLike,now:number):Wallet {
 let current:Wallet={balance:INITIAL_DEMO_CREDITS,charged:[],zeroSince:null};
 try {
  const data=JSON.parse(storage.getItem(walletKey(userId))||'null');
  if(data&&Number.isSafeInteger(data.balance)&&data.balance>=0&&Array.isArray(data.charged)&&data.charged.every((id:unknown)=>typeof id==='string')){
   // Upgrade the old three-credit demo while preserving spent and added credits.
   const balance=data.balance+(data.zeroSince===undefined?2:0);
   current={balance,charged:data.charged,zeroSince:balance===0?(Number.isSafeInteger(data.zeroSince)&&data.zeroSince>=0?data.zeroSince:now):null};
  }
 }catch{}
 if(current.balance===0&&current.zeroSince!==null&&now-current.zeroSince>=FREE_CREDIT_WAIT_MS){current.balance=1;current.zeroSince=null;}
 const serialized=JSON.stringify(current);
 if(storage.getItem(walletKey(userId))!==serialized)storage.setItem(walletKey(userId),serialized);
 return current;
}
export function demoBalance(userId:number,storage:StorageLike=localStorage,now=Date.now()){return wallet(userId,storage,now).balance;}
export function spendDemoCredit(userId:number,requestId:string,storage:StorageLike=localStorage,now=Date.now()):number|null {
 const current=wallet(userId,storage,now);if(current.charged.includes(requestId))return current.balance;if(current.balance<1)return null;
 current.balance--;current.zeroSince=current.balance===0?now:null;current.charged=[...current.charged.slice(-99),requestId];storage.setItem(walletKey(userId),JSON.stringify(current));return current.balance;
}
export function addDemoPackage(userId:number,packageId:string,storage:StorageLike=localStorage,now=Date.now()):number {
 const pack=CREDIT_PACKAGES.find(p=>p.id===packageId);if(!pack)throw new Error('Pacote inválido.');const current=wallet(userId,storage,now);
 const balance=current.balance+pack.credits;if(!Number.isSafeInteger(balance))throw new Error('Saldo inválido.');storage.setItem(walletKey(userId),JSON.stringify({...current,balance,zeroSince:null}));return balance;
}
