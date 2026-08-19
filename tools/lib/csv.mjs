// RFC4180 CSV 파서.
// 관측 CSV의 메모·추천 칸에 쉼표와 따옴표가 들어 있어 단순 split를 쓸 수 없다.
// (CLAUDE.md 작업규칙 4 — 글자를 바꾸지 않고 인용으로 처리한다)
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const s = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }   // "" → 리터럴 따옴표
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** 첫 행을 헤더로 보고 객체 배열로 만든다 */
export function readCsv(text) {
  const [head, ...body] = parseCsv(text);
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/** 객체 배열을 CSV로 되돌린다. 쉼표·따옴표는 인용으로 처리하고 글자는 바꾸지 않는다 */
export function writeCsv(rows, 컬럼 = Object.keys(rows[0])) {
  const q = v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [컬럼.join(','), ...rows.map(r => 컬럼.map(c => q(r[c])).join(','))].join('\n') + '\n';
}

// node tools/lib/csv.mjs 로 자체 검증
// (Windows 경로는 file:///C:/… 라 문자열로 이으면 슬래시 수가 안 맞는다)
import { pathToFileURL } from 'url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t = 'a,b,c\n1,"쉼표, 있음","따옴표 ""안"" 있음"\n2,"줄\n바꿈",3\n';
  const r = readCsv(t);
  const eq = (x, y) => { if (x !== y) throw new Error(`${JSON.stringify(x)} !== ${JSON.stringify(y)}`); };
  eq(r.length, 2);
  eq(r[0].b, '쉼표, 있음');
  eq(r[0].c, '따옴표 "안" 있음');
  eq(r[1].b, '줄\n바꿈');
  eq(r[1].c, '3');
  // 왕복해도 값이 그대로여야 한다 — 관측 기록을 다시 쓸 때 글자가 바뀌면 안 된다
  eq(JSON.stringify(readCsv(writeCsv(r))), JSON.stringify(r));
  console.log('csv.mjs 자체검증 통과 (파싱 · 왕복)');
}
