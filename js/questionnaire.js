// Definição do instrumento I-CAM-Q ptBR.
// Fonte: ICAMQ_ptBR_FINAL.docx (Quandt et al., 2009 — versão brasileira).
// Cada tela é um objeto; visibleIf implementa os pulos lógicos.

export const FORM_VERSION = '1.2.0';

// Q13 do I-CAM-Q é um slot que a equipe do estudo pré-define ("Opção específica").
// Preencha com o tratamento de interesse (ex.: 'Ozonioterapia') para que a Q13
// pergunte por ele diretamente; vazio = pergunta genérica de "outro tratamento".
export const Q13_OPCAO_ESPECIFICA = '';

const SIM_NAO = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
];

const UTIL = [
  { value: 'muito', label: 'Muito' },
  { value: 'um_pouco', label: 'Um pouco' },
  { value: 'nada', label: 'Nada' },
  { value: 'nao_sei', label: 'Não sei' },
];

const MOTIVO = [
  { value: 'agudo', label: 'Para doença ou condição aguda, com duração inferior a 1 mês' },
  { value: 'cronico', label: 'Para tratar condição de longa duração (mais de 1 mês) ou seus sintomas' },
  { value: 'bem_estar', label: 'Para melhorar o bem-estar' },
  { value: 'outro', label: 'Outro (especifique o motivo)' },
];

export const SHORT_LABELS = {
  sim: 'Sim', nao: 'Não',
  muito: 'Muito', um_pouco: 'Um pouco', nada: 'Nada', nao_sei: 'Não sei',
  agudo: 'Cond. aguda', cronico: 'Cond. crônica', bem_estar: 'Bem-estar', outro: 'Outro',
  sozinho: 'Sozinho(a)', profissional: 'Com profissional',
};

export const BLOCKS = [
  { id: 0, nome: 'Identificação e consentimento', curto: 'Identificação', faixa: '' },
  { id: 1, nome: 'Consulta a profissionais de saúde', curto: 'Profissionais', faixa: 'Q01–Q08' },
  { id: 2, nome: 'Tratamentos complementares recebidos de médicos', curto: 'Trat. de médicos', faixa: 'Q09–Q14' },
  { id: 3, nome: 'Plantas medicinais e suplementos', curto: 'Plantas e supl.', faixa: 'Q15–Q26' },
  { id: 4, nome: 'Práticas de autocuidado', curto: 'Autocuidado', faixa: 'Q27–Q55' },
];

export const SCREENS = [];
export const ITEMS = [];

const consented = (a) => a.consentimento === 'sim';

function add(screen) { SCREENS.push(screen); }

function itemScreens(itemId) {
  return SCREENS.filter((s) => s.item === itemId).map((s) => s.id);
}

// ---------------------------------------------------------------- Bloco 0
add({
  id: 'admin_info', block: 0, item: 'ident', chip: 'Início', type: 'info',
  title: 'Dados da entrevista',
  subtitle: 'Confira o ID do participante, o entrevistador e a data antes de começar.',
});
add({
  id: 'nome_participante', block: 0, item: 'ident', chip: 'Identificação', type: 'text',
  title: 'Qual é o nome completo do participante?',
  placeholder: 'Nome do participante',
});
add({
  id: 'local', block: 0, item: 'ident', chip: 'Identificação', type: 'text',
  title: 'Local da entrevista',
  placeholder: 'Ex.: UBS Central, domicílio…',
});
add({
  id: 'consentimento', block: 0, item: 'ident', chip: 'Consentimento', type: 'choice',
  options: SIM_NAO,
  title: 'O participante foi informado sobre a pesquisa e concorda em participar?',
  subtitle: 'Se a resposta for "Não", a entrevista é encerrada e registrada como recusa.',
});
ITEMS.push({
  id: 'ident', block: 0, qnum: '', label: 'Identificação e consentimento',
  gate: 'consentimento', screens: itemScreens('ident'),
});

// ---------------------------------------------------------------- Bloco 1
// Tela de leitura com o enunciado do bloco, exatamente como no questionário.
add({
  id: 'b1_intro', block: 1, item: 'b1_intro', chip: 'Bloco 1', type: 'info',
  title: '1. Consulta a profissionais de saúde',
  paras: [
    'Problemas de saúde podem ser tratados por diferentes profissionais de saúde.',
    'Nos últimos 12 meses, você consultou algum dos seguintes profissionais?',
  ],
  visibleIf: consented,
});

// Q06–Q08 são encadeados: só pergunto "mais algum outro?" se o anterior foi "sim".
const B1 = [
  { id: 'q01', q: 'Q01', nome: 'Médico' },
  { id: 'q02', q: 'Q02', nome: 'Quiropraxista' },
  { id: 'q03', q: 'Q03', nome: 'Homeopata' },
  { id: 'q04', q: 'Q04', nome: 'Acupunturista' },
  { id: 'q05', q: 'Q05', nome: 'Fitoterapeuta' },
  { id: 'q06', q: 'Q06', nome: 'Outro profissional (1)', outro: true },
  { id: 'q07', q: 'Q07', nome: 'Outro profissional (2)', outro: true, depois: 'q06' },
  { id: 'q08', q: 'Q08', nome: 'Outro profissional (3)', outro: true, depois: 'q07' },
];

for (const it of B1) {
  const gate = `${it.id}_porta`;
  const gateVis = it.depois
    ? (a) => consented(a) && a[`${it.depois}_porta`] === 'sim'
    : consented;
  const dep = (a) => gateVis(a) && a[gate] === 'sim';
  const chip = `${it.q} · ${it.nome}`;

  add({
    id: gate, block: 1, item: it.id, chip, type: 'choice', options: SIM_NAO,
    title: it.outro
      ? (it.depois
        ? 'Nos últimos 12 meses, você consultou mais algum outro profissional de saúde?'
        : 'Nos últimos 12 meses, você consultou algum outro profissional de saúde não listado?')
      : `Nos últimos 12 meses, você consultou: ${it.nome}?`,
    visibleIf: gateVis,
  });
  if (it.outro) {
    add({
      id: `${it.id}_qual`, block: 1, item: it.id, chip, type: 'text',
      title: 'Qual profissional?', visibleIf: dep,
    });
  }
  add({
    id: `${it.id}_n3m`, block: 1, item: it.id, chip, type: 'number',
    title: 'Nº de consultas com este profissional nos últimos 3 meses', visibleIf: dep,
  });
  add({
    id: `${it.id}_util`, block: 1, item: it.id, chip, type: 'choice', options: UTIL,
    title: 'O quanto foi útil para você consultar esse profissional?', visibleIf: dep,
  });
  add({
    id: `${it.id}_motivo`, block: 1, item: it.id, chip, type: 'choice', options: MOTIVO,
    title: 'Qual foi o principal motivo da sua última consulta?', visibleIf: dep,
  });
  add({
    id: `${it.id}_motivo_outro`, block: 1, item: it.id, chip, type: 'text',
    title: 'Especifique o motivo',
    visibleIf: (a) => dep(a) && a[`${it.id}_motivo`] === 'outro',
  });
  ITEMS.push({ id: it.id, block: 1, qnum: it.q, label: it.nome, gate, screens: itemScreens(it.id) });
}

// ---------------------------------------------------------------- Bloco 2
// Visível apenas se Q01 (médico) = sim.
const b2vis = (a) => consented(a) && a.q01_porta === 'sim';

add({
  id: 'b2_intro', block: 2, item: 'b2_intro', chip: 'Bloco 2', type: 'info',
  title: '2. Tratamentos complementares recebidos de médicos',
  paras: [
    'Preencha esta seção apenas se Q01 = Sim.',
    'Se você não consultou um médico nos últimos 12 meses, vá para o bloco 3.',
    'Nos últimos 12 meses, você recebeu de um médico algum dos seguintes tratamentos?',
  ],
  visibleIf: b2vis,
});

const B2 = [
  { id: 'q09', q: 'Q09', nome: 'Manipulação (terapia manual)' },
  { id: 'q10', q: 'Q10', nome: 'Homeopatia' },
  { id: 'q11', q: 'Q11', nome: 'Acupuntura' },
  { id: 'q12', q: 'Q12', nome: 'Fitoterápicos' },
  { id: 'q13', q: 'Q13', nome: Q13_OPCAO_ESPECIFICA || 'Tratamento específico', outro: true },
  { id: 'q14', q: 'Q14', nome: 'Outro tratamento', outro: true },
];

for (const it of B2) {
  const gate = `${it.id}_porta`;
  const dep = (a) => b2vis(a) && a[gate] === 'sim';
  const chip = `${it.q} · ${it.nome}`;

  add({
    id: gate, block: 2, item: it.id, chip, type: 'choice', options: SIM_NAO,
    title: it.outro
      ? (it.id === 'q13'
        ? (Q13_OPCAO_ESPECIFICA
          ? `Nos últimos 12 meses, você recebeu de um médico: ${Q13_OPCAO_ESPECIFICA}?`
          : 'Nos últimos 12 meses, você recebeu de um médico algum outro tratamento complementar não listado?')
        : 'Nos últimos 12 meses, além dos anteriores, você recebeu de um médico mais algum outro tratamento complementar?')
      : `Nos últimos 12 meses, você recebeu de um médico: ${it.nome}?`,
    visibleIf: b2vis,
  });
  if (it.outro) {
    add({
      id: `${it.id}_qual`, block: 2, item: it.id, chip, type: 'text',
      title: 'Qual tratamento?',
      // com a opção específica pré-definida, o nome do tratamento já é conhecido
      visibleIf: it.id === 'q13' && Q13_OPCAO_ESPECIFICA ? () => false : dep,
    });
  }
  add({
    id: `${it.id}_n3m`, block: 2, item: it.id, chip, type: 'number',
    title: 'Nº de vezes que recebeu este tratamento nos últimos 3 meses', visibleIf: dep,
  });
  add({
    id: `${it.id}_util`, block: 2, item: it.id, chip, type: 'choice', options: UTIL,
    title: 'O quanto foi útil receber esse tratamento do médico?', visibleIf: dep,
  });
  add({
    id: `${it.id}_motivo`, block: 2, item: it.id, chip, type: 'choice', options: MOTIVO,
    title: 'Qual foi o principal motivo da última vez em que recebeu este tratamento?', visibleIf: dep,
  });
  add({
    id: `${it.id}_motivo_outro`, block: 2, item: it.id, chip, type: 'text',
    title: 'Especifique o motivo',
    visibleIf: (a) => dep(a) && a[`${it.id}_motivo`] === 'outro',
  });
  ITEMS.push({ id: it.id, block: 2, qnum: it.q, label: it.nome, gate, screens: itemScreens(it.id) });
}

// ---------------------------------------------------------------- Bloco 3
// 4 categorias × 3 produtos. Produto N só é perguntado se o produto N-1 foi usado.
// "em_uso" corresponde ao Sim/Não do Word (interpretação: uso atual — I-CAM-Q original).
add({
  id: 'b3_intro', block: 3, item: 'b3_intro', chip: 'Bloco 3', type: 'info',
  title: '3. Uso de plantas medicinais/fitoterápicos e suplementos alimentares, incluindo comprimidos, cápsulas e líquidos.',
  paras: [
    'Para cada categoria abaixo, liste até três produtos que você usou nos últimos 12 meses.',
  ],
  visibleIf: consented,
});

const CATS = [
  { nome: 'Plantas medicinais / fitoterápicos', ids: ['q15', 'q16', 'q17'] },
  { nome: 'Vitaminas / minerais', ids: ['q18', 'q19', 'q20'] },
  { nome: 'Medicamentos homeopáticos', ids: ['q21', 'q22', 'q23'] },
  { nome: 'Outros suplementos', ids: ['q24', 'q25', 'q26'] },
];

for (const cat of CATS) {
  cat.ids.forEach((id, i) => {
    const q = `Q${id.slice(1)}`;
    const gate = `${id}_porta`;
    const gateVis = i === 0
      ? consented
      : (a) => consented(a) && a[`${cat.ids[i - 1]}_porta`] === 'sim';
    const dep = (a) => gateVis(a) && a[gate] === 'sim';
    const chip = `${q} · ${cat.nome}`;

    add({
      id: gate, block: 3, item: id, chip, type: 'choice', options: SIM_NAO,
      title: i === 0
        ? `Nos últimos 12 meses, você usou: ${cat.nome.toLowerCase()}?`
        : `Nos últimos 12 meses, você usou algum outro tipo de: ${cat.nome.toLowerCase()}?`,
      subtitle: i === 0 ? 'Inclui comprimidos, cápsulas e líquidos.' : undefined,
      visibleIf: gateVis,
    });
    add({
      id: `${id}_nome`, block: 3, item: id, chip, type: 'text',
      title: 'Qual é o nome do produto?', visibleIf: dep,
    });
    add({
      id: `${id}_em_uso`, block: 3, item: id, chip, type: 'choice', options: SIM_NAO,
      title: 'Você ainda usa este produto atualmente?', visibleIf: dep,
    });
    add({
      id: `${id}_quem_indicou`, block: 3, item: id, chip, type: 'text', optional: true,
      title: 'Qual profissional de saúde indicou esse uso?',
      subtitle: 'Deixe em branco se ninguém indicou.', visibleIf: dep,
    });
    add({
      id: `${id}_ajudou`, block: 3, item: id, chip, type: 'choice', options: UTIL,
      title: 'O quanto este produto ajudou você?', visibleIf: dep,
    });
    add({
      id: `${id}_motivo`, block: 3, item: id, chip, type: 'choice', options: MOTIVO,
      title: 'Qual foi o principal motivo do seu último uso?', visibleIf: dep,
    });
    add({
      id: `${id}_motivo_outro`, block: 3, item: id, chip, type: 'text',
      title: 'Especifique o motivo',
      visibleIf: (a) => dep(a) && a[`${id}_motivo`] === 'outro',
    });
    ITEMS.push({
      id, block: 3, qnum: q, label: `${cat.nome} — produto ${i + 1}`,
      gate, screens: itemScreens(id),
    });
  });
}

// ---------------------------------------------------------------- Bloco 4
add({
  id: 'b4_intro', block: 4, item: 'b4_intro', chip: 'Bloco 4', type: 'info',
  title: '4. Práticas de autocuidado',
  paras: [
    'Nos últimos 12 meses, você realizou alguma das seguintes práticas de autocuidado?',
  ],
  visibleIf: consented,
});

const B4 = [
  'Meditação', 'Yoga', 'Qigong / Chi Kung', 'Tai Chi', 'Técnicas de relaxamento',
  'Oração pela própria saúde', 'Aromaterapia', 'Terapia de florais', 'Dança circular',
  'Ayurveda', 'Biodança', 'Medicina tradicional chinesa (acupuntura, moxabustão)',
  'Musicoterapia', 'Reiki', 'Terapia comunitária integrativa', 'Arteterapia',
  'Apiterapia', 'Bioenergética', 'Constelação familiar', 'Cromoterapia', 'Geoterapia',
  'Hipnoterapia', 'Medicina antroposófica / antroposofia', 'Naturopatia', 'Osteopatia',
  'Ozonioterapia', 'Quiropraxia', 'Reflexoterapia', 'Termalismo social / crenoterapia',
];

B4.forEach((nome, i) => {
  const n = 27 + i;
  const id = `q${n}`;
  const q = `Q${n}`;
  const gate = `${id}_porta`;
  const dep = (a) => consented(a) && a[gate] === 'sim';
  const chip = `${q} · ${nome}`;

  add({
    id: gate, block: 4, item: id, chip, type: 'choice', options: SIM_NAO,
    title: `Nos últimos 12 meses, você realizou: ${nome}?`,
    visibleIf: consented,
  });
  add({
    id: `${id}_n3m`, block: 4, item: id, chip, type: 'number',
    title: 'Nº de vezes que realizou esta prática nos últimos 3 meses', visibleIf: dep,
  });
  add({
    id: `${id}_modo`, block: 4, item: id, chip, type: 'choice',
    options: [
      { value: 'sozinho', label: 'Sozinho(a)' },
      { value: 'profissional', label: 'Com algum profissional' },
    ],
    title: 'Você realizou essa prática sozinho(a) ou com algum profissional?', visibleIf: dep,
  });
  add({
    id: `${id}_modo_qual`, block: 4, item: id, chip, type: 'text',
    title: 'Qual profissional?',
    visibleIf: (a) => dep(a) && a[`${id}_modo`] === 'profissional',
  });
  add({
    id: `${id}_ajudou`, block: 4, item: id, chip, type: 'choice', options: UTIL,
    title: 'O quanto esta prática ajudou você?', visibleIf: dep,
  });
  add({
    id: `${id}_motivo`, block: 4, item: id, chip, type: 'choice', options: MOTIVO,
    title: 'Qual foi o principal motivo da última vez em que realizou esta prática?', visibleIf: dep,
  });
  add({
    id: `${id}_motivo_outro`, block: 4, item: id, chip, type: 'text',
    title: 'Especifique o motivo',
    visibleIf: (a) => dep(a) && a[`${id}_motivo`] === 'outro',
  });
  ITEMS.push({ id, block: 4, qnum: q, label: nome, gate, screens: itemScreens(id) });
});

export const SCREENS_BY_ID = new Map(SCREENS.map((s) => [s.id, s]));
export const ITEMS_BY_ID = new Map(ITEMS.map((it) => [it.id, it]));
