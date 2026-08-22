import { useState } from 'react'
import {
  ids,
  seeds,
  총턴,
  도달턴,
  딥링크턴,
  딥링크없는진입,
  판정합,
  판정들,
  룰합,
  결함룰,
  결함합,
  rag,
  재현,
  안내,
  인계,
  피드백,
  커버리지,
  재탕합,
  룰히트,
  시드룰수,
  회차턴,
  golden,
  골든판정,
  골든도달,
} from './data'
import type { Seed, Turn } from './data'

const 최대턴 = 5
// 피드백 3층의 A·B·C 는 tools/feedback.py 의 내부 코드다.
// 화면에서는 「이건 어느 칸으로 신고될까」에 대한 답으로 읽혀야 하므로 말로 바꿔 쓴다.
const 층이름: Record<string, string> = {
  'A 신고 가능': '① 또는 ②로 신고할 수 있다',
  'B 칸이 없다': '보이는데 신고할 칸이 없다',
  'C 안 보인다': '사용자에게 안 보인다',
}
type Tab = '개요' | '추천 경로' | 'RAG 문서' | '골든셋'

// 공고 「담당할 업무」 5줄을 그대로 옮기고, 각각을 어느 화면이 다루는지 붙인다.
// 순서·문구는 docs/00-공고원문.md 원문 그대로다. 우리 편의로 고쳐 쓰면 대조가 안 된다.
const 담당업무: { 업무: string; 탭: Tab; 절: string }[] = [
  { 업무: '카카오뱅크 AI 데이터 모니터링', 탭: '추천 경로', 절: '관측 204건 · 시드별 전 턴 기록' },
  { 업무: 'AI 고객 피드백 모니터링 및 개선사항 발굴', 탭: '추천 경로', 절: '사용자가 신고할 수 있는가' },
  { 업무: 'AI 모델 업데이트 시 AI 답변 검증', 탭: '골든셋', 절: '문항별 룰 채점' },
  { 업무: '카카오뱅크 AI로 연결되는 선제안/추천 질문 콘텐츠 운영', 탭: '추천 경로', 절: '추천이 닿지 않은 자리' },
  { 업무: 'AI 답변에 활용되는 RAG 문서 생성 및 관리', 탭: 'RAG 문서', 절: '문서를 다시 쓰면 검색이 달라지는가' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('개요')
  return (
    <>
      <div className="disclaimer">지원자 개인 분석 · 공개 데이터 기반 · 카카오뱅크와 무관</div>
      <header className="page">
        <h1>
          reachmap<small>대화형 AI 답변 품질 관측</small>
        </h1>
        <p className="lede">
          카카오뱅크 AI에 <b>질문 {총턴 + golden.length}개</b>를 넣고, 답변 원문을 결정적 룰로 채점했다.
          <b>2026년 8월 시점 관측이며 이미 개선됐을 수 있다.</b>
        </p>
        <p className="lede sub">
          <b>추천 경로</b> 매 턴 첫 번째 추천만 따라가 5턴까지 — {회차턴(1)} + {회차턴(2)} = {총턴}턴 &nbsp;·&nbsp;
          <b>골든셋</b> 문항마다 대화를 초기화한 1턴 독립 관측 {golden.length}문항
        </p>
        <p className="links out">
          <a href="https://github.com/Junhee8649/reachmap" target="_blank" rel="noreferrer">저장소</a>
          <a href="https://github.com/Junhee8649/reachmap/blob/main/docs/08-%EB%A6%AC%ED%8F%AC%ED%8A%B8.md" target="_blank" rel="noreferrer">리포트</a>
          <a href="https://github.com/Junhee8649/reachmap/blob/main/docs/02-%EA%B2%B0%EC%A0%95%EA%B8%B0%EB%A1%9D.md" target="_blank" rel="noreferrer">결정 기록</a>
          <a href="https://github.com/Junhee8649/reachmap/blob/main/docs/03-%EA%B4%80%EC%B8%A1-%ED%94%84%EB%A1%9C%ED%86%A0%EC%BD%9C.md" target="_blank" rel="noreferrer">관측 절차</a>
        </p>
      </header>
      <nav className="tabs">
        {(['개요', '추천 경로', 'RAG 문서', '골든셋'] as const).map(t => (
          <button key={t} aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      <main>
        {tab === '개요' ? <개요 go={setTab} /> : tab === '추천 경로' ? <시드 /> : tab === 'RAG 문서' ? <Rag /> : <골든셋 />}
      </main>
    </>
  )
}

function 개요({ go }: { go: (t: Tab) => void }) {
  return (
    <>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <div className="tile">
          <div className="v">{Math.round((판정합.정답 / 총턴) * 100)}%</div>
          <div className="k">내용이 맞은 턴</div>
          <div className="sub">
            {판정들.map(p => `${p} ${판정합[p]}`).join(' · ')}
          </div>
        </div>
        <div className="tile">
          <div className="v">{Math.round((도달턴 / 총턴) * 100)}%</div>
          <div className="k">상품·기능으로 도달한 턴</div>
          <div className="sub">
            {도달턴}/{총턴}턴 — 이 서비스의 지표는 정확도가 아니라 도달이다
          </div>
        </div>
        <div className="tile">
          <div className="v">{결함합}</div>
          <div className="k">룰이 잡은 결함</div>
          <div className="sub">룰 {결함룰.length}종 · 사람 판독 없이 재현됨</div>
        </div>
        <div className="tile">
          <div className="v">{재탕합.T1}</div>
          <div className="k">추천 재탕 (완전 일치)</div>
          <div className="sub">
            숫자만 다른 것 {재탕합.T2}건 · 근접 후보 {재탕합.T3}건
          </div>
        </div>
      </div>

      <section className="card">
        <h2>공고의 담당업무를 어디서 다뤘나</h2>
        <p className="note">채용공고 「담당할 업무」 다섯 줄 <b>원문 그대로</b>다. 누르면 그 화면으로 간다.</p>
        <ul className="jobmap">
          {담당업무.map(m => (
            <li key={m.업무}>
              <span className="jd">{m.업무}</span>
              <button onClick={() => go(m.탭)}>
                {m.탭} <span className="sec">{m.절}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

    </>
  )
}

function Rag() {
  return (
    <>
      <section className="card">
        <h2>문서를 다시 쓰면 검색이 달라지는가</h2>
        <p className="note">
          이 팀은 모델을 건드릴 수 없고 <b>문서와 추천 질문</b>을 손댄다. 그래서 물어볼 것은 하나다 —
          문서를 어떻게 써야 AI가 찾아 쓰는가. 카카오뱅크 공개 FAQ 26건을 <b>내용은 한 글자도 바꾸지 않고</b>
          표현만 다시 쓴 뒤, 직접 만든 검색기로 원본과 나란히 돌렸다.
        </p>
        {rag.map(m => (
          <div key={m.이름} style={{ marginTop: 18 }}>
            <div className="lbl" style={{ marginBottom: 8 }}>
              <b>{m.이름}</b>
            </div>
            <div className="bars">
              <Bar label={`FAQ 제목 그대로 · 원본`} value={m.제목.원본} max={m.제목.n} />
              <Bar label={`FAQ 제목 그대로 · 다시 씀`} value={m.제목.재작성} max={m.제목.n} />
              <Bar label={`대화에 뜬 문구 · 원본`} value={m.추천.원본} max={m.추천.n} />
              <Bar label={`대화에 뜬 문구 · 다시 씀`} value={m.추천.재작성} max={m.추천.n} />
            </div>
          </div>
        ))}
        <p className="note" style={{ marginTop: 16 }}>
          <b>원본 문서는 자기 제목으로 물을 때만 완벽했다.</b> 같은 사실을 대화에서 실제로 뜬 문구로 물으면
          절반 가까이가 엉뚱한 문서를 1위로 내놓았고, <b>주제가 다른 두 묶음에서 같은 모양</b>이 나왔다.
        </p>
      </section>

      <section className="card">
        <h2>그런데 1차 결과는 부풀려져 있었다</h2>
        <p className="note">
          1차에서는 문서에 넣은 문구가 채점에 쓸 질문과 거의 같았다. <b>시험 문제를 교과서에 적어놓고 시험을 본 셈</b>이다.
          2차는 문서를 쓰기 전에 질문을 갈라, 검증용은 문서를 쓰는 동안 열지도 않았다.
        </p>
        {rag
          .filter(m => m.작성용 && m.검증용)
          .map(m => (
            <div key={m.이름} className="bars">
              <Bar label="작성용 — 문서에 넣은 질문 · 원본" value={m.작성용!.원본} max={m.작성용!.n} />
              <Bar label="작성용 — 문서에 넣은 질문 · 다시 씀" value={m.작성용!.재작성} max={m.작성용!.n} />
              <Bar label="검증용 — 안 넣은 질문 · 원본" value={m.검증용!.원본} max={m.검증용!.n} />
              <Bar label="검증용 — 안 넣은 질문 · 다시 씀" value={m.검증용!.재작성} max={m.검증용!.n} />
            </div>
          ))}
        <p className="note" style={{ marginTop: 16 }}>
          <b>고친 효과는 양쪽 다 +1건으로 같았다. 다른 것은 출발점이다</b> — 작성용은 이미 4/5였고
          검증용은 1/4였다. 1차 수치는 지우지 않고 두되, 분할 없이 잰 값임을 리포트에 밝혔다.
        </p>
        <p className="note">
          ⚠️ 문서에 넣은 문구 35개 중 <b>28개는 관측에 없는, 우리가 지어낸 말</b>이다(1차에 몰려 있다).
          전수 표는 저장소의 <code>data/rag/docs-v2/_문구출처.md</code> 에 있다.
        </p>
      </section>
    </>
  )
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <>
      <div className="lbl">{label}</div>
      <div className="track">
        <div className="fill" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <div className="val">{value}</div>
    </>
  )
}

function 시드() {
  const 결함최대 = Math.max(...결함룰.map(r => 룰합[r]))
  const [sel, setSel] = useState(ids[0])
  const s = seeds[sel]
  return (
    <>
      <section className="card">
        <h2>룰이 잡은 {피드백.층.reduce((a, x) => a + x.건수, 0)}건 — 사용자는 그중 무엇을 보나</h2>
        <p className="note">
          답변에 달린 <b>싫어요</b> 버튼을 누르면 사유 칸이 셋 뜬다 —
          <b>① 답변 내용이 정확하지 않음 · ② 설명이 부족함 · ③ 질문과 다른 내용을 답변함.</b>
          룰이 잡은 것을 하나씩 <b>「이건 어느 칸으로 신고될까」</b>로 붙여봤더니 세 갈래가 됐다.
        </p>
        <div className="bars">
          {피드백.층.map(x => (
            <Bar key={x.층} label={층이름[x.층] ?? x.층} value={x.건수} max={Math.max(...피드백.층.map(y => y.건수))} />
          ))}
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          <b>신고할 수 있는 {룰합.기준일없음 + 룰합.예시휘발 + 룰합.공시범위밖 + 룰합.내부용어 + 룰합.표검산}건의 내역</b> —
          전부 문자열·산술 대조라 같은 입력이면 같은 결과가 나온다.
        </p>
        <div className="bars sub">
          {결함룰.map(r => (
            <Bar key={r} label={r} value={룰합[r]} max={결함최대} />
          ))}
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          {피드백.칸.map(c => `${c.칸} ${c.건수}건`).join(' · ')}. <b>③번은 0건</b> — 룰에 그 눈이 없다.
        </p>
        <p className="note" style={{ marginTop: 14 }}>
          <b>요점은 가운데 줄이다.</b> 똑같은 추천이 또 뜨는 것은 사용자가 <b>보는데</b>, 칸 셋이 전부
          「답변」에 대한 것이라 <b>신고할 데가 없다</b> — 불만이 있어도 집계에 안 잡힌다.
          맨 아래 줄(헤더 공백)은 앱에서 정상 렌더돼 안 보인다. 그래서 결함으로 세지 않는다.
        </p>
        <p className="note">
          ⚠️ <b>실제 신고가 아니라 「신고했다면 어느 칸이었을까」</b>다. 매핑은 집계를 보기 <b>전에</b> 고정했다.
        </p>
      </section>

      <section className="card">
        <h2>추천이 닿지 않은 자리</h2>
        <p className="note">
          카카오뱅크가 <b>FAQ 제목에 붙인 태그</b> {커버리지.태그수}개 중, 추천이 한 번이라도 닿은 것은
          <b>{커버리지.닿은태그}개</b>({커버리지.닿은문항.toLocaleString()}/{커버리지.총문항.toLocaleString()}문항)다.
        </p>
        <p className="note">
          🔴 <b>카카오뱅크의 결함이 아니다.</b> 우리 시드 24개가 통장/저축에 쏠린 탓이기도 하다.
          이 표는 지적이 아니라 <b>추천 질문을 새로 쓸 자리 목록</b>이다.
        </p>
        <div className="two">
          <div>
            <div className="lbl" style={{ marginBottom: 8 }}><b>추천이 한 번도 안 간 태그</b> — 문서가 많은 순</div>
            <table className="heat gaptbl">
              <tbody>
                {커버리지.공백.map(t => (
                  <tr key={t.태그}>
                    <th className="row">{t.태그}</th>
                    <td className="empty">{t.문항}문항</td>
                    <td className="qcell">{t.분류}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="lbl" style={{ marginBottom: 8 }}><b>추천이 몰린 태그</b> — 많은 순</div>
            <table className="heat gaptbl">
              <tbody>
                {커버리지.닿음.map(t => (
                  <tr key={t.태그}>
                    <th className="row">{t.태그}</th>
                    <td style={{ background: 'var(--h3)', color: 'var(--ht3)' }}>추천 {t.추천}</td>
                    <td className="qcell">{t.문항}문항 · {t.분류}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="note" style={{ marginTop: 12 }}>
          문항 수는 <b>문서가 쌓인 양</b>이지 고객이 묻는 양이 아니다. 다만 100건 넘게 있는데 추천이 한 번도
          안 갔다면 <b>있는 문서를 안 쓰고 있다</b>는 뜻은 된다.
        </p>
        <p className="note">
          <b>기능도 마찬가지다.</b> 그 일을 대신해 줄 앱 기능이 있는데 <b>있다고 알려준 턴은
          {안내.O + 안내.X}턴 중 {안내.O}턴</b>, 새 창으로 넘겨준 턴은 {인계.length}건이다
          ({인계.join(' · ')}). <b>넘겨주는 것과 알려주는 것은 다른 일</b>이고, 알려주는 쪽이
          추천 질문으로 할 수 있는 일이다.
        </p>
      </section>

      <section className="card">
        <h2>턴별 딥링크 개수</h2>
        <p className="note">
          가로가 시드, 세로가 턴이다. 숫자는 그 턴에 붙은 상품·기능 링크 수이고 점은 대화가 일찍 끝났다는 뜻이다.
          <b>누르면 아래에서 그 시드가 열린다.</b>
          <br />
          이 격자가 세는 것은 {딥링크턴}턴이고 위 도달률은 {도달턴}턴이다 — 차이 {딥링크없는진입.length}건은
          링크 카드 없이 도달한 경우라 원문만 보는 룰이 못 잡는다.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="heat grid">
            <thead>
              <tr>
                <th />
                {ids.map(id => (
                  <th key={id} className="col">
                    <button onClick={() => setSel(id)} title={seeds[id].질문}>{id}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 최대턴 }, (_, i) => (
                <tr key={i}>
                  <th className="row">{i + 1}턴</th>
                  {ids.map(id => {
                    const n = seeds[id].딥링크[i]
                    if (n === undefined)
                      return <td key={id} className="empty" title={`${id} ${i + 1}턴 — 관측 없음`}>·</td>
                    return (
                      <td
                        key={id}
                        title={`${id} ${i + 1}턴 — 딥링크 ${n}개 · ${seeds[id].질문}`}
                        style={{ background: `var(--h${Math.min(n, 3)})`, color: `var(--ht${Math.min(n, 3)})` }}
                      >
                        {n}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend">
          없음
          {[0, 1, 2, 3].map(n => (
            <i key={n} style={{ background: `var(--h${n})` }} />
          ))}
          3개 이상
        </div>
      </section>

    <div className="split">
      <ul className="seedlist card" style={{ padding: 8 }}>
        {ids.map(id => (
          <li key={id}>
            <button aria-current={id === sel} onClick={() => setSel(id)}>
              {id} <span className="n">· {seeds[id].턴수}턴 · 룰 {시드룰수(seeds[id])}건</span>
              <span className="q">{seeds[id].질문}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="card">
        <h2>
          {sel} · {s.질문}
        </h2>
        <p className="note">
          {s.분류} · {s.턴수}턴 · 턴별 딥링크 {s.딥링크.join(' → ')}
          <br />
          딥링크는 <code>onelink.me</code> 주소라 <b>앱이 깔린 기기에서만 상품 화면으로 열린다</b> — 데스크톱 웹에서
          누르면 카카오뱅크 홈으로 간다. 관측 대상은 이동 여부가 아니라 <b>어느 상품을 가리켰는가</b>이므로 주소 뒤의
          식별자를 함께 적었다 (같은 식별자가 이어지면 대화가 바뀌어도 도착지가 그대로라는 뜻이다).
        </p>
        {s.턴.map((t, i) => (
          <턴카드 key={i} seed={s} turn={i + 1} t={t} />
        ))}
      </div>
    </div>
    </>
  )
}

function 턴카드({ seed, turn, t }: { seed: Seed; turn: number; t: Turn }) {
  const { 요약, 발췌, 추천: recs, 링크: links, 판정 } = t
  const 진입기능 = t.진입 ? t.진입기능 : ''
  const hits = 룰히트(seed, turn)
  const 재탕of = (문구: string) =>
    (['T1', 'T2', 'T3'] as const).find(k => seed.재탕[k].some(x => x.turn === turn && x.문구 === 문구))
  return (
    <div className="turn">
      <h3>
        {turn}턴 <span className={`tag j-${판정}`}>{판정}</span>
        <span className="t">기록된 판정</span>
        {hits.map((h, i) => (
          <span key={i} className="tag rule">
            {h.룰}
          </span>
        ))}
      </h3>
      <p className="summary">{요약}</p>
      {발췌.length > 0 && (
        <div className="excerpt">
          <div className="cap">룰이 잡은 자리 — 답변 원문에서 발췌</div>
          {발췌.map((x, i) => (
            <pre key={i}>{x}</pre>
          ))}
        </div>
      )}
      {hits.map((h, i) => (
        <div key={i} className="hit">
          <b>{h.룰}</b>{' — '}
          {h.룰 === '표검산' ? (
            <>
              <code>{h.원금행}</code> + <code>{h.이자행}</code> = {h.실제합?.toLocaleString()} 인데{' '}
              <code>{h.총액행}</code>은 {h.표기?.toLocaleString()}
            </>
          ) : h.룰 === '공시범위밖' ? (
            <>
              <code>{h.값}</code> · 앱 공시는 {h.공시} ({h.출처})
            </>
          ) : (
            <>
              <code>{h.근거 ?? h.금리}</code>
              {h.룰 === '예시휘발' && h.금리 ? ` · ${h.금리}` : ''}
            </>
          )}
        </div>
      ))}
      <ol className="recs">
        {recs.map((r, i) => {
          const k = 재탕of(r)
          return (
            <li key={i}>
              {r} {k ? <span className={`tag ${k.toLowerCase()}`}>재탕 {k}</span> : null}
            </li>
          )
        })}
      </ol>
      <div className="links">
        {links.length ? (
          links.map((l, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : ''}
              <a href={l.url} target="_blank" rel="noreferrer" title={l.url}>
                {l.title}
              </a>
              <code className="slug">{l.url.split('/').pop()}</code>
            </span>
          ))
        ) : (
          <span>딥링크 없음{진입기능 ? ` — 다만 사람은 도달로 기록했다 (${진입기능})` : ''}</span>
        )}
      </div>
    </div>
  )
}

// ── 골든셋 ──────────────────────────────────────────────────────────
// 추천 경로와 전제가 다르다. 문항마다 대화를 초기화했으므로 턴 사이 연속성이 없고,
// 그래서 예시휘발·재탕 같은 「앞 턴 대비」 룰은 여기서 돌리지 않는다.
function 골든셋() {
  const [열린것, 열기] = useState<string | null>(null)
  const 링크있음 = golden.filter(g => g.링크.length).length
  const 기준일 = golden.filter(g => g.근거표시 === 'O').length
  return (
    <>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <div className="tile">
          <div className="v">{golden.length}</div>
          <div className="k">문항</div>
          <div className="sub">
            {Object.entries(골든판정).map(([k, v]) => `${k === '-' ? '이관' : k} ${v}`).join(' · ')}
          </div>
        </div>
        <div className="tile">
          <div className="v">{Math.round((링크있음 / golden.length) * 100)}%</div>
          <div className="k">상품·기능으로 도달한 문항</div>
          <div className="sub">{링크있음}/{golden.length}문항</div>
        </div>
        <div className="tile">
          <div className="v">{기준일}</div>
          <div className="k">근거를 밝힌 문항</div>
          <div className="sub">{기준일}개 중 6개가 기준일 표기다</div>
        </div>
      </div>

      <section className="card">
        <h2>같은 질문을 다시 물으면</h2>
        <p className="note">
          카카오뱅크는 <b>같은 질문에도 답이 매번 다를 수 있다</b>고 공식으로 밝히고 있다. 그래서 「답이 달랐다」는
          발견이 아니다. 볼 것은 <b>어떤 회차는 상품·기능에 도착하고 어떤 회차는 못 도착하는가</b>다.
        </p>
        <table className="heat" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th />
              <th>추천 문구</th>
              <th>링크 유무</th>
              <th>판정</th>
              <th style={{ paddingLeft: 8, textAlign: 'left' }}>질문</th>
            </tr>
          </thead>
          <tbody>
            {재현.map((r, i) => (
              <tr key={i}>
                <th className="row">
                  {r.시드} {r.회차}
                </th>
                <td className={r.추천같음 ? '' : 'empty'}>{r.추천같음 ? '같음' : '다름'}</td>
                <td>{r.링크같음 ? '같음' : '다름'}</td>
                <td>{r.판정같음 ? '같음' : '다름'}</td>
                <td style={{ paddingLeft: 8, textAlign: 'left', width: 'auto' }}>{r.질문}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note" style={{ marginTop: 12 }}>
          <b>추천 문구는 {재현.length}회차 전부 달랐고, 판정과 링크 유무는 전부 같았다.</b>
          문구는 흔들리는데 사실과 도달은 흔들리지 않았다는 뜻이다. 표본이 {재현.length}건이라 여기까지만 말한다. (추천 경로 시드를 다시 물어 잰 값이다.)
        </p>
      </section>

      <section className="card">
        <h2>어느 영역에서 도달이 끊기는가</h2>
        <p className="note">
          분류별로 링크가 붙은 문항 비율이다. <b>인증/보안이 가장 낮다</b> — 답은 맞는데 갈 곳을 안 준다.
          공고가 말한 「상품 페이지로 연결되는 클릭률」을 올릴 지점이 여기다.
        </p>
        <div className="bars">
          {골든도달.map(([분류, v]) => (
            <Bar key={분류} label={`${분류} ${v.l}/${v.n}`} value={Math.round((v.l / v.n) * 100)} max={100} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>문항 {golden.length}개</h2>
        <p className="note">
          누르면 판정 근거와 룰이 잡은 자리가 열린다. <b>정답 기준은 관측 전에 사람이 붙였고</b>,
          공개 FAQ 본문으로 확인한 것만 확정으로 적었다.
        </p>
        <div className="golden">
          {golden.map(g => (
            <div key={g.q_id} className="grow">
              <button className="ghead" onClick={() => 열기(열린것 === g.q_id ? null : g.q_id)}>
                <span className={`tag j-${g.판정 === '-' ? '거절' : g.판정}`}>
                  {g.판정 === '-' ? '이관' : g.판정}
                </span>
                <span className="q">{g.질문}</span>
                <span className="gmeta">
                  {g.분류} · {g.기대유형}
                  {g.링크.length > 0 && ` · 링크 ${g.링크.length}`}
                  {g.히트.length > 0 && ` · 룰 ${g.히트.length}`}
                </span>
              </button>
              {열린것 === g.q_id && (
                <div className="gbody">
                  <p className="note"><b>정답 기준</b> — {g.정답기준}</p>
                  <p>{g.메모}</p>
                  {g.발췌.length > 0 && (
                    <div className="excerpt">
                      <div className="cap">룰이 잡은 자리 — 답변 원문 발췌</div>
                      {g.발췌.map((x, i) => <pre key={i}>{x}</pre>)}
                    </div>
                  )}
                  {g.추천.length > 0 && (
                    <ol className="recs">{g.추천.map((r, i) => <li key={i}>{r}</li>)}</ol>
                  )}
                  {g.링크.length > 0 && (
                    <ul className="links">
                      {g.링크.map((l, i) => <li key={i}>{l.title || l.url}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
