# Claude 자식 구조화 제출 100 — 실제 연결 통과

2026-09-11 KST. 사용자가 Claude 자식에 한해 파일·셸·네트워크 기능 없이
`verification_submit` 하나를 허용한 범위로 [99의 후보](VERIFICATION_SUBMISSION_99.ko.md)를
구현하고 실제 구독 CLI에서 검사했다. 제품 판정은 **rc.13 / No-Go**다.
이번 결과는 연결·수집·정산 검사이며 설명 품질 통과를 뜻하지 않는다.

## 구현과 권한 경계

- `verification-submission-contract.cjs`: 세션 한정 `ttak-coordinator`와 `ttak-verifier`를
  정의한다. 부모는 `Agent(ttak-verifier)`만, 자식은
  `mcp__ttak_verification__verification_submit`만 사용한다. 같은 Haiku를 고정한다.
- `verification-submission-mcp.cjs`: 기존 stdio 수신기를 재사용하며, 제출 인자에
  경로·명령·URL·호출자 지정 필드를 받지 않는다. 상태는 메모리에만 둔다.
  알려진 OAuth/API 및 Node 주입 환경 변수가 비어 있지 않으면 입력 처리 전에 종료한다.
- `verification-submission-protocol.cjs`, `verification-submission-audit.cjs`: 실제 자식
  tool_use ID·인자, 연결된 tool_result, packet·anchor map·제출·P0 결과 hash를 대조한다.
  부모 대리 제출, 추가 도구, 중복 제출, 잘못된 ID, 위조 ack, 역순 응답을 거부한다.
- delivery·ticket·worker·정산에 Claude 전용 `verification-submit-v3`를 연결했다.
  결과는 자유 텍스트가 아니라 실제 자식의 도구 인자에서 얻는다. 기존 v1/v2와
  P0 receipt 조건을 유지하며 `p0_receipt:null`로 기록한다.

99에서 검토한 최상위 MCP config 대신 `--agents`의 자식 정의 안에 inline stdio 서버를
넣었다. 최상위 `--mcp-config`는 빈 목록이고 `--strict-mcp-config`를 유지한다.
이 구성은 서버를 자식 수명에 한정하고 부모에는 노출하지 않는
[Claude 공식 subagent 문서](https://code.claude.com/docs/en/sub-agents)의 정의에 따른다.
전역·기존 프로필·plugin 등록은 수정하지 않았다.

파일·셸·네트워크 **도구**를 제공하지 않는 구성과 관측을 확인했다. Node 수신 프로세스에
OS 수준의 파일·네트워크 sandbox가 적용됐다는 뜻은 아니다. 수신기 코드에는 해당 작업이
없으며, 모델 입력은 고정 공개 합성 FIFO 자료로 제한했다. native 전체 시스템 입력과
실제 사용되지 않은 모든 내부 기능의 완전한 관측을 주장하지 않는다.

## 실제 실행과 수정 근거

Claude Code `2.1.266`, `claude-haiku-4-5-20251001`, 기존 시험 OAuth 프로필을 사용했다.
사용자가 확인한 MAX 20 포함량 조건을 유지했다. 각 예약은 부모 1개·자식 1개,
120초·정리 5초·자동 재시도 0회다. 실패한 예약은 재사용하거나 성공으로 바꾸지 않았다.

| 예약 | 결과 | 관측 토큰 | 시간 |
| --- | --- | ---: | ---: |
| `claude-submit100` | 수집기 중단, 상세 코드 누락 | 8,600* | 20.796초 |
| `claude-submit100-diagnostic` | `submission_ack_format` | 8,560* | 14.312초 |
| `claude-submit100-fixed` | `observed` | 19,659 | 24.091초 |

첫 실행에서 자식 제출 호출까지 관측했으나 기존 worker가 모든 프로토콜 오류를 같은
코드로 합쳐 원인을 남기지 않았다. 거부 본문을 저장하지 않는 고정 오류 코드·이벤트
형태 기록을 추가하고 별도 원인 식별 실행을 했다. 이때 Claude가 MCP tool_result의
content를 **문자열**로 전달함을 확인했다. 수집기의 배열 전용 가정을 수정하고,
문자열도 같은 strict JSON 객체·hash 검사를 거치게 한 뒤 새 예약에서 통과했다.
JSON 추출, 코드 펜스 제거, 내용 보정은 하지 않는다.

`*` 중단된 두 실행은 native 파일의 마지막 관측 snapshot이며 완전한 사용량이 아니다.
총 관측값은 36,819 tokens지만 실제 총 사용량이나 청구액으로 확정하지 않는다.
성공 실행은 input/cache 17,337 + output/thinking 포함 2,322 = 19,659다.
assistant message ID는 4개이며 이를 완전한 API 응답 수로 바꾸지 않는다.
토큰 hard cap이나 추가 청구의 부재를 이 수집기로 입증한 것은 아니다.

성공 세션:

- 부모: `2365e3be-6c54-4a89-849b-f92228bdd7d2`
- 자식: `a5d0f9aa968b34178`
- 실제 제출: `toolu_017QgUctkK812Yn5EQEpc61E`
- 제출 hash: `2cc9cb555718335d9e6a0ce3b3cc8a1f9bc1bfa036f1f67fee9c71ca06f3658e`
- P0 결과 hash: `d691a7b91bc2c87a89c33d1342491580291c55f93c4ce4603b5263630007862b`

세 실행 모두 정리 확인이 참이고 남은 소유 프로세스는 0개다. 성공 실행에서 부모 MCP
노출 0개, 부모 Agent 호출 1회, 실제 자식 제출 도구 호출 1회, 일치하는 ack 1개를
확인했다. OS 후손 프로세스 수와 모델 CLI 시작 수는 다르다.
이번 native 시작은 Claude 3회이며, 누적은 **738회 = Codex 297 + Claude 441**다.

## 로컬 검증과 보존

최종 관련 회귀는 **15개 파일, 163 PASS / fail 0 / skip 0**, 28.949초다.
실제 로컬 프로세스를 거치는 성공·정산 실패·중복 예약·timeout 후 후손 정리와 기존
anchors·P0·호스트 수집·ledger·연결·review 회귀를 포함한다. 거짓 ack, 잘못된 자식,
추가 도구, 부모 대리 제출, raw JSON framing, credential 환경 거부를 검사했다.

중간 테스트 명령 하나는 동시성 상한을 빠뜨려 `test-node-runner-cap`에서 실행 전
거부됐다. 명시적 `--test-concurrency=1`을 추가한 정상 경로로 검사했고 guard는 바꾸지 않았다.

증거는 `.superpowers/verification-submission-100/{before.json,audit.cjs,outcome.json}`에
있다. 감사는 native transcript를 메모리에서 선별해 처리하고 raw thinking을 출력·복사하지
않는다. 기준 228개 파일 중 의도한 기존 파일 9개만 달라졌고 나머지 219개 hash는 같다.
추가한 구현·테스트·이 문서는 별도로 검토했다. stage·commit·push·배포는 하지 않았다.

```powershell
node .superpowers/verification-submission-100/audit.cjs
```

## 다음 품질 시험의 전제

연결 진단은 Codex v2의 [98](NATIVE_VERIFICATION_98.ko.md)과 Claude v3의 이번 실행으로
각각 통과했다. 다만 Codex 프로필은 rc.1, Claude는 plugin 없는 시험 프로필이다.
정상 rc.13 plugin 흐름이나 전체 설명 품질의 증거로 이월하지 않는다.

다음 로컬 구현 대상은 고정 FIFO 진단 수신기를 실제 질문 packet에 묶는 입력 경로와,
`초안 → 질문별 독립 근거 확인 → 대조 → 한 번의 완성 설명 재작성`의 품질 실행 단위다.
초안은 자식에게 보내지 않고, 질문별 결과의 오판·누락과 재작성의 새 오류도 판정해야 한다.
알려진 Q1 실패·정상 대조·조정에 쓰지 않은 과제·반복을 완성 답변 기준으로 검사하며,
첫 실질 실패 이후 행은 UNRUN으로 남긴다. 기존 87의 남은 슬롯을 재사용하지 않는다.

설명 품질 시험과 **192 subjects / 516 requests** 전체 비교는 이번에 실행하지 않았다.
`full_input_observed`, `native_delivery_verified`, `semantic_quality_verified`는 여전히 false다.
