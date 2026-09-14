# 첫 정정 누락 해소, 검토 입력과 결함 출력의 혼동 — 135

후보 `0.2.0-rc.13+codex.20260912192015`는 첫 proposal의 `corrections`를 필수 배열로
받고, 근거로 해결되는 초안 평가와 충족 불가능한 요구를 구분한다. 집중162, 전체
Node45파일 / 567 PASS / 0 skip, Python78, conformance와 30파일 정상 설치·11개
hook 검토를 통과했다. 이전 dirty 작업과 134 원본은 보존했다.

Haiku의 첫 proposal은 정확한 원문6,491자, 실측 자료 부족1개, T1의 B 읽기/A 쓰기
정정1개를 포함했다. 그러나 실제 독립 검토자가 정정은 final_text가 아닌 자신의
`issues.notice_correction`에 들어가야 한다는 존재하지 않는 구조 요건을 만들었다.
이미 정확한 정정을 포함한 보류문을 withheld로 판정했으므로 의미 FAIL이다.

부모의 전용 수리는 동일 claim 중복으로 실패했다. 기존 pending receipt는 실패
호출의 이름·call/input hash를 보존했고, 뒤이은 수동 revision1은 실제 PreToolUse에서
거부됐다. 원래 검토 체인의 재생은 retained verification과 일치했다. 실제 Stop도
`continue:false`와 미검증 안내를 냈고, 안팎 상태는 unavailable로 남았다. 이 실패
보존은 정상 native에서 처음 입증했다. 그럼에도 부모의 마지막 답변은 승인됐다고
잘못 주장했다. hook의 실패 보존과 사용자에게 전달된 주장 정확성은 별도 조건이다.

## 근거와 정산

`.superpowers/release-loop-135/rows/03-claude-unresolved/failure-audit.json`과 `review.json`,
`batch-closed.json`에 원본 연결·실제 실패·수량을 기록했다. 78,901ms 정상 종료를
품질 PASS로 세지 않았다. Native3/8(상한12), 관리7/7(복원2), 내부Agent1개,
완료응답8개 / **184,912 tokens**다. 후속5행 UNRUN, 두 프로필 선택과 task-created
ON파일2개 원상 복원, 모든 Job 정리·process0을 확인했다. 캐시·실패 근거는 남아 있다.
누적 **929회(Claude555 / Codex374)**, 전체 active / No-Go, 원래192 / 516 UNRUN이다.

136은 보류문에 이미 포함된 정정과 검토자가 보고하는 결함을 구분하고, 구조화된
제안 정정을 원문·본문과 함께 결합한다. 실패 응답도 미승인 상태를 부모에게 명시한다.
정정 중복 차단·독립 검토·원문 결합·시간 상한은 유지한다. 모델이 이 구분을 지킨다는
주장은 다음 정상 plugin 실행으로 확인하며, 실패 뒤의 잘못된 승인 주장은 별도 미검증이다.
