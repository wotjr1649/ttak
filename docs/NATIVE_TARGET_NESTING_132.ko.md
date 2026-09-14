# 부모 호출 receipt 보강과 검토 정정 target 위치 실패 — 132

후보 `0.2.0-rc.13+codex.20260912182848`은 부모 PreToolUse에 도구명·호출ID해시·
입력해시만 저장하고 일치하는 정상 PostToolUse가 와야 해제한다. 실패 MCP 호출에
PostToolUse가 없는 호스트에서도 다음 호출과 Stop이 누락을 검출한다. 고정 Codex의
schema에 없는 이벤트를 공통 hook에 추가하지 않았다. 관련 정상/반례 집중159,
전체 Node45파일 / 564 PASS / 0 skip, Python78, conformance를 통과했다.

Claude의 별도 MCP 실패 이벤트는 [공식 hook 문서](https://code.claude.com/docs/en/hooks#posttoolusefailure)에서,
Codex의 PostToolUse는 [공식 문서](https://learn.chatgpt.com/docs/hooks#posttooluse)와
고정0.154.0 로컬 schema를 함께 확인했다. 현재 공식 문서를 과거 binary 실행 증거로
간주하지 않았다. 새 receipt의 실제 누락-반환 실패 경로 자체는 아직 미검증이다.

## 정상 plugin 결과

두 활성화·11개 hook 신뢰 검토·30파일 일치 후 Haiku가 원래 보류 과제를 수행했다.
초기 부모 MCP 호출의 정상 반환과 receipt 해제는 관측됐다. 첫 검토자는 T1 정정 및
해결되는 원래 요구 인용을 올바르게 골랐으나, `resolves_request_quote`를 issue의
형제 필드가 아닌 `notice_correction` 안에 넣었다. strict parser가 첫 제출을 거부했다.

이후 제출2개, 다른 Agent 시도1개, 수리 시도1개도 모두 거부됐다. 실제 검증자는1개,
native typed 결과 수용은0개다. child는 4-turn 제한에서 PARTIAL로 반환됐으며 완료
결과로 간주하지 않았다. unavailable 상태와 실제 Stop의 `continue:false` / 미검증
안내가 일치했다. 정상 종료117,630ms를 품질 PASS로 바꾸지 않는다. 최종 부모 본문은
주어진 자료로 해결되는 T1 평가를 여전히 추가 확인이 필요한 것으로 설명해 FAIL이다.

실제 자료는 `.superpowers/release-loop-132/rows/03-claude-unresolved/failure-audit.json`.
감사 도중 PARTIAL Agent 응답의 추가 블록과 하나의 Stop에 두 attachment가 존재함을
확인해 해당 형식을 반영했다. 원래 native 효과를 재실행하거나 실패 필드를 지우지 않았다.

## 정산과 후속

Native3/8(상한12), 관리7/7(상한12, 복원2/2), 내부Agent시도2/실제1, 완료응답9개 /
194,898 tokens. 후속5행 UNRUN. 두 프로필 기존 선택·후보 비활성화·task-created
ON파일2개 부재 복원, 소유 Job 정리·process0을 확인했다. 원본·캐시는 보존됐다.
누적 native918회(Claude549 / Codex369), 전체 active / No-Go, 원래192/516 UNRUN이다.

133은 target과 정정을 한 객체에 함께 둔다. `corrections`의 출력용3필드는 유지하고,
검토 전용 target만 분리 검증해 정확한 unresolved 항목에 적용한다. 양쪽 위치를 모두
허용하거나 추가 필드를 무시하지 않는다. 해시·원문·한 번의 수정·새 독립 검토 조건은
유지하며, 같은 실패 세션에서 결과를 재제출하지 않는다.
