// 1라운드 원문에 채점 룰을 돌린다.
//   node tools/score.mjs            → 요약
//   node tools/score.mjs --detail   → 건별 근거
import fs from 'fs';
import { splitTurns, normRec, maskNum, lev, NL } from './lib/parse.mjs';
import { 전체 as 룰 } from './lib/rules.mjs';
import { readCsv } from './lib/csv.mjs';

const RAW = 'data/raw/round1';
const detail = process.argv.includes('--detail');

// 시드별 원문 읽기 — 시드당 파일 하나 (S<번호>.txt)
const seeds = {};
for (const f of fs.readdirSync(RAW).filter(x => x.endsWith('.txt')).sort()) {
  const sid = f.replace('.txt', '').split(/[-.]/)[0];
  (seeds[sid] ||= []).push(...splitTurns(fs.readFileSync(`${RAW}/${f}`, 'utf8')));
}


// 재탕 3층 — T1 완전일치 / T2 숫자만 다름 / T3 근접(판정 아님, 검토 후보)
const T3_MAX = 0.25;
function 재탕(turns) {
  const seen = [], out = { T1: [], T2: [], T3: [] };
  turns.forEach((t, i) => {
    for (const raw of t.recs) {
      const n = normRec(raw), mk = maskNum(raw);
      const ex = seen.find(p => p.n === n);
      const mkEq = seen.find(p => p.mk === mk);
      let best = null, bd = Infinity;
      for (const p of seen) { const d = lev(p.n, n); if (d < bd) { bd = d; best = p; } }
      if (ex) out.T1.push({ turn: i + 1, 문구: raw, 앞턴: ex.turn });
      else if (mkEq) out.T2.push({ turn: i + 1, 문구: raw, 앞턴: mkEq.turn, 앞문구: mkEq.raw });
      else if (best && bd / Math.max(best.n.length, n.length) <= T3_MAX)
        out.T3.push({ turn: i + 1, 문구: raw, 앞턴: best.turn, 앞문구: best.raw,
                      r: +(bd / Math.max(best.n.length, n.length)).toFixed(3) });
      seen.push({ turn: i + 1, raw, n, mk });
    }
  });
  return out;
}

// 시드 메타 — seeds.csv
// ponytail: 전 22행이 정확히 5필드라 단순 split로 충분하다. 인용 필드가 생기면 파서를 넣는다
const meta = {};
for (const line of fs.readFileSync('data/seeds.csv', 'utf8').trim().split(NL)) {
  const [id, 분류, 질문] = line.split(',');
  if (id !== 'seed_id') meta[id] = { 분류, 질문 };
}

// CSV에 기록된 판정 — observations-round1.csv
// 룰이 못 세는 두 가지가 여기에만 있다: 판정(정답/부분/오답/거절)과 「딥링크 없는 기능 진입」.
// 판정을 누가 붙였는지는 data/README.md 「누가 무엇을 썼나」 참조.
// 딥링크 카드가 붙은 턴은 58인데 사람 기준 도달은 61이다 (S01 1턴은 스크린샷 전사라 카드가
// 원문에 없고, S17 3턴·S21 1턴은 딥링크가 아니라 다른 창으로 이관된 경우다).
const 사람 = {};
for (const r of readCsv(fs.readFileSync('data/observations-round1.csv', 'utf8'))) {
  if (!r.앱기능_진입) continue;   // 미기록 행(사전 생성된 빈 행)은 건너뛴다
  (사람[r.seed_id] ||= [])[+r.turn - 1] =
    { 요약: r.답변요약, 판정: r.판정, 진입: r.앱기능_진입 === 'O', 진입기능: r.진입한_기능명 };
}

const 결과 = {};
for (const [sid, turns] of Object.entries(seeds)) {
  const r = {
    턴수: turns.length,
    딥링크: turns.map(t => t.links.length),
    재탕: 재탕(turns),
    턴: turns.map((t, i) => ({ 본문: t.body, 추천: t.recs, 링크: t.links, ...(사람[sid]?.[i] ?? {}) })),
  };
  for (const [name, fn] of Object.entries(룰)) r[name] = fn(turns);
  결과[sid] = { ...meta[sid], ...r };
}

const 합 = k => Object.values(결과).reduce((a, r) => a + (Array.isArray(r[k]) ? r[k].length : 0), 0);
const 시드수 = k => Object.entries(결과).filter(([, r]) => r[k]?.length).map(([s]) => s);

console.log(`\n채점 대상: ${Object.keys(결과).length}개 시드 / ${Object.values(결과).reduce((a, r) => a + r.턴수, 0)}턴\n`);
console.log('룰            검출  걸린 시드');
console.log('─'.repeat(70));
for (const k of Object.keys(룰))
  console.log(`${k.padEnd(12)} ${String(합(k)).padStart(4)}   ${시드수(k).join(' ') || '-'}`);
const t = ['T1', 'T2', 'T3'].map(x => Object.values(결과).reduce((a, r) => a + r.재탕[x].length, 0));
console.log(`${'재탕 T1'.padEnd(12)} ${String(t[0]).padStart(4)}   완전일치`);
console.log(`${'재탕 T2'.padEnd(12)} ${String(t[1]).padStart(4)}   숫자만 다름(파라미터 순열)`);
console.log(`${'재탕 T3'.padEnd(12)} ${String(t[2]).padStart(4)}   근접 — 판정 아님, 사람이 볼 후보`);

if (detail) for (const [sid, r] of Object.entries(결과)) {
  const hits = Object.keys(룰).filter(k => r[k].length);
  if (!hits.length && !r.재탕.T1.length) continue;
  console.log(`\n━━ ${sid} ━━`);
  for (const k of hits) r[k].forEach(x => console.log(`  ${k}  ${JSON.stringify(x, null, 0)}`));
  r.재탕.T1.forEach(x => console.log(`  재탕T1  ${x.turn}턴 ← ${x.앞턴}턴  "${x.문구}"`));
}

fs.writeFileSync('data/scored-round1.json', JSON.stringify(결과, null, 1));
console.log('\n→ data/scored-round1.json 저장');

// ── 공개본 ────────────────────────────────────────────────────────────
// 카카오뱅크 AI 답변 원문 전량은 공개하지 않는다 (재배포가 된다).
// 대신 ① 우리가 쓴 요약 ② 룰이 잡은 자리 앞뒤 120자 발췌만 담는다.
// 추천 문구는 재탕 분석의 대상 자체이고 짧으므로 그대로 싣는다.
// 필요한 문맥의 폭은 룰마다 다르다.
// 헤더공백은 「##✅」라는 표기 자체가 증거라 주변 문장이 필요 없고,
// 내부용어의 근거는 이미 앞뒤가 잘린 상태로 저장돼 있다.
// 숫자를 다루는 룰만 문장 단위 문맥이 있어야 읽힌다.
const PAD = { 헤더공백: 15, 내부용어: 0, 예시휘발: 60, 기준일없음: 60, 표검산: 60, 공시범위밖: 60 };

// 히트마다 창을 따로 뜨면 창끼리 겹쳐 같은 문장이 여러 번 실린다.
// 범위를 먼저 합친 뒤 한 번만 잘라낸다.
function 발췌들(body, hits) {
  const 범위 = [];
  for (const h of hits) {
    const key = [h.근거, h.금리, h.값, h.총액행].find(k => k && body.includes(k));
    if (!key) continue;
    const at = body.indexOf(key), pad = PAD[h.룰] ?? 60;
    범위.push([Math.max(0, at - pad), Math.min(body.length, at + key.length + pad)]);
  }
  범위.sort((a, b) => a[0] - b[0]);
  const 합친 = [];
  for (const [s, e] of 범위) {
    const last = 합친[합친.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else 합친.push([s, e]);
  }
  return 합친.map(([s, e]) =>
    (s > 0 ? '…' : '') + body.slice(s, e).trim() + (e < body.length ? '…' : ''));
}

const 공개 = {};
for (const [sid, r] of Object.entries(결과)) {
  공개[sid] = {
    분류: r.분류, 질문: r.질문, 턴수: r.턴수, 딥링크: r.딥링크, 재탕: r.재탕,
    ...Object.fromEntries(Object.keys(룰).map(k => [k, r[k]])),
    턴: r.턴.map((t, i) => ({
      요약: t.요약, 판정: t.판정, 진입: t.진입, 진입기능: t.진입기능,
      추천: t.추천, 링크: t.링크,
      발췌: 발췌들(t.본문, Object.keys(룰).flatMap(k => r[k].filter(h => h.turn === i + 1).map(h => ({ ...h, 룰: k })))),
    })),
  };
}
fs.writeFileSync('data/scored-round1.public.json', JSON.stringify(공개, null, 1));

const 원문길이 = Object.values(결과).reduce((a, r) => a + r.턴.reduce((b, t) => b + t.본문.length, 0), 0);
const 발췌길이 = Object.values(공개).reduce((a, r) => a + r.턴.reduce((b, t) => b + t.발췌.join('').length, 0), 0);
console.log(`→ data/scored-round1.public.json 저장 (원문 ${원문길이.toLocaleString()}자 → 발췌 ${발췌길이.toLocaleString()}자)`);
