# 초안 검사와 최종 설명 교정 후보 — 73·74·75

2026-09-10. 현재 로컬 후보는 **`0.2.0-rc.5`**다. 초안 본문을 검사하는 MCP와
최종 설명에서 지원하는 격리 수준 오류를 발견하면 한 번 더 교정을 요청하는 Stop hook을
제품 경로에 연결했다. 로컬 실행·실제 Codex MCP 연결 근거는 있으나 rc.5의 교정 이후 모델 품질은
아직 관측하지 않았다. 출하 합격은 아니다.

이전 [재검증 72](REVALIDATION_72.ko.md)는 구현 전에 멈춘 기록이다. 이후 사용자가
확인을 반복하지 말고 실제로 동작하도록 진행하라고 명시해 구현과 남은 네이티브 진단을
진행했다. 과거 후보의 No-Go와 원래 16과제·두 반복·양 호스트·기본/원본 비교 기준은 유지한다.

## 구현한 경로

1. `skills/ttak-explain/SKILL.md`가 boolean 동시성 예시를 설명할 때 사용 가능한
   `scenario_review`에 실제 초안을 전달한다. 다른 설명 과제는 기존 직접 설명 경로를 쓴다.
2. 호스트별 `.claude-plugin/mcp.json`과 `.codex-plugin/mcp.json`이 등록하는 로컬 stdio
   서버 `scripts/scenario-feedback-mcp.cjs`는 기존 유한모델을
   재사용하고 `scripts/scenario-draft.cjs`로 지원하는 초안 표현을 대조한다. 모델이 제출한
   별도 claim ID가 맞는지를 검사하는 대신 초안 본문에서 해당 표현을 찾는다.
3. 발견한 문제의 문자열 위치와 계산 근거·수정 피드백을 반환한다. 영어/한국어의 제한된
   교차 읽기/쓰기 부정, 완화책 범위 과장, 격리 수준과 실제 직렬 순서의 혼동을 검사한다.
   위치는 JavaScript 문자열의 UTF-16 offset이다. 미인식 문장은 `unchecked_spans`로 남는다.
4. 모델은 설명을 완성한다. 이어 `hooks/scenario-stop.cjs`가 host의
   `last_assistant_message`만 받아 지원하는 격리 수준/실행 순서 오류를 검사한다.
   오류가 있으면 `decision: block`과 고정된 교정 이유를 반환한다.
5. `stop_hook_active: true`이면 두 번째 교정을 요청하지 않는다. 오류가 남았다면
   미검증 안내를 반환한다. 이 안내나 오류 종료를 완성된 설명의 품질 통과로 세지 않는다.

Stop hook은 최종 메시지를 교체하는 API가 아니다. 호스트가 continuation을 실행해
모델이 다시 답하도록 요청한다. 이 동작은 [Codex Stop 계약](https://learn.chatgpt.com/docs/hooks#stop)과
[Claude Stop 계약](https://code.claude.com/docs/en/hooks#stop)에 근거한다. rc.5에서 그 continuation을
실제 모델로 실행한 기록은 없다.

후크는 설치된 설명 보조 기능이며 `ttak on/off`가 제어하는 운영 지침 주입과 별개다.
지원하는 격리 수준 표현을 포함한 최종 메시지에만 교정 요청이 발생한다. 기존 상태 저장,
SessionStart/SubagentStart/UserPromptSubmit 처리는 수정하지 않았다. 설명 스킬의 기존
불변식과 독자 프로필 문구를 테스트가 요구하는 표현으로 정리했고, 기존 실패 테스트를
삭제하거나 약화하지 않았다.

## 진단 73: rc.2, Haiku 1회

Claude Code `2.1.266`, `claude-haiku-4-5-20251001`, thinking 요청 상한 8192,
기존 first-party 구독 인증으로 실행했다. 후보 스킬은 `--plugin-dir`로 로드했고, 동일
패키지의 `.mcp.json`을 명시적으로 세션에 연결했다. 자동 설치 후 discovery 전체를 검증한
것과는 구분한다. 최대 120초, 재시도 0회, agentic turn 상한 5를 고정했다.

실제 스킬 본문과 도구 호출 1회, 도구 결과의 재계산 일치, 정상 종료·하위 프로세스 0개를
확인했다. 최종 답변은 각 트랜잭션이 상대가 쓰는 행을 읽는다고 설명해 H2는 통과했다.
하지만 SERIALIZABLE이 snapshot 획득부터 완전히 순차 실행시킨다고 설명하고, 겹치는
데이터를 다루는 트랜잭션의 동시 실행을 보편적으로 부정했다. Q1·범위·정확성은 실패다.
H1/H2/H3/Q2의 통과와 실패 항목을 분리해 기록했다.

초안에도 같은 오류가 있었지만 rc.2 검사기가 놓쳤다. 이를 정상 대조와 함께 로컬 테스트로
추가하고, 문장 사이에 걸친 격리 수준/실행 순서 주장을 대조하는 rc.3를 만들었다.
과거 rc.2 파일은 `.superpowers/scenario-feedback-73/candidate/`에 보존했다.
장부와 실패 판정은 변경하지 않았다.

## 진단 74: rc.3, Haiku 1회

동일 과제·모델·스킬 본문과 실행 제한으로 별도의 계획을 고정했다. 초안의
SERIALIZABLE 설명은 결과 동등성을 표현했지만, 최종 답변은 다시 실제 순차 실행으로
바꾸었다. Q1·범위·정확성이 실패했으며, 관련 없는 주기적 사후 복구 조언도 추가했다.
스킬과 도구 전달 성공을 최종 설명의 품질 성공으로 바꾸지 않았다.

수집기는 Skill 결과에 전체 본문이 들어온다고 가정해 실패했다. 이번 호스트는 별도
user 메시지에 정확한 스킬 본문을 확장하고 Skill 결과에는 응답 확인만 남겼다.
원본 transcript에서 이 전달 형식, 정확한 모델·버전, 최종 답변과 MCP 결과의 일치를
오프라인으로 확인해 `supplemental-audit.json`에 기록했다. 기존 failed receipt는 보존했다.
이는 전달 검사 오탐의 보충 설명이며 최종 품질 실패를 뒤집지 않는다.

SERIALIZABLE은 실제로 모든 트랜잭션을 한 번에 하나씩 실행한다는 뜻이 아니다.
PostgreSQL 18은 동시 실행의 결과가 직렬 실행과 동등하도록 감시하고 직렬화 실패 시
전체 재시도를 요구할 수 있다. [공식 격리 수준 설명](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-SERIALIZABLE)
이는 해당 문장의 정확성을 판단하는 근거이며 실제 DB 실행 시험은 아니다.

rc.3 파일도 `.superpowers/scenario-feedback-74/candidate/`에 보존했다.
73·74의 원본 응답과 장부를 고쳐 재실행하지 않았다.

## 로컬 변경 75: 최종 답변 검사

74에서 확인한 실패 위치에 맞춰 **초안 뒤에 생성된 최종 메시지**를 검사하도록
개입 지점을 추가했다. 문단 제목의 SERIALIZABLE 문맥을 다음 설명에 연결하고,
`one completes fully (...) before the next begins`와 같은 물리적 순서 주장도 검사한다.
조건부 예시·결과 동등성·명시적 순차 조정·인용·코드는 정상 대조로 유지한다.

73·74의 실제 최종 답변을 hook에 재생했을 때 모두 교정 요청이 나왔다.
같은 입력에 `stop_hook_active: true`를 주면 추가 교정이 발생하지 않았다.
`.superpowers/scenario-feedback-75/replay.json`은 이 **로컬 재생**의 근거다.
실제 모델이 그 피드백으로 설명을 고쳤다는 근거는 아니다.

검사기는 일반 자연어 의미 검증기가 아니다. 지원하지 않는 바꿔 말하기를 놓칠 수 있고,
일부 복잡한 문맥에서 오탐 가능성도 남아 있다. 최종 hook은 현재 격리 수준/물리적 순서
검사만 수행하며, 시나리오 입력이 없는 최종 hook에서 모든 읽기/쓰기 관계를 인증하지 않는다.

## 설치와 보안 경계

- 양 manifest는 rc.5이며 각 manifest는 호스트별 번들 MCP 파일을 참조한다.
  [Claude plugin MCP 계약](https://code.claude.com/docs/en/plugins-reference#mcp-servers) 및
  로컬 Codex manifest 명세와 현재 CLI를 대조했다.
- Claude의 **plugin manifest 파일**을 지정한 검사가 통과했다. 앞선 디렉터리 검사는
  marketplace manifest를 검사했으므로 두 기록을 혼동하지 않는다.
- 별도 `.superpowers/scenario-feedback-75/codex-metadata`에 local marketplace로
  rc.4를 설치한 뒤 rc.5로 갱신했다. native 설치 결과와 installed/enabled 목록을 확인했다.
  처음에는 CODEX_HOME 디렉터리가 없어 초기화가 실패했고, 해당 작업용 디렉터리를
  만든 뒤 정상 설치했다. 사용자 전역 프로필·기존 설치·credential 파일은 변경하지 않았다.
- rc.4는 설치됐지만 실제 Codex MCP 시작은 실패했다. 이 버전은 MCP args의
  `${CLAUDE_PLUGIN_ROOT}`를 치환하지 않는다. rc.5에서 Claude는 기존 치환 경로를,
  Codex는 `cwd: "."`와 상대 script 경로를 사용하도록 설정 파일을 분리했다.
  [Codex의 plugin MCP 경로 정규화 구현](https://github.com/openai/codex/blob/main/codex-rs/codex-mcp/src/plugin_config.rs)을
  확인하고 현재 설치 버전으로 검증했다. 실제 app-server의 ephemeral thread에서
  `mcpServerStatus/list`가 **connected**, `scenario_review` 도구와 serverInfo를 반환했다.
  이 검사는 모델 turn을 시작하지 않았으며 종료 후 하위 프로세스 0개를 확인했다.
  근거는 `codex-mcp-runtime.json`의 실패와 `codex-mcp-runtime-rc5.json`의 성공이다.
- 새 hook 정의의 실제 host trust/continuation은 이번에 실행하지 않았다. 정상 trust
  검토를 우회하는 flag나 설정은 도입하지 않았다.
- MCP는 파일·네트워크·모델 API를 사용하지 않는다. 입력 문자열은 명령이나 경로가
  되지 않는다. hook 역시 transcript 경로를 열지 않으며, 입력에서 받은 임의 문장을
  교정 이유에 그대로 붙이지 않는다. 숨겨진 thinking은 새 산출물로 복사하지 않았다.
- hook 입력은 128 KiB, 초안은 24,000 UTF-16 단위/256문장으로 제한한다.
  비정상 입력은 미검증 안내를 남기며 정답 인증으로 처리하지 않는다.

## 검사와 남은 범위

최종 코드에서 다음을 실행했다.

- Node: 제품 기본 suite + 초안/MCP/Stop/패키지 검사 **93개 통과**, 실패·skip 0.
- Python: 입력 freeze 및 변조 검사 **7개 통과**. 새 MCP·hook과 런타임 의존 파일도
  freeze에 포함하며, 파일 변경을 기존 snapshot으로 인증하지 못하도록 검사했다.
- 변경된 PowerShell 환경의 기존 Windows 프로세스 격리·시간/출력 제한·정리 검사
  **5개 통과**. 이는 앞서 실행한 별도 검사 집합이다.
- manifest 검사, 작업용 Codex 실제 설치, 실패 답변 두 개의 로컬 hook 재생을 확인했다.

네이티브 진단 누적은 **700회: Claude 415, Codex 285**다. 진단 잔여는 **0회**,
전체 비교용 **516회는 미사용**이다. 73은 native agentic turn 2, 74는 4로 보고됐다.
도구 왕복과 내부 모델 메시지는 CLI 요청 수와 별도로 기록한다. rc.5 Stop correction은
host continuation을 최대 한 번 추가하므로 이후 비교의 내부 요청·시간·토큰 비용에
포함해야 한다.

rc.5의 모델 교정 결과, Luna 품질, 동일 항목 두 반복 개선, 원본 대비 중대 퇴보 없음은
미검증이다. 기존 전체 비교 수집기는 새 번들 MCP와 Stop 경로에 맞춘 검토도 필요하다.
따라서 516회를 탐색에 전용하거나 새 후보의 전체 비교를 시작하지 않았다.

남은 핵심 관측은 **rc.5의 실제 Stop 피드백을 받은 모델이 정확한 최종 설명을 완성하는지**다.
현재 기록된 로컬 동작·설치 성공을 이 관측이나 출하 합격으로 대신하지 않는다.
기존 실패와 최신 구현이 공존하며, 구현 파일과 검증 근거는 이 worktree에 남아 있다.
