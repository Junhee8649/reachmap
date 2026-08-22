// 공개 직전 톤 정제 — 표현만 바꾼다. 판정·수치·원문 인용은 건드리지 않는다.
//
// 왜 도구인가:
//   손으로 고치면 ① CSV 인용이 깨지고 ② 무엇을 바꿨는지 기록이 남지 않는다.
//   치환표를 코드에 박아두면 **무엇을 어떤 이유로 바꿨는지가 그대로 증거**가 된다.
//
// 무엇을 바꾸나:
//   작업 중에는 눈에 띄라고 🔴🔴🔴 같은 표시와 「최강 발견」 같은 말을 썼다.
//   그건 나에게 하는 메모였고, 공개 문서에서는 저격으로 읽힌다.
//   심각도 표시 자체는 유용하므로 **없애지 않고 한 겹으로 낮춘다.**
//
// 무엇을 안 바꾸나:
//   판정(정답/부분/오답/거절) · 모든 수치 · 카카오뱅크 답변 인용 · 딥링크 URL.
//   치환표에 그런 항목이 없다는 것이 곧 보증이다.
//
//   node tools/tone.mjs           미리보기 (파일을 바꾸지 않는다)
//   node tools/tone.mjs --적용     실제로 바꾼다
import fs from 'fs';
import { execSync } from 'child_process';
import { parseCsv, readCsv, writeCsv } from './lib/csv.mjs';

const 적용 = process.argv.includes('--적용');

// 순서가 중요하다. 긴 것부터 바꿔야 🔴🔴🔴 이 🔴🔴 + 🔴 로 쪼개지지 않는다.
const 치환 = [
  ['🔴🔴🔴', '🔴'],
  ['🔴🔴', '🔴'],
  ['🟢🟢🟢', '🟢'],
  ['🟢🟢', '🟢'],
  ['최강 사례', '가장 뚜렷한 사례'],
  ['최강 발견', '가장 뚜렷한 관측'],
  ['최대 발견', '가장 뚜렷한 관측'],
  ['가장 강한 한 쌍', '가장 뚜렷한 한 쌍'],
  ['가장 강한 누락 사례', '가장 뚜렷한 누락 사례'],
  ['가장 강한 발견', '가장 뚜렷한 관측'],
];

const 적용하기 = s => 치환.reduce((t, [a, b]) => t.split(a).join(b), s);

// 공개되는 파일만 손댄다 = git 이 추적하는 것
//
// 🔴 core.quotePath=false 가 없으면 한글 파일명이 "docs/01-\354\202\254…" 처럼
//    이스케이프돼 확장자 검사에서 통째로 걸러진다. 처음에 md 파일이 전부 건너뛰어졌다.
// 🔴 docs/05 는 **이 도구가 무엇을 바꾸는지 설명하는 문서**다. 치환표를 본문에 인용하고 있어서
//    돌리면 자기 설명을 자기가 망가뜨린다. 실제로 미리보기에서 4건이 잡혔다 (2026-08-22).
const 자기설명 = ['docs/05-공개목록.md'];
const 대상 = execSync('git -c core.quotePath=false ls-files', { encoding: 'utf8' })
  .split('\n').filter(f => /\.(md|csv)$/.test(f) && !자기설명.includes(f));

let 총건수 = 0;
const 보고 = [];

for (const f of 대상) {
  const 원본 = fs.readFileSync(f, 'utf8');
  let 결과;

  if (f.endsWith('.csv')) {
    // CSV는 파서를 왕복시킨다. 텍스트 치환만 하면 인용 안의 쉼표에서 깨진다.
    const rows = readCsv(원본);
    const 컬럼 = parseCsv(원본)[0];
    for (const r of rows)
      for (const c of 컬럼)
        if (c !== '판정') r[c] = 적용하기(r[c]);   // 판정 칸은 아예 만지지 않는다
    결과 = writeCsv(rows, 컬럼);
    // 왕복 검증 — 행수·컬럼수가 그대로여야 한다
    const 뒤 = parseCsv(결과);
    if (뒤.length !== parseCsv(원본).length || 뒤[0].length !== 컬럼.length)
      throw new Error(`${f}: CSV 구조가 바뀌었다. 중단한다`);
  } else {
    결과 = 적용하기(원본);
  }

  const 건수 = 치환.reduce((a, [x]) => a + (원본.split(x).length - 1), 0);
  if (건수 === 0) continue;
  총건수 += 건수;
  보고.push({ 파일: f, 건수 });
  if (적용) fs.writeFileSync(f, 결과);
}

console.log(`\n${적용 ? '■ 적용' : '■ 미리보기 (파일 안 바꿈)'} — 치환 ${총건수}건 / 파일 ${보고.length}개`);
console.log('─'.repeat(56));
for (const b of 보고.sort((a, b) => b.건수 - a.건수))
  console.log(`  ${String(b.건수).padStart(4)}  ${b.파일}`);
console.log('\n치환표');
for (const [a, b] of 치환) console.log(`  ${a}  →  ${b}`);
if (!적용) console.log('\n실제로 바꾸려면: node tools/tone.mjs --적용');
