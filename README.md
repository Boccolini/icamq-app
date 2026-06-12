# I-CAM-Q · Questionário eletrônico de campo (PWA)

Versão eletrônica do **I-CAM-Q ptBR** (`ICAMQ_ptBR_FINAL.docx`) para coleta de dados
em campo: uma pergunta por tela, pulos lógicos automáticos, navegação por pergunta
e por bloco, funcionamento 100% offline e instalação como aplicativo em iOS e Android.

## Estrutura

```
app/
├── index.html              ponto de entrada
├── styles.css              design (tipografia grande, alto contraste)
├── manifest.webmanifest    metadados de instalação (PWA)
├── sw.js                   service worker (cache offline)
├── icons/                  ícones do app
├── js/
│   ├── questionnaire.js    DEFINIÇÃO do instrumento (perguntas, opções, pulos)
│   ├── engine.js           motor de navegação e visibilidade
│   ├── storage.js          persistência local, IDs e exportação
│   └── app.js              interface
└── tests/
    ├── skips.test.mjs      58 verificações dos pulos lógicos
    └── ui.smoke.mjs        31 verificações do fluxo completo da interface
```

Para alterar texto de pergunta, opções ou regras de pulo, edite **apenas**
`js/questionnaire.js` e atualize `FORM_VERSION` (e o nome do cache em `sw.js`,
ex. `icamq-v2`, para forçar atualização nos aparelhos).

## Como rodar localmente

```bash
node serve.mjs          # na raiz do projeto → http://localhost:8714
# ou
python3 -m http.server 8714 --directory app
```

O service worker (offline) exige HTTPS ou `localhost` — abrir o arquivo direto
(`file://`) não funciona.

## Como publicar (necessário para instalar nos celulares)

Qualquer hospedagem estática com HTTPS serve. Opções gratuitas, já preparadas:

1. **GitHub Pages (um comando)**: `bash tools/publicar_github.sh` — cria/atualiza um
   repositório público só com o app e imprime o endereço de instalação.
   Requer internet e `gh` autenticado.
2. **Netlify Drop**: acesse <https://app.netlify.com/drop> e arraste o arquivo
   `dist/icamq_app_netlify.zip` (ou a pasta `app/`). Com conta, o endereço é permanente.
3. **Vercel**: `vercel deploy app/`.

O app usa apenas caminhos relativos, então funciona em subdiretório
(ex.: `usuario.github.io/icamq-app/`) sem ajuste.

## Instalação nos aparelhos dos entrevistadores

- **Android (Chrome)**: abrir o endereço → menu ⋮ → **Instalar aplicativo**.
- **iOS (Safari)**: abrir o endereço → botão Compartilhar → **Adicionar à Tela de Início**.

Após a primeira abertura o app funciona sem internet. Os dados ficam gravados
no aparelho (localStorage) e sobrevivem a fechamento do app e reinício do telefone.
⚠️ Não apague os dados do navegador antes de exportar.

## Fluxo de uso em campo

1. Primeira abertura: registrar o **código do entrevistador** (E01, E02, …) — uma vez por aparelho.
2. **+ Nova entrevista** → o app gera o ID único `ICAMQ-E01-K7-001`, `-002`, …
   (código do entrevistador + sufixo do aparelho + sequencial: mesmo que dois
   celulares usem o mesmo código por engano, os IDs nunca colidem; cada registro
   também carrega um UUID interno).
3. Identificação (nome do participante, local) → consentimento → blocos 1–4.
4. ☰ abre o **índice de blocos**: status de cada bloco, salto direto a qualquer
   pergunta visível; blocos pulados por regra aparecem marcados com o motivo.
5. Tocar numa opção avança sozinho **apenas na primeira resposta**; ao corrigir
   uma resposta já dada, o app espera o toque em "Avançar" (proteção contra
   toque errado).
6. **Revisão final**: resumo por bloco, lista de pendências obrigatórias, edição
   pontual e conclusão (ou registro de recusa). Entrevista já concluída exige
   "reabrir" explícito para ser editada.
7. Ao fim do dia: **Exportar CSV** (separador `;`, UTF-8 com BOM — abre direto no
   Excel pt-BR) ou **JSON**. No celular a exportação abre a **folha de
   compartilhamento** (Arquivos, AirDrop, WhatsApp, e-mail); no desktop baixa o
   arquivo. Consolidação entre aparelhos: `node tools/consolidate.mjs <exports>`.

## Pulos lógicos implementados

| Regra | Condição | Efeito |
|---|---|---|
| P0 | Consentimento = não | encerra: blocos 1–4 ocultos, registro como recusa |
| P1 | Porta do item = não (Q01–Q14, Q27–Q55) | oculta os desdobramentos do item |
| P2 | Q01 (médico) = não | oculta o bloco 2 inteiro (Q09–Q14) |
| P4 | Bloco 3: produto 1 da categoria = não | pula a categoria (→ próxima categoria) |
| P5 | Bloco 3: produto 2 = não | oculta o produto 3 |
| P6 | Bloco 4: modo = sozinho | oculta "qual profissional?" |
| P7 | Motivo = outro (qualquer item) | exibe campo de texto obrigatório |
| P8 | Q55 = não | vai direto à revisão final |
| — | Q06 = não / Q07 = não | oculta Q07–Q08 / Q08 ("outros" encadeados) |

Mudar uma resposta que controla pulos (ex.: Q01 sim→não) apaga as respostas
dependentes **após confirmação** do entrevistador — nunca ficam dados órfãos.

Verificação: `node app/tests/skips.test.mjs` e `node app/tests/ui.smoke.mjs`
(o segundo requer `jsdom`).

## Codebook (exportação)

Metadados: `pid`, `uuid`, `entrevistador`, `nome_entrevistador`, `aparelho`,
`status` (`completa`/`recusa`/`em_andamento`), `inicio`/`fim` (UTC),
`inicio_local`/`fim_local` (horário de campo com offset de fuso, ex.
`2026-06-11T19:30:00-03:00`), `duracao_min`, `atualizado_em`, `versao_form`.

Por questão (prefixo `q01`…`q55`):

| Sufixo | Conteúdo | Valores |
|---|---|---|
| `_porta` | usou/consultou/realizou? | `sim` / `nao` |
| `_n3m` | nº de vezes nos últimos 3 meses | inteiro 0–999 |
| `_util` / `_ajudou` | utilidade percebida | `muito`, `um_pouco`, `nada`, `nao_sei` |
| `_motivo` | motivo principal | `agudo`, `cronico`, `bem_estar`, `outro` |
| `_motivo_outro` | texto se motivo = outro | livre |
| `_qual` | qual profissional/tratamento (itens "outro") | livre |
| `_nome` | nome do produto (bloco 3) | livre |
| `_em_uso` | ainda usa o produto (bloco 3) | `sim` / `nao` |
| `_quem_indicou` | quem indicou (bloco 3, opcional) | livre |
| `_modo` / `_modo_qual` | sozinho ou com profissional (bloco 4) | `sozinho`, `profissional` / livre |

Identificação: `nome_participante`, `local`, `consentimento`.

## Decisões tomadas em relação ao Word (confirmar com a equipe)

1. **Bloco 3, "Sim/Não" sem enunciado** → implementado como "Você ainda usa este
   produto atualmente?" (`_em_uso`), conforme o I-CAM-Q original ("Do you use it now?").
2. **Q06–Q08 e produtos do bloco 3** → encadeados (só pergunto "outro 2" se houve
   "outro 1"); o papel pedia leitura sequencial mesmo após "não".
3. Typo recorrente do Word ("professional") corrigido para "profissional".
4. "Quem indicou" (bloco 3) é o único campo opcional; todo o restante é obrigatório,
   o que distingue pulo de omissão na base.
5. Nome do participante fica junto do registro neste protótipo; para LGPD estrita,
   exportar o JSON e separar a coluna `nome_participante` antes de circular a base.
6. **Q13 "Opção específica"**: no I-CAM-Q é um slot que a equipe pré-define com um
   tratamento de interesse do estudo. Configure-o na constante
   `Q13_OPCAO_ESPECIFICA` no topo de `js/questionnaire.js`; vazio, a Q13 vira uma
   pergunta genérica de "outro tratamento" (e a Q14, "mais algum outro").
7. A janela de recall **"nos últimos 12 meses"** foi incluída no título de todas as
   perguntas-porta (no papel ela aparece só no enunciado da seção, que o app não
   exibe em tela separada).
