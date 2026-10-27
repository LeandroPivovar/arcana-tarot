import type { Spread, TarotCard } from './data';
export function Diagram({method,selected=[],mini=false,onCard}:{method:Spread;selected?:TarotCard[];mini?:boolean;onCard?:(card:TarotCard)=>void}){return <div className={`spread-diagram ${mini?'mini':''} layout-${method.id}`} aria-label={`Disposição: ${method.name}`}>
 {method.layout.map(([x,y,rotation],i)=><div className={`diagram-slot ${selected[i]?'filled':''}`} key={i} style={{left:`${x}%`,top:`${y}%`,transform:`translate(-50%,-50%) rotate(${rotation||0}deg)`,zIndex:i+1}}>
 {selected[i]?<button className="diagram-card" onClick={()=>onCard?.(selected[i])} aria-label={`${i+1}. ${method.positions[i]}: ${selected[i].name}`}><img src={selected[i].image} alt={selected[i].name}/><span>{i+1}</span></button>:<span className="slot-number">{i+1}</span>}
 {!mini&&<span className="slot-label" style={rotation?{transform:'rotate(-90deg)',left:'65%',top:'-28%'}:undefined}>{method.positions[i]}</span>}
 </div>)}
 </div>}

