// 공개 FAQ 제목 적재 — 커버리지 히트맵의 축(docs/04)을 실물로 만든다
//
// 왜 있나:
//   지금까지 FAQ는 「대출 809 · 통장/저축 506」 같은 **개수**로만 갖고 있었다.
//   개수는 밀도를 말해주지만 **무엇을 묻는지**는 말해주지 않는다.
//   추천 문구를 만들려면 문항 수가 아니라 문항 자체가 필요하다.
//
// 어디서 왔나 (D-07):
//   www.kakaobank.com/robots.txt 는 `User-agent: *` → `Disallow: /` 다 (8줄·144바이트, 전문 확인).
//   그래서 크롤링하지 않았다. 관측자가 브라우저에서 직접 복사한 것을 그대로 받았다.
//   원문은 커밋하지 않는다(.gitignore). 이 스크립트가 내는 집계만 공개한다.
//
//   node tools/faq.mjs            → 적재·분포
//   node tools/faq.mjs --태그     → 대괄호 태그 전량
//   node tools/faq.mjs --미확인   → 우리가 실재를 못 굳힌 상품명 조회
import fs from 'fs';
import path from 'path';

const DIR = 'data/raw/faq';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.txt')).sort();

// 원문을 고치지 않는다(작업규칙 4). 줄 끝 CR과 앞뒤 공백만 떼고, 빈 줄은 세어서 보고한다.
const cats = files.map(f => {
  const raw = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/).map(s => s.trim());
  const 빈줄 = lines.filter(s => !s).length;
  const 제목 = lines.filter(Boolean);
  const 고유 = [...new Set(제목)];
  return { 이름: path.basename(f, '.txt'), 파일: f, 빈줄, 제목, 고유 };
});

const 총제목 = cats.reduce((a, c) => a + c.제목.length, 0);
const 총고유 = cats.reduce((a, c) => a + c.고유.length, 0);

console.log(`\n■ 적재 — ${cats.length}개 카테고리 / 제목 ${총제목}개 (고유 ${총고유})`);
console.log('─'.repeat(66));
console.log('카테고리      제목    고유   중복  빈줄   평균길이  대괄호태그');
for (const c of cats) {
  const 평균 = Math.round(c.제목.reduce((a, s) => a + s.length, 0) / c.제목.length);
  const 태그있음 = c.제목.filter(s => /^\[/.test(s)).length;
  console.log(
    `${c.이름.padEnd(10)} ${String(c.제목.length).padStart(5)} ${String(c.고유.length).padStart(6)}`
    + ` ${String(c.제목.length - c.고유.length).padStart(5)} ${String(c.빈줄).padStart(5)}`
    + `   ${String(평균).padStart(4)}자   ${String(태그있음).padStart(4)} (${(100*태그있음/c.제목.length).toFixed(0)}%)`);
}

// ── 대괄호 태그 = 카카오뱅크가 스스로 붙인 상품/주제 라벨 ────────────────
// 우리가 만든 분류가 아니라 **문서 쓴 쪽이 붙인 것**이라 근거로서 격이 다르다.
const 태그 = {};
for (const c of cats)
  for (const s of c.제목) {
    const m = s.match(/^\[([^\]]+)\]/);
    if (!m) continue;
    const t = m[1].trim();
    (태그[t] ??= { n: 0, cats: new Set() });
    태그[t].n++; 태그[t].cats.add(c.이름);
  }
const 태그행 = Object.entries(태그).map(([k, v]) => ({ 태그: k, n: v.n, cats: [...v.cats] }))
  .sort((a, b) => b.n - a.n);

if (process.argv.includes('--태그')) {
  console.log(`\n대괄호 태그 ${태그행.length}종\n`);
  for (const t of 태그행) console.log(`  ${String(t.n).padStart(4)}  ${t.태그}  [${t.cats}]`);
  process.exit(0);
}

console.log(`\n■ 카카오뱅크가 직접 붙인 태그 ${태그행.length}종 — 상위 20`);
for (const t of 태그행.slice(0, 20))
  console.log(`  ${String(t.n).padStart(4)}  ${t.태그}`);

// ── 우리가 실재를 못 굳혀 둔 상품명 (CLAUDE.md 「확인해야 할 것」) ──────────
// AI 답변에만 등장하고 우리 [A]등급 목록에는 없던 이름들이다.
// FAQ 제목은 카카오뱅크가 쓴 공개 문서이므로 여기 나오면 실재가 확정된다.
const 미확인 = ['마이너스 통장대출', '마이너스통장', '비상금대출', '새희망홀씨', '같이대출',
  '전국민 생계비', '기록통장', '최애적금', '우리아이적금', '청년미래적금', '한달적금',
  '중신용비상금대출', '세이프박스', '저금통', 'MMF박스'];
const 모든제목 = cats.flatMap(c => c.제목.map(s => ({ s, cat: c.이름 })));

console.log(`\n■ 미확인 상품명 조회 — FAQ 제목에 나오는가`);
const 조회 = 미확인.map(name => {
  const hit = 모든제목.filter(x => x.s.includes(name));
  return { 상품: name, 건수: hit.length, 카테고리: [...new Set(hit.map(x => x.cat))], 예시: hit[0]?.s ?? null };
});
for (const r of 조회)
  console.log(`  ${r.건수 ? '✔' : '·'} ${r.상품.padEnd(14)} ${String(r.건수).padStart(4)}건`
    + (r.건수 ? `  [${r.카테고리}]` : '  ← FAQ 제목에 없음'));

if (process.argv.includes('--미확인')) {
  for (const r of 조회.filter(r => r.건수)) {
    console.log(`\n── ${r.상품} (${r.건수}건)`);
    모든제목.filter(x => x.s.includes(r.상품)).slice(0, 8).forEach(x => console.log(`   ${x.s}`));
  }
  process.exit(0);
}

fs.writeFileSync('data/faq.json', JSON.stringify({
  출처: '카카오뱅크 공개 FAQ 제목. 관측자가 브라우저에서 수동 복사 (D-07 · robots.txt 준수)',
  수집일: '2026-08-19',
  주의: ['제목만 있다. 답변 본문은 받지 않았다.',
        '중복은 지우지 않고 세어서 보고한다 — FAQ가 같은 제목을 여러 곳에 걸어둔 것도 사실이다.'],
  총제목, 총고유,
  카테고리: cats.map(c => ({ 이름: c.이름, 제목수: c.제목.length, 고유수: c.고유.length })),
  태그: 태그행,
  미확인상품조회: 조회,
}, null, 1));

// 제목 본문은 별도 파일로 로컬에만 둔다. 커버리지 스크립트가 읽는다.
fs.writeFileSync('data/faq-titles.json', JSON.stringify(
  Object.fromEntries(cats.map(c => [c.이름, c.제목])), null, 0));
console.log('\n→ data/faq.json (집계·공개) · data/faq-titles.json (제목 전량·로컬)');
