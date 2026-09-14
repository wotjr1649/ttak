# 구독 전용 연결 진단 90 — Codex 사용량 제한으로 중단

이 문서는 재로그인 전 첫 실행 기록이다. 이후 결과는
[재로그인 후 연결 진단 91](NATIVE_CONNECTION_91.ko.md)을 본다.

2026-09-11 KST. P0 이후 작은 비대화형 연결 진단을 실행했다. Codex 상위 시작 1회와
턴 요청 1회 후 `usage_limit_exceeded`로 종료됐다. 자식 시작은 관측되지 않았고
Claude·설명 품질은 UNRUN이다. 제품 rc.13 / No-Go를 유지한다.
과거 누적 727회에 이번 상위 시작 1회를 더하면 **728회(Claude 434 / Codex 294)**다.
이는 내부 API 요청·응답 수나 과금 토큰 수가 아니다. 과거 장부는 수정하지 않았다.

## 확정된 진행 방식

- assistant가 비대화형으로 Codex부터 순차 실행한다. Codex 연결 진단 통과 후 Claude를 실행한다.
- 호스트별 상위 실행 1회, 독립 자식 1개 요청, 전체 실행 120초, 자동 재시도 0회다.
- 기존 plan의 포함 사용량만 사용한다. API key 기반 과금, 추가 유료 사용량,
  구매 크레딧 소비나 자동 결제 전환을 허용한 것이 아니다. 한도에 걸리면 중단한다.
- 내부 응답 수와 토큰은 관측한다. 프롬프트나 P0 장부가 호스트 내부 hard cap을
  강제한다고 주장하지 않는다. 자식 1개도 현재는 요청 정책이며 강제 경계는 미검증이다.
- 연결 실패와 설명 품질 실패를 분리한다. 연결 통과 전 설명 품질 시험은 UNRUN이다.
- TUI는 이후 별도 흐름 검사다. 사용자가 실행할 때 경로·프롬프트를 제공하고 session ID를
  받는다. 비대화형 성공으로 TUI 성공을 대신하지 않는다.

## 이번 준비물

작업 경로는 `D:\AI_DEV\ttak\.superpowers\worktrees\first-release`다.

| 호스트 | 준비한 프롬프트 | 실행 상태 |
|---|---|---|
| Codex | [session-07](prompts/2026-09-11-session-07-codex-connection.md) | STOPPED_USAGE_LIMIT |
| Claude | [session-08](prompts/2026-09-11-session-08-claude-connection.md) | UNRUN |

두 프롬프트는 같은 공개 합성 FIFO 질문을 한 자식에게 전달한다. 부모 전용 표식은
자식 요청에 포함하지 않는다. 실제 하위 입력에서 표식이 없다는 관측은 유용하지만,
표식 한 개의 부재만으로 전체 이력이 없는 것을 증명하지는 않는다.

프롬프트만으로 도구 접근이나 비용을 제한할 수 없다.
[connection-probe.cjs](../scripts/connection-probe.cjs)는 독점 디렉터리 예약 후
기존 Windows Job 제어 아래에서 작업 소유 stdio app-server를 실행한다. 재실행하면
기존 예약 때문에 spawn 전에 거부한다. API key·별도 공급자 환경 변수를 전달하지 않고,
shell 도구와 웹 검색을 실행 옵션에서 제외했다. 활성 hook이나 신뢰 상태를 변경하지 않았다.
제품 adapter나 실제 입력 격리를 구현·검증한 것은 아니다.

사용한 기존 프로필은 `.superpowers/release-run-03/profiles/codex-ttak`다. 사용자 기본
`C:\Users\js\.codex`와 다른 경로이며, 두 프로필의 로그인 계정 동일성은 검증하지 않았다.
시험 프로필의 활성 플러그인은 보존된 `ttak@ttak-release` rc.1이다. rc.13으로 바꾸지
않았고, rc.13 제품 연결의 증거로 사용하지 않는다. config/read에서 별도 공급자·외부
MCP 부재와 기존 플러그인 선택을 확인했으며 hooks/list에서 정상 신뢰된 3개 hook을
대조했다. 설치된 hook 및 주입 policy는 검토한 작업 사본과 일치했다.

수집할 증거는 실제 부모/자식 session 또는 thread ID, spawn 입력과 이력 설정,
호스트가 보고한 모델, 완료/취소 상태, 수집 가능한 사용량 원필드, 프로세스 정리다.
숨겨진 thinking 본문과 자격 값은 수집하지 않는다. 빠진 메타데이터는 unknown으로
기록하며 CLI 시작 수·자식 수·내부 응답 수·토큰을 합쳐 단일 호출 수로 만들지 않는다.
정답은 연결용 합성 자료의 결과이며 제품 설명 품질 합격 근거가 아니다.

## 인증 확인과 실제 관측

기존 시험 프로필에서 인증 유형과 API key 존재 여부만 분류하려던 셸 명령이
PreToolUse `credential-path` / `shell-guard`에 의해 거부됐다. 값 출력이나 파일 복사는
발생하지 않았다. 거부 후 다른 셸·도구·경로로 같은 자격 정보에 접근하지 않았다.
같은 실행 묶음의 후속 명령도 실행되지 않았으며 비자격 소스 읽기만 따로 수행했다.

이후 사용자가 Codex 구독 로그인·포함량 잔여·추가 유료 사용량 비활성을 확인했다.
Claude는 OAuth 장기 토큰으로 MAX 20 plan 포함량만 사용하며 포함량 잔여·추가 유료
사용량 비활성임을 확인했다. 이 사용자 확인을 기록하고 자격 파일을 다시 읽지 않았다.
CLI는 기존 인증을 사용하며, API key나 별도 과금 fallback을 추가하지 않았다.

Codex CLI `0.154.0`의 바이너리 hash는 기존 검증본과 일치했다. 10:43:23 KST에
실행 슬롯을 예약했다. 실제 관측은 다음과 같다.

| 항목 | 결과 |
|---|---|
| 부모 thread | `01a08e22-4336-7392-b321-87190a0d4066` |
| thread/start 설정 | `gpt-5.6-luna` / `high` / provider `openai` |
| 실제 hook 완료 | sessionStart, userPromptSubmit |
| 상위 실행 / turn/start 요청 | 1 / 1 |
| 자식 생성 / 답변 / usage 알림 | 모두 관측되지 않음 |
| 호스트 오류 | native rollout의 `task_complete.error.codex_error_info = usage_limit_exceeded` |
| 호스트 기록 턴 시간 | 3,269 ms |
| Windows Job 경과 / 종료 코드 | 4,958 ms / 1 |
| 정리 | 실행 전 Job 할당, 정리 후 activeProcesses 0, cleanupVerified true |
| 후속 처리 | 자동 재시도 0회, Claude 및 품질 시험 UNRUN |

사용량 알림이 없으므로 내부 API 응답 수와 소비 토큰은 unknown이다. 0으로 추정하지 않는다.
Windows Job의 누적 OS 프로세스 수 53은 CLI 모델 호출 수나 서브에이전트 수가 아니다.
수집기는 오류 본문을 저장하지 않아 최초 관측에는 `native_error`로 기록됐다. 같은
thread의 기존 native rollout을 로컬에서 읽고 오류 enum만 추출해 원인을 특정했다.
새 model 요청, 세션 resume, 별도 CLI 재시작은 하지 않았다.

계정 포함량 잔여라는 사용자 확인과 이 시험 프로필의 사용량 제한 응답 사이의 이유는
미확정이다. 계정·프로필 차이, 모델별 제한 또는 다른 한도인지 이번 자료로 판별하지
못한다. 계정 상태를 다시 단정하거나 모델의 설명·독립 자식 기능 불합격으로 바꾸지 않는다.

다음 단계는 해당 시험 프로필의 정상 사용량 상태를 확인하는 것이다. 포함 사용량으로
실행할 수 있다는 새 증거와 새 1회 실행 범위가 정해진 뒤 연결 진단을 다시 시도할 수
있다. 현재 슬롯은 종료됐으며 재사용하지 않는다. 구매·추가 과금·보안 훅 해제를 하지 않는다.

## 보존과 검사 범위

준비 단계 시작 시 tracked/untracked 파일 196개의 hash를
`.superpowers/native-connection-90/before.json`에 저장했다. 이번 실행 전에는 그 파일들과
준비 문서·프롬프트 3개, 총 199개가 그대로임을 확인했다. 이번에 수집기와
[테스트](../tests/connection-probe.test.cjs)를 추가하고 이 결과 문서를 갱신했다.
제품 코드·P0 모듈·기존 테스트·프로필 설정·hook·설치를 직접 편집하지 않았다.
CLI는 시험 프로필에 이번 세션 기록을 남겼으며 지우지 않았다.

새 관측기 검사 5개와 기존 Windows Job 실프로세스 검사 5개, **10 PASS / fail 0 /
skip 0**다. reasoning/오류 본문 제거, usage 중복 알림 처리, 추가 spawn·후속 요청·
예상 밖 도구·실패·hook 차단 거부, 공급자/커넥터/플러그인 변경 거부를 검사했다.
Windows 검사는 timeout·출력 초과·부모 종료 후 자식 정리를 실제 프로세스로 검증했다.

```powershell
node --test --test-concurrency=1 --test-timeout=15000 tests/connection-probe.test.cjs tests/bounded-native-process.test.cjs
```

P0의 이전 관련 검사 56 PASS와 제품 전체 검사는 재실행하지 않았다. 모델 품질 검사는
없다. 검토는 Root 로컬 검토이며 독립 검증으로 표시하지 않는다. 이번 실행 증거는
`.superpowers/native-connection-90/codex-attempt-01/`에 있으며, 최초 차단·준비 기록은
기존 `verification.json`, 이후 실행 전 검사는 `prelaunch-verification.json`, 최종 결과는
`outcome.json`으로 구분해 보존한다. 이 자료와 프롬프트는 ignored이며 HEAD만으로 복원되지 않는다.
