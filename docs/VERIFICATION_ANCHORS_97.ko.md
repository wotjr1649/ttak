# 인용 anchor 및 자식 출력 지시 97

2026-09-11 KST. [native 진단 96](NATIVE_VERIFICATION_96.ko.md)의 Claude 실패를 대상으로
인용 생성과 출력 지시를 수정하고, worker·ticket·정산까지 연결했다. 이번에는 native를
호출하지 않았다. 누적 상위 시작은 **733회(Codex 296 / Claude 437)**이며 제품은
**rc.13 / No-Go**다. 기존 실패 기록을 수정하거나 통과로 바꾸지 않았다.

## 변경한 동작

새 전송 형식은 `verification-anchors-v2`다. P0 packet 원문과 hash는 유지하고,
그 packet에서 결정적으로 생성한 source anchor 목록·목록 hash·결과 schema를 전달한다.
자식은 인용 문자열이나 UTF-16 위치를 계산하지 않고 source ID와 처음·마지막 anchor ID를
선택한다. 로컬 코드가 해당 연속 구간을 원문에서 그대로 잘라 P0 인용을 만든다.

```json
{"source_id":"S1","first":"A0002","last":"A0003"}
```

이 선택은 중간 내용을 생략하지 않는 연속 구간이다. 위치나 quote를 모델이 함께
반환하면 여분 필드로 거부한다. 잘못된 anchor를 가장 비슷한 것으로 대체하거나,
공백을 제거하거나, 인용을 첫 번째 문자열 일치 위치로 이동시키지 않는다.
반복되는 문장도 위치별 ID로 구분한다. 결과는 기존 `validateAnswer`를 다시 통과한다.

기존 [review-anchors.cjs](../scripts/review-anchors.cjs)의 기계적 구간 분할을
[source-text-anchors.cjs](../scripts/source-text-anchors.cjs)로 추출해 재사용했다.
원문·CRLF·공백·Unicode를 보존하며 surrogate pair 안을 자르지 않는다. 기존 리뷰의
anchor ID와 결과는 유지한다. 의미 단위나 사실 정확성을 판정하는 tokenizer는 아니다.

[verification-anchors.cjs](../scripts/verification-anchors.cjs)는 packet과 anchor map의
hash, source ID, 구간 순서, 중복 인용과 결과 필드를 확인한다. map은 최대 4,096개
anchor, v2 전달 JSON은 최대 64 KiB다. 기존 JSON 데이터·결과·source 제한도 적용하며,
초과하면 모델 실행 전에 실패한다.

## Claude 출력 형식

공식 문서에서 `--json-schema`는 상위 실행의 `structured_output`을 설명한다.
현재 Agent 자식에 이 schema를 직접 적용하는 인자는 확인되지 않았다. 이 옵션만
추가해 자식 결과가 강제된다고 표시하지 않는다.
[Claude headless 문서](https://code.claude.com/docs/en/headless)

대신 CLI 2.1.266에서 지원 범위에 포함되는 `--append-subagent-system-prompt`를
v2 실행에만 사용한다. bare JSON, 필드 타입과 anchor 선택 규칙을 자식의 시스템
지시에 추가한다. 기존 general-purpose foreground 경로와 구독 OAuth를 유지하며
profile·plugin·hook을 설치하거나 변경하지 않는다.
[Claude subagent 문서](https://code.claude.com/docs/en/sub-agents)

이것은 출력 규칙의 전달 위치를 개선한 것이며 native schema 강제 기능은 아니다.
Haiku가 실제로 펜스 없이 답하는지는 새 native 실행에서 확인해야 한다. 코드펜스,
본문 앞뒤의 설명, 중복된 JSON 키를 거부하는 파서는 그대로 사용한다. 모델의 형식
준수 실패를 없앴다고 아직 주장하지 않는다.

## 통합과 이전 결과의 보존

[verification-delivery.cjs](../scripts/verification-delivery.cjs)는 v1/v2를 명시적으로
구분한다. 기존 v1 FIFO 입력 hash는
`7238a68b4f69a6d815dd0f3a0f1d405aa3768f25a2843c2088857b4d00499e14`로 유지됐고,
부모 prompt도 이전 byte 계약을 보존했다. 과거 ticket의 형식을 추측하거나 자동으로
v2로 재해석하지 않는다. 새 `prepare`의 기본값만 v2다.

worker는 예약된 형식으로 부모 prompt·자식 입력을 생성하고 검사한다. Claude의
시스템 지시 인자는 검토된 worker 코드에서 고정 생성되며 packet의 자료가 CLI
인자·명령·경로를 고르지 못한다. 새 모듈까지 artifact hash 목록에 포함했다.

정산은 v2의 anchor 응답을 P0 인용으로 변환한 뒤 기존 결과 감사를 실행한다.
`wire_result_sha256`, `result_sha256`, `result_input_format`, `result_conversion`으로
원 응답과 변환 결과를 구분한다. 정산의 `p0_receipt`는 여전히 null이고,
`full_input_observed`, `native_delivery_verified`, `semantic_quality_verified`는 false다.
존재하는 anchor를 선택했더라도 답변의 의미가 참이라는 보장은 생기지 않는다.

기존 packet·P0 감사·장부의 수용 조건은 변경하지 않았다. 96의 Claude 응답은 계속
펜스 오류로 거부되며, 이전 정산은 stopped 상태다. 수정된 코드로 그 실행을 다시
정산하거나 소모한 슬롯을 재사용하지 않는다.

## 검증

**144 PASS / fail 0 / skip 0**, 13개 테스트 파일, 동시성 1, 테스트별 30초 제한으로
검사했다. 공유 anchor를 사용하는 기존 리뷰·native 변환·role workflow까지 포함했다.

```powershell
node --test --test-concurrency=1 --test-timeout=30000 tests/verification-execution.test.cjs tests/verification-anchors.test.cjs tests/review-anchors.test.cjs tests/verification-host-adapter.test.cjs tests/verification-ledger.test.cjs tests/verification-native-audit.test.cjs tests/verification-packet.test.cjs tests/verification-worker-protocol.test.cjs tests/verification-native-evidence.test.cjs tests/connection-probe.test.cjs tests/connection-probe-claude.test.cjs tests/review-roles.test.cjs tests/review-native.test.cjs
```

양쪽 호스트의 v2 입력·결과·회계를 합성 JSONL 및 실제 Node worker/Windows Job으로
검사했다. 알 수 없는 anchor·펜스 결과의 실행 후 실패, 실패 시 사용량 보존, stale
packet/map, 반복 문장, Unicode, CRLF, 범위·출력 제한과 기존 v1 호환성을 확인했다.
모델 응답을 흉내 낸 품질 통과 증거가 아니라 전송·변환·정산 코드의 로컬 검사다.

시작 파일 hash는 `.superpowers/verification-anchors-97/before.json`, 최종 보존 및
예약 검증은 같은 디렉터리의 `verification.json`에 기록한다. 전체 제품 테스트와
설명 품질 시험은 재실행하지 않았다. 원격 쓰기·새 의존성·운영 위임도 없다.

## 실행 준비와 남은 판별

새 실행 예약은 `.superpowers/verification-worker-95/` 아래 `codex-anchor97`,
`claude-anchor97`이며 각각의 `*-work/request.json`에 정확한 요청이 있다.
다음 명령은 **새 구독 호출 2회에 대한 권한이 확인된 뒤** 실행한다.

```powershell
Set-Location D:\AI_DEV\ttak\.superpowers\worktrees\first-release
node scripts/verification-native-run.cjs --execute-pair codex-anchor97 claude-anchor97
```

Codex 1회가 통과한 경우에만 Claude 1회를 시작한다. 각각 부모 1개·자식 1개,
120초·정리 5초·자동 재시도 0회다. 기존 포함량 사용과 추가 유료 비활성 조건을
유지하며 API key로 전환하지 않는다. 예약은 약 58분 뒤 만료된다. 만료 후에는
옛 예약을 변경하지 않고, 실행 권한 범위에서 새 이름으로 준비해야 한다.

이 실행이 판별할 것은 v2 실제 전달, 시스템 지시를 추가한 Haiku의 bare JSON 준수,
실제 anchor 선택과 정확한 인용 정산이다. 양쪽 통과 후에 정상 rc.13 plugin 연결과
설명 품질 검증으로 진행한다. 현재 시험 profile의 Codex plugin은 rc.1, Claude는
plugin 없음이라는 기존 상태를 유지한다. 전체 192 subjects / 516 requests는 미실행이다.
