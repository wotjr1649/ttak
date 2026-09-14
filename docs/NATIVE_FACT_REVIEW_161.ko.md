# 실제 fact별 부분 대조161 — 정상 전달과 원래 과제 실패

후보 `0.2.0-rc.13+codex.20260913084004`, namespace `ttak-facts161`은
**CLOSED/RESTORED**다. 정상 대조는 양쪽 통과했으나 원래 Haiku complex에서
오승인과 최종 답변 전 timeout이 남아 전체 출하 목표는 active / No-Go다.

## 변경과 로컬 근거

기존 모델 기반 prose 검사를 최종 제안뿐 아니라 실제 fact 본문에도 적용한다.
fact ID·실제 결과 SHA·원래 본문 위치를 결합해 최종 검토자에게 전달하며,
원문·실제 fact·제안은 변경하지 않는다. PostgreSQL18에서 SQL 행 잠금이 동시
snapshot 자체를 방지한다는 일부 명확한 표현도 보수적으로 검사한다. 부정·인용·
가정·다른 구현·별도의 전체 트랜잭션 조정은 확정 오류로 분류하지 않는 대조를 넣었다.
이 좁은 검사나0건 결과는 전체 문장의 사실성 인증이 아니다.

집중 RED117PASS/4FAIL → GREEN121PASS, 정상 Stop 대조 추가 후122PASS/0skip.
160의 실제 원문·fact·제안 로컬 재생에서 이전에는 없던 잠금 과장 보고를 각각1건
확인했다. 최종 전체 Node63파일/702PASS/0skip, Python79PASS, conformance PASS.
후보34파일 고정, helper9검사/23syntax PASS. 공용 plugin validator는 기존
per-host MCP 경로 불일치로 UNRUN이며 과거 FAIL 기록을 지우지 않았다.

## 정상 plugin 관측

정상 등록·설치·11hook의 정확한 파일/명령/해시 검토·활성화는 양쪽 PASS다.

| 대상 | 본문과 실제 경로 | 시간 | 관측 tokens |
|---|---|---:|---:|
| Haiku Nori |3문장, 두 읽기와 남은 값7, 실제9항목 제출·receipt/read·Stop |62215ms|286603|
| Luna Nori |2문장, 두 읽기와 남은 값7, 실제9항목 제출·receipt/read·Stop |77253ms|176903|
| Haiku 원래 complex |fact·최종 검토 제출/반환·부모 결과 조회, 부모 final/Stop 미관측 |120초 timeout|323282|

각 정상 대조는 독립 verifier2개를 실제 실행했고 preview와 반환 보정은 없었다.
정확한 native 상태 전이 재생이 retained attempt와 일치했다. 이 대조 결과를
원래 complex H/Q나 미실행 후속 과제의 성공으로 전환하지 않는다.

complex에서도 새로운 `model_fact_reviews`가 실제 packet으로 전달됐다. 그러나
이번 표현은 지원하는 부분 검사에 걸리지 않았고 최종 검토자가 아홉 항목을 모두
pass로 제출했다. 반환과 부모 결과 조회까지 첫 SessionStart hook 기준114901ms가
걸렸다. 이는 관측 이벤트 간 시간이지 backend 지연 원인이나 정확한 잔여 시간의
측정은 아니다. 부모 최종 답변과 Stop 전에 전체 제한으로 종료됐다.

## 원래 과제의 미해결 결함

- fact는 “서로의 쓰기 대상을 읽지 않는다”고 하면서 동시에 T1이 B를 읽고 T2가
  B를 쓰며 T2가 A를 읽고 T1이 A를 쓴다고 설명한다. 원문·계산·자체 설명과 모순이다.
- fact는 A→B의 전역 잠금 순서를 말하면서 실제 첫 잠금을 T1:A, T2:B로 썼다.
  이 절차는 주장한 동일 획득 순서가 아니다.
- fact와 제안은 명시적 잠금에 대해 deadlock 외에는 재시도가 불필요하다고
  과장한다. PostgreSQL18의 Repeatable Read/Serializable에서는 잠글 행이
  트랜잭션 시작 뒤 바뀌었다면 오류가 날 수 있다. 잠금 자체가 모든 snapshot을
  새로 만드는 것도 아니다. [PostgreSQL18 Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)

마지막 항목은 공식 문서 대조이며 실제 DB 시험은 아니다. 모호한 SSI 추가 검사나
guard 중단 표현은 이번 확정 결함에 포함하지 않았다. H/Q의 의미 오류와 미완료
사용자 본문을 유지하며, 단순 형식 성공이나 부분 검사0건으로 전체 성공을 주장하지 않는다.

retained outer status는 pending, 내부 attempt는 complete/final returned였다.
후자는 제출·반환·조회된 승인 상태를 나타내며 사용자에게 최종 답변을 전달했다는
증거가 아니다. 실제 부모 final/Stop은 미관측이고 Job 정리는 native cancel이 아니다.

## 정산·복원과 다음 조사

새 native10 배정 중5시작, 상한12 중7미사용, 후속5행 UNRUN. 관리8/8 중 복원2.
내부 verifier66 상한 중6시작, 완료 응답35. input768785 + output18003 =
**786788 tokens**를 관측했다. thinking8375는 output의 부분집합이다.
complex의 미보고 in-flight 사용량 가능성이 있어 이를 확정 총사용량으로 보지 않는다.
누적 상위 native는 **1018 = Claude609 + Codex409**다.

모든 소유 Job의 정리와 잔여 process0을 확인했다. 두 프로필 선택을 원래대로
복원하고 후보를 비활성화했으며, 배치가 만든 ON 파일2개만 원래의 부재 상태로
되돌렸다. 설치 cache와 retained 증거는 보존했고 세션 중간 OFF 제거 시험은 없었다.

근거 루트 `.superpowers/release-loop-161/`: `batch-closed.json`,
`full-qualified-final/result.json`, `local-replay-160.json`, `config-restored.json`,
`own-state-restored.json`, 정상 두 행의 `completion-audit.json`·`review.json`,
원래 complex 행의 `process.json`·`recovered.json`·`failure-audit.json`·`review.json`.
실패 감사 SHA256은 `04684148b624a033368bcd3a9ddcdb724e17e5b7b8d5ee92ae2cc01a80838980`다.

다음은 source에 결합된 사실 답변 구성·전달 구간이다. 계산 결과를 다시 자유문장으로
생성하고, 부모가 또 긴 제안으로 확장하는 과정에서 오류와 시간이 늘어났다.
새 문구 패턴 추가만으로 해결됐다고 보지 않으며 독립 검증·전체 출하 기준·실행 한도는
유지한다. 전체 비교 수집기의 고정 binary·정상 autoload·두 프로필 조건 선택 이식도
남아 있다. 원래192/516 비교는 아직 UNRUN이며 과거 준비·예약을 재사용하지 않는다.
