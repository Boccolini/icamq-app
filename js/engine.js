// Motor de navegação e pulos lógicos.
// Todas as regras de visibilidade vivem em questionnaire.js (visibleIf);
// aqui ficam as operações derivadas: lista visível, limpeza de dependentes,
// progresso, status de bloco e pendências.

import { SCREENS, SCREENS_BY_ID } from './questionnaire.js';

export const answered = (v) => v !== undefined && v !== null && String(v).trim() !== '';

export function visibleScreens(a) {
  return SCREENS.filter((s) => !s.visibleIf || s.visibleIf(a));
}

// Respostas que ficam ocultas se id receber value — iterando até ponto fixo,
// porque apagar uma resposta pode ocultar telas que dependiam dela em cadeia
// (ex.: produto 1 = não oculta o gate do produto 2, que oculta o produto 3).
function collectCleared(a, id, value) {
  const next = { ...a, [id]: value };
  const cleared = [];
  let changed = true;
  while (changed) {
    changed = false;
    const vis = new Set(visibleScreens(next).map((s) => s.id));
    for (const k of Object.keys(next)) {
      if (k === id) continue;
      if (answered(next[k]) && SCREENS_BY_ID.has(k) && !vis.has(k)) {
        delete next[k];
        cleared.push(k);
        changed = true;
      }
    }
  }
  return { next, cleared };
}

export function wouldClear(a, id, value) {
  return collectCleared(a, id, value).cleared;
}

export function applyAnswer(a, id, value) {
  const { next, cleared } = collectCleared(a, id, value);
  return { answers: next, cleared };
}

export function nextScreenId(a, currentId) {
  const vis = visibleScreens(a);
  const i = vis.findIndex((s) => s.id === currentId);
  return i >= 0 && i < vis.length - 1 ? vis[i + 1].id : null; // null = revisão
}

export function prevScreenId(a, currentId) {
  const vis = visibleScreens(a);
  const i = vis.findIndex((s) => s.id === currentId);
  return i > 0 ? vis[i - 1].id : null;
}

export function lastScreenId(a) {
  const vis = visibleScreens(a);
  return vis.length ? vis[vis.length - 1].id : null;
}

export function progress(a, currentId) {
  const vis = visibleScreens(a);
  const i = vis.findIndex((s) => s.id === currentId);
  return { pos: i >= 0 ? i + 1 : vis.length, total: vis.length };
}

// Telas obrigatórias visíveis ainda sem resposta.
export function missingRequired(a) {
  return visibleScreens(a).filter(
    (s) => s.type !== 'info' && !s.optional && !answered(a[s.id])
  );
}

export function blockScreens(a, blockId) {
  return visibleScreens(a).filter((s) => s.block === blockId);
}

export function blockStatus(a, blockId) {
  const vis = blockScreens(a, blockId);
  if (vis.length === 0) {
    // Sem telas visíveis: só é "pulado" se a resposta que controla o bloco já
    // foi dada; antes disso o bloco está pendente (ainda pode vir a aparecer).
    if (blockId > 0) {
      if (!answered(a.consentimento)) return 'pendente';
      if (a.consentimento === 'sim' && blockId === 2 && !answered(a.q01_porta)) return 'pendente';
    }
    return 'pulado';
  }
  const answerable = vis.filter((s) => s.type !== 'info');
  const done = answerable.filter((s) => answered(a[s.id]));
  const pendingReq = answerable.filter((s) => !s.optional && !answered(a[s.id]));
  if (done.length === 0) return 'pendente';
  return pendingReq.length === 0 ? 'completo' : 'em_andamento';
}

// Primeira tela pendente (para "continuar entrevista" e atalho de bloco).
export function firstPendingId(a, blockId = null) {
  const vis = blockId === null ? visibleScreens(a) : blockScreens(a, blockId);
  const f = vis.find((s) => s.type !== 'info' && !s.optional && !answered(a[s.id]));
  if (f) return f.id;
  return vis.length ? vis[0].id : null;
}

export function isScreenVisible(a, id) {
  const s = SCREENS_BY_ID.get(id);
  return !!s && (!s.visibleIf || s.visibleIf(a));
}
