# 검토 요약 상한 실패 154

목표 **active / No-Go**. 후보 `0.2.0-rc.13+codex.20260913040904`는
**FAIL_REVIEW_SUMMARY_LIMIT**로 종료·복원했다. 입력 상한을 넘긴 동일 호출을 다시
시도하거나 결과를 잘라 수용하지 않았다.

## 변경과 로컬 검증

세 필수 final 검토를 각각400 UTF-8 bytes의 결론으로 제한하고 상세 인용·이유·수정은
기존 issues에 한 번만 보고하도록 했다. issue16 및 각 상세 필드 상한, 전체 요구·주장·
fact 검토, native 반환/receipt/본문 SHA·보류·재개·단일 수정·120초 제한은 유지했다.
반박은 실제 조건의 결과에 근거하고 fact와 final의 문장을 구분하도록 안내했다.

경계 red1 FAIL 후 PASS. 집중248, 전체 **Node55파일/653 PASS/0skip, Python79,
conformance PASS**다. 400/401-byte·Unicode 경계 및 긴 상세 issues의 보존을 확인했다.
32파일 고정·설치와11hook 검토/신뢰, helper/수집기/인수·로컬 lifecycle도 PASS다.
기존 범용 plugin helper 비호환은 과거 FAIL과 현재 UNRUN을 유지한다.

전체 Node 회귀는121,018 ms, 집중 검사는35,025 ms로 이전보다 오래 걸렸다.
종료 후 CPU 단일 관측은16 logical processors에서80%였다. 원인이라고 단정하지 않았고
호스트 설정이나 실행 제한은 바꾸지 않았다. 기록은 local-readiness.json에 있다.

## 실제 결과

Haiku가 원문과 계산 모델을 사용해 fact를 반환하고 정확한 final을 준비했다.
그러나 final 검토 요약은 **802/873/749 bytes**로 모두400을 초과했다.
동결된 compiler의 `verification_content_rejected`를 같은 입력으로 재현했고,
실제 PreToolUse 거부·tool error·미제출 상태가 일치했다. 거부된 최종 결과를 승인하거나
같은 시도를 다시 시작하지 않았다. 115,509 ms에 프로세스는 정상 종료됐다.

Stop 한 사건의 두 attachment는 stopped-continuation과 hook-success였다. 같은
toolUseID이고 stdout은 continue=false / final-check unavailable다. 성공 attachment라는
이름으로 승인했다고 해석하지 않는다. 실제 final receipt는 submitted=false,
전체 상태는 unavailable로 남았다.

부모가 이를 infrastructure/binding 문제로 오진하고 내용상 완성됐다고 주장하며 새 등록을
제안한 점도 정확한 실패 보고가 아니다. 완료된 H/Q PASS는 없다. 검토 전체를 복사하는
전달 구조가 남아 있는데 요약 상한만 줄이는 방법은 실제 호스트에서 성립하지 않았다.

감사 SHA `de0a9ad012527e3c1ef0bcebaeed12ea4865ddd5ce914d4849f12bb71dd52b37`.
failed completion auditor의 거부도 보존했다. 실패 감사의 Stop attachment 가정1개는
실제 동시 식별자와2개 type을 대조해 수정했다. 모델을 다시 실행한 것은 아니다.

## 정산·복원과 다음 조사

새 native8배정/3실제/상한12, 후속5 UNRUN, 상한미사용9. 관리7/상한12,
복원예약/사용2. 내부상한44/Agent2, 완결응답11,
**264,290 tokens**(input254,551 + output9,739; thinking3,508은 output 일부).
실제 전체 model usage와 대조했다. 새 누적 **992(Claude594 / Codex398)**다.

모든 소유 Job 정리·process0, 두 프로필 기존 선택 및 시험 ON 파일2개 원래 부재를
복원했다. 캐시·근거는 보존했고 세션 중간 OFF 주입 제거는 하지 않았다.
원래 **192 subjects / 516 requests** 및 나머지 출하 조건은 미완료다.

같은 Haiku 요약 축소를 반복하지 않는다. 실제 결과를 재복사하지 않고 정확한 참조로
전달할 수 있는 구조를 조사하되 기존 거부를 다른 경로로 수용하지 않는다. 아울러 이
후보에서 아직 UNRUN인 Luna의 정상 경로를 별도 배정으로 확인해 호스트 범위를 분리한다.
개별 배치/검사/보류를 목표 완료로 계산하지 않는다.

근거: `.superpowers/release-loop-154/`의 DESIGN, manifest-final, source-delta,
local-readiness, focused, full-qualified, rows/03-claude-complex/{failure-audit,review},
management, own-state-restored, batch-closed.
