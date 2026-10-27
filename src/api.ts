// Same-origin JSON client; the session lives in an HttpOnly cookie the browser sends on its own.
export class ApiError extends Error {status:number;constructor(message:string,status:number){super(message);this.status=status;}}
export class AuthRequiredError extends ApiError {constructor(message='Entre na sua conta para continuar.'){super(message,401);}}
export async function api<T>(path:string,init:{method?:string;body?:unknown;timeout?:number}={}):Promise<T>{
 const response=await fetch(path,{method:init.method||'GET',credentials:'same-origin',headers:init.body===undefined?undefined:{'Content-Type':'application/json'},body:init.body===undefined?undefined:JSON.stringify(init.body),signal:AbortSignal.timeout(init.timeout??15000)});
 if(!response.ok){
  let message='';try {const data=await response.json();if(typeof data?.error==='string')message=data.error;}catch{}
  if(response.status===401)throw new AuthRequiredError(message||undefined);
  throw new ApiError(message||`Falha na solicitação (${response.status})`,response.status);
 }
 return (response.status===204?undefined:await response.json()) as T;
}
