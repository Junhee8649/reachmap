// 골든셋 관측 시트 생성 — 축소안 20문항
//
// 왜 20개인가: 60문항 전량은 질문 한도(3시간 90회)와 남은 일정에 안 맞는다.
// 버리는 것이 아니라 **고정 회귀 세트**로 20개를 뽑는다. 축은 셋이다.
//   ① 모름이정답 13 — 은행 사실을 몰라도 채점된다. 「단정하는가」를 본다
//   ② 거절 2       — 안전 축
//   ③ 사실 5       — 공개 FAQ 본문으로 정답을 확인한 것만 (D-03)
//
// 순서는 **가치 높은 것부터**다. 중간에 멈춰도 앞쪽만으로 성립한다
// (CLAUDE.md: 막히면 뒤에서부터 버린다).
import fs from 'fs';
import { readCsv, writeCsv } from './lib/csv.mjs';

const 순서 = [
  'G20',                                          // 26주적금 — 우리 관측이 182/184로 갈렸던 지점
  'G01','G02','G05','G08','G10','G13','G14','G15','G32','G41','G49','G51','G59',  // 모름이정답 13
  'G44','G60',                                    // 거절 2
  'G03','G16',                                    // 사실 — 문서 확인 완료
  'G18','G47',                                    // 혼동 축 — 본문 수령 후 정답 확정
];

const g = Object.fromEntries(readCsv(fs.readFileSync('data/goldenset.csv', 'utf8')).map(r => [r.q_id, r]));
const rows = 순서.map((id, i) => {
  const q = g[id];
  if (!q) throw new Error(`골든셋에 없는 문항: ${id}`);
  return {
    순번: i + 1, q_id: id, 분류: q.category, 기대유형: q.expected_type,
    질문: q.question,
    답변원문파일: `data/raw/golden/${id}.txt`,
    판정: '', 근거표시: '', 한계고지: '', 딥링크_개수: '', 추천_개수: '', 되묻기: '',
    인계여부: '', 메모: '',
    정답기준: q.expected_answer || '(미확정 — 본문 수령 후 채운다)',
  };
});
fs.mkdirSync('data/raw/golden', { recursive: true });
fs.writeFileSync('data/goldenset-round1.csv', writeCsv(rows));
console.log(`${rows.length}행 생성 → data/goldenset-round1.csv`);
console.log(`정답기준 확정 ${rows.filter(r => !r.정답기준.startsWith('(미확정')).length} / 미확정 ${rows.filter(r => r.정답기준.startsWith('(미확정')).length}`);
console.log('\n관측 순서:');
rows.forEach(r => console.log(`  ${String(r.순번).padStart(2)}. [${r.기대유형.padEnd(5)}] ${r.질문}`));
