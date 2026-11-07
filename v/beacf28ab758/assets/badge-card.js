// 배지 카드: 레벨별 휘장 그림(AI ONE 이미지 API 로 그린 web/assets/badge-art/lv<N>.webp, tools/gen-badge-art.mjs)과 글자(f-badge).
// 확인 페이지와 배지 이미지(PNG)가 이 한 함수로 같은 내용을 그린다.
// 이미지는 판정 프로그램(L3)과 예시 만들기(tools/make-sample.mjs)가 크롬으로 이 카드를 찍어 만든다.
import { esc } from './dom.js';
import { levelTitle, ISSUER } from './levels.js';
import { kstDateLong } from './model.js';

export const SITE_URL = 'https://skyman200.github.io/master/';

/** 확인 주소. base: 사이트 주소(끝에 /), sample: 예시 화면이면 true */
export function badgeUrl(id, base = SITE_URL, sample = false) {
  return `${base}#/${sample ? 'sample/' : ''}badge/${id}`;
}

/** 휘장 그림 주소(이 파일 옆 badge-art/). 크롬이 file: 주소를 못 여는 곳(배지 이미지)에서는 art 로 data: 주소를 따로 준다 */
export function artUrl(level) {
  return new URL(`./badge-art/lv${level}.webp`, import.meta.url).href;
}

/** p: model.normalizePublic 이 돌려준 교수. verify: 확인 주소. art: 휘장 그림 주소(없으면 artUrl) */
export function badgeHtml(p, verify, art = artUrl(p.level)) {
  const shown = verify.replace(/^https?:\/\//, '');
  return `<div class="badge-card" data-id="${esc(p.id)}" data-level="${esc(p.level)}">`
    + `<img class="bc-art" src="${esc(art)}" alt="" width="640" height="640">`
    + `<p class="bc-lv"><span>Lv.</span><b>${esc(p.level)}</b></p>`
    + `<p class="bc-title">${esc(levelTitle(p.level))}</p>`
    + `<p class="bc-name">${esc(p.name)}</p>`
    + `<p class="bc-dept">${esc(p.dept)}</p>`
    + '<dl class="bc-meta">'
    + `<div><dt>발급 기관</dt><dd>${esc(ISSUER)}</dd></div>`
    + `<div><dt>발급일</dt><dd>${esc(kstDateLong(p.badge.date))}</dd></div>`
    + `<div><dt>앱</dt><dd>${esc(p.apps.length)}개 인증</dd></div>`
    + '</dl>'
    + '<p class="bc-foot">DIT AI 3-LEVEL 인증 · 앱 제작 실적</p>'
    + `<p class="bc-url">${esc(shown)}</p>`
    + '</div>';
}
