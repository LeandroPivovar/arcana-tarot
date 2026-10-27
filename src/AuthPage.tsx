import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import { ApiError } from './api';
import { login, register } from './auth';
import type { User } from './auth';

type Mode='login'|'register';
export function AuthPage({mode,notice,onSwitch,onAuthenticated}:{mode:Mode;notice:string;onSwitch:(mode:Mode)=>void;onAuthenticated:(user:User)=>void}){
 const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [showPassword,setShowPassword]=useState(false);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const registering=mode==='register';
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;setError('');
  if(registering&&name.trim().length<2){setError('Informe seu nome.');return;}
  if(registering&&password.length<8){setError('A senha deve ter pelo menos 8 caracteres.');return;}
  setBusy(true);
  try {onAuthenticated(registering?await register({name,email,password}):await login({email,password}));}
  catch(err){setError(err instanceof ApiError?err.message:'Não foi possível conectar. Verifique sua internet e tente novamente.');setBusy(false);}
 }
 return <section className="content-page auth-page">
  <div className="auth-card">
   <div className="eyebrow">{registering?'UM ESPAÇO SÓ SEU':'QUE BOM TER VOCÊ AQUI'}</div>
   <h1>{registering?<>Crie sua <em>conta.</em></>:<>Entre na sua <em>conta.</em></>}</h1>
   <p className="auth-intro">{registering?'Com uma conta, você faz suas perguntas às cartas e guarda cada leitura no seu histórico.':'Acesse sua conta para fazer uma pergunta e revisitar suas leituras.'}</p>
   {notice&&<p className="service-notice" role="status">{notice}</p>}
   <form className="auth-form" onSubmit={e=>void submit(e)} noValidate>
    {registering&&<label>Nome<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" maxLength={60} required/></label>}
    <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" maxLength={254} required/></label>
    <label>Senha<span className="password-input"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={registering?'new-password':'current-password'} minLength={registering?8:undefined} maxLength={128} required aria-describedby={registering?'password-hint':undefined}/><button type="button" className="icon-button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></span></label>
    {registering&&<small id="password-hint" className="auth-hint">Use pelo menos 8 caracteres.</small>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <button className="button primary" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<LockKeyhole size={16}/>} {registering?'Criar minha conta':'Entrar'} <ArrowRight size={16}/></button>
   </form>
   <p className="auth-switch">{registering?'Já tem uma conta?':'Ainda não tem uma conta?'} <button className="inline-link" onClick={()=>{setError('');onSwitch(registering?'login':'register')}}>{registering?'Entrar':'Criar conta'}</button></p>
  </div>
 </section>;
}
