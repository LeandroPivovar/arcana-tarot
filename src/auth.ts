import { api, AuthRequiredError } from './api.ts';

export type User={id:number;name:string;email:string};
export async function currentUser():Promise<User|null>{
 try {return (await api<{user:User}>('/api/auth/me')).user;}catch(error){if(error instanceof AuthRequiredError)return null;throw error;}
}
export async function register(input:{name:string;email:string;password:string}):Promise<User>{return (await api<{user:User}>('/api/auth/register',{method:'POST',body:input})).user;}
export async function login(input:{email:string;password:string}):Promise<User>{return (await api<{user:User}>('/api/auth/login',{method:'POST',body:input})).user;}
export function logout():Promise<void>{return api<void>('/api/auth/logout',{method:'POST'});}
