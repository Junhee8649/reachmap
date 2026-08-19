// 관측 원문(data/raw/**)을 턴 단위로 쪼갠다.
//
// [추천 블록 머리말은 5종이다] 1라운드에서 확인 (2026-08-18)
//   👉 원하시면 이어서 도와드릴게요 / 👉 이어서 원하시면 도와드릴게요
//   👉 이어서 이런 것도 물어볼 수 있어요
//   🔍 더 자세히 알려드릴게요      / 🔍 더 구체적으로도 찾아드릴게요
// 하나만 세면 턴을 놓친다 — 실제로 S04·S13·S19에서 그랬다.
//
// [이모지만으로는 안 된다] 본문 소제목(##🔥 금리 높은 편인 상품들)이 섞인다 — S16에서 확인.
// 이모지 + "드릴게요|물어볼 수 있어요로 끝남" 두 조건을 모두 요구한다.
const MARKER  = /^[^\S\n]*[#*]*\s*[👉🔍][^\n]*(?:드릴게요|물어볼 수 있어요)[^\n]*$/gm;
const NUMLINE = /^\s*(\d+)[.)]\s*(.+?)\s*$/;
const URLLINE = /^\s*(https?:\/\/\S+)\s*$/;

// 마지막 추천 블록 뒤 꼬리는 대부분 딥링크 카드·면책이고 새 턴이 아니다.
// 다만 이관된 턴(S17 3턴)은 추천 없이 본문만 있으므로 진짜 턴이다.
// 관측값: 꼬리 0~132자 vs S17 3턴 460자 → 150자로 가른다.
const TAIL_MIN = 150;

export const NL = String.fromCharCode(10);

// 세그먼트 앞머리의 딥링크 카드(제목줄 + URL줄 반복)와 그 뒤 본문을 가른다.
// 딥링크 카드는 추천 블록 **뒤**에 붙으므로, 다음 세그먼트 앞머리에 나타난다.
function splitLeadingCards(text) {
  const lines = text.split(NL);
  let i = 0; const lead = [];
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    if (URLLINE.test(lines[i])) { lead.push({ title: '', url: lines[i].trim() }); i++; continue; }
    const title = lines[i];
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j < lines.length && URLLINE.test(lines[j])) {
      lead.push({ title: title.trim(), url: lines[j].trim() });
      i = j + 1;
    } else break;
  }
  return { lead, rest: lines.slice(i).join(NL) };
}

function extractLinks(text) {
  const lines = text.split(NL); const links = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(URLLINE);
    if (!m) continue;
    let title = '';
    for (let j = i - 1; j >= 0 && j >= i - 2; j--) if (lines[j].trim()) { title = lines[j].trim(); break; }
    links.push({ title, url: m[1] });
  }
  return links;
}

function stripAttachments(text) {
  const lines = text.split(NL); const drop = new Set();
  lines.forEach((l, i) => {
    if (!URLLINE.test(l)) return;
    drop.add(i);
    for (let j = i - 1; j >= 0 && j >= i - 2; j--) if (lines[j].trim()) { drop.add(j); break; }
  });
  return lines.filter((_, i) => !drop.has(i)).join(NL)
    .replace(/투자 자문이나 권유[^\n]*/g, '').trim();
}

export function splitTurns(text) {
  const marks = [...text.matchAll(MARKER)];
  const turns = [];
  let cursor = 0;

  for (const mk of marks) {
    const end = mk.index + mk[0].length;
    const recs = []; let consumed = 0;
    for (const raw of text.slice(end).split(NL)) {
      const step = raw.length + 1;
      if (!raw.trim()) { if (recs.length) break; consumed += step; continue; }
      const m = raw.match(NUMLINE);
      if (!m) break;
      recs.push(m[2]); consumed += step;
    }
    const { lead, rest } = splitLeadingCards(text.slice(cursor, mk.index));
    if (lead.length && turns.length) turns[turns.length - 1].links.push(...lead);
    turns.push({ body: rest.trim(), header: mk[0].trim(), recs, links: [] });
    cursor = end + consumed;
  }

  const tail = text.slice(cursor);
  if (tail.trim()) {
    const { lead, rest } = splitLeadingCards(tail);
    if (lead.length && turns.length) turns[turns.length - 1].links.push(...lead);
    if (stripAttachments(tail).length >= TAIL_MIN || !turns.length) {
      turns.push({ body: rest.trim(), header: null, recs: [], links: extractLinks(rest) });
    }
  }
  return turns;
}

export function normRec(s) {
  return s.replace(/^\s*\d+\s*[.)]\s*/, '').replace(/[\s.,?!~·"'`()[\]>“”‘’*]/g, '');
}
export const maskNum = s => normRec(s).replace(/[0-9０-９]+/g, '#');
export function lev(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
