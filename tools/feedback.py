"""관측 144턴을 카카오뱅크 AI 피드백 UI의 분류 체계로 재집계한다.

왜 있나 (D-13):
  담당업무 「AI 고객 피드백 모니터링」을 채우려고 앱 스토어 리뷰를 모으려 했으나
  두 스토어 모두 robots.txt로 리뷰 수집을 금지하고 있어 접었다.
  대신 앱 안의 피드백 UI가 쓰는 분류 3개를 기준으로 우리 관측을 재집계한다.

  싫어요 → 바텀 모달 3개
    ① 답변 내용이 정확하지 않음
    ② 설명이 부족함
    ③ 질문과 다른 내용을 답변함

  ⚠️ 우리가 재는 것은 「사용자가 신고했다면 어느 칸이었을까」이지 실제 신고가 아니다.

세 층으로 나눈다 (2026-08-19 개정):
  A 신고 가능   — 사용자가 보고, 세 칸 중 하나로 신고할 수 있다
  B 칸이 없다   — 사용자가 볼 수 있는데 신고할 칸이 없다  ← 피드백 축의 공백
  C 안 보인다   — 사용자가 알 수 없다                    ← 도구가 필요한 이유

  개정 전에는 전부 「결함」으로 세어 227건이라고 했다. 검증해보니 절반 이상이
  헤더공백이었고, 그것은 앱에서 정상 렌더된다(관측자 확인). 숫자를 부풀린 것이다.

  실행:  python tools/feedback.py
  출력:  data/feedback-map.json  (집계만. 원문은 로컬에 둔다)
"""
import json
import sqlite3
import sys
from pathlib import Path

# 윈도우 콘솔 기본이 cp949라 한글·기호 출력이 막힌다. 파일 입출력은 이미 utf-8 고정.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

# 룰 → (층, 피드백 칸). 사전에 고정한다.
# 집계를 보고 이 표를 고치면 결론에 맞춰 기준을 쓰는 것이 된다.
RULE_BUCKET = {
    "표검산":     ("A 신고 가능", "① 답변 내용이 정확하지 않음"),
    "공시범위밖": ("A 신고 가능", "① 답변 내용이 정확하지 않음"),
    "기준일없음": ("A 신고 가능", "② 설명이 부족함"),
    "예시휘발":   ("A 신고 가능", "② 설명이 부족함"),
    "내부용어":   ("A 신고 가능", "② 설명이 부족함"),
    # 앱에서는 정상 제목으로 렌더된다. 사용자는 이것을 볼 수 없다.
    # CommonMark 위반이라 다른 렌더러에서는 깨지므로 관측은 유지한다.
    "헤더공백":   ("C 안 보인다", "표기 특성 — 앱에서는 정상 렌더"),
    # 추천 문구는 사용자가 본다. 그런데 세 칸은 전부 「답변」에 대한 것이다.
    "재탕T1":     ("B 칸이 없다", "추천 질문 — 완전 일치 반복"),
}
RULES = [k for k in RULE_BUCKET if not k.startswith("재탕")]


def load_turns(conn):
    """채점 결과 두 라운드를 턴 단위로 편다."""
    turns, hits, t2 = [], [], []
    for rnd in (1, 2):
        data = json.loads((ROOT / f"data/scored-round{rnd}.json").read_text(encoding="utf-8"))
        for key, run in data.items():
            for i, t in enumerate(run["턴"]):
                if not t.get("판정"):        # 이관 등으로 기록이 없는 턴
                    continue
                n = i + 1
                turns.append((rnd, key, n, run.get("분류"), t["판정"],
                              1 if t.get("진입") else 0, run["딥링크"][i],
                              len(t.get("추천", []))))
                for rule in RULES:
                    for h in run[rule]:
                        if h["turn"] == n:
                            tier, bucket = RULE_BUCKET[rule]
                            # 같은 값이 여러 턴에 반복되면 건수가 부풀려진다.
                            # 회차+값을 고유키로 함께 저장해 나중에 접을 수 있게 한다.
                            val = h.get("값") or h.get("금리") or h.get("근거") or ""
                            hits.append((rnd, key, n, rule, tier, bucket, str(val)[:40]))
            for h in run["재탕"]["T1"]:
                tier, bucket = RULE_BUCKET["재탕T1"]
                hits.append((rnd, key, h["turn"], "재탕T1", tier, bucket, h["문구"][:40]))
            # T2(숫자만 다름)는 결함이 아니다 — 「연 4%」와 「연 5%」는 다른 질문이다.
            # 파라미터 순열 루프라는 패턴의 지표로만 따로 센다.
            t2 += [(rnd, key, h["turn"]) for h in run["재탕"]["T2"]]

    conn.executescript("""
        CREATE TABLE turn(round INT, run TEXT, turn INT, category TEXT,
                          verdict TEXT, entered INT, deeplinks INT, recs INT);
        CREATE TABLE hit(round INT, run TEXT, turn INT, rule TEXT,
                         tier TEXT, bucket TEXT, val TEXT);
        CREATE TABLE t2(round INT, run TEXT, turn INT);
    """)
    conn.executemany("INSERT INTO turn VALUES(?,?,?,?,?,?,?,?)", turns)
    conn.executemany("INSERT INTO hit  VALUES(?,?,?,?,?,?,?)", hits)
    conn.executemany("INSERT INTO t2   VALUES(?,?,?)", t2)
    return len(turns), len(hits), len(t2)


QUERIES = {
    "층별_건수와_고유수": """
        SELECT tier AS 층, COUNT(*) AS 건수,
               COUNT(DISTINCT run||'|'||rule||'|'||val) AS 고유,
               COUNT(DISTINCT round||run||turn) AS 턴수
        FROM hit GROUP BY tier ORDER BY 층
    """,
    "A층_피드백_칸별": """
        SELECT bucket AS 칸, COUNT(*) AS 건수,
               COUNT(DISTINCT run||'|'||rule||'|'||val) AS 고유
        FROM hit WHERE tier LIKE 'A%' GROUP BY bucket ORDER BY 건수 DESC
    """,
    "A층_결함이_어느_판정에_있나": """
        SELECT t.verdict AS 판정, COUNT(DISTINCT t.round||t.run||t.turn) AS 턴수,
               SUM(CASE WHEN h.turn IS NOT NULL THEN 1 ELSE 0 END) AS A층결함
        FROM turn t LEFT JOIN hit h
          ON h.round=t.round AND h.run=t.run AND h.turn=t.turn AND h.tier LIKE 'A%'
        GROUP BY t.verdict ORDER BY 턴수 DESC
    """,
    "도달": """
        SELECT CASE WHEN deeplinks>0 THEN '딥링크 있음' ELSE '딥링크 0' END AS 도달,
               COUNT(*) AS 턴수,
               ROUND(100.0*COUNT(*)/(SELECT COUNT(*) FROM turn),1) AS 비율
        FROM turn GROUP BY 도달
    """,
}


def main():
    conn = sqlite3.connect(":memory:")
    n_turn, n_hit, n_t2 = load_turns(conn)
    print(f"\n관측 {n_turn}턴 / 히트 {n_hit}건 — SQLite 인메모리로 적재")
    print(f"(재탕 T2 {n_t2}건은 결함이 아니라 파라미터 순열 지표로 따로 센다)\n")

    out = {"턴수": n_turn, "히트수": n_hit, "재탕T2": n_t2,
           "매핑": {k: list(v) for k, v in RULE_BUCKET.items()}, "집계": {}}
    for name, sql in QUERIES.items():
        cur = conn.execute(sql)
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
        w = [26] + [9] * (len(cols) - 1)
        print(f"■ {name}")
        print("  " + " ".join(c.ljust(w[i]) for i, c in enumerate(cols)))
        for r in rows:
            print("  " + " ".join(str(v).ljust(w[i]) for i, v in enumerate(r)))
        print()
        out["집계"][name] = [dict(zip(cols, r)) for r in rows]

    a = conn.execute("SELECT COUNT(*) FROM hit WHERE tier LIKE 'A%'").fetchone()[0]
    b = conn.execute("SELECT COUNT(*) FROM hit WHERE tier LIKE 'B%'").fetchone()[0]
    c = conn.execute("SELECT COUNT(*) FROM hit WHERE tier LIKE 'C%'").fetchone()[0]
    딥0 = conn.execute("SELECT COUNT(*) FROM turn WHERE deeplinks=0").fetchone()[0]
    print(f"■ 요약")
    print(f"  A 신고 가능   {a:>4}건  — 세 칸으로 신고된다")
    print(f"  B 칸이 없다   {b:>4}건  + 딥링크 0인 턴 {딥0}  — 보이는데 신고할 곳이 없다")
    print(f"  C 안 보인다   {c:>4}건  — 도구만 잡는다")
    out["요약"] = {"A_신고가능": a, "B_칸없음": b, "C_안보임": c, "딥링크0_턴": 딥0}

    path = ROOT / "data/feedback-map.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n→ {path.relative_to(ROOT)} 저장")


if __name__ == "__main__":
    main()
