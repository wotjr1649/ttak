# Haiku 보류 통과와 Luna 원문 범위 불일치 — 133

후보 `0.2.0-rc.13+codex.20260912184027`에서 검토 전용 target을
`notice_correction.resolves_request_quote`로 일원화했다. 출력용 corrections의
3필드는 유지하며 target은 별도 검증 후 정확히 대응되는 unresolved 항목에만 적용한다.
집중160, 전체 Node45파일 / 565 PASS / 0 skip, Python78, conformance를 통과했다.
132에서 실제 거부된 nested 입력은 새 순수 parser에서 수용됐고, 형제 위치는 거부됐다.
이를 native 정정 실행으로 세지 않았다.

## Haiku: 원래 보류 과제 PASS

66,779ms에 필수 실측 자료만 미해결로 남기고 T1이 B를 읽고 A를 쓴다는 평가를
별도 corrections에 넣었다. 독립 검토자1개가 전체 원문과 실제 보류문을 대조했고,
정확한 native receipt·결과·보존 상태가 일치했다. 초기 제안이 이미 정정을 포함해
새 수리 도구는 이 행에서 UNRUN이다. 완성 설명 H/Q를 보류로 통과시키지 않는다.

부모는 한때 승인 문구에 형식 변경과 숫자 요구를 빼자는 제안을 덧붙였다. Native Stop이
이를 거부하고 1회 전달 교정 뒤 정확한 승인 본문이 반환됐다. 그 앞의 보이는 메시지는
삭제되지 않았으며 승인된 본문으로 세지 않았다. 근거는 `rows/03-claude-unresolved/`
아래 `withholding-audit.json`과 별도 의미 판정 `review.json`이다.

## Luna: 자동 환경 문맥을 사용자 원문에 넣어 FAIL

첫 native 코드의 request literal은 자동 주입 `environment_context`를 포함한
7,084자였다. 원래 과제 6,491자는 그 뒤에 정확히 들어 있었으나, 전체 입력은 원래
UserPromptSubmit 해시와 달랐다. PreToolUse가 이를 거부했다. 모델이 두 번째 호출에
정확한 원문만 전달했어도 이미 실패한 시도라 다시 거부됐다. 보류 검토자 시작은0개,
새 검토 결과는 UNRUN이다. 120,006ms timeout 뒤 소유 process0 정리를 확인했다.

`rows/04-codex-unresolved/failure-audit.json`은 두 literal의 길이·해시와 실제
거부2개를 기록한다. 모델 생성 코드는 실행하지 않고 검토된 raw literal만 추출했다.
첫 입력의 자동 prefix를 제거하면 정확한 원문이 남지만, 실패한 native 세션을
그 방식으로 재시도하거나 복구하지 않았다.

## 정산과 다음 작업

실제 자료 루트는 `.superpowers/release-loop-133/`이다. Native4/8(상한12), 관리7/7
(상한12, 복원2/2), 내부Agent1개, 완료응답11개 / 217,718 tokens다. Luna timeout의
미보고 진행 중 사용량 가능성이 남는다. 후속4행 UNRUN, 두 프로필 기존 선택·후보
비활성화·task-created ON파일2개 부재 복원, 모든 Job 정리·process0을 확인했다.
누적 native922회(Claude551 / Codex371). 전체 active / No-Go, 원래192/516 UNRUN이다.

134는 request 계약에서 사용자 과제 본문과 자동 host metadata·skill-loading 문맥을
구분한다. 사용자 본문 안의 모든 산문·인용·자료는 유지한다. 문자열의 environment
태그를 자동으로 삭제하거나 원문 해시 검사를 완화하지 않는다. 이 지침의 실제 효과는
새 후보의 첫 Luna 호출로 판별하며, 남은 동일 후보 검증을 계속한다.
