// Teste de fumaça da interface (headless, jsdom): percorre uma entrevista
// completa — setup do entrevistador, identificação, pulos, menu de blocos,
// alteração de resposta com limpeza de dependentes, revisão, conclusão e CSV.
// Executar:  node app/tests/ui.smoke.mjs   (requer jsdom em /tmp/icamq-uitest)

import { createRequire } from 'node:module';
const require = createRequire('/tmp/icamq-uitest/x.js');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.scrollTo = () => {};

let passed = 0, failed = 0;
const fails = [];
function check(name, cond, detail = '') {
  if (cond) passed++;
  else { failed++; fails.push(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const text = () => document.body.textContent;

async function clickAction(action) {
  const el = $(`[data-action="${action}"]`);
  if (!el) throw new Error(`ação não encontrada: ${action}`);
  el.click();
  await sleep(30);
}
async function clickOpt(value) {
  const el = $(`.opt[data-value="${value}"]`);
  if (!el) throw new Error(`opção não encontrada: ${value}`);
  el.click();
  await sleep(400); // espera o avanço automático (300 ms na primeira marcação)
}
async function fillAndAdvance(value) {
  const input = $('.q-input');
  input.value = value;
  await clickAction('avancar');
}

await import('../js/app.js');
const store = await import('../js/storage.js');

// 1. setup do entrevistador
check('abre no setup quando não há entrevistador', !!$('#setup-code'));
$('#setup-code').value = 'E01';
$('#setup-nome').value = 'Ana';
await clickAction('salvar-entrevistador');
check('home após salvar entrevistador', text().includes('Nova entrevista'));

// 2. nova entrevista → tela administrativa
await clickAction('nova-entrevista');
check('tela inicial mostra ID gerado (com sufixo do aparelho)',
  /ICAMQ-E01-[A-Z2-9]{2}-001/.test(text()), text().slice(0, 200));
check('uma pergunta por tela', document.querySelectorAll('.q-title').length === 1);

// 3. identificação
await clickAction('avancar');
check('pergunta do nome do participante', text().includes('nome completo do participante'));
await fillAndAdvance('Maria de Teste');
check('pergunta do local', text().includes('Local da entrevista'));
await fillAndAdvance('UBS Central');
check('tela de consentimento', text().includes('concorda em participar'));
await clickOpt('sim');

// 4. tela de leitura do bloco 1, depois Q01 = não pula desdobramentos e bloco 2
check('tela de leitura do bloco 1 com o enunciado do questionário',
  text().includes('1. Consulta a profissionais de saúde') &&
  text().includes('Problemas de saúde podem ser tratados'), text().slice(0, 160));
await clickAction('avancar');
check('chegou em Q01 (médico)', text().includes('Q01 · Médico'), text().slice(0, 120));
await clickOpt('nao');
check('Q01=não → próxima é Q02', text().includes('Q02 · Quiropraxista'));

await clickAction('menu');
check('menu de blocos abre', text().includes('Índice do questionário'));
check('menu marca bloco 2 como pulado', text().includes('Pulado: Q01 (médico) = não.'));
await clickAction('fechar-menu');

// 5. volta, muda Q01 para sim e responde desdobramentos
// (trocar resposta já dada NÃO avança sozinho — exige Avançar explícito)
await clickAction('voltar');
await clickOpt('sim');
check('trocar resposta existente não avança automaticamente', text().includes('Q01 · Médico'));
await clickAction('avancar');
check('Q01=sim → pergunta nº de consultas', text().includes('Nº de consultas'));
await fillAndAdvance('3');
check('pergunta de utilidade', text().includes('foi útil'));
await clickOpt('muito');
check('pergunta de motivo', text().includes('principal motivo'));
await clickOpt('outro');
check('motivo=outro → campo especifique', text().includes('Especifique o motivo'));
await fillAndAdvance('Check-up');
check('após Q01 completo vem Q02', text().includes('Q02 · Quiropraxista'));

// 6. menu: navegar de volta a Q01 e mudar para "não" (limpeza com confirmação)
await clickAction('menu');
$('[data-action="ir-item"][data-screen="q01_porta"]').click();
await sleep(30);
check('navegou para Q01 pelo menu', text().includes('Q01 · Médico'));
$('.opt[data-value="nao"]').click();
await sleep(60);
check('modal de confirmação de limpeza aparece', !!$('.modal'), text().slice(0, 80));
$('[data-md="ok"]').click();
await sleep(400);
check('após confirmar a troca, permanece em Q01 (sem avanço automático)',
  text().includes('Q01 · Médico'));
await clickAction('avancar');
check('Avançar leva a Q02', text().includes('Q02 · Quiropraxista'));
{
  const iv = store.listInterviews()[0];
  check('respostas dependentes de Q01 foram apagadas',
    !('q01_n3m' in iv.answers) && !('q01_motivo_outro' in iv.answers) && iv.answers.q01_porta === 'nao',
    JSON.stringify(Object.keys(iv.answers)));
}

// 7. responde "não" para tudo até a revisão
let guard = 0;
while (guard++ < 300) {
  if ($('.rev-area')) break;
  const nao = $('.opt[data-value="nao"]');
  if (nao) { nao.click(); await sleep(400); continue; }
  const input = $('.q-input');
  if (input) { await fillAndAdvance(input.classList.contains('num-input') ? '0' : 'x'); continue; }
  const opt = $('.opt');
  if (opt) { opt.click(); await sleep(400); continue; }
  await clickAction('avancar');
}
check('chega à revisão sem travar', !!$('.rev-area'), `guard=${guard}`);
check('revisão mostra bloco 2 pulado', text().includes('Q01 (médico) = não — bloco não se aplica.'));
check('revisão sem pendências obrigatórias', !text().includes('sem resposta'));

// 8. concluir
await clickAction('concluir');
await sleep(60);
$('[data-md="ok"]').click();
await sleep(60);
check('volta à home após concluir', text().includes('Nova entrevista'));
check('entrevista listada como completa',
  text().includes('Completa') && /ICAMQ-E01-[A-Z2-9]{2}-001/.test(text()));

// 8b. entrevista concluída é protegida contra edição silenciosa
await clickAction('abrir-entrevista');
check('entrevista concluída abre direto na revisão', !!$('.rev-area'));
check('revisão de entrevista concluída não tem botão de voltar ao questionário',
  !$('[data-action="rev-voltar"]'));
$('.rev-item').click();
await sleep(60);
check('editar item de entrevista concluída pede reabertura', text().includes('Reabrir entrevista?'));
$('[data-md="cancel"]').click();
await sleep(60);
check('cancelar reabertura mantém a revisão e o status', !!$('.rev-area') &&
  store.listInterviews()[0].status === 'completa');
await clickAction('sair');

// 9. exportação
{
  const csv = store.toCSV(store.listInterviews());
  const [header, row] = csv.split('\n');
  check('CSV tem cabeçalho com variáveis do codebook',
    header.includes('pid') && header.includes('q01_porta') && header.includes('q55_motivo_outro'));
  check('CSV tem metadados novos (aparelho, horário local, updatedAt)',
    header.includes('aparelho') && header.includes('inicio_local') && header.includes('atualizado_em'));
  check('CSV tem a linha da entrevista', /ICAMQ-E01-[A-Z2-9]{2}-001/.test(row) && row.includes('completa'));
  const cols = header.replace('﻿', '').split(';');
  const vals = row.split(';');
  check('CSV: colunas e valores alinhados', cols.length === vals.length,
    `${cols.length} vs ${vals.length}`);
  const get = (name) => vals[cols.indexOf(name)];
  check('CSV: q01_porta = nao e q01_n3m vazio (limpo)', get('q01_porta') === 'nao' && get('q01_n3m') === '');
  check('CSV: nome do participante registrado', get('nome_participante') === 'Maria de Teste');
  check('CSV: início local com offset de fuso', /[+-]\d{2}:\d{2}$/.test(get('inicio_local')), get('inicio_local'));
}

// 10. segunda entrevista gera ID sequencial
await clickAction('nova-entrevista');
check('segunda entrevista termina em -002', /ICAMQ-E01-[A-Z2-9]{2}-002/.test(text()));

console.log(`\nInterface (smoke) — ${passed} verificações OK, ${failed} falhas`);
if (failed) { console.log(fails.join('\n')); process.exit(1); }
