# 구조화 결과 제출 후보 99 — 로컬 검증 완료, 호스트 연결 비활성

2026-09-11 KST. [98의 결과](NATIVE_VERIFICATION_98.ko.md)에 따라 자유 텍스트 JSON의
framing에 의존하지 않는 다음 후보를 준비했다. **아직 Claude에 MCP를 등록하거나
자식 도구 권한을 변경하지 않았다.** 기존 v2 worker는 여전히 자식 도구 호출을 거부한다.

## 준비한 수신기

[verification-submission-mcp.cjs](../scripts/verification-submission-mcp.cjs)는 프로젝트의
기존 `review-mcp.cjs` stdio 전송 코드를 재사용한다. 도구는 `verification_submit` 하나다.
입력 schema는 97의 anchoredSchema이며, packet/map hash·source·anchor 범위·필수 결과
필드를 검사하고 기존 P0 인용 감사까지 실행한다.

수신기는 파일·네트워크·자격 값·모델 API를 읽거나 쓰는 처리를 하지 않는다. 제출 상태는
프로세스 메모리에만 둔다. schema에 path·command·URL·caller ID 인자를 추가하지 않는다.
최초의 유효한 tool 호출 경로에서 제출 시도를 한 번 소모하며, 그 인자가 잘못됐더라도
다시 제출할 수 없다. 연결은 최대 64개 dispatch 메시지, 총 2 MiB 입력, 120초로 제한한다.

응답은 제출 객체 hash와 검증된 P0 결과 hash를 포함한 ack다. `accepted:true`는
내용의 사실 정확성이나 native 자식의 신원을 인증하지 않는다.
`native_caller_verified:false`, `semantic_quality_verified:false`를 명시한다.

프로그램의 `--diagnostic` 진입점은 기존 고정 합성 FIFO packet만 사용한다.
모델이 config 파일이나 임의 실행 경로를 선택할 수 없다. 로컬 테스트에서만 Node
프로세스로 실행했으며 호스트 CLI나 구독 모델은 호출하지 않았다.

## 검증

[verification-submission-mcp.test.cjs](../tests/verification-submission-mcp.test.cjs)의
**8 PASS / fail 0 / skip 0**다. 검증한 내용은 한 번의 구조화 제출, 실패 시 재제출 금지,
허위 caller/path/command 및 잘못된 anchor 거부, 초기화·notification·단일 도구 노출,
가능한 secret 미출력, 메시지/입력 크기 제한, 미완성 프레임 거부와 실제 stdio 프로세스다.
이 검사는 수신기 경계 검사이며 실제 Claude 연동 통과 증거가 아니다.

```powershell
node --test --test-concurrency=1 --test-timeout=30000 tests/verification-submission-mcp.test.cjs
```

## 사용자 결정이 필요한 정확한 변경

현재의 **Claude 자식 도구 0개** 조건을, 새 후보에서만 **로컬 결과 제출 도구 1개**로
변경하는 것을 제안한다. 파일 읽기·쓰기, shell, web, 다른 MCP 또는 추가 자식 기능은
허용 대상에 포함하지 않는다. 모델·구독 조건과 부모 1개·독립 자식 1개의 범위는 유지한다.

제안 대상은 다음과 같다.

- 실행 프로그램: 작업 루트의 `scripts/verification-submission-mcp.cjs --diagnostic`.
- 연결: Claude 진단 실행에 한정한 `--mcp-config`의 `ttak_verification` stdio 서버.
- 도구 식별자: `mcp__ttak_verification__verification_submit`.
- 자식: 같은 Haiku의 세션 한정 custom agent로, 위 도구 하나만 가진다.
  상위 coordinator는 이 자식만 생성하도록 범위를 제한한다.
- 인증 분리: 모델 CLI는 기존 구독 OAuth를 사용한다. MCP 자식 프로세스에는 OAuth/API
  credential 환경 변수를 전달하지 않는 실행 환경을 별도로 검토·고정한다.
- 지속성: 전역·기존 profile의 MCP/agent 설정과 plugin 등록은 변경하지 않는다.

세션 한정 custom agent와 MCP tool 이름을 제한하는 agent tools 설정은
[Claude subagent 문서](https://code.claude.com/docs/en/sub-agents)를 근거로 준비한다.
이는 외부 앱 추가나 API key 전환을 제안하는 것이 아니다.

## 승인 이후에도 먼저 충족할 조건

수신기 ack만으로 자식의 제출이라고 인정할 수 없다. native 자식 기록의 실제 tool_use
ID·arguments, 부모/자식 연결, 수신 ack의 hash를 대조하는 별도 v3 수집 경로가 필요하다.
부모가 대신 제출하거나 child가 두 번 호출하면 실패해야 한다. custom agent에 허용한
도구가 실제로 하나뿐인지도 native init 및 실제 tool 기록으로 확인해야 한다.

현재 수신기는 그 수집 경로에 연결되지 않았다. 범위 변경 승인 후 v3 collector와
ticket을 구현하고, 위 정상·부정 사례를 로컬에서 검사한 뒤에만 실제 연결을 활성화한다.
기존 v1/v2 판정과 P0 receipt 규칙은 변경하지 않는다. native 연결 검사에는 기존처럼
유한한 실행 상한과 실패 중단을 적용하고, 구조화 제출이 통과하기 전 품질 시험으로
넘어가지 않는다.

이 변경은 사용자 제공 계약 S3의 MCP·도구 권한 변경 및 W5의 작업 효과 변경에 해당한다.
이미 완료한 로컬 개선이나 검사를 다시 승인받는 요청이 아니라, 이 추가 도구 허용
범위를 결정받는 단계다. 승인 전에는 호스트 연결을 비활성으로 유지한다.
