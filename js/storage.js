// Persistência local (localStorage), geração de ID e exportação.
// Cada aparelho guarda suas próprias entrevistas; a consolidação entre
// entrevistadores é feita juntando os arquivos exportados.

import { SCREENS, FORM_VERSION } from './questionnaire.js';

const K = {
  interviewer: 'icamq.interviewer',
  interviews: 'icamq.interviews',
  device: 'icamq.device',
  seq: (code) => `icamq.seq.${code}`,
};

// Identificador curto e persistente do aparelho — entra no PID para que o mesmo
// código de entrevistador usado em dois aparelhos nunca gere IDs repetidos.
// Alfabeto sem caracteres confundíveis (0/O, 1/I/L).
export function getDeviceId() {
  let id = localStorage.getItem(K.device);
  if (!id) {
    const alfa = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    id = alfa[buf[0] % alfa.length] + alfa[buf[1] % alfa.length];
    localStorage.setItem(K.device, id);
  }
  return id;
}

// ISO com offset local (ex.: 2026-06-11T19:30:00-03:00) — preserva o horário
// de campo na análise, independentemente do fuso da máquina que consolidar.
export function toLocalISO(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sig = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sig}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

export function getInterviewer() {
  try { return JSON.parse(localStorage.getItem(K.interviewer)); } catch { return null; }
}

export function setInterviewer(obj) {
  localStorage.setItem(K.interviewer, JSON.stringify(obj));
}

export function listInterviews() {
  try { return JSON.parse(localStorage.getItem(K.interviews)) || []; } catch { return []; }
}

export function saveInterview(iv) {
  iv.updatedAt = new Date().toISOString();
  const all = listInterviews();
  const i = all.findIndex((x) => x.uuid === iv.uuid);
  if (i >= 0) all[i] = iv; else all.push(iv);
  localStorage.setItem(K.interviews, JSON.stringify(all));
}

export function deleteInterview(uuid) {
  const all = listInterviews().filter((x) => x.uuid !== uuid);
  localStorage.setItem(K.interviews, JSON.stringify(all));
}

function uuid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    'u' + Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
}

// ID legível: ICAMQ-<entrevistador>-<aparelho>-<sequencial>.
// O sufixo do aparelho garante unicidade mesmo se o mesmo código de
// entrevistador for usado em dois celulares por engano.
export function newInterview(interviewer) {
  const seqKey = K.seq(interviewer.code);
  const n = (parseInt(localStorage.getItem(seqKey) || '0', 10)) + 1;
  localStorage.setItem(seqKey, String(n));
  const now = new Date();
  return {
    uuid: uuid(),
    pid: `ICAMQ-${interviewer.code}-${getDeviceId()}-${String(n).padStart(3, '0')}`,
    interviewer: interviewer.code,
    interviewerName: interviewer.nome || '',
    device: getDeviceId(),
    startedAt: now.toISOString(),
    startedAtLocal: toLocalISO(now),
    endedAt: null,
    endedAtLocal: null,
    status: 'em_andamento',
    formVersion: FORM_VERSION,
    answers: {},
    currentId: 'admin_info',
  };
}

// ---------------------------------------------------------------- export
const META_COLS = [
  'pid', 'uuid', 'entrevistador', 'nome_entrevistador', 'aparelho', 'status',
  'inicio', 'fim', 'inicio_local', 'fim_local', 'duracao_min',
  'atualizado_em', 'versao_form',
];

export function questionColumns() {
  return SCREENS.filter((s) => s.type !== 'info').map((s) => s.id);
}

export function toCSV(interviews) {
  const qcols = questionColumns();
  const header = [...META_COLS, ...qcols];
  const esc = (v) => {
    v = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  const rows = interviews.map((iv) => {
    const ms = iv.endedAt ? new Date(iv.endedAt) - new Date(iv.startedAt) : NaN;
    const dur = Number.isFinite(ms) ? Math.round(ms / 60000) : '';
    const meta = [iv.pid, iv.uuid, iv.interviewer, iv.interviewerName,
      iv.device || '', iv.status, iv.startedAt, iv.endedAt || '',
      iv.startedAtLocal || '', iv.endedAtLocal || '', dur,
      iv.updatedAt || '', iv.formVersion];
    return [...meta, ...qcols.map((c) => iv.answers[c] ?? '')].map(esc).join(';');
  });
  // BOM para o Excel abrir UTF-8 corretamente; separador ';' (padrão pt-BR).
  return '\ufeff' + header.join(';') + '\n' + rows.join('\n');
}

export function toJSON(interviews) {
  return JSON.stringify({ formVersion: FORM_VERSION, exportedAt: new Date().toISOString(), interviews }, null, 2);
}

export function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
}

// Saída de dados com três rotas, na ordem de confiabilidade em celular:
// 1) Web Share com arquivo (iOS/Android — abre a folha de compartilhar:
//    Arquivos, AirDrop, WhatsApp, e-mail), 2) download clássico,
// 3) área de transferência como último recurso.
// Retorna o nome da rota usada, para a UI informar o usuário.
export async function exportFile(filename, text, mime = 'text/plain') {
  try {
    const file = new File([text], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return 'share';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelado'; // usuário fechou a folha
    // qualquer outra falha: tenta a próxima rota
  }
  try {
    download(filename, text, mime);
    return 'download';
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return 'clipboard';
    } catch {
      return 'erro';
    }
  }
}
