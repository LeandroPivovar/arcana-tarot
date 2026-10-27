import type { BookId } from './types.ts';
export const books:Record<BookId,{title:string;author:string;pages:number;context:string}>={
 dean:{title:'The Ultimate Guide to Tarot',author:'Liz Dean',pages:537,context:'Iconografia Rider–Waite–Smith, significados e estrutura de tiragens.'},
 pollack:{title:'Setenta e Oito Graus de Sabedoria',author:'Rachel Pollack',pages:397,context:'Desenvolvimento simbólico, consciência e leitura do conjunto.'},
 banzhaf:{title:'Guia Completo do Tarô',author:'Hajo Banzhaf',pages:193,context:'Comportamentos, vida profissional, relações e o método O Caminho.'},
 kaplan:{title:'O Tarô Clássico',author:'Stuart R. Kaplan',pages:233,context:'Tradições do baralho e diferenças entre sistemas de disposição.'},
 amor:{title:'O Tarô do Amor',author:'Celina Fioravanti',pages:169,context:'Questões afetivas e dinâmicas de relacionamento.'},
 prosperidade:{title:'O Tarô da Prosperidade',author:'Celina Fioravanti',pages:183,context:'Trabalho, recursos e atitudes diante da vida material.'},
 saude:{title:'O Tarô da Saúde',author:'Celina Fioravanti',pages:171,context:'Referência histórica para o tema do cuidado, examinada de modo crítico e simbólico.'},
};
