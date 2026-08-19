// 문서에 적힌 주장을 데이터와 대조한다.
//
// 왜 있나: 이 프로젝트에서 실제로 다친 것은 거의 전부 숫자와 위치였다.
// AI 기능 6개(실제 7개) · S06 재탕 6건(실제 5건) · S12 3턴 2번(실제 3번).
// 전부 "확인했다"고 생각하고 확인하지 않은 것들이다.
// 산문 규칙으로는 막히지 않는다 — 틀리면 빨간 줄이 떠야 막힌다.
//
//   node tools/check.mjs
import fs from 'fs';
import path from 'path';
import { readCsv } from './lib/csv.mjs';

const 읽기 = p => fs.readFileSync(p, 'utf8');
const R1 = readCsv(읽기('data/observations-round1.csv')).filter(r => r.판정);
const R2rows = readCsv(읽기('data/observations-round2.csv'));
const SEEDS = readCsv(읽기('data/seeds.csv'));
// 룰 함수만 센다. 집계용 export(전체)는 룰이 아니다
const 룰수 = (읽기('tools/lib/rules.mjs').match(/^export function /gm) || []).length;
const 판정수 = v => R1.filter(r => r.판정 === v).length;
const raw1 = fs.existsSync('data/raw/round1') ? fs.readdirSync('data/raw/round1').filter(f => f.endsWith('.txt')) : null;

const 문서 = ['README.md', 'data/README.md', ...fs.readdirSync('docs').filter(f => f.endsWith('.md')).map(f => `docs/${f}`)]
  .filter(p => fs.existsSync(p));

// [이름, 정규식(캡처 1개), 참값]
// 정규식은 좁게 쓴다. 넓게 잡아 오탐을 내면 아무도 안 보게 된다.
const 주장 = [
  ['1라운드 총 턴수', /1라운드 관측 기록 (\d+)턴|관측 기록 97턴|총 (\d+)턴\)/g, R1.length],
  // 「시드 22개」는 1라운드를 가리키는 맥락에서 맞는 값이므로 문서 전체 대조 대상이 아니다.
  // 파일 표에 적힌 seeds.csv 행수만 본다
  ['seeds.csv 행수', /\| 시드 질문 (\d+)개 \|/g, SEEDS.length],
  ['룰 종류 수', /룰 (\d+)종/g, 룰수],
  ['판정 정답', /정답 (\d+) ?· ?부분/g, 판정수('정답')],
  ['도달한 턴', /도달한 턴 \*\*(\d+)%\*\*|앱기능_진입 = O` ?인 턴은 (\d+)개/g, R1.filter(r => r.앱기능_진입 === 'O').length],
  ['2라운드 행수', /(\d+)행 \/ 19컬럼|기록지 (\d+)행/g, R2rows.length],
  ['2라운드 컬럼수', /(\d+)컬럼이다|총 (\d+)컬럼/g, Object.keys(R2rows[0]).length],
  ['1라운드 원문 파일 수', /\((\d+)파일/g, raw1 ? raw1.length : null],
];

let 실패 = 0, 검사 = 0;
console.log('\n■ 숫자 주장 대조');
for (const [이름, re, 참값] of 주장) {
  if (참값 === null) { console.log(`  –  ${이름} — 원본이 로컬에 없어 건너뜀`); continue; }
  const 발견 = [];
  for (const p of 문서) {
    for (const m of 읽기(p).matchAll(new RegExp(re.source, 'g'))) {
      const v = +[...m].slice(1).find(x => x !== undefined);
      발견.push({ p, v, 원문: m[0].trim() });
    }
  }
  if (!발견.length) { console.log(`  –  ${이름} — 문서에서 못 찾음 (참값 ${참값})`); continue; }
  검사++;
  const 틀림 = 발견.filter(f => f.v !== 참값);
  if (틀림.length) {
    실패++;
    console.log(`  🔴 ${이름} — 계산값 ${참값}`);
    for (const f of 틀림) console.log(`        ${f.p}  "${f.원문}"`);
  } else {
    console.log(`  ✅ ${이름} — ${참값} · 문서 ${발견.length}곳 일치`);
  }
}

console.log('\n■ 문서가 가리키는 경로가 실재하나');
const 경로들 = new Set();
for (const p of 문서)
  for (const m of 읽기(p).matchAll(/`((?:data|tools|src|docs)\/[A-Za-z0-9가-힣._\/-]+)`/g)) 경로들.add(m[1]);
// 확장자가 없는 것은 산문의 약칭(docs/03 참조)이지 경로가 아니다
const 없는경로 = [...경로들].filter(c => /\.[a-z]+$/.test(c) && !fs.existsSync(c) && !c.includes('<'));
if (없는경로.length) { 실패++; 없는경로.forEach(c => console.log(`  🔴 ${c}`)); }
else console.log(`  ✅ ${경로들.size}개 경로 전부 실재`);

console.log('\n■ 과장 표현 — 판정이 아니라 검토 목록이다');
// 실제로 이 프로젝트에서 사고를 낸 표현만 남긴다.
// 「최초」「유일」처럼 정당한 서술에도 흔한 단어를 넣으면 목록이 길어져 아무도 안 본다.
const 과장어 = /전부 재현|100%|반드시 잡|완벽하게|사람이 손으로|사람 대 기계|무조건/;
let 과장 = 0;
for (const p of 문서)
  읽기(p).split('\n').forEach((l, i) => {
    if (과장어.test(l) && !l.startsWith('>')) { console.log(`  ·  ${p}:${i + 1}  ${l.trim().slice(0, 78)}`); 과장++; }
  });
if (!과장) console.log('  ✅ 걸린 표현 없음');

console.log('\n■ 하네스 문서 자체 검사 — 규칙마다 검증 수단이 있나');
const H = 'docs/06-작업-하네스.md';
if (!fs.existsSync(H)) console.log(`  –  ${H} 없음`);
else {
  // 「작업별」 절의 규칙 줄만 본다 — 번호 붙은 표 행과 불릿.
  // 표 머리글·구분선·설명 산문은 규칙이 아니다.
  const 줄들 = 읽기(H).split('\n');
  const 시작 = 줄들.findIndex(l => l.startsWith('## 작업별'));
  const 끝 = 줄들.findIndex((l, i) => i > 시작 && l.startsWith('## '));
  const 규칙줄 = 줄들.slice(시작, 끝 < 0 ? 줄들.length : 끝)
    .map((l, i) => ({ l, n: 시작 + i + 1 }))
    .filter(({ l }) => /^\| \d+ \|/.test(l) || /^- /.test(l));
  // 명령·파일을 가리키거나(백틱), 검증 수단이 없음을 ⚠️로 밝혀야 한다
  const 나쁜줄 = 규칙줄.filter(({ l }) => !/`[^`]+`/.test(l) && !l.includes('⚠️'));
  if (나쁜줄.length) {
    실패++;
    console.log('  🔴 검증 수단도 없고 없다는 표시(⚠️)도 없는 규칙 — 지키는지 확인할 방법이 없다');
    나쁜줄.forEach(({ l, n }) => console.log(`        ${n}: ${l.trim().slice(0, 70)}`));
  } else console.log(`  ✅ 규칙 ${규칙줄.length}줄 — 명령을 가리키거나 검증 없음(⚠️)으로 표시됨`);
}

console.log(`\n${실패 ? `🔴 ${실패}개 항목 실패` : `✅ 통과 (숫자 주장 ${검사}종 대조)`}\n`);
process.exit(실패 ? 1 : 0);
