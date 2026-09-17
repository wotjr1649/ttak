# 계산 사실162 — 실제 원문 결합과 최종 전달 실패

후보 `0.2.0-rc.13+codex.20260913093423`, namespace `ttak-computed162`은
**CLOSED/RESTORED**다. 계산형 fact 제출은 동작했지만 원래 과제의 최종 의미 오류와
본문 불일치의 교정 전 timeout이 남았다. 전체 출하 목표는 active / No-Go다.

## 구현과 로컬 검증

원문 모델이 있는 fact packet은 관련 모델의 정확한 정의·SHA와 보충 사실을
제출한다. 기존 계산기가 모델 사실을 구성하며 actual native 제출·결과 재독해를
준비된 원문 SHA에 결합한다. 다른 모델·위조 SHA·자유문장 대체를 거부한다.
retained state에는 모델 SHA만 추가한다. 모델 없는 설명, 독립 최종 검토,
엄격한 결과·receipt/read·Stop은 유지했다.

깊이16 제한은 유지하고 schema 반복 정의를 루트 `$defs`/로컬 `$ref`로 옮겼다.
집중160PASS/0skip, Node64파일/714PASS/0skip, Python79PASS, conformancePASS.
runtime34파일, helper9검사/23syntax PASS. generic plugin validator의 알려진
호스트별 MCP 경로 문제는 UNRUN이며 정상 설치·runtime 검증은 별도 근거다.

## 실제 정상 plugin 관측

정상 등록·설치·11hook의 파일/명령/해시 검토·양쪽 활성화 후 원래 Haiku complex를
실행했다. 원문6240 bytes와 SHA는 그대로다. 독립 fact와 final 검증자는 각각 한 번
시작·반환했고 부모가 실제 결과를 조회했다. preview·재실행은0이다. source-bound
계산 제출은 실제 응답·native 재독해까지 정확히 재생됐다. 다만 additional_facts가
계산 내용을 반복하고 SQL 구현 설명도 덧붙였다.

최종 검증자는9항목 모두 pass/issue0으로 승인했다. 첫 SessionStart hook부터
최종 결과 조회까지91578ms, 부모 final까지112899ms였다. 부모는 검증받은 본문
앞에 제목 한 줄을 추가했다. 원본 Stop은 불일치를 차단하고 기존1회 전달 교정을
요구했다. 교정된 final이나 성공한 Stop 없이120010ms에 종료됐다. 이 시간은
관측 이벤트 간 차이이며 backend 지연 원인의 측정이 아니다.

## 확정된 결함

- 승인·전달된 본문은 PostgreSQL18 SSI가 predicate lock을 보유하지 않는다고
  설명했다. SSI는 nonblocking predicate/SIRead lock을 사용한다. 비차단과 잠금
  부재는 다르다. [PostgreSQL18 Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- RR/Serializable로 소개한 잠금 예시는 기다리던 트랜잭션이 상대가 변경한 행을
  재시작 없이 새 값으로 읽는 trace를 제시했다. 뒤의 일반적 오류 주의문은 이를
  changed-snapshot 오류 조건과 일치시키지 않았다.
  [PostgreSQL18 Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- 전달 본문은 `## Snapshot Isolation Write Skew Explained`와 빈 줄을 앞에
  추가한 것 외에는 검증 대상과 정확히 같았다. Stop의 SHA 경계는 정상적으로
  차단했다. 이를 허용하도록 정규화하거나 검증을 약화하지 않는다.

공식 문서 대조이며 실제 DB 시험은 아니다. 모호한 동시 시작·strict serializability·
읽기 차단 표현까지 확정 오류로 확대하지 않았다. 부분 prose 보고0건은 인증이 아니다.
내부 attempt complete/final returned는 승인 수신 상태이지 성공한 사용자 전달이나
H/Q 통과를 뜻하지 않는다.

## 정산·복원·남은 조건

native10 배정 중3시작, 상한12 중9미사용, 후속7행 UNRUN. 관리8/8 중 복원2.
내부66 상한 중2검증자, 완료 응답13. input364085 + output9653 = **373738 tokens**.
thinking3913은 output 부분집합이며 미보고 in-flight 사용량 가능성이 있다.
누적 native **1021 = Claude611 + Codex410**. 과거 예약·실패·UNRUN은 재사용하지 않았다.

모든 소유 Job 정리와 process0, 두 프로필 선택 복원을 확인했다. 후보를 비활성화하고
배치가 만든 ON 파일2개만 원래의 부재 상태로 복원했다. cache와 retained 증거는
보존했다. 세션 중간 OFF 제거 시험이나 native cancel 성공 주장은 없다.

근거 루트 `.superpowers/release-loop-162/`: `batch-closed.json`,
`full-qualified-final/result.json`, `config-restored.json`, `own-state-restored.json`,
`rows/03-claude-complex/{process,recovered,failure-audit,review}.json`.
실패 감사 SHA256: `88bae43c10a76526d7711a756d1d6cca475ddadd70323a143fef26d9b4ac0f80`.

다음은 결과 조회 직후의 정확한 본문 전달과 잘못된 보충 구현 설명을 분리해 고친다.
정상·미지·변형·반복·보류·실제 실패 및 중단/재개·네 기능과 혼합 검증, 원래192
subjects/516 requests 비교 등 기존 필수 출하 조건은 계속 남아 있다.
