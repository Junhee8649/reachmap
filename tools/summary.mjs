// 대시보드가 쓰는 파생 수치를 한 파일로 모은다.
//
// 왜 있나: 화면에 숫자를 손으로 적으면 데이터와 갈라진다. 실제로 갈라졌다 —
// 「룰 검출 189건」이 헤더공백을 포함한 값이었는데 리포트는 그걸 결함으로 안 센다.
// 그래서 화면이 쓰는 값은 전부 여기서 계산해 JSON 으로 떨어뜨린다.
//
//   node tools/summary.mjs   →  data/summary.json
import fs from 'fs';
import { readCsv } from './lib/csv.mjs';

const 읽기 = p => fs.readFileSync(p, 'utf8');
const J = p => JSON.parse(읽기(p));

// ── RAG 문서 실험 ────────────────────────────────────────────────
// 원본 vs 다시 쓴 문서를, 질의 출처(FAQ 제목 / 대화에 뜬 추천 문구)로 갈라 센다.
const 묶음정의 = [
  { 이름: '자동이체 (절차 10건)', v1: 'data/rag/result-v1.json', v2: 'data/rag/result-v2.json', 질의: 'data/rag/queries.csv' },
  { 이름: '26주적금 (상품 16건)', v1: 'data/rag/result-적금-v1.json', v2: 'data/rag/result-적금-v2.json', 질의: 'data/rag/queries-적금.csv' },
];

const 키워드 = d => d.find(x => x.검색기.includes('키워드'));
const rag = 묶음정의.map(({ 이름, v1, v2, 질의 }) => {
  const Q = readCsv(읽기(질의));
  const a = Object.fromEntries(키워드(J(v1)).질의별.map(x => [x.질의, x]));
  const b = Object.fromEntries(키워드(J(v2)).질의별.map(x => [x.질의, x]));
  const 세기 = 고르기 => {
    const sel = Q.filter(고르기).filter(r => r.정답문서 && r.정답문서 !== '없음');
    const top1 = m => sel.filter(r => m[r.질의]?.rank === 1).length;
    return { n: sel.length, 원본: top1(a), 재작성: top1(b) };
  };
  const 분할있음 = Q.some(r => r.분할 === '작성용');
  return {
    이름,
    제목: 세기(r => r.출처 === 'FAQ제목'),
    추천: 세기(r => r.출처 === '추천'),
    // 분할은 2차 묶음에만 있다. 1차는 질의를 가르지 않고 쟀다 — 그래서 값이 부풀려졌다.
    작성용: 분할있음 ? 세기(r => r.분할 === '작성용') : null,
    검증용: 분할있음 ? 세기(r => r.분할 === '검증용') : null,
  };
});

// ── 재현성 — 같은 시드를 다시 물었을 때 ─────────────────────────
// 카카오뱅크가 공식으로 인정한 비결정성을, 우리 관측에서 실제로 확인한 값이다.
const R1 = readCsv(읽기('data/observations-round1.csv')).filter(r => r.판정);
const R2 = readCsv(읽기('data/observations-round2.csv')).filter(r => r.판정);
const 정규화 = s => (s || '').replace(/\s+/g, '').replace(/^\d+[.)]/, '');
const 첫턴 = rows => Object.fromEntries(rows.filter(r => r.turn === '1').map(r => [r.seed_id, r]));
const 원본첫턴 = 첫턴(R1);
const 재현 = [];
for (const r of R2.filter(r => r.turn === '1' && r.목적 === '재현성')) {
  const o = 원본첫턴[r.seed_id];
  if (!o) continue;
  // 🔴 1라운드에는 딥링크 개수 칸이 없다. 그래서 「붙었나/안 붙었나」로만 비교한다.
  //    개수끼리 비교하면 없는 칸을 있는 것처럼 다루게 된다.
  재현.push({
    시드: r.seed_id,
    회차: `${r.round}회차`,
    질문: o.입력질문,
    추천같음: 정규화(o.노출된_추천_전부) === 정규화(r.노출된_추천_전부),
    링크같음: (o.앱기능_진입 === 'O') === (Number(r.딥링크_개수 || 0) > 0),
    판정같음: o.판정 === r.판정,
  });
}

// ── 기능 안내 ────────────────────────────────────────────────────
// 「이 기능이 있다」고 알려준 턴. 2라운드부터 칸이 생겨 2라운드만 센다.
const 안내 = { O: 0, X: 0, 해당없음: 0 };
for (const r of R2) if (r.기능안내 in 안내) 안내[r.기능안내]++;
const 인계 = R2.filter(r => r.인계여부 === 'O').map(r => `${r.seed_id} ${r.turn}턴 → ${r.진입한_기능명}`);


// ── 피드백 UI 3층 ────────────────────────────────────────────────
// tools/feedback.py 가 낸 집계를 화면이 쓰는 모양으로만 옮긴다. 여기서 다시 세지 않는다 —
// 두 곳에서 세면 두 값이 갈린다.
const FB = JSON.parse(읽기('data/feedback-map.json'));
const 피드백 = {
  턴수: FB.턴수,
  층: FB.집계.층별_건수와_고유수.map(x => ({ 층: x.층, 건수: x.건수, 턴수: x.턴수 })),
  칸: FB.집계.A층_피드백_칸별.map(x => ({ 칸: x.칸, 건수: x.건수 })),
};

// ── 추천이 닿지 않은 자리 ────────────────────────────────────────
// 태그는 카카오뱅크가 FAQ 제목에 직접 붙인 라벨이다. 우리 분류가 아니다.
// 🔴 「추천 0」은 품질 지적이 아니다. 우리 시드가 통장/저축에 쏠린 결과이기도 하다.
//    그래서 화면에도 그 문장을 같이 띄운다.
const CV = JSON.parse(읽기('data/faq-coverage.json'));
const 커버리지 = {
  태그수: CV.태그수, 닿은태그: CV.닿은태그,
  총문항: CV.총문항, 닿은문항: CV.닿은문항,
  공백: CV.태그.filter(t => t.추천 === 0).sort((a, b) => b.문항 - a.문항).slice(0, 8)
          .map(t => ({ 태그: t.태그, 문항: t.문항, 분류: t.cat })),
  닿음: CV.태그.filter(t => t.추천 > 0).sort((a, b) => b.추천 - a.추천).slice(0, 5)
          .map(t => ({ 태그: t.태그, 문항: t.문항, 추천: t.추천, 분류: t.cat })),
};

fs.writeFileSync('data/summary.json', JSON.stringify({ rag, 재현, 안내, 인계, 피드백, 커버리지 }, null, 1));
console.log('→ data/summary.json');
console.log(`  RAG 묶음 ${rag.length} · 재현성 ${재현.length}건 · 기능안내 O ${안내.O}/X ${안내.X} · 인계 ${인계.length}건`);
console.log(`  피드백 3층 ${피드백.층.map(x => x.건수).join('/')} · 커버리지 태그 ${커버리지.닿은태그}/${커버리지.태그수}`);
