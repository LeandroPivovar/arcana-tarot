# Arcana · Tarot online

Interface em português construída com React, TypeScript e Vite. Usa as 78 faces extraídas do PDF fornecido e o verso anexado pelo usuário.

## Executar

```sh
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite. Para abrir pelo celular na mesma rede, use o endereço Network e permita o acesso ao servidor na sua rede privada, se necessário.

```sh
npm test
npm run build
npm run preview
```

Node.js 24 é necessário. `npm run dev` inicia o frontend em `http://localhost:5173` e o backend em `http://localhost:3001`, com proxy para `/api`. Também é possível executar `npm run dev:client` e `npm run dev:server` separadamente. Para produção, execute `npm run build` e `npm start`: o backend serve a interface compilada e as APIs na porta `PORT` (3001 por padrão). `npm run preview` serve apenas a interface, sem a integração de IA.

## Fluxo

1. Pergunta entre 5 e 500 caracteres, com exemplos editáveis. É preciso ter uma conta: sem sessão, a pergunta fica guardada, a pessoa entra ou se cadastra e a consulta continua sozinha.
2. Escolha de um dos nove métodos pela Groq a partir da pergunta, com justificativa visível. Se a IA estiver indisponível, há sorteio aleatório com aviso.
3. Embaralhamento Fisher-Yates com `crypto.getRandomValues`, sem repetição.
4. As 78 cartas fechadas ficam disponíveis. A pessoa escolhe a quantidade exigida, na ordem das posições. É possível desfazer a última escolha.
5. Revelação no desenho do método, interpretação da IA para a pergunta e para cada carta em sua posição, e uma reflexão final personalizada. Em falhas da API, são apresentados significados locais identificados como tal.
6. Cada leitura revelada é salva no histórico da conta (`/historico`), que permite reabrir a tiragem completa, apagar uma leitura ou limpar tudo.

Também há um guia com diagramas e fontes e uma biblioteca das cartas com busca e filtros. As leituras usam apenas cartas na posição normal. Não há cobrança. As contas e o histórico (as 100 leituras mais recentes de cada pessoa) ficam no banco do servidor (SQLite no desenvolvimento, Postgres na Vercel); veja **Contas** e **Deploy na Vercel** abaixo.

## Contas

Cadastro em `/cadastro` e login em `/entrar`, com nome, e-mail e senha (mínimo de 8 caracteres). Sem `DATABASE_URL`, o banco é SQLite (módulo nativo `node:sqlite`) em `DATABASE_PATH` (padrão `data/arcana.db`, ignorado pelo Git), criado automaticamente. Com `DATABASE_URL` (ou `POSTGRES_URL`), usa Postgres pelo pacote `pg`, com as mesmas tabelas criadas na primeira requisição. `server/db.mjs` define as tabelas dos dois bancos e `server/accounts.mjs` concentra cadastro, login, sessões e histórico. Os testes rodam as mesmas consultas num Postgres real em memória (PGlite).

- Senhas: hash scrypt com salt aleatório; o login responde no mesmo tempo quando o e-mail não existe.
- Sessão: token aleatório em cookie `arcana_session` HttpOnly, SameSite=Lax e `Secure` em produção, válido por 30 dias. O banco guarda só o hash SHA-256 do token. Sair apaga a sessão.
- Rotas: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` e `GET /api/auth/me`. `/api/tarot/*` e `/api/readings` respondem 401 sem sessão.
- Histórico: `GET`, `POST` e `DELETE /api/readings`, e `DELETE /api/readings/:id`. O servidor gera o ID e a data, remonta a tiragem campo a campo e a valida com `isSavedReading` (`src/history.ts`), a mesma verificação usada no navegador. Cada pessoa só vê e apaga as próprias tiragens.
- Proteções: limite de 10 tentativas por minuto em cadastro e login, e recusa de requisições de outra origem em todas as rotas que alteram dados.

Se a sessão expirar no meio de uma consulta, a pessoa volta para o login com a pergunta guardada. Em produção atrás de HTTP sem TLS (apenas para testes), defina `INSECURE_COOKIES=true` para o cookie funcionar.

## Deploy na Vercel

O projeto já vem pronto para a Vercel (`vercel.json`): o Vite gera a interface em `dist/` e todas as rotas `/api/*` vão para uma única função Node (`api/index.mjs`), que usa o mesmo app Express do servidor local. As demais rotas devolvem `index.html`, para que `/historico`, `/baralho/12` etc. abram direto.

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório do GitHub. O framework (Vite), o build e a pasta de saída são lidos do `vercel.json`.
2. Crie um banco Postgres: no projeto, **Storage → Create Database → Neon** (plano gratuito) e conecte ao projeto. Isso cria `DATABASE_URL` automaticamente. Qualquer Postgres serve (Supabase, Neon direto etc.): basta definir `DATABASE_URL`.
3. Em **Settings → Environment Variables**, adicione `GROQ_API_KEY` (e, se quiser, `GROQ_MODEL`).
4. Faça o deploy (ou **Redeploy** depois de criar as variáveis).

Na Vercel, a função exige `DATABASE_URL`: sem ela, as rotas falham com uma mensagem clara no log, em vez de perder contas num disco temporário. Os cookies saem com `Secure` e o IP real vem do proxy da Vercel. A função tem até 60 s por requisição (a interpretação da IA leva até 30 s). O limite de tentativas fica na memória de cada instância da função, então é uma proteção aproximada.

## Groq integrada ao backend

A integração real usa `groq-sdk`, com o modelo `openai/gpt-oss-120b`, raciocínio baixo na escolha do método e médio na interpretação e respostas JSON validadas por schema estrito. O backend está em `server/`: `groq.mjs` concentra prompts e validações, `app.mjs` define rotas e limites, e `index.mjs` carrega as configurações e inicia o servidor. A chave recebida foi configurada apenas no `.env` local, ignorado pelo Git.

Para configurar outra instalação:

1. Copie `.env.example` para `.env`.
2. Preencha `GROQ_API_KEY` com uma chave válida. `GROQ_MODEL` já aponta para `openai/gpt-oss-120b`.
3. Execute `npm run dev`.

**Nunca coloque chaves em variáveis `VITE_*`.** Elas são públicas no bundle. O backend guarda a chave e faz as chamadas à Groq. A pergunta e as cartas são enviadas ao provedor, como informado na interface; o aplicativo não grava perguntas ou leituras. Há validação de entrada, tamanho máximo de 12 KB, limite por IP de 20 chamadas/minuto, verificação de origem e respostas de erro sem conteúdo do provedor ou credenciais. O limite usa memória e reinicia com o processo; uma publicação pública com múltiplas instâncias e cobrança exige controles compartilhados apropriados.

`GET /api/health` informa a disponibilidade do backend e se há chave configurada, sem revelar a chave. O frontend usa `/api/tarot/method` e `/api/tarot/interpret` por padrão; variáveis `VITE_TAROT_METHOD_ENDPOINT` e `VITE_TAROT_INTERPRET_ENDPOINT` são opcionais para substituir essas URLs.

### Escolha de método

`VITE_TAROT_METHOD_ENDPOINT=/api/tarot/method`

Recebe `POST` JSON: `{ question, methods: [{ id, name, positions }] }`.

Resposta: `{ "methodId": "linear", "reason": "Uma sequência para explorar a evolução da sua situação.", "source": "ai" }`. O ID deve existir em `src/data.ts`. Uma resposta inválida, erro de rede ou timeout leva ao método aleatório com aviso na tela.

### Interpretação

`VITE_TAROT_INTERPRET_ENDPOINT=/api/tarot/interpret`

Recebe `POST` JSON:

```json
{
  "question": "O que posso aprender com este momento?",
  "method": { "id": "one", "name": "Uma carta", "positions": ["Conselho para o agora"] },
  "cards": [{ "id": 17, "name": "A Estrela", "position": "Conselho para o agora", "orientation": "upright" }],
  "locale": "pt-BR"
}
```

Resposta esperada:

```json
{
  "summary": "Texto que conecta a pergunta ao conjunto da tiragem.",
  "cards": [{ "cardId": 17, "position": "Conselho para o agora", "text": "Interpretação da carta nesta posição." }],
  "reflection": "Uma pergunta de reflexão para encerrar."
}
```

O backend usa os nomes e significados do catálogo confiável, ignora nomes enviados pelo cliente e rejeita cartas inexistentes, repetidas ou em posições incompatíveis. As cartas e posições devem corresponder exatamente à ordem recebida; o frontend também valida essa correspondência. Respostas inválidas ou indisponibilidade retornam aos significados locais, com aviso. Timeout do navegador: 35 segundos; timeout da Groq: 30 segundos, sem repetição automática. A resposta é renderizada como texto, sem HTML. O proxy já está configurado no Vite. Em produção, `npm start` mantém interface e API na mesma origem.

## Tiragens e pesquisa

Os diagramas são desenhados no código e reproduzidos tanto no guia quanto no resultado. Números indicam a ordem de seleção. Algumas tradições usam posições diferentes; a variante adotada é apresentada na interface.

| Método | Cartas | Disposição e leitura |
| --- | --- | --- |
| Uma carta | 1 | Conselho central |
| Linear | 3 | Esquerda para direita: passado, presente, futuro possível |
| Triângulo | 3 | Caminhos A e B na base; conselho no topo |
| Péladan | 5 | Favorável à esquerda, desafio à direita, questão no topo, resposta embaixo, síntese no centro |
| Diamante | 5 | Questão no centro; influência interna à esquerda, externa à direita, ação embaixo e solução no topo |
| Afrodite | 7 | Duas colunas: pensamentos, sentimentos e atração de cada pessoa; síntese central |
| Cruz Celta | 10 | Situação central, desafio atravessado, objetivo acima, raízes abaixo, passado à esquerda, futuro à direita; postura, ambiente, esperanças e desfecho na coluna direita de baixo para cima |
| O Caminho | 7 | Tema acima; coluna esquerda com postura consciente, emocional e exterior atual; coluna direita com propostas de mudança em ordem inversa |
| A Cruz de quatro cartas | 4 | Assunto, atitude a reconsiderar, abordagem construtiva e direção possível |

Referências consultadas:

- [Guia NOSOTRAS: três cartas, Péladan e Templo de Afrodite](https://pt.scribd.com/document/472504272/1592243071EBOOK-Guia-para-comear-suas-tiragens-NOSOTRAS-TAROT-cupom-pdf). A variante Péladan usa cinco cartas escolhidas, sem síntese por soma.
- [Labyrinthos: disposições de três cartas](https://labyrinthos.co/blogs/learn-tarot-with-labyrinthos-academy/3-card-tarot-spreads-simple-tarot-spreads-organized-by-layout). Base para o triângulo adaptado de duas possibilidades e conselho.
- [Astrocentro: Diamante e outros métodos](https://www.astrocentro.com.br/blog/tarot/tarot-metodos-tiragem/).
- [Tarotfarm: 30 métodos](https://tarotfarm.com.br/30-metodos-de-tiragens-para-iniciantes-e-mais-avancados/).
- [A. E. Waite: An Ancient Celtic Method of Divination](https://original.sacred-texts.com/tarot/pkt/pkt0307.htm). Cruz Celta adaptada sem significador extra.

Os significados locais são textos próprios de reflexão, resumidos para este protótipo; não foram copiados do PDF ou desses sites. A leitura local não faz análise semântica da pergunta; a leitura da Groq considera o contexto da pergunta e o conjunto das posições.

## Imagens e licença

**Atenção antes de publicar ou monetizar:** o PDF `Tarot-Card-Deck.pdf` informa copyright de Bennion Kearny Limited, uso pessoal gratuito, proibição de uso comercial/em serviços pagos e de redistribuição. As imagens foram fornecidas pelo usuário e extraídas para este protótipo. Isso não concede licença comercial. Use imagens com autorização apropriada antes de uma publicação pública/comercial. O verso também é o arquivo fornecido pelo usuário; sua licença não foi verificada.

Para trocar o baralho, substitua `public/cards/00.jpg` a `77.jpg` e `back.jpg`, mantendo o mapeamento: 0–21 maiores, 22–35 Paus, 36–49 Copas, 50–63 Espadas, 64–77 Ouros. Dentro de cada naipe: Ás a Dez, Pajem, Cavaleiro, Rainha, Rei.

## Acessibilidade

Controles por teclado, estados de seleção acessíveis, foco em mudanças de etapa, diálogos com foco contido e fechamento por Escape, mensagens de erro e estado anunciáveis e respeito a `prefers-reduced-motion`. As imagens das cartas preservam os títulos em inglês do material original; a interface e os significados estão em português.

## Validação

`npm test` cobre cadastro, login, sessões e histórico por conta (com banco em memória), o baralho, as nove tiragens, aleatoriedade sem repetição, contratos de API, recuperação local, os prompts e schemas enviados à Groq com cliente simulado, a validação do backend e os limites HTTP. Não consome a API real. Os testes reais de seleção e interpretação foram executados separadamente durante a implementação.

Documentação consultada: [modelo GPT-OSS 120B na Groq](https://console.groq.com/docs/model/openai/gpt-oss-120b), [Structured Outputs](https://console.groq.com/docs/structured-outputs) e [raciocínio](https://console.groq.com/docs/reasoning).

## Biblioteca de estudo aprofundado

A aba **O baralho** abre páginas próprias em `/baralho/<nome-da-carta>`, com histórico do navegador e acesso direto por URL. Cada capítulo reúne contexto, seis ou mais análises de símbolos, vida profissional, saúde como reflexão simbólica, vida amorosa, vida financeira, conselho, expressão da sombra, exercícios, conexões com outras cartas e referências de páginas dos PDFs.

Os capítulos são textos originais estáticos, não gerados novamente a cada visita e não dependentes da disponibilidade da Groq. O conteúdo é carregado em blocos separados para evitar baixar toda a biblioteca ao abrir a página inicial. Os arquivos `src/content/major-arcana.json`, `wands-cups.json` e `swords-pentacles.json` guardam os 78 estudos; `src/content/methods.ts` contém os nove métodos.

Os métodos abrem em `/metodos/<id>` com fundamentos, preparação, posições, diagramas, sequência de interpretação, exemplo comentado carta por carta, síntese, erros comuns, exercícios e bibliografia. O Caminho e A Cruz de quatro cartas foram acrescentados a partir de Hajo Banzhaf; o catálogo e o schema enviado à Groq incluem ambos.

As obras foram consultadas a partir dos sete PDFs fornecidos. O volume de Kaplan foi lido visualmente, pois não tem camada de texto. A biblioteca identifica variantes e usa números de página do arquivo PDF, que podem diferir dos impressos. Os PDFs completos e suas extrações de pesquisa não são distribuídos com o site. Material histórico que associa cartas a diagnósticos, destinos inevitáveis ou conclusões sobre terceiros foi tratado criticamente, sem transformar essas associações em recomendações ou fatos.

## Créditos — protótipo de frontend

O saldo no cabeçalho abre `/creditos`, com três pacotes: 5, 15 e 30 créditos. Não existem preços, gateway, checkout, pagamento ou crédito financeiro real. A página identifica a simulação e permite testar os pacotes. Cada conta começa com 5 créditos demonstrativos neste navegador. Ao zerar o saldo, começa uma espera de 24 horas para receber 1 crédito gratuito, sem acumular períodos ausentes. Adicionar um pacote cancela a espera; ao zerar novamente, começa um novo prazo. A página verifica o saldo ao acessar, voltar ao foco e a cada minuto. Saldos da versão anterior recebem a diferença de 2 créditos uma única vez.

O saldo fica no `localStorage`, separado por ID de conta. Uma nova pergunta consome uma unidade depois de preparar o método. Embaralhar, revelar as cartas e consultar o histórico não geram novos descontos. Sem saldo, o frontend mantém a pergunta e leva aos pacotes. A escolha do pacote é preservada durante a navegação para login.

Esta implementação atende apenas à demonstração visual/funcional solicitada. Para cobrança real, o backend deverá controlar saldo, débito por consulta e confirmação idempotente dos pagamentos; o saldo local não pode ser usado como controle de cobrança ou autorização da API.
