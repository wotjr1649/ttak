# 호스트 worker 연결 95 — 로컬 구현, native 실행 대기

2026-09-11 KST. [실행 계층 94](VERIFICATION_EXECUTION_94.ko.md)의 ticket에 실제
Codex app-server / Claude stream-json worker를 연결했다. 준비 작업은 CLI를 시작하지
않는다. 이번 작업의 native 시작은 **0회**, 누적은 **731회(Claude 436 / Codex 295)**다.
제품 rc.13 / No-Go, 전체 192 subjects / 516 requests 미실행 상태를 유지한다.

## 구현 범위

- [verification-native-run.cjs](../scripts/verification-native-run.cjs): 검토한 합성 FIFO
  질문 하나를 준비하고, 명시적인 실행 명령에서만 기존 구독 profile로 실행·수집·정산한다.
  `--execute-pair`는 Codex가 `observed`에 도달한 경우에만 Claude를 실행한다.
- [verification-host-worker.cjs](../scripts/verification-host-worker.cjs): 시작 stamp와
  ticket hash·nonce·packet·profile·실행 파일을 확인한 뒤 CLI를 한 번 시작한다.
  worker 전용 시작 claim도 독점 생성해 같은 worker를 다시 실행하지 못하게 한다.
- [verification-worker-protocol.cjs](../scripts/verification-worker-protocol.cjs): 기존
  probe의 필터를 재사용하고, 실제 자식 입력·ID·완료·종료를 ticket envelope로 연결한다.
- [verification-native-evidence.cjs](../scripts/verification-native-evidence.cjs): 기존
  profile의 해당 부모/자식 JSONL만 제한된 경로·크기로 읽어 adapter report를 만든다.
  raw transcript나 숨겨진 thinking을 별도 파일로 복사하지 않는다.
- [verification-delivery.cjs](../scripts/verification-delivery.cjs): P0 packet과 결과 지시를
  native 자식 입력 하나로 직렬화한다. 모델 결과에서 명령·경로·실행 파일을 고르지 않는다.

기존 `connection-probe*.cjs`, P0 packet·감사·장부와 adapter는 수정하지 않았다.
실행 계층에는 task root 안의 중첩 기록 디렉터리, 별도로 고정한 native 실행 파일,
검토한 `.md` 지시 artifact와 새 전달 형식의 정산을 추가했다. 경로의 `..`, junction,
변경된 artifact와 재실행은 계속 거부한다.

## 자식 입력을 바꾼 이유와 범위

완료된 Codex 0.154.0 세션에서 관측한 `multi_agent_v1__spawn_agent` 인자는
`fork_context`, `message` 또는 `items`, `model`, `reasoning_effort`다. 별도의 자식
system/developer 지시 인자를 확인하지 못했다. 최신 custom agent 문서를 이 V1
도구에 그대로 적용하지 않았다. [공식 Codex 문서](https://learn.chatgpt.com/docs/agent-configuration/subagents)
및 실제 설치 버전의 도구 선언을 대조했다.

따라서 새 native 전달 형식 `verification-envelope-v1`은 다음 두 값을 담는다.

```json
{
  "schema_version": 1,
  "packet_json": "<기존 encodePacket(packet)의 정확한 문자열>",
  "result_instructions": "<고정 결과 필드·형식·인용 규칙>"
}
```

P0 packet의 내용과 digest는 유지하며, 실제 전송하는 JSON 전체의 digest를 별도로
ticket에 고정한다. 결과 지시는 bare JSON, 문자열 answer, 문자열 배열 conditions 및
uncertainties, UTF-16 시작 포함/끝 제외 인용 구간과 상태별 필수 근거를 명시한다.
기존 `packet-v1` 정산과 P0 receipt 수용 조건을 새 형식으로 덮어쓰지 않는다.

Codex가 자동으로 넣는 가시 `environment_context`도 무시하지 않는다. 기존 native
기록에서 확인한 read-only 형식의 cwd·날짜·timezone을 사전 고정하고, 자식 입력이
정확히 `[고정 환경 입력, 고정 전달 JSON]`인지 대조한다. 예상하지 못한 환경이나 추가
문맥은 실패다. 전체 system/developer 입력이 관측됐다는 뜻은 아니다.

Claude는 기존 `general-purpose`, foreground 경로를 유지한다. Task/Agent alias를
수용하되 fork·resume·background·다른 모델 override·추가 자식 입력은 거부한다.
세션 한정 custom agent를 정의할 수는 있지만, 이번 진단에는 새 agent 정의·profile
변경을 도입하지 않았다. [공식 Claude 문서](https://code.claude.com/docs/en/sub-agents)

## 실행 증거와 경계

Codex는 config/read → hooks/list → thread/start → turn/start 순서를 강제한다.
기존 시험 profile의 provider와 plugin 선택, 세 개의 trusted hook을 확인한다.
부모의 spawn/wait/close 이벤트와 같은 자식 ID를 대조한다. 추가로 native 부모 기록의
세 exec 호출문이 생성한 문장과 정확히 같은지 확인한다. `fork_context:false`를
모델의 자기 보고로 인정하거나 기록 속 JavaScript를 평가하지 않는다.

Claude는 init의 model·tool·MCP·plugin 구성을 검사한다. Agent/Task의 실제 prompt,
forward된 자식 입력, tool result의 자식 ID와 정상 result를 연결한다. API retry,
권한 거부, 자식의 도구 사용, 입력 변경과 중복 실행을 실패로 남긴다.

각 native 실행에는 최대 120초와 정리 5초를 적용한다. 호스트별 상위 CLI 시작 1회,
요청 자식 1개, 자동 재시도 0회다. OS 프로세스 수는 별도다. 내부 API 응답 수·토큰의
hard cap을 구현했다고 주장하지 않는다. 사용량은 94의 집계 규칙을 사용한다.

실제 Windows Job의 정리 결과를 받은 뒤 native 기록을 adapter에 통과시켜 정산한다.
식별 또는 파일 읽기 실패는 빈 성공 기록으로 수리하지 않고 영구적인 증거 실패로
남긴다. 엄격한 결과 형식이 실패해도 이미 대조된 사용량은 정산에 보존한다. envelope를
얻지 못한 조기 실패의 전체 사용량은 여전히 미확인일 수 있다.

성공 상태 이름은 `observed`다. `native_delivery_verified`, `full_input_observed`,
`semantic_quality_verified`는 false, `p0_receipt`는 null이다. 설명의 사실 정확성,
완전한 입력 격리, 정상 rc.13 plugin 흐름의 통과 증거로 승격하지 않는다.

## 준비 과정에서 발견한 문제

Codex의 데스크톱 설치 경로 `...OpenAI\Codex\bin`은 junction이었다. ticket 준비가
`verification_storage_link`로 거부됐고 native 시작은 없었다. 링크 검사를 유지하고
동일 SHA-256의 실제 설치 파일을 고정했다.

`C:\Users\js\.codex\packages\standalone\releases\0.154.0-x86_64-pc-windows-msvc\bin\codex.exe`

Codex SHA-256은 `be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde`,
Claude는 `d2c5f7b3b6a12819097ceb6efbce2a390157166003fcaee32dbde0e6d7b45ef7`으로 확인했다.
코드 수정 전에 생성한 예약은 덮어쓰지 않았다. 그 예약은 최종 artifact와 맞지 않으며
실행 대상으로 쓰지 않는다. 최종 예약 이름과 상태는 아래 검증 기록에서 확인한다.

## 로컬 검증과 다음 실행

최종 검사는 동시성 1, 테스트별 timeout 30초로 실행했다.

```powershell
node --test --test-concurrency=1 --test-timeout=30000 tests/verification-worker-protocol.test.cjs tests/verification-native-evidence.test.cjs tests/verification-execution.test.cjs tests/verification-host-adapter.test.cjs tests/verification-ledger.test.cjs tests/verification-native-audit.test.cjs tests/verification-packet.test.cjs tests/connection-probe.test.cjs tests/connection-probe-claude.test.cjs
```

**94 PASS / fail 0 / skip 0**. 프로토콜 검사는 합성 native 이벤트로 수집기 경계를
검사한다. 실제 Node worker와 Windows Job 검사는 전달 JSON·환경 입력의 정확한 정산,
동시 실행 배제, timeout 및 자손 정리, nonce·artifact·경로 변경 거부를 확인한다.
실제 Codex/Claude worker의 새 전송과 응답은 아직 실행하지 않았다.

기록 위치는 `.superpowers/verification-worker-95/`다. `before.json`에 기존 파일의
hash, `verification.json`에 최종 보존 검사·테스트·예약 상태를 기록한다. 이 경로는
ignored이며 Git HEAD만으로 복원되지 않는다. 이전 90–94의 증거는 보존했다.

다음 native 진단의 실행 명령은 다음과 같다. 새 실행량 승인이 확인된 뒤 사용한다.

```powershell
Set-Location D:\AI_DEV\ttak\.superpowers\worktrees\first-release
node scripts/verification-native-run.cjs --execute-pair codex-q1-ready claude-q1-ready
```

최종 준비 파일은 각각 `codex-q1-ready/ticket.json`, `claude-q1-ready/ticket.json`,
해당 `*-work/request.json`이다. 예약은 약 58분 뒤 만료되며 만료·코드 변경 시 자동으로
새 예약이나 호출을 만들지 않는다. 필요하면 명시적인 새 이름으로 prepare부터 수행한다.
`--prepare <host> <name>`은 구독 호출 없이 합성 입력과 hash를 고정하는 로컬 작업이다.

기존 확인은 **Codex 구독 포함량 / Claude MAX 20 OAuth 포함량, 추가 유료 사용 비활성**이다.
API key 경로를 추가하지 않았고 자격 파일을 읽거나 복사하지 않았다. 이전의 추가 Claude
1회 예산은 완료된 시도에 사용됐으므로 이 새 전송 진단에 재사용하지 않는다.

Codex 시험 profile의 plugin은 여전히 rc.1이며 Claude 시험 profile에는 plugin이 없다.
양쪽 새 전송 진단이 통과한 뒤 rc.13 정상 plugin 연결과 설명 품질 시험으로 진행한다.
전체 제품 회귀 검사·516회 비교·품질 판정·설치·원격 쓰기는 이번에 수행하지 않았다.
