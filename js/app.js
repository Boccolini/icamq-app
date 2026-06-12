// Interface: uma pergunta por tela, navegação por pergunta e por bloco,
// revisão final, exportação. Renderização por estado + eventos delegados.

import { SCREENS_BY_ID, ITEMS, BLOCKS, SHORT_LABELS, FORM_VERSION } from './questionnaire.js';
import * as eng from './engine.js';
import * as store from './storage.js';

const $app = document.getElementById('app');

const state = {
  view: 'home',          // home | setup | interview | review
  iv: null,              // entrevista corrente
  currentId: null,
  fromReview: false,
  reviewFrom: null,      // tela a partir da qual se entrou na revisão
  menuOpen: false,
};

let autoAdvanceTimer = null; // avanço automático pendente de pergunta de escolha

const STATUS_LABEL = {
  em_andamento: 'Em andamento', completa: 'Completa', recusa: 'Recusa',
  pendente: 'Pendente', completo: 'Completo', pulado: 'Pulado',
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------- toast
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'assertive');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------- confirm
function confirmDialog({ title, body, okLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2>
        <p>${esc(body)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-md="cancel">Cancelar</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-md="ok">${esc(okLabel)}</button>
        </div>
      </div>`;
    const close = (ok) => {
      ov.remove();
      if (opener && opener.focus) opener.focus();
      resolve(ok);
    };
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-md]');
      if (!b && e.target !== ov) return;
      close(b ? b.dataset.md === 'ok' : false);
    });
    ov.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      if (e.key === 'Tab') {
        // foco circula apenas entre os dois botões do modal
        const btns = [...ov.querySelectorAll('[data-md]')];
        const i = btns.indexOf(document.activeElement);
        e.preventDefault();
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
      }
    });
    document.body.appendChild(ov);
    ov.querySelector('[data-md="cancel"]').focus();
  });
}

// ---------------------------------------------------------------- render
function render() {
  if (state.view === 'setup') return renderSetup();
  if (state.view === 'interview') return renderInterview();
  if (state.view === 'review') return renderReview();
  return renderHome();
}

// -------- home
function renderHome() {
  const interviewer = store.getInterviewer();
  if (!interviewer) { state.view = 'setup'; return renderSetup(); }
  const list = store.listInterviews().slice().reverse();

  $app.innerHTML = `
    <div class="page home">
      <header class="home-head">
        <h1>I-CAM-Q</h1>
        <p class="sub">Coleta de campo · práticas integrativas e complementares</p>
      </header>
      <div class="card who">
        <div>
          <span class="who-code">${esc(interviewer.code)}</span>
          <span class="who-name">${esc(interviewer.nome || 'Entrevistador(a)')}</span>
        </div>
        <button class="btn btn-ghost btn-sm" data-action="trocar-entrevistador">Trocar</button>
      </div>
      <button class="btn btn-primary btn-xl" data-action="nova-entrevista">+ Nova entrevista</button>
      <section class="iv-list">
        <h2>Entrevistas neste aparelho <span class="count">${list.length}</span></h2>
        ${list.length === 0 ? '<p class="empty">Nenhuma entrevista ainda.</p>' : list.map((iv) => `
          <div class="card iv-row">
            <button class="iv-open" data-action="abrir-entrevista" data-uuid="${iv.uuid}"
                    aria-label="Abrir entrevista ${esc(iv.pid)}">
              <span class="iv-info">
                <span class="iv-pid">${esc(iv.pid)}</span>
                <span class="iv-name">${esc(iv.answers.nome_participante || 'Sem nome')}</span>
                <span class="iv-date">${fmtDate(iv.startedAt)}</span>
              </span>
            </button>
            <div class="iv-side">
              <span class="chip chip-${iv.status}">${STATUS_LABEL[iv.status]}</span>
              <button class="btn-icon" data-action="excluir-entrevista" data-uuid="${iv.uuid}"
                      aria-label="Excluir entrevista ${esc(iv.pid)}">✕</button>
            </div>
          </div>`).join('')}
      </section>
      <section class="export-row">
        <button class="btn btn-ghost" data-action="export-csv" ${list.length ? '' : 'disabled'}>Exportar CSV</button>
        <button class="btn btn-ghost" data-action="export-json" ${list.length ? '' : 'disabled'}>Exportar JSON</button>
      </section>
      <footer class="home-foot">Formulário v${FORM_VERSION} · dados armazenados somente neste aparelho</footer>
    </div>`;
}

// -------- setup do entrevistador
function renderSetup() {
  const current = store.getInterviewer();
  const codes = Array.from({ length: 8 }, (_, i) => 'E0' + (i + 1));
  $app.innerHTML = `
    <div class="page setup">
      <header class="home-head">
        <h1>I-CAM-Q</h1>
        <p class="sub">Identifique o entrevistador deste aparelho</p>
      </header>
      <div class="card">
        <label class="field-label">Código do entrevistador</label>
        <div class="code-grid">
          ${codes.map((c) => `<button class="code-btn ${current && current.code === c ? 'sel' : ''}" data-code="${c}">${c}</button>`).join('')}
        </div>
        <label class="field-label" for="setup-code">Ou digite um código</label>
        <input id="setup-code" type="text" maxlength="6" autocapitalize="characters"
               placeholder="Ex.: E09" value="${current ? esc(current.code) : ''}">
        <label class="field-label" for="setup-nome">Nome (opcional)</label>
        <input id="setup-nome" type="text" placeholder="Nome do entrevistador" value="${current ? esc(current.nome || '') : ''}">
        <button class="btn btn-primary btn-xl" data-action="salvar-entrevistador">Salvar e continuar</button>
      </div>
    </div>`;
  $app.querySelectorAll('.code-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.getElementById('setup-code').value = b.dataset.code;
      $app.querySelectorAll('.code-btn').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
    });
  });
}

// -------- entrevista (uma pergunta por tela)
function renderInterview() {
  const iv = state.iv;
  const a = iv.answers;
  const screen = SCREENS_BY_ID.get(state.currentId);
  if (!screen || !eng.isScreenVisible(a, screen.id)) {
    state.currentId = eng.firstPendingId(a) || 'admin_info';
    return renderInterview();
  }
  const { pos, total } = eng.progress(a, screen.id);
  const block = BLOCKS[screen.block];
  const pct = Math.round((pos / total) * 100);

  $app.innerHTML = `
    <div class="page interview">
      <header class="topbar">
        <button class="btn-icon" data-action="sair" aria-label="Salvar e sair">✕</button>
        <div class="topbar-mid">
          <span class="topbar-block">${esc(block.curto)}</span>
          <span class="topbar-pos">${pos} / ${total}</span>
        </div>
        <button class="btn-icon" data-action="menu" aria-label="Índice de blocos">☰</button>
      </header>
      <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
      <main class="q-area">
        <span class="q-chip">${esc(screen.chip)}</span>
        <h1 class="q-title">${esc(screen.title)}</h1>
        ${screen.subtitle ? `<p class="q-sub">${esc(screen.subtitle)}</p>` : ''}
        ${renderControl(screen, a)}
      </main>
      <nav class="bottombar">
        <button class="btn btn-ghost" data-action="voltar" ${eng.prevScreenId(a, screen.id) ? '' : 'disabled'}>← Voltar</button>
        ${state.fromReview ? '<button class="btn btn-ghost" data-action="ir-revisao">Revisão</button>' : ''}
        <button class="btn btn-primary" data-action="avancar">${eng.nextScreenId(a, screen.id) ? 'Avançar →' : 'Revisão →'}</button>
      </nav>
      ${state.menuOpen ? renderMenu(a) : ''}
    </div>`;

  const input = $app.querySelector('.q-input');
  if (input) {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') advance(); });
    // teclado virtual pode cobrir o campo: centraliza após o teclado abrir
    input.addEventListener('focus', () => {
      setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
    });
    if (screen.type === 'text' && !('ontouchstart' in window)) input.focus();
  } else {
    // anuncia só a nova pergunta para leitores de tela, sem live region global
    const title = $app.querySelector('.q-title');
    if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
  }
}

function renderControl(screen, a) {
  const v = a[screen.id];
  if (screen.type === 'info') {
    if (screen.id === 'admin_info') {
      const iv = state.iv;
      return `
        <div class="card admin-card">
          <div class="admin-row"><span>ID do participante</span><strong>${esc(iv.pid)}</strong></div>
          <div class="admin-row"><span>Entrevistador</span><strong>${esc(iv.interviewer)}${iv.interviewerName ? ' · ' + esc(iv.interviewerName) : ''}</strong></div>
          <div class="admin-row"><span>Data</span><strong>${fmtDate(iv.startedAt)}</strong></div>
        </div>`;
    }
    // tela de leitura de bloco: enunciado do questionário, em texto grande
    return `<div class="intro-text">${(screen.paras || [])
      .map((p) => `<p>${esc(p)}</p>`).join('')}</div>`;
  }
  if (screen.type === 'choice') {
    return `<div class="opts">${screen.options.map((o) => `
      <button class="opt ${v === o.value ? 'sel' : ''}" data-action="opt" data-value="${o.value}">
        <span class="opt-mark"></span><span class="opt-label">${esc(o.label)}</span>
      </button>`).join('')}</div>`;
  }
  if (screen.type === 'number') {
    return `
      <div class="num-wrap">
        <button class="num-step" data-action="num-menos" aria-label="Diminuir">−</button>
        <input class="q-input num-input" type="text" inputmode="numeric" pattern="[0-9]*"
               value="${v !== undefined && v !== null ? esc(v) : ''}" placeholder="0">
        <button class="num-step" data-action="num-mais" aria-label="Aumentar">+</button>
      </div>`;
  }
  // text
  return `
    <input class="q-input text-input" type="text"
           value="${v !== undefined && v !== null ? esc(v) : ''}"
           placeholder="${esc(screen.placeholder || 'Digite a resposta')}">
    ${screen.optional ? '<p class="q-hint">Campo opcional — pode ficar em branco.</p>' : ''}`;
}

// -------- menu de blocos (índice)
function renderMenu(a) {
  return `
    <div class="menu-overlay">
      <div class="menu-sheet">
        <div class="menu-head">
          <h2>Índice do questionário</h2>
          <button class="btn-icon" data-action="fechar-menu" aria-label="Fechar">✕</button>
        </div>
        ${BLOCKS.map((b) => {
          const st = eng.blockStatus(a, b.id);
          const vazio = eng.blockScreens(a, b.id).length === 0;
          const items = ITEMS.filter((it) => it.block === b.id);
          const nota = st === 'pulado'
            ? (b.id === 2 ? 'Pulado: Q01 (médico) = não.' : 'Não se aplica.')
            : (vazio ? (b.id === 2 ? 'Aguardando a resposta de Q01 (médico).' : 'Aguardando o consentimento.') : '');
          return `
            <div class="menu-block">
              <button class="menu-block-head" data-action="ir-bloco" data-block="${b.id}" ${vazio ? 'disabled' : ''}>
                <span class="menu-block-name">${esc(b.nome)}${b.faixa ? ` <small>${b.faixa}</small>` : ''}</span>
                <span class="chip chip-${st}">${STATUS_LABEL[st]}</span>
              </button>
              ${nota ? `<p class="menu-skip-note">${nota}</p>` : `
              <div class="menu-items">
                ${items.map((it) => {
                  const gateAns = a[it.gate];
                  const visible = eng.isScreenVisible(a, it.gate);
                  if (!visible) return '';
                  const cls = gateAns === 'sim' ? 'i-sim' : gateAns === 'nao' ? 'i-nao' : 'i-pend';
                  return `<button class="menu-item ${cls}" data-action="ir-item" data-screen="${it.gate}">
                    ${esc(it.qnum || '•')}</button>`;
                }).join('')}
              </div>`}
            </div>`;
        }).join('')}
        <button class="btn btn-ghost btn-block" data-action="ir-revisao">Ir para a revisão final</button>
      </div>
    </div>`;
}

// -------- revisão
function renderReview() {
  const iv = state.iv;
  const a = iv.answers;
  const missing = eng.missingRequired(a);
  const refused = a.consentimento === 'nao';

  const sections = BLOCKS.map((b) => {
    const st = eng.blockStatus(a, b.id);
    const items = ITEMS.filter((it) => it.block === b.id && eng.isScreenVisible(a, it.gate));
    if (b.id !== 0 && eng.blockScreens(a, b.id).length === 0) {
      const nota = st === 'pulado'
        ? (b.id === 2 ? 'Q01 (médico) = não — bloco não se aplica.' : 'Não se aplica.')
        : (b.id === 2 ? 'Aguardando a resposta de Q01 (médico).' : 'Aguardando o consentimento.');
      return `<section class="rev-block">
        <h2>${esc(b.nome)} <span class="chip chip-${st}">${STATUS_LABEL[st]}</span></h2>
        <p class="rev-skip">${nota}</p>
      </section>`;
    }
    return `<section class="rev-block">
      <h2>${esc(b.nome)} <span class="chip chip-${st}">${STATUS_LABEL[st]}</span></h2>
      ${items.map((it) => `
        <button class="rev-item" data-action="rev-editar" data-screen="${it.gate}">
          <span class="rev-q">${esc(it.qnum || '·')}</span>
          <span class="rev-label">${esc(it.label)}</span>
          <span class="rev-ans">${esc(itemSummary(it, a))}</span>
        </button>`).join('')}
    </section>`;
  }).join('');

  $app.innerHTML = `
    <div class="page review">
      <header class="topbar">
        ${iv.status === 'em_andamento'
          ? '<button class="btn-icon" data-action="rev-voltar" aria-label="Voltar ao questionário">←</button>'
          : '<span class="btn-icon" aria-hidden="true"></span>'}
        <div class="topbar-mid"><span class="topbar-block">Revisão final</span>
          <span class="topbar-pos">${esc(iv.pid)}</span></div>
        <button class="btn-icon" data-action="sair" aria-label="Salvar e sair">✕</button>
      </header>
      <main class="rev-area">
        ${refused ? `<div class="card warn-card">Participante <strong>não consentiu</strong>. A entrevista será registrada como recusa.</div>` : ''}
        ${!refused && missing.length ? `
          <div class="card warn-card">
            <strong>${missing.length} pergunta(s) obrigatória(s) sem resposta.</strong>
            <div class="warn-links">${missing.slice(0, 12).map((s) =>
              `<button class="menu-item i-pend" data-action="rev-editar" data-screen="${s.id}">${esc(s.chip)}</button>`).join('')}
              ${missing.length > 12 ? `<span class="q-hint">+ ${missing.length - 12} outras…</span>` : ''}
            </div>
          </div>` : ''}
        ${sections}
        <button class="btn btn-primary btn-xl" data-action="concluir" ${!refused && missing.length ? 'disabled' : ''}>
          ${refused ? 'Registrar recusa' : 'Concluir entrevista'}
        </button>
      </main>
    </div>`;
}

function itemSummary(it, a) {
  if (it.id === 'ident') {
    return [a.nome_participante, a.local, a.consentimento ? 'Consent.: ' + SHORT_LABELS[a.consentimento] : '']
      .filter(Boolean).join(' · ') || '—';
  }
  const gate = a[it.gate];
  if (!eng.answered(gate)) return '—';
  if (gate === 'nao') return 'Não';
  const parts = ['Sim'];
  const p = it.id;
  if (eng.answered(a[`${p}_qual`])) parts.push(a[`${p}_qual`]);
  if (eng.answered(a[`${p}_nome`])) parts.push(a[`${p}_nome`]);
  if (eng.answered(a[`${p}_n3m`])) parts.push(`${a[`${p}_n3m`]}× (3 m)`);
  if (eng.answered(a[`${p}_em_uso`])) parts.push(a[`${p}_em_uso`] === 'sim' ? 'em uso' : 'não usa mais');
  if (eng.answered(a[`${p}_modo`])) {
    parts.push(SHORT_LABELS[a[`${p}_modo`]] + (eng.answered(a[`${p}_modo_qual`]) ? ` (${a[`${p}_modo_qual`]})` : ''));
  }
  const util = a[`${p}_util`] ?? a[`${p}_ajudou`];
  if (eng.answered(util)) parts.push(SHORT_LABELS[util]);
  if (eng.answered(a[`${p}_motivo`])) {
    parts.push(a[`${p}_motivo`] === 'outro' && eng.answered(a[`${p}_motivo_outro`])
      ? a[`${p}_motivo_outro`] : SHORT_LABELS[a[`${p}_motivo`]]);
  }
  return parts.join(' · ');
}

// ---------------------------------------------------------------- ações
function saveIv() {
  // só grava a posição quando de fato navegando o questionário, para não
  // vazar o currentId de uma entrevista para outra aberta depois
  if (state.view === 'interview' && state.currentId) {
    state.iv.currentId = state.currentId;
  }
  store.saveInterview(state.iv);
}

function goTo(screenId, fromReview = false) {
  state.currentId = screenId;
  state.fromReview = fromReview;
  state.menuOpen = false;
  state.view = 'interview';
  saveIv();
  render();
  window.scrollTo(0, 0);
}

// Lê o input da tela atual (text/number) e grava.
// strict=true (avançar) exige valor válido; strict=false (voltar/menu/sair)
// grava o que for válido, registra esvaziamento deliberado e AVISA quando
// um valor inválido for descartado — nunca descarta em silêncio.
function commitInput(strict) {
  const screen = SCREENS_BY_ID.get(state.currentId);
  if (!screen || (screen.type !== 'text' && screen.type !== 'number')) return true;
  const el = $app.querySelector('.q-input');
  if (!el) return true;
  const raw = el.value.trim();
  const prev = state.iv.answers[screen.id];
  const hadPrev = eng.answered(prev);

  if (screen.type === 'number') {
    if (raw === '') {
      if (strict) { toast('Informe um número (use 0 se nenhuma vez).'); return false; }
      if (hadPrev) { setAnswer(screen.id, '', false); toast('Número apagado — a pergunta voltou a ficar pendente.'); }
      return true;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 999) {
      if (strict) { toast('Use um número inteiro entre 0 e 999.'); return false; }
      toast(`Valor "${raw}" inválido — não foi salvo.`);
      return true;
    }
    setAnswer(screen.id, String(n), false);
    return true;
  }

  if (raw === '') {
    if (!screen.optional && strict) { toast('Este campo é obrigatório.'); return false; }
    if (hadPrev) {
      setAnswer(screen.id, '', false);
      if (!screen.optional) toast('Texto apagado — a pergunta voltou a ficar pendente.');
    }
    return true;
  }
  setAnswer(screen.id, raw, false);
  return true;
}

// Grava resposta; se apagar dependentes, pede confirmação.
async function setAnswer(id, value, rerender = true) {
  const a = state.iv.answers;
  if (a[id] === value) { if (rerender) render(); return true; }
  const cleared = eng.wouldClear(a, id, value);
  if (cleared.length > 0) {
    const ok = await confirmDialog({
      title: 'Alterar resposta?',
      body: `Esta mudança apaga ${cleared.length} resposta(s) dependente(s) já registrada(s). Deseja continuar?`,
      okLabel: 'Alterar e apagar', danger: true,
    });
    if (!ok) { if (rerender) render(); return false; }
  }
  const res = eng.applyAnswer(a, id, value);
  state.iv.answers = res.answers;
  saveIv();
  if (rerender) render();
  return true;
}

// Entrevista encerrada só pode ser editada após reabertura explícita.
// Retorna true se a edição pode prosseguir.
async function ensureReaberta() {
  if (state.iv.status === 'em_andamento') return true;
  const ok = await confirmDialog({
    title: 'Reabrir entrevista?',
    body: `${state.iv.pid} está encerrada como "${STATUS_LABEL[state.iv.status]}". Para editar, ela volta a ficar em andamento e precisará ser concluída de novo.`,
    okLabel: 'Reabrir e editar',
  });
  if (!ok) return false;
  state.iv.status = 'em_andamento';
  state.iv.endedAt = null;
  state.iv.endedAtLocal = null;
  store.saveInterview(state.iv);
  return true;
}

function advance() {
  if (!commitInput(true)) return;
  const screen = SCREENS_BY_ID.get(state.currentId);
  const a = state.iv.answers;
  if (screen.type === 'choice' && !eng.answered(a[screen.id])) {
    toast('Selecione uma opção para continuar.');
    return;
  }
  const next = eng.nextScreenId(a, state.currentId);
  if (next) goTo(next, state.fromReview);
  else {
    state.reviewFrom = state.currentId;
    state.view = 'review'; state.menuOpen = false; saveIv(); render(); window.scrollTo(0, 0);
  }
}

function goBack() {
  commitInput(false);
  const prev = eng.prevScreenId(state.iv.answers, state.currentId);
  if (prev) goTo(prev, state.fromReview);
}

async function handleAction(el) {
  const act = el.dataset.action;
  const a = state.iv ? state.iv.answers : null;

  // qualquer ação do usuário cancela um avanço automático pendente
  clearTimeout(autoAdvanceTimer);

  switch (act) {
    case 'trocar-entrevistador': state.view = 'setup'; render(); break;

    case 'salvar-entrevistador': {
      const code = document.getElementById('setup-code').value.trim().toUpperCase();
      const nome = document.getElementById('setup-nome').value.trim();
      if (!/^[A-Z][A-Z0-9]{1,5}$/.test(code)) { toast('Informe um código válido (ex.: E01).'); return; }
      store.setInterviewer({ code, nome });
      state.view = 'home'; render(); break;
    }

    case 'nova-entrevista': {
      const iv = store.newInterview(store.getInterviewer());
      store.saveInterview(iv);
      state.iv = iv;
      state.reviewFrom = null;
      goTo('admin_info'); break;
    }

    case 'abrir-entrevista': {
      const iv = store.listInterviews().find((x) => x.uuid === el.dataset.uuid);
      if (!iv) return;
      state.iv = iv;
      state.reviewFrom = null;
      if (iv.status === 'em_andamento') goTo(iv.currentId || eng.firstPendingId(iv.answers) || 'admin_info');
      else { state.view = 'review'; render(); }
      break;
    }

    case 'excluir-entrevista': {
      const uuid = el.dataset.uuid;
      const iv = store.listInterviews().find((x) => x.uuid === uuid);
      const ok = await confirmDialog({
        title: 'Excluir entrevista?',
        body: `${iv ? iv.pid : ''} será apagada definitivamente deste aparelho.`,
        okLabel: 'Excluir', danger: true,
      });
      if (ok) { store.deleteInterview(uuid); render(); }
      break;
    }

    case 'export-csv': case 'export-json': {
      // o arquivo contém TODAS as entrevistas do aparelho, então o nome
      // identifica o aparelho (não só o entrevistador atual)
      const day = new Date().toISOString().slice(0, 10);
      const base = `icamq_aparelho-${store.getDeviceId()}_${day}`;
      const csv = act === 'export-csv';
      const via = await store.exportFile(
        csv ? `${base}.csv` : `${base}.json`,
        csv ? store.toCSV(store.listInterviews()) : store.toJSON(store.listInterviews()),
        csv ? 'text/csv' : 'application/json'
      );
      if (via === 'share') toast('Arquivo enviado pela folha de compartilhamento.');
      else if (via === 'download') toast('Arquivo baixado.');
      else if (via === 'clipboard') toast('Não foi possível gerar arquivo — conteúdo copiado para a área de transferência.');
      else if (via === 'erro') toast('Falha na exportação — tente novamente ou use outro navegador.');
      break;
    }

    case 'opt': {
      const screen = SCREENS_BY_ID.get(state.currentId);
      // avanço automático só na PRIMEIRA marcação; ao trocar uma resposta já
      // dada, o entrevistador confirma com "Avançar" (evita perder correção
      // de toque errado)
      const primeira = !eng.answered(state.iv.answers[screen.id]);
      const ok = await setAnswer(screen.id, el.dataset.value);
      if (ok && primeira && eng.answered(state.iv.answers[screen.id])) {
        autoAdvanceTimer = setTimeout(() => {
          if (state.view === 'interview' && state.currentId === screen.id && !state.menuOpen) {
            advance();
          }
        }, 300);
      }
      break;
    }

    case 'num-mais': case 'num-menos': {
      const input = $app.querySelector('.num-input');
      const cur = parseInt(input.value || '0', 10) || 0;
      const next = Math.min(999, Math.max(0, cur + (act === 'num-mais' ? 1 : -1)));
      input.value = String(next);
      break;
    }

    case 'avancar': advance(); break;
    case 'voltar': goBack(); break;

    case 'sair':
      commitInput(false); saveIv();
      state.view = 'home'; state.iv = null; state.menuOpen = false;
      state.fromReview = false; state.reviewFrom = null;
      render(); break;

    case 'menu': commitInput(false); state.menuOpen = true; render(); break;
    case 'fechar-menu': state.menuOpen = false; render(); break;

    case 'ir-bloco': {
      const bid = Number(el.dataset.block);
      // bloco ainda intocado abre pela tela de leitura; senão, vai à pendência
      const vis = eng.blockScreens(a, bid);
      const target = eng.blockStatus(a, bid) === 'pendente' && vis.length
        ? vis[0].id
        : eng.firstPendingId(a, bid);
      if (target) goTo(target, state.fromReview);
      break;
    }
    case 'ir-item': goTo(el.dataset.screen, state.fromReview); break;
    case 'ir-revisao':
      commitInput(false);
      state.reviewFrom = state.view === 'interview' ? state.currentId : state.reviewFrom;
      saveIv();
      state.view = 'review'; state.menuOpen = false; state.fromReview = false;
      render(); window.scrollTo(0, 0); break;

    case 'rev-editar': {
      if (!(await ensureReaberta())) return;
      goTo(el.dataset.screen, true);
      break;
    }
    case 'rev-voltar': {
      // o botão só é renderizado para entrevista em andamento, mas o guard
      // fica como defesa em profundidade
      if (!(await ensureReaberta())) return;
      // volta para a tela de onde se entrou na revisão (se ainda visível)
      const target = (state.reviewFrom && eng.isScreenVisible(a, state.reviewFrom))
        ? state.reviewFrom
        : eng.lastScreenId(a);
      if (target) goTo(target);
      break;
    }

    case 'concluir': {
      const refused = a.consentimento === 'nao';
      const ok = await confirmDialog({
        title: refused ? 'Registrar recusa?' : 'Concluir entrevista?',
        body: refused
          ? 'A entrevista será encerrada como recusa de participação.'
          : 'Após concluir, a entrevista fica salva neste aparelho e disponível para exportação.',
        okLabel: refused ? 'Registrar recusa' : 'Concluir',
      });
      if (!ok) return;
      const now = new Date();
      state.iv.status = refused ? 'recusa' : 'completa';
      state.iv.endedAt = now.toISOString();
      state.iv.endedAtLocal = store.toLocalISO(now);
      saveIv();
      toast(refused ? 'Recusa registrada.' : `Entrevista ${state.iv.pid} concluída.`);
      state.view = 'home'; state.iv = null;
      render(); break;
    }
  }
}

// Delegação de eventos: um único listener para toda a interface.
$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) {
    e.stopPropagation();
    handleAction(el);
    return;
  }
  const bg = e.target.classList && e.target.classList.contains('menu-overlay');
  if (bg) { state.menuOpen = false; render(); }
});

// ---------------------------------------------------------------- boot
render();

// iOS standalone não redimensiona o layout quando o teclado abre: usa o
// visualViewport para manter a barra de navegação acima do teclado.
if (window.visualViewport) {
  const vv = window.visualViewport;
  const ajustar = () => {
    const bb = document.querySelector('.bottombar');
    if (!bb) return;
    const teclado = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    bb.style.transform = teclado > 0 ? `translateY(-${teclado}px)` : '';
  };
  vv.addEventListener('resize', ajustar);
  vv.addEventListener('scroll', ajustar);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline-first é opcional em dev */ });
  });
}
