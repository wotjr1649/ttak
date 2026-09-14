# Luna 계산·설명 진단 66 기록

상태: 사용자 승인 후 Luna CLI 1회 실행·사후 검토 완료. 추가 재시도 없음.

## 관측 결과

세션 `01a0870b-a96d-7973-acb3-9c577698b31f`에서 실제 Luna/high, CLI 0.153.4와 정확한
입력을 확인했다. 약 27.5초 뒤 정상 종료하고 하위 프로세스 0개로 정리했다. 모델이
구성한 두 의사 시나리오는 과제에 충실했다. `mcp_tool_call` 이벤트의 텍스트 응답과
`structured_content` 모두 재계산 결과와 일치했다. 네이티브 code-mode의 `exec` 2회는
도구 목록 검색과 해당 MCP 호출·결과 전달이었다. 코드 내용을 검토했으며 셸·파일·별도
네트워크 작업은 없었다. CLI 1회, wrapper 2회, 실제 MCP 호출 1회를 구분한다.

최종 답변은 교차 읽기·쓰기와 서로 다른 쓰기 대상, 불변식 위반 및 동시성 비용을
설명했고 전수 검증을 주장하지 않았다. 그러나 완화책에서 shared coordination lock과
serializable execution을 함께 제시하면서 두 번째 트랜잭션이 첫 번째의 갱신 후 상태를
검사한다고 했다. 실제 직렬 실행과 serializable 격리 수준을 구분하지 않아 전문가용
정확성을 합격으로 인증하지 않는다. 단순히 실제 순차 실행을 뜻했을 가능성도 있으므로
모든 해석에서 명백히 거짓이라고 단정하지는 않는다.

[PostgreSQL 18 공식 문서](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-SERIALIZABLE)는
Serializable이 커밋 결과의 직렬 동등성을 보장하며, 동시 스냅샷 실행과 serialization
failure를 사용할 수 있다고 설명한다. 따라서 격리 수준을 선택하면 뒤 트랜잭션이 반드시
새 상태를 읽는다는 보장은 도출되지 않는다. 유한 도구가 검증한 것은 스냅샷 획득부터
전체 트랜잭션을 직렬로 조정한 경우다. 실제 DB 실행 시험은 하지 않았다.

판정은 `not_qualified_mitigation_precision_unresolved`다. 원문 보존은 이번 진단의
합격 조건이 아니며 그 이유로 실패 처리하지 않았다. `.superpowers/luna-scenario-66/`의
`operator-review.json`, `transport-review.json`에 근거를 남겼다. 설치 제품이나 반복
기본/원본 비교의 합격 증거는 아니다. 누적 **696회(Claude 412, Codex 284)**, 진단 잔여
**4회**, 전체 비교용 **516회**는 미사용이다. 아래 실행 절차는 과거 기록이며 재실행하지 않는다.
이 계획은 Claude에서 사용자가 실행한 진단 64의 재실행이 아니며, Codex에서 새 도구를
연결하는 별도 진단이다. 전역 설정이나 설치된 제품에 도구를 추가하지 않는다.

## 목적과 판정

`gpt-5.6-luna / high`, Codex CLI 0.153.4, 기존 구독 `codex-baseline` 프로필에서
모델이 직접 시나리오를 만들고 로컬 `scenario_explain`을 사용해 전문가 설명을 완성하는지
확인한다. 원래 `explain-expert` 과제 및 필수 3항목·품질 2항목을 그대로 보존한다.
복사 지시를 삭제한 새 프롬프트이므로 진단 64의 반복 관측으로 세지 않는다.
시나리오 정답은 입력에 제공하지 않는다. 설치 제품·원본/기본 모델 비교가 아니다.

모델·버전·effort·정확한 입력, 실제 도구 호출, 입력 시나리오의 충실성, 계산 결과 일치,
최종 설명 전체의 정확성과 범위 보존을 각각 확인한다. 최초 Codex MCP 출력 형식은
아직 실제로 관측하지 않았으므로 임의로 추정해 감사 합격으로 처리하지 않는다.
첫 실행의 원시 JSONL과 세션을 보존한 뒤 수정된 `finite-scenario-audit.cjs`로 도구
응답을 재검사한다. 예상 외 도구·거부·오류·사실 오류가 있으면 중단하고 재시도하지 않는다.
모델의 자기 보고로 도구 사용이나 정확성을 판정하지 않는다.

## 실행 준비

- 스크립트: `.superpowers/luna-scenario66.cjs`
- 프롬프트: `docs/prompts/2026-09-10-session-02-luna-finite-scenario.md`
- 고정 입력·해시·인수·기준: `.superpowers/luna-scenario-66-prepared/plan.json`
- 실행 후 출력: `.superpowers/luna-scenario-66/`
- 제한: CLI 1회, 재시도 0회, 120초와 정리 10초, stdout 1 MiB / stderr 64 KiB.
- 기존 Windows Job Object 실행기로 모든 하위 프로세스를 정리한다.

`prepare`와 `check`는 모델이나 MCP를 시작하지 않는다. 실제 실행은 `run`만 수행한다.
해시가 바뀌면 중단하며 배타적 실행 폴더 생성으로 중복 실행을 거부한다.

```powershell
Set-Location -LiteralPath 'D:\AI_DEV\ttak\.superpowers\worktrees\first-release'
& 'C:\Program Files\nodejs\node.exe' '.superpowers/luna-scenario66.cjs' check
```

`ready_without_model_call`, `already_started: false` 확인 후, 이 세션 한정 MCP 연결과
Luna 1회 진단을 승인하거나 사용자가 직접 실행하기로 결정한 경우에만 다음을 실행한다.

```powershell
& 'C:\Program Files\nodejs\node.exe' '.superpowers/luna-scenario66.cjs' run
```

정상 수집 상태 `native_recorded_manual_tool_and_quality_review_required`는 도구·품질
합격을 뜻하지 않는다. `stopped_do_not_retry`이면 상태·phase를 보존하고 재실행하지 않는다.
실행 뒤 `answer.md`, `audit.json`, `native-output.json`, `process.json`을 검토해야 한다.
모델 호출이 시도되면 누적 696회, 진단 잔여 4회가 되며 전체 비교 배정 516회는 유지된다.

## 설정 검증과 한계

현재 로컬 CLI `exec --help`에서 `-c` TOML 인수, read-only sandbox, stdin 입력과 JSONL
출력을 확인했다. [공식 MCP 문서](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)에서
stdio command/args, 환경 변수 설정, `required`, `enabled_tools`, 시간 제한,
`default_tools_approval_mode="writes"`를 확인했다. 이 모드는 읽기 전용으로 표시되지
않은 도구에 승인을 요구한다. 읽기 전용 계산 도구만 허용 목록에 넣는다.

`finite-scenario-codex.cjs`는 실제 실행 없이 이 인수만 구성한다. 모델·effort 고정,
셸 도구 비활성화, 웹 비활성화, 단일 서버와 도구 제한을 포함한다. 기존 Codex 프로필에
설정 파일이나 설치 플러그인이 추가됐다면 사전 검사에서 중단한다. API 키를 전달하지
않으며 MCP 서버는 인증 정보가 필요 없다. 신뢰/규칙 우회 인수는 사용하지 않는다.

새 테스트 3개에서 제한 인수와 잘못된 경로 거부, Python 표준 `tomllib`로 전체 TOML을
해석한 뒤 실행 경로·환경·허용 도구·시간 제한의 정확한 일치를 확인했다. 이 검사는
문법과 인수 생성의 증거이며 실제 Codex MCP 연결 및 출력 형식 검증을 대체하지 않는다.
