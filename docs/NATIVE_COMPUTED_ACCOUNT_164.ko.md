# 계산 본문의 사전 제공164 — fact 범위와 최종 작성의 분리

후보 `0.2.0-rc.13+codex.20260913104538` / `ttak-account164`은
**CLOSED/RESTORED**다. 원래 과제의 실제 전달은 통과했으나 의미 오류와 오승인이 남아
전체 목표는 active / No-Go다.

## 변경과 검증

fact 검증자에게 계산기가 실제로 넣을 본문·모델 SHA·본문 SHA를 사전에 제공한다.
원문, 기존 witness·edge·source 위치와16000/48000-byte 제한은 유지했다. 동일 모델의
본문만 중복 제거하며 최종 검토 packet에는 실제 fact가 있으므로 다시 추가하지 않는다.
새 본문은 실제 DB·실측이나 일반 의미 인증으로 승격되지 않는다.

RED0PASS/6FAIL → 집중178PASS/0skip. 전체 Node67파일/732PASS/0skip, Python79,
conformancePASS. runtime34파일 중 두 manifest와 source-model·verification4개 변경.
helper9검사/23syntax PASS, generic plugin validator의 기존 경로 문제는 UNRUN으로 보존했다.

원래6240-byte 요청과 witness는 동일하다. packet16542→18696 bytes에 계산 본문
1829 bytes가 추가됐다. SHA는 `c356d73494d269ad84dba91cf1cfcaae51b56ccf5f592834e857ded8c388669b`.

## 정상 plugin에서 관찰한 결과

정상 등록·설치·11hook 검토·양쪽 활성화 후 원래 Haiku complex를 실행했다.
실제 fact packet의 사전 본문·원문·witness, 계산형 제출과 두 native receipt/read를
고정 소스로 재계산해 대조했다. fact2480 bytes는 계산 본문과 모델 범위·직렬 조정
비용의 보충 문장으로 구성됐다. 이번 보충 문장은 SQL/SSI 대안을 추가하지 않았다.
이는 이번 관측이지 여러 실행에서의 인과적 품질 보장은 아니다.

부모가 제출한 final과 실제 사용자 본문은 정확히 같았고 Stop은 교정 없이 통과했다.
시간116498ms, preview0, 독립 검증자2개. 하지만 최종 검증자는 아래 결함을
9pass/issue0으로 오승인했다.

- 쓰기 충돌이 없는 이유를 각 트랜잭션 자신의 read/write 집합이 겹치지 않는다는
  것으로 설명했다. 충돌 검사는 트랜잭션 사이의 쓰기 집합을 비교한다. 별도 유한
  반례에서 두 트랜잭션이 모두 B를 읽고 A를 쓰면 각자의 read/write는 분리돼도
  두 번째 커밋은 write_conflict_abort였다.
- 모델의 전체 트랜잭션·snapshot 조정을 PostgreSQL FOR UPDATE로 구현한다고
  옮겼다. 제시한 T1의 B행 잠금은 T2가 다른 A행을 먼저 읽고 잠그며 snapshot을
  얻는 것을 막지 못한다. 행 잠금이 snapshot 취득 전의 전체 조정이라는 근거도 없다.
- Serializable 예시의 기다림이 같은 트랜잭션에서 상대의 변경값을 보게 한다고
  단정했다. snapshot 뒤 변경된 행에 대해서는 오류와 전체 재시작이 필요할 수 있다.
  [PostgreSQL18 Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html),
  [Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)

실제 DB를 실행하지 않았다. guard가 거짓일 때 “write를 abort한다”는 표현은 이전
평가 정정을 유지하여 별도 확정 오류로 세지 않았다. 부분 prose 보고0건은 인증이 아니다.

## 정산·복원과 다음 수정

native10 중3시작, 상한12 중9미사용, 후속7 UNRUN. 관리8/8 중 복원2.
내부66 중2검증자, 완료 응답13. input364008 + output9307 = **373315 tokens**.
thinking3804는 output 부분집합이며 native terminal 사용량과 대조했다.
누적 **1029 = Claude616 + Codex413**. 163 정상 대조는164에 전용하지 않는다.

소유 Job 정리·process0과 프로필 선택 복원을 확인했고 ON 파일2개만 원래 부재로
되돌렸다. cache·retained 증거는 보존했다. 중간 OFF 제거·native cancel 시험은 없었다.
근거 `.superpowers/release-loop-164/`: `batch-closed.json`, `full-qualified-final/result.json`,
`config-restored.json`, `own-state-restored.json`, 원래 행의 `completion-audit.json`과
`review.json`. 품질 review SHA256:
`d6fdeac0afb0c73d25eb8a46e0d54ab2f7185b292aac2ff0533e957da6b0f6d7`.

다음은 이미 필요한 사실이 갖춰진 경우 그 실제 fact 본문에 연결해 최종 제안을 구성하는
경로다. 독자·언어·형식에 맞춘 작성이 필요하면 기존 작성 경로를 유지하고, 어떤 경로든
전체 원래 요구·독립 최종 검토·정확한 전달을 그대로 검사한다. 원래192/516과 나머지
필수 출하 조건은 미완료다.
