// Revisão detalhada dos pulos lógicos do I-CAM-Q eletrônico.
// Executar:  node app/tests/skips.test.mjs
// Cada teste afirma exatamente quais telas ficam visíveis/ocultas em cada cenário.

import { SCREENS, SCREENS_BY_ID, ITEMS } from '../js/questionnaire.js';
import * as eng from '../js/engine.js';

let passed = 0;
let failed = 0;
const fails = [];

function check(name, cond, detail = '') {
  if (cond) { passed++; }
  else { failed++; fails.push(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const visIds = (a) => new Set(eng.visibleScreens(a).map((s) => s.id));

const BASE = { nome_participante: 'Teste', local: 'UBS', consentimento: 'sim' };

// ---------------------------------------------------------------- estrutura
check('total de itens = 56 (ident + 55 questões)', ITEMS.length === 56, `obtido ${ITEMS.length}`);
check('Q01–Q08 no bloco 1', ITEMS.filter((i) => i.block === 1).length === 8);
check('Q09–Q14 no bloco 2', ITEMS.filter((i) => i.block === 2).length === 6);
check('Q15–Q26 no bloco 3', ITEMS.filter((i) => i.block === 3).length === 12);
check('Q27–Q55 no bloco 4', ITEMS.filter((i) => i.block === 4).length === 29);
const ids = SCREENS.map((s) => s.id);
check('ids de tela únicos', new Set(ids).size === ids.length);

// ---------------------------------------------------------------- consentimento
{
  const a = { ...BASE, consentimento: 'nao' };
  const v = visIds(a);
  check('P0: recusa oculta todos os blocos 1–4',
    eng.visibleScreens(a).every((s) => s.block === 0),
    [...v].filter((id) => SCREENS_BY_ID.get(id).block > 0).slice(0, 3).join(','));
  check('P0: recusa → próximo após consentimento é revisão (null)',
    eng.nextScreenId(a, 'consentimento') === null);
  check('P0: blocos 1–4 com status pulado',
    [1, 2, 3, 4].every((b) => eng.blockStatus(a, b) === 'pulado'));
}

// ---------------------------------------------------------------- P1: porta de item
{
  const a = { ...BASE, q02_porta: 'nao' };
  const v = visIds(a);
  check('P1: Q02 = não oculta desdobramentos de Q02',
    !v.has('q02_n3m') && !v.has('q02_util') && !v.has('q02_motivo') && !v.has('q02_motivo_outro'));
  check('P1: Q02 = não mantém Q03 visível', v.has('q03_porta'));
  check('P1: após Q02 = não, próxima tela é Q03',
    eng.nextScreenId(a, 'q02_porta') === 'q03_porta');
}
{
  const a = { ...BASE, q02_porta: 'sim' };
  const v = visIds(a);
  check('P1: Q02 = sim mostra desdobramentos na ordem',
    v.has('q02_n3m') && v.has('q02_util') && v.has('q02_motivo'));
  check('P1: após Q02 = sim, próxima tela é nº de consultas',
    eng.nextScreenId(a, 'q02_porta') === 'q02_n3m');
  check('P1: motivo_outro oculto enquanto motivo ≠ outro', !v.has('q02_motivo_outro'));
}

// ---------------------------------------------------------------- P2: Q01 controla o bloco 2
{
  const a = { ...BASE, q01_porta: 'nao' };
  const v = visIds(a);
  const b2 = SCREENS.filter((s) => s.block === 2).map((s) => s.id);
  check('P2: Q01 = não oculta TODAS as telas do bloco 2',
    b2.every((id) => !v.has(id)), b2.filter((id) => v.has(id)).slice(0, 3).join(','));
  check('P2: bloco 2 com status "pulado"', eng.blockStatus(a, 2) === 'pulado');
  // último gate do bloco 1 (q06=nao encadeia: q07/q08 ocultos) → próxima é a
  // tela de leitura do bloco 3 (a intro do bloco 2 fica oculta com Q01 = não)
  const a2 = { ...a, q02_porta: 'nao', q03_porta: 'nao', q04_porta: 'nao', q05_porta: 'nao', q06_porta: 'nao' };
  check('P2: do fim do bloco 1 vai direto ao bloco 3 (b3_intro)',
    eng.nextScreenId(a2, 'q06_porta') === 'b3_intro',
    `obtido ${eng.nextScreenId(a2, 'q06_porta')}`);
  check('P2: intro do bloco 2 oculta com Q01 = não',
    !visIds(a2).has('b2_intro'));
}
{
  const a = { ...BASE, q01_porta: 'sim' };
  const v = visIds(a);
  check('P2: Q01 = sim mostra os 6 gates do bloco 2',
    ['q09', 'q10', 'q11', 'q12', 'q13', 'q14'].every((q) => v.has(`${q}_porta`)));
  check('P2: desdobramentos do bloco 2 só com o próprio gate = sim',
    !v.has('q09_n3m'));
}

// ---------------------------------------------------------------- P3: gates do bloco 2
{
  const a = { ...BASE, q01_porta: 'sim', q09_porta: 'sim', q10_porta: 'nao' };
  const v = visIds(a);
  check('P3: Q09 = sim mostra desdobramentos', v.has('q09_n3m') && v.has('q09_util'));
  check('P3: Q10 = não oculta desdobramentos', !v.has('q10_n3m'));
  check('P3: após Q10 = não vem Q11', eng.nextScreenId(a, 'q10_porta') === 'q11_porta');
}

// ---------------------------------------------------------------- P4/P5: bloco 3 encadeado
{
  const a = { ...BASE, q15_porta: 'nao' };
  const v = visIds(a);
  check('P4: produto 1 = não oculta produtos 2 e 3 da categoria',
    !v.has('q16_porta') && !v.has('q17_porta'));
  check('P4: produto 1 = não oculta os campos do produto 1',
    !v.has('q15_nome') && !v.has('q15_em_uso') && !v.has('q15_quem_indicou'));
  check('P4: após plantas = não, vai para vitaminas (q18_porta)',
    eng.nextScreenId(a, 'q15_porta') === 'q18_porta');
}
{
  const a = { ...BASE, q15_porta: 'sim', q16_porta: 'nao' };
  const v = visIds(a);
  check('P5: produto 2 = não oculta produto 3', !v.has('q17_porta'));
  check('P5: produto 1 segue visível com seus campos',
    v.has('q15_nome') && v.has('q15_ajudou'));
  check('P5: após produto 2 = não, vai para q18_porta',
    eng.nextScreenId(a, 'q16_porta') === 'q18_porta');
}
{
  // mesmas regras nas 4 categorias (após a última, vem a intro do bloco 4)
  for (const [p1, destino] of [['q18', 'q21_porta'], ['q21', 'q24_porta'], ['q24', 'b4_intro']]) {
    const a = { ...BASE, [`${p1}_porta`]: 'nao' };
    check(`P4: ${p1} = não pula categoria → ${destino}`,
      eng.nextScreenId(a, `${p1}_porta`) === destino,
      `obtido ${eng.nextScreenId(a, `${p1}_porta`)}`);
  }
}
{
  const a = { ...BASE, q15_porta: 'sim' };
  check('P4: campo "quem indicou" é opcional (não trava conclusão)',
    eng.missingRequired(a).every((s) => s.id !== 'q15_quem_indicou'));
}

// ---------------------------------------------------------------- P6: modo no bloco 4
{
  const a = { ...BASE, q27_porta: 'sim', q27_modo: 'sozinho' };
  check('P6: modo = sozinho oculta "qual profissional"', !visIds(a).has('q27_modo_qual'));
  const b = { ...BASE, q27_porta: 'sim', q27_modo: 'profissional' };
  check('P6: modo = com profissional mostra "qual profissional"', visIds(b).has('q27_modo_qual'));
}

// ---------------------------------------------------------------- P7: motivo = outro
{
  for (const q of ['q01', 'q09', 'q15', 'q27']) {
    const gates = { q01: { q01_porta: 'sim' }, q09: { q01_porta: 'sim', q09_porta: 'sim' },
      q15: { q15_porta: 'sim' }, q27: { q27_porta: 'sim' } };
    const a = { ...BASE, ...gates[q], [`${q}_motivo`]: 'outro' };
    check(`P7: ${q} motivo = outro mostra campo de texto`, visIds(a).has(`${q}_motivo_outro`));
    const b = { ...BASE, ...gates[q], [`${q}_motivo`]: 'bem_estar' };
    check(`P7: ${q} motivo ≠ outro oculta campo de texto`, !visIds(b).has(`${q}_motivo_outro`));
  }
}

// ---------------------------------------------------------------- P8: fim do questionário
{
  const a = { ...BASE, q55_porta: 'nao' };
  check('P8: Q55 = não → revisão (próxima tela = null)',
    eng.nextScreenId(a, 'q55_porta') === null);
  const b = { ...BASE, q55_porta: 'sim' };
  check('P8: Q55 = sim → segue para desdobramentos',
    eng.nextScreenId(b, 'q55_porta') === 'q55_n3m');
}

// ---------------------------------------------------------------- encadeamento Q06–Q08
{
  const a = { ...BASE, q06_porta: 'nao' };
  const v = visIds(a);
  check('Q06 = não oculta Q07 e Q08', !v.has('q07_porta') && !v.has('q08_porta'));
  const b = { ...BASE, q06_porta: 'sim', q07_porta: 'sim' };
  check('Q06 e Q07 = sim mostram Q08', visIds(b).has('q08_porta'));
}

// ---------------------------------------------------------------- limpeza de dependentes
{
  const a = { ...BASE, q01_porta: 'sim', q01_n3m: '4', q01_util: 'muito', q09_porta: 'sim', q09_n3m: '2' };
  const would = eng.wouldClear(a, 'q01_porta', 'nao');
  check('limpeza: mudar Q01 sim→não apaga desdobramentos de Q01 e respostas do bloco 2',
    would.includes('q01_n3m') && would.includes('q01_util') &&
    would.includes('q09_porta') && would.includes('q09_n3m'),
    `apagaria: ${would.join(',')}`);
  const { answers, cleared } = eng.applyAnswer(a, 'q01_porta', 'nao');
  check('limpeza: applyAnswer remove as respostas órfãs',
    cleared.length === 4 && !('q01_n3m' in answers) && !('q09_porta' in answers));
  check('limpeza: a resposta alterada permanece', answers.q01_porta === 'nao');
}
{
  const a = { ...BASE, q27_porta: 'sim', q27_modo: 'profissional', q27_modo_qual: 'Fisioterapeuta' };
  const { answers } = eng.applyAnswer(a, 'q27_modo', 'sozinho');
  check('limpeza: trocar modo para sozinho apaga "qual profissional"', !('q27_modo_qual' in answers));
}
{
  const a = { ...BASE, q15_porta: 'sim', q15_nome: 'Camomila', q16_porta: 'sim', q16_nome: 'Boldo' };
  const { answers } = eng.applyAnswer(a, 'q15_porta', 'nao');
  check('limpeza: produto 1 = não apaga toda a cadeia da categoria',
    !('q15_nome' in answers) && !('q16_porta' in answers) && !('q16_nome' in answers));
}
{
  // cascata de 3 níveis: q17 só fica oculto DEPOIS que q16_porta é apagado —
  // exige limpeza iterada até ponto fixo, não uma única passada
  const a = {
    ...BASE,
    q15_porta: 'sim', q15_nome: 'Camomila',
    q16_porta: 'sim', q16_nome: 'Boldo',
    q17_porta: 'sim', q17_nome: 'Guaco', q17_ajudou: 'muito',
  };
  const would = eng.wouldClear(a, 'q15_porta', 'nao');
  check('cascata: wouldClear alcança o 3º nível da cadeia',
    would.includes('q17_porta') && would.includes('q17_nome') && would.includes('q17_ajudou'),
    `apagaria: ${would.join(',')}`);
  const { answers } = eng.applyAnswer(a, 'q15_porta', 'nao');
  check('cascata: applyAnswer não deixa órfãos no 3º nível',
    !('q17_porta' in answers) && !('q17_nome' in answers) && !('q17_ajudou' in answers));
}
{
  // mesma cascata via Q06→Q07→Q08
  const a = { ...BASE, q06_porta: 'sim', q06_qual: 'Benzedeira', q07_porta: 'sim', q07_qual: 'Raizeiro', q08_porta: 'sim' };
  const { answers } = eng.applyAnswer(a, 'q06_porta', 'nao');
  check('cascata: Q06 = não limpa Q07 e Q08 em cadeia',
    !('q07_porta' in answers) && !('q07_qual' in answers) && !('q08_porta' in answers));
}

// ---------------------------------------------------------------- status de bloco
{
  const a = { nome_participante: 'T', local: 'X' }; // consentimento ainda sem resposta
  check('status: blocos 1–4 "pendente" (não "pulado") antes do consentimento',
    [1, 2, 3, 4].every((b) => eng.blockStatus(a, b) === 'pendente'),
    [1, 2, 3, 4].map((b) => eng.blockStatus(a, b)).join(','));
  const b = { ...BASE }; // consentiu, mas Q01 ainda sem resposta
  check('status: bloco 2 "pendente" enquanto Q01 não foi respondida',
    eng.blockStatus(b, 2) === 'pendente', eng.blockStatus(b, 2));
  const c = { ...BASE, q01_porta: 'nao' };
  check('status: bloco 2 "pulado" somente após Q01 = não',
    eng.blockStatus(c, 2) === 'pulado');
}

// ---------------------------------------------------------------- caminho mínimo completo
{
  const a = { ...BASE };
  for (const it of ITEMS) {
    if (it.id === 'ident') continue;
    if (eng.isScreenVisible(a, it.gate)) a[it.gate] = 'nao';
  }
  const missing = eng.missingRequired(a);
  check('caminho mínimo: tudo "não" não deixa pendências', missing.length === 0,
    missing.slice(0, 5).map((s) => s.id).join(','));
  const totals = eng.visibleScreens(a).length;
  // 4 ident + intro b1 + 6 gates b1 (q06=não encadeia) + intro b3 + 4 gates b3
  // + intro b4 + 29 gates b4 = 46 (b2 e sua intro ocultos com q01=não)
  check('caminho mínimo: 46 telas no total', totals === 46, `obtido ${totals}`);
  check('caminho mínimo: blocos 1, 3 e 4 completos',
    eng.blockStatus(a, 1) === 'completo' && eng.blockStatus(a, 3) === 'completo' && eng.blockStatus(a, 4) === 'completo');
}

// ---------------------------------------------------------------- caminho máximo
{
  const a = { ...BASE };
  // responde sim a tudo e preenche tudo
  let guard = 0;
  let cur = eng.visibleScreens(a)[0].id;
  while (cur && guard++ < 1000) {
    const s = SCREENS_BY_ID.get(cur);
    if (s.type === 'choice') {
      if (s.options.some((o) => o.value === 'sim')) a[s.id] = 'sim';
      else if (s.id.endsWith('_modo')) a[s.id] = 'profissional';
      else a[s.id] = s.options[0].value; // util/motivo → primeira opção
    } else if (s.type === 'number') a[s.id] = '2';
    else if (s.type === 'text') a[s.id] = 'x';
    cur = eng.nextScreenId(a, cur);
  }
  check('caminho máximo: percorre sem loop infinito', guard < 1000, `guard=${guard}`);
  const missing = eng.missingRequired(a);
  check('caminho máximo: nada obrigatório fica para trás', missing.length === 0,
    missing.slice(0, 5).map((s) => s.id).join(','));
  check('caminho máximo: todos os blocos completos',
    [0, 1, 2, 3, 4].every((b) => eng.blockStatus(a, b) === 'completo'));
}

// ---------------------------------------------------------------- resultado
console.log(`\nPulos lógicos — ${passed} verificações OK, ${failed} falhas`);
if (failed) { console.log(fails.join('\n')); process.exit(1); }
