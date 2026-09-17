# Native 원문 선택 144

143 Luna는 로드된 skill과 원문을 재작성해 첫 요청의 binding을 잃었다. 144는
첫 `explanation_assess_request` / `explanation_prepare`에서 명시적 `request: current`를
정상 Pre hook이 같은 session·turn의 native 원문으로 바꾸는 경로를 추가했다.
변경된 문자열을 정규화하거나 기존 실패한 시도를 되살리는 경로는 아니다.

원문은 host-designated plugin data root로 확인한 같은 profile의 `sessions` 아래에서만
읽는다. 경로·링크·hardlink·regular file·inode·8MiB·1만 entry/line·디렉터리 깊이를
제한한다. 명시적 잘못된 경로는 다른 경로로 재시도하지 않는다. 관측한 0.154.0의
header/session/cwd, 현재 turn의 `user.text`, 기존 UserPromptSubmit 원문 해시가
모두 맞는 유일한 필드만 선택한다. user가 인용한 metadata는 그대로 보존한다.
새 raw 저장소·IPC·서비스·인증 접근·egress는 없다. durable 상태는 hash/metadata다.

[공식 hook 문서](https://learn.chatgpt.com/docs/hooks#common-input-fields)는 transcript
경로를 제공하지만 그 형식은 안정된 API가 아니라고 설명한다. 이 경로는 실제 확인한
0.154.0 형식으로 제한하고 다른 버전·형식은 거부한다. 현재 공식 문서로 고정 binary의
행동을 추정하지 않았다. [PreToolUse 입력 갱신](https://learn.chatgpt.com/docs/hooks#pretooluse)은
기존 정상 MCP 경로에서만 사용한다.

## 로컬 검증과 실제 결과

- 후보 `0.2.0-rc.13+codex.20260912230252`, namespace `ttak-source144`, runtime31파일.
- 초기 신규 검사 FAIL을 보존했다. 집중208 PASS / 0 skip.
- 첫 전체 검사는 공통 skill의 호스트별 문구 때문에 612 PASS / 1 FAIL이었다.
  provider-neutral 검사는 유지하고 문구를 어댑터 규약 참조로 옮겼다.
- `full-provider-neutral`: Node48파일 / 613 PASS / 0 skip, Python78 PASS, conformance PASS.
  앞선 `full-qualified` FAIL과 그때 미실행 Python/conformance를 덮어쓰지 않았다.
- 실제143 transcript의 읽기 전용 재생에서 원문6,491자·기존 해시 일치, 5ms를 관측했다.
- 정상 등록·설치·활성화와 정확한31파일·11hook 검토 후 Luna부터 실행했다.

Luna의 실제 code-mode 호출은 `request: current`였고, 정상 MCP에는 원래6,491자가
전달됐다. 독립 평가의 실제 제출도 수용됐다. 그러나 child는 도구에서 올바른7필드
JSON을 출력한 뒤, 마지막 응답에는 그 내부 `answer`에 해당하는3필드만 반환했다.
정확한 반환 검사는 이를 거부했다. SubagentStop은 경고를 남기고 attempt는 unavailable,
부모의 보류 호출은 Pre에서 거부됐으며 실제 Stop은 stopped였다. 부모는 마지막에
실패한 handoff와 미승인 상태를 인정했다. 그 안전한 실패 고지가 보류 경로 PASS는 아니다.

근거는 `.superpowers/release-loop-144/rows/03-codex-unresolved/failure-audit.json`이다.
원문 선택부터 실제 typed 제출까지 재생했고, 누락된 반환을 거부한 상태와 저장된 상태가
일치했다. 7필드 JSON은 `answer`부터 표시됐고, child 최종문은 그 내부 내용과 정확히 같았다.

## 정산과 다음 행동

배치는 FAIL로 닫았고 후속5행은 UNRUN이다. native3 / 새 배정8 / 상한12,
관리7(복원2) / 상한12, 실제 내부 verifier1, 완료 응답8 / 164,424 tokens,
81,978ms를 관측했다. 누적 native957(Claude572 / Codex385)이다. 모든 소유 Job
정리·process0, 두 프로필 실제 선택 복원을 확인하고 시험 ON 파일2개만 부재로 복원했다.
캐시·등록·실패 근거는 보존했다. 세션 중간 OFF 시험은 하지 않았다.

145는 반환 표시에서 `protocol`·binding 필드를 `answer`보다 먼저 직렬화한다.
canonical 값의 해시, 7필드 요구, SyntaxError에만 허용된 기존 한 번 복사 교정과
거부 조건은 유지한다. 필드를 보충하거나 내부 answer를 검증 결과로 승인하지 않는다.
전체 목표는 active / No-Go이며 양쪽 보류·재개, 정상 완료 H/Q, 실패·취소, 같은 최종
후보의 known/unseen/반복 및 원래192 subjects/516 requests 출하 비교는 남아 있다.
