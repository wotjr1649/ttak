# 재로그인 후 연결 진단 91 — Codex 통과, Claude 수집기 호환 수정

수정 후 Claude 추가 1회의 결과는 [연결 진단 92](NATIVE_CONNECTION_92.ko.md)에 기록했다.

2026-09-11 KST. 사용자가 기존 Codex 시험 프로필의 로그인 완료를 확인한 뒤,
Codex 상위 실행 1회와 Claude 상위 실행 1회를 순차 수행했다. **Codex의 작은 내장
연결 진단은 PASS다. Claude는 초기 도구 이름에 대한 수집기 가정 때문에 중단됐으며,
호환 처리를 로컬 수정했다. 수정 후 native 재실행과 설명 품질 시험은 UNRUN이다.**

제품 rc.13 / No-Go를 유지한다. 이전 누적 728회에 상위 시작 2회를 더한 누적은
**730회(Claude 435 / Codex 295)**다. 이번 Codex 자식 1개는 별도 계수하며 이 누적에
중복 가산하지 않는다. 192 subjects / 516 requests 전체 비교도 미실행이다.

## 실행 조건과 범위

작업 루트는 `D:\AI_DEV\ttak\.superpowers\worktrees\first-release`다.
기존 시험 프로필과 준비한 session-07/08 프롬프트를 사용했다. 두 프롬프트를 수정하지
않았다. 호스트별 상위 시작 1회·독립 자식 1개 요청·120초·자동 재시도 0회를 유지했다.
인증 파일은 읽거나 복사하지 않았다. Codex는 사용자가 재로그인한 시험 프로필의 기존
인증을 사용하고, Claude는 기존 `CLAUDE_CODE_OAUTH_TOKEN` 환경을 그대로 자식 환경에
전달했다. OAuth 값은 출력·기록하지 않았다. 양쪽 모두 API key·별도 공급자 환경을
전달하지 않으며, 사용자 확인인 구독 포함량 전용·추가 유료 사용량 비활성을 유지한다.

Codex CLI는 0.154.0, Claude Code는 2.1.266이다. 활성 Codex 플러그인은 보존된 rc.1,
Claude 시험 프로필의 설치 플러그인은 0개다. 이번 결과는 내장 연결 관측이며 정상
rc.13 plugin 진입이나 TUI의 성공을 입증하지 않는다. 설치·hook·신뢰 설정을 변경하지 않았다.

## Codex — 실제 연결 통과

- 부모: `01a08e38-8284-7b13-9d8f-ef7d96dda364`
- 자식: `01a08e38-e405-7592-9d62-46b224058082`
- 실제 호출: `tools.multi_agent_v1__spawn_agent`, `fork_context: false`.
- 부모와 자식의 native `turn_context` 모두 `gpt-5.6-luna` / `high`다.
- 자식 생성 1개, 지정된 세 줄 질문과 실제 spawn 본문·자식 user 본문이 정확히 일치한다.
- 자식 user 본문에는 부모 전용 표식 `PARENT_ONLY_ORCHID_90`이 없다.
- 자식 결과는 `{"question_id":"Q1","answer":"A","source_id":"S1"}`다.
- 실제 wait 완료, closeAgent 완료, 부모·자식 turn 완료를 확인했다.
- Windows Job은 39,165 ms에 종료됐다. exitCode 0, activeProcesses 0, cleanupVerified true다.

부모 자기 보고만 사용하지 않았다. 실제 custom_tool_call 코드에서 V1 호출과
`fork_context: false`를 확인하고, 별도 자식 rollout 및 수집기 이벤트와 대조했다.
현재 세션에서 노출된 V1과 바이너리에 존재했던 V2 문자열을 구분한다.
`fork_turns="none"`이 실제 실행됐다고 쓰지 않는다.

자식 user 텍스트는 2개이며 지정 질문 외 환경 문맥이 있다. 기본 system/developer
문맥과 전체 요청을 완전히 수집·고정한 것은 아니므로 `full_input_isolation_verified`
및 설명 품질 검증은 false다. 표식 부재만으로 전 문맥의 독립성을 인증하지 않는다.

| native 최종 누적 counter | 부모 | 자식 |
|---|---:|---:|
| inputTokens | 119,799 | 9,744 |
| cachedInputTokens | 79,616 | 1,792 |
| cacheWriteInputTokens | 0 | 0 |
| outputTokens | 1,399 | 21 |
| reasoningOutputTokens | 835 | 0 |
| totalTokens | 121,198 | 9,765 |

서로 다른 thread의 totalTokens 원값 합은 130,963이다. cache와 reasoning 상세를
그 합에 다시 더하지 않는다. 이는 청구 금액이나 독립적으로 확인한 유료 사용량이
아니다. usage 알림 7개는 내부 API 응답 7개라는 증거가 아니므로 API 응답 수는 unknown이다.
짧은 합성 질문도 기본 문맥과 도구 schema 탐색의 비용이 크다는 관측이다. 후속 연결에서는
검증된 V1 경로를 사용해 매번 도구 탐색을 반복할 필요가 있는지 검토해야 한다.

## Claude — 수집기 가정 때문에 중단

세션 ID는 `755a3f51-eccc-466b-8c7b-48d201a5a1a7`이다. 실행 옵션은 Haiku 날짜 포함
모델 ID, `--tools Agent`, `--allowedTools Agent`, `--disallowedTools Agent(fork)`,
stream-json 및 하위 텍스트 전달이다. 외부 MCP를 제공하지 않았다. `--bare`나
permission bypass를 사용하지 않았다.

실제 `system/init`은 모델을 `claude-haiku-4-5-20251001`, tools를 `["Task"]`,
MCP와 plugin 수를 각각 0으로 보고했다. 수집기가 `["Agent"]`만 허용했던 탓에
`unexpected_init`로 중단했다. assistant 응답·자식·usage 알림은 관측되지 않았다.
상위 실행 시간 920 ms, exitCode 1, activeProcesses 0, cleanupVerified true다.
내부 요청 발송 여부나 소비 토큰을 0으로 단정하지 않는다. 해당 UUID로 된 native
프로젝트 transcript 파일은 검색에서 발견되지 않았다.

이는 인증·설명 품질·독립 자식 기능의 실패 판정이 아니다. 현재 실행에서 관측된
`--tools Agent` → `Task` 노출을 처리하지 못한 수집기 호환 오류다.
[수집기](../scripts/connection-probe-claude.cjs)는 Agent 또는 Task 중 정확히 하나의
도구만 허용하도록 수정했다. 추가 도구, 두 이름 동시 노출, fork, 중첩 자식, 재개,
background 요청과 두 번째 자식은 계속 거부한다. 이 수정으로 이전 native 실행을
통과로 바꾸지 않았다.

## 로컬 검사와 보존

[Codex 수집기](../scripts/connection-probe.cjs)는 별도 `codex-attempt-02` 슬롯을 지원하도록
수정했다. 기존 01 슬롯은 보존하고 02도 중복 실행하면 생성 단계에서 거부한다.
Claude 수집기와 [대응 테스트](../tests/connection-probe-claude.test.cjs)를 추가했다.
실행에 사용한 수정 전 Claude 수집기는 `claude-attempt-01/collector-used.cjs`로 보존했다.

최종 양쪽 수집기 관련 **10 PASS / fail 0 / skip 0**다. Task 별칭의 정상 처리와 함께
추가 도구·fork·중첩 자식 거부를 검사했다. 별도 후속 슬롯 전달을 추가한 뒤 Claude
대응 5개도 통과했다. Windows Job은 변경하지 않아 이전 실프로세스 검사 근거를 유지하며
이번 native 실행 두 건에서도 정상 정리를 확인했다. P0 및 제품 전체 검사는 재실행하지 않았다.

```powershell
node --test --test-concurrency=1 --test-timeout=15000 tests/connection-probe.test.cjs tests/connection-probe-claude.test.cjs
```

Codex 기록 대조용 일회성 Python 검사에서 질문 첫 공백을 잘못 없애 비교가 실패했다.
원문 구간을 그대로 선택하도록 검사 코드를 고쳐 실제 본문 일치를 확인했다.
모델을 다시 실행하거나 관측된 본문을 보정하지 않았다.

증거는 `.superpowers/native-connection-90/codex-attempt-02/`와 `claude-attempt-01/`에
있으며 Codex의 `audit.json`은 실제 기록 대조 결과다. 이전 90의 실패·로그인 대기 종료·
준비 기록은 그대로 남겼다. 최신 종합 결과는 같은 루트의 `after-login-outcome.json`이다.
검토는 Root의 로컬 검토이며 독립 블라인드 감사가 아니다.

## 다음 실행

현재 두 슬롯은 종료됐다. 자동 재시도 0회 조건에 따라 Claude를 추가 호출하지 않았다.
수정된 수집기로 Claude만 상위 실행 1회·자식 1개 요청·120초를 새로 실행하는 것이
다음 최소 검사다. 그 범위가 승인되면 아래 준비된 명령을 assistant가 실행한다.

```powershell
node scripts/connection-probe-claude.cjs --run-once --after-tool-alias-fix
```

이 명령의 02 슬롯은 아직 생성하지 않았다. Codex를 재실행하지 않으며, 기존 결과를
Claude 합격 근거로 쓰지 않는다. Claude 연결도 통과한 다음에 P0를 실제 plugin 흐름에
연결하고 설명 품질 시험을 준비한다. 지금 설명 품질·TUI·rc.13 연결은 미검증이다.
