# 정확한 최종 본문 전달163 — 정상 대조와 원래 과제 실패

후보 `0.2.0-rc.13+codex.20260913101917` / `ttak-delivery163`은
**CLOSED/RESTORED**다. 전체 목표는 active / No-Go이며 개별 전달 성공으로 완료하지 않는다.

최종 complete 결과 조회는 현재 연결의 final packet에서 정확한 본문·SHA·범위를
함께 반환한다. native receipt/read와 retained final SHA·purpose를 독립 대조한다.
보류 공지는 notice에만 한정하고 새 본문 저장·도구·모델·교정 예산은 추가하지 않았다.
Codex recipe도 전달된 body를 표시한다. Stop의 전체 본문 SHA는 그대로다.

## 로컬 및 정상 plugin 근거

집중29PASS/0skip, 전체 Node66파일/725PASS/0skip, Python79, conformancePASS.
runtime34파일 중 두 manifest·verification·MCP·skill5개 변경, helper9/22syntax PASS.
정상 설치·11hook의 정확한 파일/명령/해시 검토와 양쪽 활성화는 PASS다.
generic plugin validator의 기존 호스트별 MCP 경로 문제는 UNRUN으로 보존했다.

| 대상 | 실제 결과 | 시간 | 관측 tokens |
|---|---|---:|---:|
| Haiku Nori | 두 native 검증·정확한 delivery·3문장·Stop PASS |60374ms|294328|
| Luna Nori | 두 native 검증·정확한 delivery·2문장·Stop PASS |86004ms|187394|
| Haiku 원래 complex | 두 native 검증·정확한 delivery 후 본문 변경·교정 실패 |112681ms|424157|

정상 대조는 첫/둘째 읽기7, 남은 값7을 정확히 설명했고 금지된 보장을 추가하지 않았다.
원래 complex도 원문 SHA, 계산형 fact 제출, 최종9항목 결과, 두 receipt/read가
실제 native 기록과 일치했다. 별도 preview나 verifier 재실행은 없었다.

## 원래 complex의 실패

검토된 본문5978 bytes가 그대로 조회됐지만 첫 사용자 본문5960 bytes에서는 표의
마지막 열 구분선이19개 하이픈에서3개로 바뀌고 마지막 newline2개가 제거됐다.
Stop은 전달 교정을 요구했다. 부모는 본문 대신 승인됐고 일치한다는 주장만 출력했다.
두 번째 Stop은 continue:false로 중지했고 retained outer/attempt 모두 unavailable이다.
Stop 기록3개는 실제 호출2개다. 마지막 hook_success는 hook 프로세스의 정상 종료이지
검사 통과가 아니며, 그 stdout 자체가 continue:false다. CLI exit0/success도 출하 성공이 아니다.

의미 검증도 실패했다. fact가 계산 내용을 반복하며 두 구현 대안을 덧붙였고,
최종 검증자는 다음 결함을9pass/issue0으로 오승인했다.

- 다른 행이 아니라 다른 열이라는 이유로 행 단위 쓰기 충돌이 없다고 추론했다.
- Repeatable Read 잠금 예시에서 상대가 변경한 행을 기다린 뒤 재시작 없이 새 값으로
  읽는다고 설명했다. snapshot 이후 바뀐 행의 오류 조건과 맞지 않는다.
  [PostgreSQL18 Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- SSI에서 deadlock이 불가능하다고 일반화했다. 비차단 predicate 감시는 다른 잠금과
  deadlock 가능성을 제거하지 않는다.
  [PostgreSQL18 Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- 대기 시간을 holder의 전체 트랜잭션 실행 시간과 같다고 했다. 늦게 도착한 waiter는
  남은 보유 구간만 기다릴 수 있으므로 그 등식은 성립하지 않는다.

공식 문서 대조이며 실제 DB 시험은 아니다. 첫 SessionStart→최종 결과 조회는97681ms;
이는 native hook 관측 시간이며 backend 원인의 측정은 아니다.

## 정산·복원과 다음 수정

native10 중5시작, 상한12 중7미사용, 후속5 UNRUN. 관리8/8 중 복원2, 내부66 중6검증자.
완료 응답38, input887703 + output18176 = **905879 tokens**. thinking7327은 output
부분집합이며 각 native terminal 사용량과 대조했다. 누적 **1026 = Claude614 + Codex412**.
모든 Job 정리와 process0·프로필 선택 복원을 확인했고 ON 파일2개만 원래 부재로 되돌렸다.
cache·retained 증거와 과거 예약/실패는 보존했다. 중간 OFF 제거·native cancel 성공 주장은 없다.

근거 `.superpowers/release-loop-163/`: `batch-closed.json`, `full-qualified-final/result.json`,
`config-restored.json`, `own-state-restored.json`, 정상 두 행의 `completion-audit.json`,
원래 행의 `failure-audit.json`·`review.json`. 실패 감사 SHA256:
`0ed3569aef7a5e14781bcaf1c8d575ab066833b36f4647021f9dde45a36b513a`.
최초 completion auditor는 Stop 기록 수에서 실패했으며 결과 파일을 만들지 않았다.
별도 실패 감사가 실제 두 Stop·continue:false·unavailable·사용량을 검증했다.

다음 조사에서는 fact 검증자가 witness는 보지만 계산기가 구성할1829-byte 사실
본문과 그 완화책·조건·비용을 보지 못한다는 차이를 확인했다. 보충 사실이 정말
필요한지 판단할 때 이 실제 계산 본문을 제공하는 경로를 검증한다. 승인된 본문을
Stop에서 정규화해 수용하지 않는다. 원래192/516 및 나머지 출하 조건은 계속 UNRUN이다.
