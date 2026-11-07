// 관리자 화면(#/admin): 열쇠를 넣으면 제출 목록이 보이고 승인·반려·비공개·다시 판정·삭제를 바로 한다.
// 시트·디스코드와 같은 결정 길(수신함 admin API)을 쓴다. 열쇠는 이 탭이 열려 있는 동안만 기억한다(sessionStorage).
import { h, clear } from './dom.js';
import { call, backendReady } from './api.js';

const KEY = 'dit-admin-key';
const GROUPS = [
  ['todo', '처리할 것', ['판정 완료', '판정 실패', '중복 확인', '판정 대기(AI 서버 쉬는 중)']],
  ['live', '공개 중', ['승인', '공개됨']],
  ['done', '끝난 것', ['반려', '비공개', '바뀜']],
  ['going', '진행 중', ['접수', '확인됨', '판정 중']],
  ['all', '전체', null],
];
const LEVELS = [[1, 'Lv.1 AI 활용전문가'], [2, 'Lv.2 AI 설계전문가'], [3, 'Lv.3 AI 혁신리더']];
const WARN = { 삭제: '삭제하면 캡처·이름·이메일·앱 정보가 지워지고 되돌릴 수 없습니다(교수에게 메일은 가지 않습니다). 삭제할까요?' };

const keyOf = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const setKey = (v) => { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch { /* 저장 못 해도 이 화면에서는 동작 */ } };
const kst = (iso) => (iso ? new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : '');
const levelNo = (label) => { const m = /^\s*Lv\.?\s*([123])/i.exec(label || ''); return m ? Number(m[1]) : 0; };

function admin(op, payload = {}) {
  return call('admin', { token: keyOf(), op, ...payload });
}

function loginForm(root, ctx, message) {
  const input = h('input', { type: 'password', name: 'key', autocomplete: 'current-password', placeholder: '관리자 열쇠', 'aria-label': '관리자 열쇠', required: true });
  const err = h('p.adm-msg', { role: 'alert' }, message || '');
  const form = h('form.adm-login', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    setKey(v);
    err.textContent = '확인하는 중…';
    try {
      const res = await admin('list');
      showList(root, ctx, res);
    } catch (x) {
      setKey('');
      err.textContent = x && x.code === 'DENIED' ? '열쇠가 맞지 않습니다.' : (x && x.message) || '수신함에 닿지 않습니다.';
    }
  } }, input, h('button.btn', { type: 'submit' }, '들어가기'), err);
  clear(root).append(h('section.page.admin', { dataset: { view: 'admin-login' } },
    h('h1.page-title', null, '관리자'),
    h('p.page-lead', null, '관리자 열쇠를 넣으면 제출을 승인·반려·삭제할 수 있습니다. 열쇠는 이 탭을 닫으면 잊습니다.'),
    form));
  input.focus();
}

function shotsBox(r) {
  const box = h('div.adm-shots');
  const btn = h('button.btn-text', { type: 'button', onclick: async () => {
    btn.disabled = true;
    btn.textContent = '불러오는 중…';
    try {
      const got = await Promise.all(r.shots.map((s) => admin('file', { file: s.file }).then((f) => ({ s, f }))));
      btn.remove();
      for (const { s, f } of got) {
        box.append(h('figure', null, h('img', { src: `data:${f.type};base64,${f.data}`, alt: `${r.appName} 캡처 ${s.n}`, loading: 'lazy' }),
          h('figcaption', null, `${s.n}번 ${s.kind}${s.flag ? ` · ${s.flag}` : ''}${s.use ? '' : ' · 공개 안 함'}`)));
      }
    } catch (x) {
      btn.disabled = false;
      btn.textContent = `캡처 ${r.shots.length}장 보기 (다시 시도)`;
    }
  } }, `캡처 ${r.shots.length}장 보기`);
  return r.shots.length ? h('div', null, btn, box) : null;
}

function item(r, reload) {
  const msg = h('p.adm-msg', { role: 'status' });
  let busy = false;
  const buttons = [];
  const level = h('select', { 'aria-label': '승인할 레벨' }, LEVELS.map(([n, t]) => h('option', { value: String(n), selected: n === levelNo(r.level) }, t)));
  const reason = h('input', { type: 'text', placeholder: '반려 사유(교수에게 메일로 갑니다)', maxlength: 300, 'aria-label': '반려 사유' });
  async function run(decision, extra = {}) {
    if (busy) return;
    if (WARN[decision] && !window.confirm(`${r.id} ${r.name}\n${WARN[decision]}`)) return;
    busy = true;
    buttons.forEach((b) => { b.disabled = true; });
    msg.textContent = '처리하는 중…';
    try {
      const res = await admin('decide', { id: r.id, decision, ...extra });
      if (res.result === 'ok') {
        await reload();
        return;
      }
      msg.textContent = res.message || '처리하지 못했습니다.';
    } catch (x) {
      msg.textContent = (x && x.message) || '수신함에 닿지 않습니다.';
      if (x && x.code === 'DENIED') { setKey(''); await reload(); return; }
    }
    busy = false;
    buttons.forEach((b) => { b.disabled = false; });
  }
  const act = (name, cls, fn) => { const b = h(`button.${cls}`, { type: 'button', onclick: fn }, name); buttons.push(b); return b; };
  const row = [];
  for (const a of r.actions) {
    if (a === '승인') row.push(level, act('승인', 'btn', () => run('승인', { level: Number(level.value) })));
    else if (a === '반려') row.push(reason, act('반려', 'btn-line', () => { const v = reason.value.trim(); if (v.length < 2) msg.textContent = '반려 사유를 적어 주세요.'; else run('반려', { reason: v }); }));
    else row.push(act(a, a === '삭제' ? 'btn-line.adm-del' : 'btn-line', () => run(a)));
  }
  return h('li.adm-item', { dataset: { id: r.id, state: r.state } },
    h('div.adm-head',
      null,
      h('b.adm-id', null, r.id),
      h('span.adm-state', null, r.state),
      r.level ? h('span.adm-level', null, r.level) : null,
      h('span.adm-at', null, kst(r.at))),
    h('p.adm-who', null, `${r.name} · ${r.dept}`),
    h('p.adm-app', null, h('b', null, r.appName), ' ', h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.url), r.github ? [' · ', h('a', { href: r.github, target: '_blank', rel: 'noopener noreferrer' }, 'GitHub')] : null),
    r.desc ? h('p.adm-desc', null, r.desc) : null,
    r.reason ? h('p.adm-desc', null, `반려 사유: ${r.reason}`) : null,
    r.note ? h('p.adm-desc', null, `메모: ${r.note}`) : null,
    r.evidence ? h('details', null, h('summary', null, '판정 근거'), h('pre', null, r.evidence)) : null,
    shotsBox(r),
    r.decidedAt ? h('p.adm-by', null, `${kst(r.decidedAt)} ${r.by === 'discord' ? '디스코드' : r.by === 'web' ? '웹 관리자' : '시트'}`) : null,
    r.actions.length ? h('div.adm-actions', null, row) : null,
    msg);
}

function showList(root, ctx, data, group = 'todo') {
  const reload = async () => {
    try {
      showList(root, ctx, await admin('list'), current());
    } catch (x) {
      if (x && x.code === 'DENIED') { setKey(''); loginForm(root, ctx, '열쇠가 맞지 않습니다.'); return; }
      alert_(x);
    }
  };
  const alert_ = (x) => { status.textContent = (x && x.message) || '불러오지 못했습니다.'; };
  const count = (g) => (g[2] ? data.rows.filter((r) => g[2].includes(r.state)).length : data.rows.length);
  const pick = h('select', { 'aria-label': '보기', onchange: () => showList(root, ctx, data, pick.value) },
    GROUPS.map((g) => h('option', { value: g[0], selected: g[0] === group }, `${g[1]} ${count(g)}`)));
  const current = () => pick.value;
  const status = h('p.adm-msg', { role: 'status' });
  const g = GROUPS.find((x) => x[0] === group) || GROUPS[0];
  const rows = data.rows.filter((r) => !g[2] || g[2].includes(r.state));
  clear(root).append(h('section.page.admin', { dataset: { view: 'admin' } },
    h('h1.page-title', null, '관리자'),
    h('div.adm-bar', null, pick,
      h('button.btn-line', { type: 'button', onclick: reload }, '새로 고침'),
      h('button.btn-text', { type: 'button', onclick: () => { setKey(''); loginForm(root, ctx); } }, '나가기')),
    status,
    rows.length ? h('ul.adm-list', null, rows.map((r) => item(r, reload))) : h('p.page-lead', null, '해당하는 제출이 없습니다.')));
}

export async function renderAdmin(root, ctx) {
  if (!backendReady()) {
    clear(root).append(h('section.page.admin', { dataset: { view: 'admin-off' } }, h('h1.page-title', null, '관리자'), h('p.page-lead', null, '수신함 주소가 없어 이 화면에서는 쓸 수 없습니다.')));
    return;
  }
  if (!keyOf()) { loginForm(root, ctx); return; }
  clear(root).append(h('section.page.admin', null, h('h1.page-title', null, '관리자'), h('p.page-lead', null, '불러오는 중…')));
  try {
    showList(root, ctx, await admin('list'));
  } catch (x) {
    if (x && x.code === 'DENIED') { setKey(''); loginForm(root, ctx, '열쇠가 맞지 않습니다.'); return; }
    clear(root).append(h('section.page.admin', null, h('h1.page-title', null, '관리자'), h('p.page-lead', null, (x && x.message) || '불러오지 못했습니다.'),
      h('p', null, h('button.btn', { type: 'button', onclick: () => renderAdmin(root, ctx) }, '다시 불러오기'))));
  }
}
