// FAQ 답변 본문 파서 — data/raw/faq/답변.txt → data/faq-bodies.json
//
// 형식: 제목 한 줄, 그 아래가 본문. 다음 제목이 나올 때까지.
// 제목 판별은 **추측하지 않는다** — 이미 수집한 제목 전량(data/faq-titles.json)과
// 완전 일치하는 줄만 제목으로 본다. 본문 안에 물음표 문장이 있어도 잘리지 않는다.
//
//   node tools/faq-body.mjs        → 적재 결과
//   node tools/faq-body.mjs 세이프  → 그 단어가 든 제목의 본문 출력
import fs from 'fs';

const 제목집합 = new Set(Object.values(JSON.parse(
  fs.readFileSync('data/faq-titles.json', 'utf8'))).flat().map(s => s.trim()));

const lines = fs.readFileSync('data/raw/faq/답변.txt', 'utf8')
  .replace(/^﻿/, '').split(/\r?\n/).map(s => s.replace(/\s+$/, ''));

const 시작 = [];
lines.forEach((l, i) => { if (제목집합.has(l.trim())) 시작.push(i); });

const 항목 = 시작.map((i, k) => ({
  제목: lines[i].trim(),
  본문: lines.slice(i + 1, 시작[k + 1] ?? lines.length).join('\n').replace(/\n{3,}/g, '\n\n').trim(),
}));

// 제목으로 못 잡힌 줄이 앞에 있으면 알린다 (오타·미수집 제목)
const 앞쓰레기 = 시작.length ? lines.slice(0, 시작[0]).filter(s => s.trim()) : lines.filter(s => s.trim());
const 빈본문 = 항목.filter(x => !x.본문);

const q = process.argv[2];
if (q) {
  for (const x of 항목.filter(x => x.제목.includes(q)))
    console.log(`\n════ ${x.제목}\n${x.본문}`);
  process.exit(0);
}

console.log(`\n적재 ${항목.length}건 / 평균 본문 ${Math.round(항목.reduce((a,x)=>a+x.본문.length,0)/항목.length)}자`);
if (앞쓰레기.length) console.log(`⚠️ 제목으로 못 잡은 앞줄 ${앞쓰레기.length}개: ${앞쓰레기[0].slice(0,40)}…`);
if (빈본문.length) console.log(`⚠️ 본문이 빈 항목 ${빈본문.length}개`);
for (const x of 항목) console.log(`  ${String(x.본문.length).padStart(5)}자  ${x.제목.slice(0, 50)}`);

fs.writeFileSync('data/faq-bodies.json', JSON.stringify(항목, null, 1));
console.log('\n→ data/faq-bodies.json (로컬 전용 — 카카오뱅크 콘텐츠라 커밋하지 않는다)');
