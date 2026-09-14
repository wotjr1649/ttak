# 사실 우선 작성 151

목표 **active / No-Go**. 후보 `0.2.0-rc.13+codex.20260913024714`는
정상 원문으로 사실 검증을 먼저 시작하는 경로를 실제 입증했지만, 원래 복합 설명은
**FAIL_TIMEOUT_AND_SEMANTICS**다. 개별 전달 통과를 출하 완료로 계산하지 않는다.

## 변경과 검증

정상 `explanation_prepare`는 원문과 두 binding 필드만 받는다. 선행 부모 초안 없이
하나의 독립 REQUEST_FACTS를 만들고, 결과를 검토한 부모가 정확한 final을 제출한다.
새 모드의 `preparation=request_facts`, `draft_sha256=null`만 명시적으로 허용한다.
기존 draft/structured compiler, 원문 SHA, 실제 fact receipt, 새 final verifier,
정확한 본문·Stop 결합, 보류·실패·재개·단일 수정 제한은 보존했다.

`writing-for-agents`·`skill-creator`에 따라 사실 우선 순서를 shared skill과 해당
경계 안내에 반영했다. `plugin-creator`의 기본 UTC cachebuster와 정상 설치를 사용했다.
새 원문이나 부모의 답을 만들어 검증자에게 넣지 않았으며, 도구/권한/외부 경로를 늘리지 않았다.

새 테스트 red 4 FAIL 뒤 구현했다. 집중 236 PASS, 전체 Node 53파일/641 PASS/0skip,
Python 79, conformance PASS다. 기존 native 전달·결과·최종 검증 반례와 새 모드의
불완전/혼합/변경 입력 및 검사 없는 완료 거부를 확인했다. skill·marketplace helper,
수집기 7, 실행 인수 2, 로컬 보류/재개 상태 검사도 PASS다. 범용 plugin helper의 기존
per-host MCP 경로 비호환은 과거 FAIL을 보존하고 UNRUN으로 두었다.

## 정상 실행 관측

두 호스트 정상 설치·ON 활성화와 31파일·11hook 신뢰를 확인했다. Haiku는 3필드 prepare,
독립 fact, 원래 scenario를 넣은 scenario_review, 참조 기반 final, 독립 FINAL0 순으로
진행했다. FINAL0 packet을 읽은 뒤 120,014 ms에 timeout. final 결과·Stop·완료 본문은
UNRUN이고, 실제 native 취소를 관측했다고 주장하지 않는다.

원문 SHA `414f92ef155cdac2f0fdf37cddcf80562828bb1ad198e803110b661933ea5544`,
각 packet·결과·자식 ID·native 반환을 재생해 실제 retained pending 상태와 일치했다.
감사 SHA는 `ebfa9722b7f0c9929f39a572192ee14f033db0f8312ef77dd3ed0138c60cd104`다.

그와 별개로 H2/Q1 의미 오류가 있다.

- fact와 제안 final이 교차 읽기/쓰기 의존성을 부정했다. 원래 모델에서 T1은 T2가
  쓰는 B를 읽고, T2는 T1이 쓰는 A를 읽는다. 쓰기 집합끼리의 비중첩과 다르다.
- serial/재시도 설명이 guard_false의 무갱신을 자동 abort로 바꿨다.
- 제안 final이 Repeatable Read를 PostgreSQL 기본으로 부르고 Serializable을 모든
  교차 행 불변식의 필수 해법으로 일반화했다. 기본은 Read Committed다.
  [PostgreSQL18 isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- false abort의 희소성과 제거 불가능한 retry 비용 하한을 근거 없이 단정했다.
- 정상 scenario_review는 39구간을 미검사, **평가 구간 0**으로 반환했다. 부모의
  검증 성공 해석은 잘못이며 이 도구의 부분 검사로 의미 정확성을 인증하지 않는다.

## 정산·복원과 다음 계층

새 native 배정8/실제3/상한12, 후속5 UNRUN, 상한 미사용9. 관리7/상한12,
복원 예약·사용2. 내부 상한44/실제 Agent2, 완결 응답9,
관측 **212,978 tokens**(input205,676 + output7,302; thinking2,165는 output 일부).
실행 중 미보고 사용량 가능성을 남겼다. 새 누적 **983(Claude588 / Codex395)**다.

소유 Job 정리·프로세스0, 두 프로필 기존 선택 복원, 시험이 만든 ON 파일2개의
원래 부재 복구를 확인했다. 근거·캐시는 보존했다. 세션 중간 OFF 주입 제거는 하지 않았다.
원래 **192 subjects / 516 requests** 및 과거 실패·예약·UNRUN은 별도 이력이다.

다음은 원문에 명시된 모델을 자동 계산해 사실/최종 검사에 출처와 함께 결합하는
의미 근거 계층이다. 모델 적용 범위와 실제 DB 주장은 구분하고, 독립 검사를 유지한다.
151 재실행이나 발견0/시간 감소를 성공으로 계산하지 않는다.

근거: `.superpowers/release-loop-151/`의 DESIGN, known-semantic-coverage,
manifest-final, full-qualified, rows/03-claude-complex/timeout-recovery,
timeout-audit, review, management, own-state-restored, batch-closed.
