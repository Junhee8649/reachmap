import { useState } from 'react'
import {
  RULES,
  ids,
  seeds,
  총턴,
  도달턴,
  딥링크턴,
  딥링크없는진입,
  판정합,
  판정들,
  룰합,
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

export default function App() {
  const [tab, setTab] = useState<'개요' | '추천 경로' | '골든셋'>('개요')
  return (
    <>
      <div className="disclaimer">지원자 개인 분석 · 공개 데이터 기반 · 카카오뱅크와 무관</div>
      <header className="page">
        <h1>
          reachmap<small>대화형 AI 답변 품질 관측</small>
        </h1>
        <p className="lede">
          카카오뱅크 AI를 두 방식으로 관측했다. <b>추천 경로</b>는 매 턴 <b>첫 번째 추천만</b> 따라가며 5턴까지 간 것으로
          1라운드 {회차턴(1)}턴 + 2라운드 {회차턴(2)}턴 = {총턴}턴이고, <b>골든셋</b>은 문항마다 대화를 초기화한 1턴짜리
          독립 관측 {golden.length}문항이다. 답변 원문에 결정적 룰 6종을 돌렸다.
          <b>2026년 8월 시점 관측이며 이미 개선됐을 수 있다.</b>
        </p>
      </header>
      <nav className="tabs">
        {(['개요', '추천 경로', '골든셋'] as const).map(t => (
          <button key={t} aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      <main>{tab === '개요' ? <개요 /> : tab === '추천 경로' ? <시드 /> : <골든셋 />}</main>
    </>
  )
}

function 개요() {
  const 룰최대 = Math.max(...Object.values(룰합))
  const 룰총 = Object.values(룰합).reduce((a, b) => a + b, 0)
  return (
    <>
      <div className="tiles" style={{ marginBottom: 20 }}>
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
          <div className="v">{룰총}</div>
          <div className="k">룰 검출 건수</div>
          <div className="sub">룰 6종 · 사람 판독 없이 재현됨</div>
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
        <h2>룰별 검출 건수</h2>
        <p className="note">전부 문자열·산술 대조다. 같은 입력이면 같은 결과가 나온다.</p>
        <div className="bars">
          {RULES.map(r => (
            <Bar key={r} label={r} value={룰합[r]} max={룰최대} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>턴별 딥링크 개수</h2>
        <p className="note">
          한 칸이 한 턴이고 숫자는 그 턴에 붙은 상품·기능 링크 수다. 점은 그 시드가 일찍 끝났다는 뜻이다.
          <br />
          <b>이 격자가 세는 것은 {딥링크턴}턴이고 위 도달률은 {도달턴}턴이다.</b> 차이 {딥링크없는진입.length}건은 딥링크
          카드 없이 도달한 경우다 — {딥링크없는진입.join(' · ')}. 룰은 원문에 카드가 있어야만 세므로 이 셋을 못 잡는다.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="heat">
            <thead>
              <tr>
                <th />
                {Array.from({ length: 최대턴 }, (_, i) => (
                  <th key={i}>{i + 1}턴</th>
                ))}
                <th style={{ paddingLeft: 8, textAlign: 'left' }}>시드 질문</th>
              </tr>
            </thead>
            <tbody>
              {ids.map(id => {
                const s = seeds[id]
                return (
                  <tr key={id}>
                    <th className="row">{id}</th>
                    {Array.from({ length: 최대턴 }, (_, i) => {
                      const n = s.딥링크[i]
                      if (n === undefined)
                        return (
                          <td key={i} className="empty" title={`${id} ${i + 1}턴 — 관측 없음 (체인 종료)`}>
                            ·
                          </td>
                        )
                      return (
                        <td
                          key={i}
                          title={`${id} ${i + 1}턴 — 딥링크 ${n}개`}
                          style={{
                            background: `var(--h${Math.min(n, 3)})`,
                            color: `var(--ht${Math.min(n, 3)})`,
                          }}
                        >
                          {n}
                        </td>
                      )
                    })}
                    <td className="qcell">{s.질문}</td>
                  </tr>
                )
              })}
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
  const [sel, setSel] = useState(ids[0])
  const s = seeds[sel]
  return (
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
      <div className="tiles" style={{ marginBottom: 20 }}>
        <div className="tile">
          <div className="v">{golden.length}</div>
          <div className="k">문항</div>
          <div className="sub">
            {Object.entries(골든판정).map(([k, v]) => `${k} ${v}`).join(' · ')}
          </div>
        </div>
        <div className="tile">
          <div className="v">{Math.round((링크있음 / golden.length) * 100)}%</div>
          <div className="k">상품·기능으로 도달한 문항</div>
          <div className="sub">{링크있음}/{golden.length}문항</div>
        </div>
        <div className="tile">
          <div className="v">{기준일}</div>
          <div className="k">기준일을 밝힌 문항</div>
          <div className="sub">
            금리·수수료·환율을 말하면서 언제 기준인지 밝힌 것은 {golden.length}개 중 {기준일}개다
          </div>
        </div>
      </div>

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
