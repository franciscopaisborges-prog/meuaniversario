# Francisco Rodrigues · 29.11.2026 · Coimbra

Convite digital interativo para o aniversário de Francisco Rodrigues, com programa, mapa interativo, confirmação de presença (RSVP) e um painel privado de administração.

- **Site público:** `index.html`, em preto e dourado, com páginas de atividade em branco e azul.
- **Administração:** `admin.html`, com acesso por email e palavra-passe e autorização por UID.
- **Dados:** Firebase Realtime Database (`/rsvps`), sem Firestore.
- **Mapas:** Leaflet 1.9.4 com OpenStreetMap.
- **Sem build:** HTML, CSS e JavaScript (ES Modules). O SDK Firebase 12.19.0 é carregado do CDN oficial da Google.

---

## 1. Estrutura de pastas

```
/
├── index.html                  Site do convite (página única com router por hash)
├── admin.html                  Painel privado de administração
├── promax.html                 Página “Código PROMAX2.0” (ligada a partir da atividade 08)
├── firebase-config.js          ← CONFIGURAÇÃO DO FIREBASE (partilhada pelos dois documentos)
├── firebase-rtdb-rules.json    Regras de segurança da Realtime Database
├── firebase.json               Hosting, cabeçalhos de segurança (CSP), regras e emuladores
├── .firebaserc                 ← ID DO PROJETO FIREBASE
├── package.json                Scripts: emuladores, testes, deploy
├── assets/
│   ├── css/
│   │   ├── base.css            Tokens (cores, tipografia), botões, campos, acessibilidade
│   │   ├── site.css            Página principal, roteiro, mapa, RSVP e páginas de atividade
│   │   └── admin.css           Painel de administração
│   ├── js/
│   │   ├── shared/
│   │   │   ├── firebase.js     Inicialização do Firebase (RTDB, Auth, App Check, emuladores)
│   │   │   └── dom.js          Utilitários (escape de HTML, normalização de texto)
│   │   ├── site/
│   │   │   ├── program.js      ← DADOS DO PROGRAMA (atividades, coordenadas, textos)
│   │   │   ├── state.js        Horários + ordem cronológica + numeração
│   │   │   ├── live.js         Leitura em tempo real de /schedule
│   │   │   ├── app.js          Arranque, roteiro, router, transições
│   │   │   ├── detail.js       Páginas de atividade (inclui o esquema do Metrobus)
│   │   │   ├── map.js          Mapa geral e mapas individuais (Leaflet)
│   │   │   └── rsvp.js         Formulário de presença → RTDB
│   │   └── admin/
│   │       └── admin.js        Login, autorização, dashboard, tabela e CSV
│   ├── img/
│   │   ├── fr-mark.svg         Monograma FR (vetorial, traço único, pronto para laser)
│   │   └── favicon.svg
│   ├── fonts/                  Instrument Serif + Manrope (alojadas localmente, licença OFL)
│   └── vendor/leaflet/         Leaflet 1.9.4 (local, sem CDN)
├── tests/
│   ├── server.mjs              Servidor estático local
│   ├── rules.test.mjs          38 testes das regras RTDB (emulador)
│   └── e2e.test.mjs            31 testes end-to-end (Playwright + emuladores)
└── tools/
    └── verify-coordinates.mjs  Compara as coordenadas do site com o OpenStreetMap
```

### Decisões técnicas

| Decisão | Porquê |
|---|---|
| **Página única com router por hash** (`#/atividade/<slug>`) | Abre as atividades sem recarregar a página. O mapa geral e a posição de scroll mantêm-se. As ligações diretas funcionam, tal como os botões Anterior/Seguinte do navegador e a partilha de um link de uma atividade. |
| **Página de atividade como camada de ecrã inteiro** | A transição é uma revelação circular a partir do ponto tocado, do preto para o branco e azul. Com `prefers-reduced-motion` passa a ser instantânea. A página principal fica `inert` enquanto a camada está aberta, para o teclado e os leitores de ecrã. |
| **Anterior/Seguinte usam `location.replace`** | O botão “voltar” do navegador regressa sempre ao programa, em vez de percorrer todas as atividades visitadas. |
| **SDK Firebase carregado dinamicamente no site** | Se o CDN falhar, o programa e o mapa continuam a funcionar e só o envio do RSVP mostra o erro. |
| **Leaflet e fontes alojados localmente** | São mais rápidos, não dependem de CDNs de terceiros e permitem uma CSP restrita. |
| **Sucesso do RSVP só depois da confirmação do servidor** | O envio começa por confirmar a ligação real (`.info/connected`). Depois faz `push()` + `set()` e espera pelo *ack* da RTDB, com limite de tempo. Sem rede, sem configuração ou com o servidor inacessível, mostra um erro claro. |
| **CSV com `;`, BOM UTF-8 e CRLF** | Abre diretamente no Excel em português com acentos corretos, e o Google Sheets e o Numbers detetam o `;` automaticamente. Valores começados por `=`, `+`, `-` ou `@` são prefixados com `'` para evitar injeção de fórmulas. |
| **Admin com Google** | Login com `signInWithPopup` (com recurso a redirecionamento se o popup for bloqueado). A sessão fica limitada ao separador (`browserSessionPersistence`), por isso fechar o navegador termina a sessão. |

---

## 2. Executar localmente

Requisitos: **Node.js 18+**. Java 11+ só é necessário para os emuladores e testes.

```bash
npm install
```

```bash
npm run serve
```

Abra `http://127.0.0.1:5173/` (site) e `http://127.0.0.1:5173/admin.html` (painel).

Também funciona com qualquer servidor estático, por exemplo `npx serve .` ou `python3 -m http.server`. Não abra o `index.html` com duplo clique (`file://`), porque os ES Modules exigem um servidor HTTP.

### Com os emuladores Firebase (sem tocar no projeto real)

Para isto, `firebase-config.js` tem de ter valores preenchidos. Para testar sem projeto real, use os valores de demonstração indicados em `tests/e2e.test.mjs` (`testConfig`).

```bash
npm run emulators
```

```bash
npm run serve
```

Abra `http://127.0.0.1:5173/?emulators=1`. O parâmetro `?emulators=1` só tem efeito em `localhost` / `127.0.0.1`.

---

## 3. Configurar o Firebase (passo a passo)

### 3.1 Criar o projeto
1. Abra <https://console.firebase.google.com> → **Adicionar projeto**.
2. Dê um nome (ex.: `aniversario-fr`). O Google Analytics é opcional e não é necessário.

### 3.2 Registar uma aplicação Web
1. Na página do projeto clique no ícone **Web** (`</>`).
2. Dê um nome (ex.: `convite`). Não precisa de ativar o Hosting neste passo.
3. Copie o objeto `firebaseConfig` apresentado.

### 3.3 Ativar a Realtime Database
1. Menu **Build → Realtime Database → Criar base de dados**.
2. Escolha a localização. **europe-west1 (Bélgica)** é a recomendada para Portugal.
3. Escolha **Iniciar em modo bloqueado**. As regras corretas são publicadas no passo 3.7.
4. Copie o URL da base de dados (ex.: `https://aniversario-fr-default-rtdb.europe-west1.firebasedatabase.app`).

### 3.4 Ativar o início de sessão com Google
**Build → Authentication → Começar → Sign-in method → Google → Ativar → Guardar.**
O painel usa apenas “Entrar com Google”. Não há palavras-passe no código nem na base de dados.

### 3.5 Quem é administrador
A autorização está nas **regras da RTDB** (`firebase-rtdb-rules.json`). Uma conta é administradora se:
- o email Google for **`franciscopaisborges@gmail.com`** e estiver verificado pelo Google (`auth.token.email_verified`); **ou**
- o seu UID constar de `/admins/{uid}: true`. Esta segunda opção serve para acrescentar outros administradores.

Qualquer outra conta Google consegue iniciar sessão, mas vê “Esta conta não é administradora” e as regras recusam a leitura das respostas.

### 3.6 Acrescentar outro administrador (opcional)
1. A pessoa entra no `admin.html` com a sua conta Google. O painel mostra o caminho exato a criar.
2. Na **Realtime Database → Dados**, crie `admins` → `<UID>` com o valor `true` (booleano).

Para mudar o email do organizador, edite-o nas duas ocorrências em `firebase-rtdb-rules.json` e volte a publicar as regras.

### 3.7 Publicar as regras de segurança
**Opção A, na consola:** em **Realtime Database → Regras**, cole o conteúdo de `firebase-rtdb-rules.json` e clique em **Publicar**.

**Opção B, com a CLI:**

```bash
npx firebase login
```

```bash
npx firebase deploy --only database
```

Para adicionar um administrador pela CLI:

```bash
npx firebase database:set /admins/<UID> --data true
```

### 3.8 Inserir a configuração no projeto
1. Edite **`firebase-config.js`** e substitua os valores `COLOCAR_...`:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "aniversario-fr.firebaseapp.com",
  databaseURL: "https://aniversario-fr-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "aniversario-fr",
  appId: "1:1234567890:web:abc123",
};
```

2. Edite **`.firebaserc`** e substitua `COLOCAR_PROJECT_ID` pelo ID do projeto.

> Estes valores **não são segredos**: identificam o projeto e são sempre visíveis no navegador. A proteção dos dados vem das regras da RTDB, da autenticação e do App Check.

Enquanto houver valores `COLOCAR_...`, o site funciona em modo de consulta. Nesse modo, o formulário mostra um erro claro e não simula gravações, e o painel mostra “Firebase ainda não configurado”.

### 3.9 Publicar com Firebase Hosting

```bash
npx firebase login
```

```bash
npx firebase deploy --only hosting,database
```

Ou `npm run deploy`. O site fica em `https://<projeto>.web.app` e o painel em `https://<projeto>.web.app/admin.html`.

O `firebase.json` já:
- publica apenas os ficheiros do site e ignora `tests/`, `tools/`, `node_modules/`, o README e os ficheiros de configuração;
- envia cabeçalhos de segurança: **Content-Security-Policy**, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e `frame-ancestors 'none'`;
- marca o `admin.html` com `Cache-Control: no-store` e `X-Robots-Tag: noindex`.

> **CSP:** o `index.html` tem um pequeno script em linha autorizado por *hash* (`sha256-...` em `firebase.json`). Se alterar esse script, atualize o hash. A forma mais simples é abrir a consola do navegador, onde a mensagem de erro da CSP indica o hash correto.

**Domínio próprio (opcional):** em Hosting → Adicionar domínio personalizado. Depois acrescente o domínio em **Authentication → Settings → Authorized domains**.

**QR Code:** gere-o a partir do URL final (`https://<projeto>.web.app`). O site foi pensado primeiro para telemóvel.

---

## 4. Regras de segurança da RTDB

O ficheiro `firebase-rtdb-rules.json` garante o seguinte:

| Regra | Efeito |
|---|---|
| `".read": false, ".write": false` na raiz | Tudo é proibido por omissão. |
| `rsvps/.read` → só se `admins/{auth.uid} === true` | Anónimos e utilizadores autenticados não autorizados **não leem** respostas. |
| `rsvps/$id/.write` → `!data.exists() && newData.exists()` | Qualquer pessoa pode **criar** uma resposta nova, mas ninguém pode **alterar nem apagar** respostas existentes (nem substituir `/rsvps` inteiro). |
| `name` | Texto obrigatório de 2 a 80 caracteres, sem espaços nas pontas. |
| `noticesRead` | Booleano obrigatório; tem de ser `true` quando `attending` é `"yes"` (só quem confirma presença tem de abrir os AVISOS). |
| `noTransportCard` | Obrigatório, booleano: `true` = não tem cartão Move C (levar valor do bilhete). |
| `allergies` | Opcional, 1 a 300 caracteres. |
| `schedule` | Leitura pública; escrita só para administradores. `start` (HH:MM) obrigatório, `end` opcional e posterior a `start`, `updatedAt` = hora do servidor. Só as atividades 01–09 são aceites. |
| `attending` | Só `"yes"` ou `"no"`. |
| `message` | Opcional, com 1 a 500 caracteres (se vazia, o site não a envia). |
| `createdAt` | Tem de ser `now`, o `serverTimestamp()`. O cliente não consegue falsificar a data. |
| `eventDate` | Tem de ser `"2026-11-29"`. |
| `$other: .validate false` | Não são permitidos campos inesperados. |
| `admins/.read` → só administradores | Só administradores consultam a lista. Cada utilizador pode ler apenas o seu próprio `admins/{uid}`, para o painel verificar a autorização. |
| `admins/.write: false` | Ninguém se promove a administrador pelo cliente. Os administradores são geridos na consola ou na CLI. |

Estrutura dos dados:

```
/rsvps/{pushId}
    name:       "João Gonçalves"
    attending:  "yes" | "no"
    message:    "…"              (opcional)
    createdAt:  1795190000000     (serverTimestamp)
    eventDate:  "2026-11-29"
/admins/{uid}: true
```

Para apagar respostas de teste ou spam, use a consola Firebase (Realtime Database → Dados). As regras não permitem apagar a partir do site.

---

## 5. App Check e outras medidas antiabuso

O formulário é público por natureza. Medidas já incluídas:
- validação no cliente **e** nas regras (tipos, tamanhos, valores, sem campos extra);
- impossibilidade de ler, alterar ou apagar respostas sem ser administrador;
- campo “armadilha” (*honeypot*) invisível que bloqueia bots simples;
- botão desativado durante o envio, para evitar submissões duplicadas acidentais.

### Ativar o App Check (recomendado)
O App Check garante que só o seu site, e não scripts externos, escreve na base de dados.

1. Registe uma chave **reCAPTCHA v3** em <https://www.google.com/recaptcha/admin> com o tipo *Score based (v3)* e o domínio `<projeto>.web.app` (mais o domínio próprio, se o tiver). Guarde a **chave do site** e a **chave secreta**.
2. Na consola Firebase: **Build → App Check → Apps → a sua app Web → reCAPTCHA v3**. Cole a **chave secreta** e guarde.
3. Em `firebase-config.js`, preencha `appCheckSiteKey` com a **chave do site**, que é pública.
4. Publique (`npm run deploy`) e, em **App Check → APIs → Realtime Database**, acompanhe as métricas durante uns dias.
5. Quando as métricas mostrarem só pedidos verificados, clique em **Aplicar (Enforce)** na Realtime Database. A partir daí, pedidos sem token válido são recusados.

> O painel de administração usa a mesma inicialização, por isso também passa a enviar o token App Check. A CSP do `firebase.json` já permite os domínios do reCAPTCHA e do App Check.

### Outras recomendações
- **Authentication → Settings → Authorized domains:** mantenha apenas os domínios reais (remova `localhost` depois de terminar os testes, se quiser).
- **Proteção contra enumeração de emails:** confirme que está ativa (Authentication → Settings).
- **Alertas de orçamento** no Google Cloud (Billing → Budgets), para o caso de abuso.
- Para limitar abusos em volume, pode acrescentar um índice `.indexOn` e monitorizar o uso em **Realtime Database → Utilização**. Um limite de taxa estrito por visitante anónimo exigiria Cloud Functions, o que é desnecessário para 6 convidados.

---

## 6. Testes

```bash
npm install
```

O Playwright não faz parte das dependências do projeto. Instale-o à parte:

```bash
npm i --no-save playwright && npx playwright install chromium
```

```bash
npm test
```

`npm test` arranca os emuladores Auth + RTDB, executa os dois conjuntos de testes e encerra os emuladores. Também pode correr cada conjunto em separado com `npm run test:rules` e `npm run test:e2e`. As capturas de ecrã ficam em `tests/output/`.

### Resultados da última execução: 69/69 ✔

**Regras RTDB (38/38):**
- Anónimo cria resposta válida, com e sem mensagem.
- Anónimo **não** lê `/rsvps`, nem uma resposta individual, nem a raiz, nem `/admins`.
- Anónimo **não** altera (PUT/PATCH), **não** apaga, **não** substitui `/rsvps`, **não** escreve em `/admins` nem fora de `/rsvps`.
- São rejeitados 14 tipos de dados inválidos: sem nome, nome vazio, com 1 carácter, com espaços nas pontas, com mais de 80 caracteres ou não-string; `attending` inválido ou booleano; mensagem com mais de 500 caracteres ou vazia; `createdAt` do cliente; `eventDate` errada ou ausente; campo inesperado.
- Autenticado **não-admin** não lê `/rsvps` nem `/admins`, lê apenas o próprio `/admins/{uid}` e não se consegue promover.
- **Admin** (por UID) lê `/rsvps`, `/admins` e o próprio registo.
- **Organizador** (Google, `franciscopaisborges@gmail.com` verificado) lê `/rsvps` e `/admins`, mas não altera respostas.
- Outra conta Google, ou uma conta com email não verificado, não lê nada.

**End-to-end (31/31), Chromium:**
- **Página inicial:** abre sem erros de consola nem de CSP (com a CSP de produção aplicada).
- **Programa:** as 9 atividades aparecem pela ordem correta e o roteiro não tem checkboxes, botões de conclusão nem barras de progresso.
- **Mapa geral:** carrega 6 marcadores (05 e 06 partilham a Portagem; 08 e 09 não têm local confirmado). O marcador abre o popup e o popup abre a página da atividade. Os botões de foco também funcionam.
- **Páginas de atividade:** as 9 abrem com título, contador e mapa individual. O marcador aparece só onde existe localização, e “Abrir no Google Maps” só onde há um local definido.
- **Navegação:** Anterior/Seguinte percorrem 01→09 e voltam, e “Voltar ao programa” funciona. Ligação direta, Anterior/Seguinte do navegador e a tecla Escape também funcionam, e o foco regressa ao cartão.
- **Atividade 02:** mostra o Metrobus Portagem → República com as paragens intermédias. **06** é o regresso ao Largo da Portagem. **07** mostra os contactos do golfe e os avisos. **08** não revela projetos.
- **RSVP:**
  - não envia sem nome e exige resposta;
  - grava na RTDB com o nome normalizado, `serverTimestamp` e `eventDate`;
  - o botão fica desativado durante o envio e o sucesso só aparece depois da gravação;
  - a resposta negativa sem mensagem não cria o campo `message`;
  - mostra erro sem internet, com o servidor inacessível e com o Firebase por configurar, e em nenhum destes casos mostra sucesso.
- **Telemóvel (390×844):** sem scroll horizontal na página inicial nem nas atividades, alvos de toque com pelo menos 40 px e esquema vertical do Metrobus.
- **Admin:**
  - sem sessão não mostra dados, e o login é só com Google, sem campos de palavra-passe;
  - uma conta Google não autorizada não vê respostas, nem lendo diretamente pelo SDK;
  - `franciscopaisborges@gmail.com` vê os totais certos, a tabela e as atualizações em tempo real;
  - a pesquisa (sem acentos), o filtro, a ordenação e o botão Atualizar funcionam;
  - o CSV sai em UTF-8 com BOM, acentos, aspas e quebras de linha, e com proteção contra fórmulas;
  - o logout limpa os dados, a página não tem erros de consola e não há scroll horizontal no telemóvel.

> Os testes correm contra os **emuladores** oficiais do Firebase. A ligação ao seu projeto real só pode ser verificada depois de preencher `firebase-config.js` (ver secção 8).

---

## 7. Coordenadas, mapa e percursos

- **Coordenadas:** estão em `assets/js/site/program.js` e foram todas confirmadas no OpenStreetMap a 20/11/2026: Largo da Portagem (ponto de encontro), paragem Portagem do Metrobus, Mr. Pizza (Praça da República 38), Praça 8 de Maio, Torre e Arco de Almedina e campo de golfe da Quinta das Lágrimas.
- **08 Apresentação privada:** “Localização: indefinida entre o espaço e o tempo”. Não tem morada nem Google Maps; no mapa, o pino salta para um ponto aleatório de Coimbra a cada segundo. No fim da página há o botão **Código PROMAX2.0**, que abre `promax.html` (página azul e vermelha com lasers, pedestal com diamante e “EM BREVE”).
- **Sem marcador:** 09 Lanche (local por confirmar).
- **Percursos** (`assets/js/site/routes-data.js`), com geometria real gerada a partir do OpenStreetMap:
  - **Verde (a pé):** Largo da Portagem → paragem do Metrobus; e o passeio Mr. Pizza (Praça da República) → Av. Sá da Bandeira → Rua da Fonte Nova → Praça 8 de Maio → Rua Visconde da Luz → Arco de Almedina → Rua Ferreira Borges → Largo da Portagem (cerca de 1,5 km). Calculado pelo motor de rotas pedonais do OSM.
  - **Azul (Metrobus, só ida):** Portagem → Loja do Cidadão → Câmara → Mercado → República (cerca de 1,6 km).
  - **Dourado ponteado (outras deslocações, com o meio a confirmar):** Largo da Portagem → Quinta das Lágrimas pela Ponte de Santa Clara (cerca de 1,4 km).
- **Origem do traçado do Metrobus:** linha "MM U2: Vale das Flores → República" do OpenStreetMap (relação 21409406), entre as paragens Portagem e República.
- **Setas:** todos os percursos têm setas de direção.
- **Enquadramento do mapa geral:** os botões "Dia completo" e "Baixa" mudam a vista.
- **Acrescentar ou alterar percursos:** edite `ROUTES` em `routes-data.js`, com `verified: true` e uma lista de pontos que siga as ruas.
- **Verificar as coordenadas:**

```bash
npm run verify:coords
```

- **Horários:** geridos no painel (ver secção 7A), não no código.

## 7A. Horários (painel → separador “Horários”)

- No `admin.html`, depois de iniciar sessão, abra o separador **Horários**. Cada atividade tem:
  - **Início:** obrigatório para a atividade ter horário.
  - **Fim:** opcional.
  - **Guardar:** grava o horário.
  - **Remover:** a atividade volta a “A confirmar”.
- **Como funciona:**
  - os horários ficam em `/schedule/{id}` na Realtime Database, no formato `{ start: "HH:MM", end?: "HH:MM", updatedAt }`;
  - o site público lê-os em tempo real, sem recarregar e sem alterar código, incluindo a página de uma atividade que esteja aberta;
  - o navegador guarda a última versão, para os horários aparecerem logo na visita seguinte.
- **Sem horário:** aparece “A confirmar”. O site nunca inventa horas.
- **Ordem cronológica:**
  - as atividades com horário ordenam-se pela hora de início;
  - as que não têm horário mantêm a posição prevista;
  - a numeração (01–09), os botões Anterior/Seguinte, o mapa e o próprio painel seguem a nova ordem.
- **Validação:** hora no formato HH:MM, fim posterior ao início e nenhum campo extra. É verificada no painel **e** nas regras da RTDB, onde `/schedule` tem leitura pública e escrita só para administradores.

## 7B. Atualização forçada das páginas abertas

- As páginas abertas, tanto o site como o painel, escutam `/meta/version` na base de dados. Quando esse valor muda, cada página recarrega-se sozinha com a versão publicada mais recente.
- `npm run deploy` publica o site e as regras e, no fim, atualiza essa versão. Para forçar o recarregamento sem publicar nada, use:

```bash
npm run force-refresh
```

- `/meta` tem leitura pública e não pode ser escrito a partir do site. Só a CLI com acesso de dono do projeto o altera.
- **Administrador removido:** se for retirado de `/admins` enquanto tem o painel aberto, as regras recusam logo a leitura e o painel apaga os dados do ecrã e mostra “sem autorização”.

## 8. Limitações e pendentes (dependem de si)

1. **Firebase:** já ligado ao projeto `aniversario-francisco` e publicado em <https://aniversario-francisco.web.app>, com o painel em `/admin.html` (login Google de franciscopaisborges@gmail.com). Para voltar a publicar depois de alterações, use `npm run deploy`.
2. **Horários:** definir no painel → separador **Horários** (secção 7A).
3. **Mr. Pizza (Praça da República):** reserva a confirmar.
5. **Metrobus (linha U2, Portagem → República):** funcionamento e horários a confirmar junto da Metro Mondego.
6. **Golfe:** reserva, disponibilidade de posições cobertas para 6 pessoas, preço e duração a confirmar com o clube (+351 923 312 226).
8. **Lanche:** local e condições a confirmar.
9. **Percursos no mapa:** só serão desenhados quando houver trajetos confirmados.
10. **App Check:** recomendado antes de partilhar o link (secção 5).
11. **Teste final em produção:** depois do deploy, enviar uma resposta de teste, confirmá-la no painel e apagá-la na consola.

---

## 9. Manutenção rápida

| Quero… | Onde |
|---|---|
| Mudar horários | `admin.html` → separador **Horários** (sem alterar código) |
| Mudar textos, moradas ou coordenadas de uma atividade | `assets/js/site/program.js` |
| Mudar cores ou tipografia | variáveis no topo de `assets/css/base.css` |
| Mudar o texto do convite | `index.html` |
| Mudar os limites do formulário | `assets/js/site/rsvp.js` **e** `firebase-rtdb-rules.json` (manter coerentes) |
| Adicionar um administrador | RTDB: `/admins/<UID>: true` |
| Remover um administrador | Apagar `/admins/<UID>` (o acesso termina de imediato) |
| Obrigar as páginas abertas a atualizar | `npm run force-refresh` |
| Mostrar o painel fictício (André e Maria, botões sem efeito; “Terminar sessão” abre o jogo da cobrinha e só termina a sessão aos 50 pontos) a uma conta | RTDB: `/decoys/<UID>: true` (consola/CLI); apagar para retirar |

Créditos: mapas © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright), [Leaflet](https://leafletjs.com) (BSD-2), fontes Instrument Serif e Manrope (SIL Open Font License, em `assets/fonts/`).
