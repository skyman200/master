// 공개 칸반보드(첫 화면). 레벨별 세 열, 맨 위에 레벨별 인원과 전체 앱 수(K1~K4).
import { h, clear, countTo } from './dom.js';
import { LEVELS, levelTitle } from './levels.js';
import { columns, totals, coverShot, featuredProf, appShot } from './model.js';
import { artUrl } from './badge-card.js';
import { morph } from './motion.js';

function num(k, n) {
  return h('b.num', { dataset: { k } }, String(n));
}

// 히어로 오른쪽 장면(꾸밈, 9초 반복): 판정이 실제로 하는 일 — 앱 화면에서 근거를 찾고 → 근거 글이 입력에 있는지 확인하고 → 항목을 채점하고 → 규칙으로 레벨을 계산한다.
// 예시 하나(저장 + 로그인, AI 없음 → Lv.2)를 보여 준다. 동작 줄이기면 움직임 없이 끝 장면만 보인다.
const WIRE = `<svg class="wire" viewBox="0 0 360 214" role="presentation" focusable="false">
<rect class="w1" x="0" y="0" width="360" height="26" rx="4"/><rect class="w2" x="14" y="9" width="64" height="8" rx="2"/><rect class="w2" x="288" y="9" width="58" height="8" rx="2"/>
<rect class="w2" x="14" y="42" width="116" height="12" rx="2"/>
<rect class="w3" x="14" y="68" width="156" height="22" rx="4"/><rect class="w3" x="14" y="98" width="156" height="22" rx="4"/><rect class="w4" x="14" y="130" width="156" height="26" rx="4"/>
<rect class="w1" x="192" y="68" width="154" height="16" rx="3"/>
<rect class="w3" x="192" y="90" width="154" height="14" rx="3"/><rect class="w3" x="192" y="110" width="154" height="14" rx="3"/><rect class="w3" x="192" y="130" width="154" height="14" rx="3"/><rect class="w3" x="192" y="150" width="154" height="14" rx="3"/>
<rect class="w2" x="14" y="186" width="332" height="8" rx="2"/>
<rect class="hb hb1" x="8" y="62" width="168" height="100" rx="6" pathLength="1"/>
<rect class="hb hb2" x="186" y="62" width="166" height="108" rx="6" pathLength="1"/>
</svg>`;

const EVIDENCE = [
  ['C', '로그인', 'POST identitytoolkit.googleapis.com/v1/accounts:signInWithPassword', '있음'],
  ['B', '서버 저장', 'POST firestore.googleapis.com/v1/projects/…/documents/scores', '있음'],
  ['A', 'AI 직접 연동', '부른 주소·코드에서 AI 호출을 찾지 못했습니다', '없음'],
];

function demo() {
  const wire = h('div.wire-wrap', null, h('span.tag.tag1', null, 'C'), h('span.tag.tag2', null, 'B'));
  wire.insertAdjacentHTML('afterbegin', WIRE);
  return h('div.hero-demo', { 'aria-hidden': 'true' },
    wire,
    h('ul.evid', null, EVIDENCE.map(([k, name, quote, val], i) => h('li', { class: `ev ev${i + 1}${val === '없음' ? ' none' : ''}` },
      h('b.ev-k', null, k),
      h('span.ev-name', null, name),
      h('span.ev-quote', null, quote),
      h('span.ev-state', null, h('i.wait', null, '확인 중'), h('i.val', null, val === '있음' ? `✓ ${val}` : val))))),
    h('div.verdict', null,
      h('p.v-rule', null, 'A 없음 · B 있음 · C 있음 → 규칙으로 계산'),
      h('p.v-level', null, h('b', null, 'Lv.2'), h('span', null, 'AI 설계전문가'))));
}

function head(t) {
  return h('div.board-head.hero', null,
    h('div.hero-copy', null,
      h('p.hero-title', null,
        h('span.hl', null, h('span', null, h('u', null, 'LLM'), '이 앱을 직접 열어 보고')),
        h('span.hl.l2', null, h('span', null, '레벨을 자동으로 판정합니다'))),
      h('p.board-lead', null, '화면과 네트워크 요청, 공개 코드를 읽고 AI 연동·서버 저장·로그인을 하나씩 채점합니다. 근거로 댄 글이 실제 입력에 있는지 확인한 항목만 레벨에 들어갑니다.'),
      h('h1.board-title', null, '교수 ', h('span.accent', null, num('profs', t.profs), '명'), ' · 앱 ', h('span.accent', null, num('apps', t.apps), '개')),
      h('dl.board-stats', null, LEVELS.map((lv, i) => h('div', null,
        h('dt', null, `Lv.${lv.n}`),
        h('dd', null, num(`lv${lv.n}`, t.byLevel[i]), '명')))),
      h('p.hero-note', null, '승인된 앱만 올라옵니다. 카드를 누르면 실제 화면이 넘어갑니다.')),
    demo());
}

// 카드 그림이 화면에서 차지하는 너비(app.css: 휴대폰 한 줄, 태블릿 두 줄, 컴퓨터 세 열). 선명한 화면은 큰 그림을 받는다.
const SIZES = '72px';

// 열마다 첫 카드 그림은 바로 받는다(첫 화면에 보이는 그림 — 늦게 받으면 첫 화면이 늦게 뜬다). 나머지는 보일 때 받는다.
/** 벤토 칸의 앱 화면 그림 */
function shotImg(ctx, shot, alt) {
  if (!shot) return null;
  const set = shot.thumb !== shot.src ? `${ctx.asset(shot.thumb)} ${shot.tw}w, ${ctx.asset(shot.src)} ${shot.w}w` : null;
  return h('img', { src: ctx.asset(shot.src), srcset: set, sizes: set && '(min-width: 900px) 360px, 90vw', width: shot.w, height: shot.h, alt, loading: 'lazy', decoding: 'async' });
}

/**
 * 가장 완성도 높은 교수 한 명을 벤토 그리드로 강조한다(칸반 위). 큰 칸은 교수·레벨·앱 수, 나머지 칸은 앱마다 화면 하나(최대 4개).
 * 열 안의 같은 교수 카드는 그대로 둔다(칸반 순서·쇼케이스 돌아가기 자리).
 */
function feature(p, ctx) {
  const apps = p.apps.slice(0, 4);
  const open = (e) => ctx.open(e, p);
  const tile = (a, i) => h('a.bt', { href: `${ctx.prefix}/p/${p.id}`, onclick: open, class: `bt-app bt${i + 1}`, dataset: { level: a.level } },
    h('span.bt-shot', null, shotImg(ctx, appShot(a, i === 0 && apps.length > 1), `${a.name} 화면`)),
    h('span.bt-cap', null, h('span.bt-name', null, a.name), h('span.bt-lv', null, `Lv.${a.level}`)));
  return h('section.bento', { dataset: { n: apps.length, id: p.id }, 'aria-label': '가장 완성도 높은 교수' },
    h('a.bt.bt-main', { href: `${ctx.prefix}/p/${p.id}`, onclick: open },
      h('img.bt-badge', { src: artUrl(p.level), alt: '', width: 96, height: 96, decoding: 'async' }),
      h('span.bt-cap2', null, '가장 완성도 높은 교수'),
      h('span.bt-prof', null, p.name),
      h('span.bt-dept', null, p.dept),
      h('span.bt-stats', null,
        h('span', null, h('b', null, `Lv.${p.level}`), levelTitle(p.level)),
        h('span', null, h('b', null, String(p.apps.length)), '개 앱'))),
    apps.map(tile));
}

function card(p, ctx, first) {
  const shot = coverShot(p);
  const set = shot && shot.thumb !== shot.src ? `${ctx.asset(shot.thumb)} ${shot.tw}w, ${ctx.asset(shot.src)} ${shot.w}w` : null;
  const img = shot
    ? h('img', { src: ctx.asset(shot.thumb), srcset: set, sizes: set && SIZES, width: shot.tw, height: shot.th, alt: `${p.name} 교수 앱 화면`, loading: first ? 'eager' : 'lazy', decoding: 'async' })
    : null;
  return h('li', { dataset: { id: p.id } },
    h('a.card', { href: `${ctx.prefix}/p/${p.id}`, dataset: { id: p.id }, onclick: (e) => ctx.open(e, p) },
      h('span.card-shot', null, img),
      h('span.card-text', null,
        h('span.card-name', null, p.name),
        h('span.card-dept', null, p.dept)),
      h('span.card-apps', null, h('b.num', null, String(p.apps.length)), h('span', null, '개 앱'))));
}

function column(lv, list, count, ctx) {
  return h('section.col', { 'aria-labelledby': `col-${lv.n}`, dataset: { level: lv.n } },
    h('header.col-head', null,
      h('h2', { id: `col-${lv.n}` }, h('span.col-lv', null, `Lv.${lv.n}`), ' ', h('span.col-name', null, levelTitle(lv.n))),
      h('p.col-count', null, num(`col${lv.n}`, count), '명')),
    list.length
      ? h('ol.cards', null, list.map((p, i) => card(p, ctx, i === 0)))
      : h('p.col-empty', null, '아직 없습니다. ', h('a', { href: `${ctx.prefix}/register` }, '앱 등록하기')));
}

function board(data, ctx) {
  const t = totals(data.profs);
  const cols = columns(data.profs);
  return h('section.board', { dataset: { view: 'kanban' } },
    head(t),
    cols.some((c) => c.length) ? feature(featuredProf(data.profs), ctx) : null,
    h('div.cols', null, LEVELS.map((lv, i) => column(lv, cols[i], t.byLevel[i], ctx))));
}

/** 처음 그리기 */
export function renderKanban(root, data, ctx) {
  clear(root).append(board(data, ctx));
}

const NUMS = '.board-head [data-k], .col-count [data-k]';

function nameCards(scope, on) {
  scope.querySelectorAll('.cards > li').forEach((li) => { li.style.viewTransitionName = on ? `card-${li.dataset.id}` : ''; });
}

/**
 * 열어 둔 화면에서 데이터가 바뀌었을 때: 카드가 새 자리로 움직이고, 빠진 카드는 사라지고,
 * 숫자는 그 자리에서 세어 바뀐다(R12, 모핑).
 */
export function updateKanban(root, data, ctx) {
  const old = root.querySelector('.board');
  if (!old) {
    renderKanban(root, data, ctx);
    return Promise.resolve();
  }
  const before = new Map([...old.querySelectorAll(NUMS)].map((el) => [el.dataset.k, Number(el.textContent)]));
  const next = board(data, ctx);
  const counts = [];
  next.querySelectorAll(NUMS).forEach((el) => {
    if (!before.has(el.dataset.k)) return;
    counts.push([el, Number(el.textContent)]);
    el.textContent = String(before.get(el.dataset.k));
  });
  nameCards(old, true);
  return morph(() => {
    nameCards(old, false);
    old.replaceWith(next);
    nameCards(next, true);
  }).then(() => {
    nameCards(next, false);
    for (const [el, to] of counts) countTo(el, to, ctx.reduced());
  });
}

/** 카드 요소(모핑 출발점) */
export function cardEl(root, id) {
  return root.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
}
