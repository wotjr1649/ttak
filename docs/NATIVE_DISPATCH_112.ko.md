# Native 직접 전달 112

목표는 **active / No-Go**다. `0.2.0-rc.13+codex.20260912105017` 후보에서 Codex의
programmatic native packet 전달을 구현했지만 실제 자식 시작 전 결합 ID 오류로
실패했다. 전달 경로의 실제 완료 성공을 주장하지 않는다. 두 시험 프로필은 복원했다.

부모 MCP의 `explanation_dispatch`가 완전한 packet을 담은 `native_spawn` 인수를 반환한다.
Codex code mode가 이 객체를 그대로 native spawn에 전달하고, 훅은 수락된 정확한
입력 bytes와 실제 자식 ID를 결합한다. 자식은 연결 공유 없이 stateless 결과 제출을
사용한다. Claude는 짧은 launch와 직접 MCP 조회를 유지한다. 새 저장소·백그라운드
서비스·네트워크 endpoint·인증·전역 설정 변경은 없다.

최종 고정 후보는 Node **491 PASS**, Python **78 PASS**, conformance PASS, 수집기
별도 **4 PASS**다. skill·marketplace 검사도 PASS다. 첫 새 테스트의 잘못된 예외 기대는
기존 관련 없는 자식 이벤트의 no-op 계약으로 수정했으며 85 PASS / 1 FAIL 원본을 남겼다.
이 로컬 검사를 실제 전달·의미 품질 검사로 계산하지 않는다.

## 실제 실패

Codex가 첫 `explanation_prepare`에서 시도 UUID의 두 글자를 잘못 옮겼다. 실제 값의
문자 offset 17·21이 달라졌으며 PostToolUse 결합 검사가 실패했다. 같은 원본 입력으로
결합 오류를 로컬 재현했다. 나중에 ID를 올바르게 바꿨지만 이미 실패한 시도를 복구하는
근거는 아니므로 세 번의 Agent 요청이 거부됐다. **실제 verifier는 0개**다.

dispatch 응답 bytes는 고정 compiler와 일치하지만 자식 입력 전달은 UNRUN이다.
Job은 **120,005 ms**에서 timeout으로 정리됐고 최종 설명·최종 판정은 없다.
완결 `collected.json`이 없어 checkpoint와 원본 native 사용량을 감사했다. 이를 정상
완료나 보류 성공으로 처리하지 않는다.

상위 native는 **배정 8 / 사용 3 / 상한 12**다. Haiku 정상 설명·양쪽 보류·양쪽 재개
5행은 UNRUN이며 상한 미사용은 9다. 관리는 **7 / 상한 12**, 복원 몫 2회를 모두
소비했다. 모든 Job 정리와 소유 프로세스 0을 확인했다. 후보 ON 파일 두 개만 원래
부재로 복구했고 모든 증거·실패 기록·캐시는 남겼다. OFF 주입 제거 시험은 하지 않았다.

관측된 완결 모델 응답은 **11개**, 사용량은 입력 188,714 + 출력 5,497 = **194,211
tokens**다. timeout 때 진행 중이던 응답의 미회수 사용량 가능성이 있으므로 정확한
전체 청구 사용량이라고 주장하지 않는다. 내부 Agent는 0개다. 누적 상위 native는
**846회(Claude 507, Codex 339)**다. 과거 실패·예약과 원래 **192 subjects / 516
requests UNRUN**은 새 배정과 분리한다.

다음 113은 모델의 결합 ID 재입력을 제거하는 정상 PreToolUse 입력 연결을 검토한다.
명시적인 `current` 표지만 현재 등록된 시도·후보 값으로 바꾸고, 실제 ID의 불일치,
다른 turn·후보, 실패 상태, 원래 입력·native 결과·최종 본문 검사는 그대로 거부해야 한다.
[Codex hooks](https://learn.chatgpt.com/docs/hooks)와
[Claude hooks](https://code.claude.com/docs/en/hooks)의 지원되는 입력 갱신 계약을 확인했다.
아직 이 다음 경로의 실제 설치·실행 성공은 없다.

근거: `.superpowers/release-loop-112/native-plan-final.json`, `manifest-final.json`,
`full-qualified/`, `rows/03-codex-simple/failure-audit.json`, `batch-closed.json`,
`management/`, `own-state-restored.json`. 원본 transcript와 숨겨진 reasoning 본문은
별도로 복사하지 않았다.
