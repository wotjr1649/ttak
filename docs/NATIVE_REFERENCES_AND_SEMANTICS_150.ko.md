# 150 — 원문·fact 참조 전달 PASS, 시간과 의미 FAIL

후보 `0.2.0-rc.13+codex.20260913014400`은 Claude의 원문 선택, 최종 fact 참조,
정상 설명 우선 분기를 연결했다. 새 원문 선택 반례는 수정 전 4 FAIL / 후 4 PASS,
최종 참조는 6 FAIL / 후 6 PASS였다. 기존 호스트 adapter 검사 2개는 새 final 호출
객체를 기대값에 포함하되 외부 호스트 경로·별도 연결 접근 거부를 유지했다.
집중 **231 PASS**, 전체 **Node 52파일 / 636 PASS / 0 skip, Python 79 / conformance PASS**다.

Claude 2.1.266의 실제 command wrapper·external user record를 조사했다. 최신 실제
사용자 기록과 해당 UserPromptSubmit의 hash를 대조하며 이전 일치 기록으로 돌아가지 않는다.
원문에 인용된 wrapper는 원래 hash가 그것을 가리킬 때 그대로 보존한다. 경로·링크·크기·UTF-8·
버전·세션·cwd·완료된 유한 파일 prefix 검사를 유지한다. 새 raw 저장소나 egress는 없다.

최종 참조는 같은 bounded MCP 연결의 원문과 실제 fact 결과를 사용한다. 이것만으로
완료할 수 없으며 Pre는 실제 fact receipt와 수정 횟수를, Post는 원문·모든 실제 결과의
해시·정확한 final packet을 다시 대조한다. 부모 초안은 fact verifier에게 보이지 않는다.
공유 skill은 `writing-for-agents`의 분기 배치 원칙에 따라 정상 절차를 먼저 두고, 근거
부족 절차를 해당 조건 뒤로 옮겼다. 필수 fact/final 및 genuine-gap 검증을 제거하지 않았다.

## 실제 판정

원래 6,240자 복잡한 과제에서 Haiku는 선행 평가 없이 준비를 시작했다. 정상
`request: current`, 실제 fresh fact receipt, 최종 `request/facts: current`, 새 final
packet과 그 native 조회까지 관측·재생이 일치했다. **전달 PASS**다.
그러나 **120,005ms timeout**으로 최종 verdict·전달·Stop은 UNRUN이다.

또한 answered fact 자체에 의미 오류가 있다. T1이 B, T2가 A를 각각 잠그는 단계부터
후자가 대기한다고 주장하지만 다른 행의 잠금은 그 단계에서 충돌하지 않는다. 이후 서로의
행에 쓰려다 deadlock이 생길 수 있다. FOR SHARE의 호환성도 일반화했다.
[PostgreSQL 18 잠금 문서](https://www.postgresql.org/docs/18/explicit-locking.html)를 다시 대조했다.

제안된 최종 본문도 snapshot의 주체·대상을 바꾸고 SSI의 전형적 첫 committer 중단을
꾸며 냈다. [SSI 원본 설명](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/storage/lmgr/README-SSI)은
dangerous structure와 commit-order 조건을 다룬다. 제시된 전형적 victim 주장을 뒷받침하지 않는다.
측정 없이 비용이 대체로 작다고 단정했고, 잠금 대기 후 처리에서 operating mode와
변경된 행 오류 경계를 빠뜨렸다. [격리 문서](https://www.postgresql.org/docs/18/transaction-iso.html)의
RR 갱신·잠금 재시도 조건과 대조했다. 이 본문은 전달되지 않았지만 제안된 내용의 Q1은 FAIL이다.

fact와 부모 모두 요청하지 않은 추가 잠금 대안을 만들었다. 부모는 6,867자 초안을
6,772자로 다시 작성했다. 처음 3,922자와 마지막 1,158자는 같았고, 최종 인자 작성의
관측 thinking-block→tool-block 간격은 21,511ms였다. 분리된 생성 속도 측정이나
정상 완료 지연 개선 주장으로 옮기지 않는다.

## 정산과 다음 조사

새 배정 native 8 / 관리 7(복원 2 포함), 내부 상한 44, 동시성 1. 실제 native 3 /
관리 7 / 내부 시작 2 / 완료 응답 8 / **관측 181,937 tokens**다. 실행 중 미보고 사용량
가능성이 있다. 후속 5행 UNRUN, 미사용 ceiling 9회는 다음 배정과 분리한다. 누적
**980(Claude 586 / Codex 394)**다. 모든 Job process 0, 두 프로필 선택과 task-created
ON 파일 2개 복원, source/frozen runtime 31개 해시를 확인했다. 기록은 보존했다.
Job 종료를 native 취소로 계산하지 않았고, 세션 중간 OFF 시험도 하지 않았다.

다음은 단순 전달 속도가 아니라 fact 범위·주어진 유한모델/출처 검사 계층을 조사한다.
기존 유한 검사와 알려진 102/103 및 새 150의 의미 실패를 연결할 방법, 변경되지 않은
초안을 반복 생성하지 않는 정확한 수정 전송을 함께 검토한다. 의미 결함을 남긴 채 같은
후보를 재실행하거나 transport PASS를 Go로 옮기지 않는다.

근거: `.superpowers/release-loop-150/`의 `batch-closed.json`, `native-source-shape.json`,
`native-source-readback.json`, `full-qualified/`, 해당 행의 `timeout-recovery.json`·
`timeout-audit.json`·`review.json` 및 복원 기록. 전체 **active / No-Go**, **192 / 516 UNRUN**이다.
