# 실행 ticket·집계 회계 94 — 로컬 구현과 실프로세스 검사 완료

2026-09-11 KST. [adapter 93](VERIFICATION_HOST_ADAPTER_93.ko.md) 이후 요청된 실행 계층과
Codex 집계 회계 계약을 구현했다. **사전 예약 → 한 번의 작업 프로세스 실행 → 정리 →
증거 대조 → 관측 기록 확정**을 로컬에서 검증했다. 실제 모델 호출은 없었다.
누적 731회(Claude 436 / Codex 295), rc.13 / No-Go와 설명 품질 미검증을 유지한다.

## 새 실행 계층

[verification-execution.cjs](../scripts/verification-execution.cjs)의 API는 다음과 같다.

- `createVerificationExecution(root, name, plan, request)`는 새 디렉터리에 ticket을
  독점 생성하고 fsync한 뒤 `directory`, `ticket_sha256`을 반환한다.
- `openVerificationExecution(root, name, ticket_sha256)`는 고정 ticket을 대조하고
  `run(request, sourceEnv)`, `settle(reports, packets)`, `state()`를 제공한다.

plan은 run ID, host, 기존 profile, 부모 prompt, P0 packets, 검토한 code artifacts와
`not_after_ms`를 지정한다. request는 기존 bounded-native-process가 받는 절대 executable,
arguments, cwd, stdin, timeout 및 출력·정리 제한이다. 경로·명령은 모델 결과에서 선택하지
않는다. 호출자가 검토한 고정 worker를 제공해야 하며 이 API가 실행 권한을 부여하지 않는다.

ticket에는 요청 hash, 부모 prompt hash, 질문별 packet hash, 실행 파일·PowerShell·
명시적으로 검토한 코드 파일의 hash를 고정한다. 원 prompt·packet·환경 변수 값은
ticket에 저장하지 않는다. profile과 작업 경로는 task root 안의 기존 디렉터리여야 하며
링크·junction을 거부한다. 실행 파일을 제외한 artifacts는 root 안의 코드 파일로 제한한다.
실행 직전 요청·파일 hash와 profile 경로를 재검사한다. 모든 전이에서 P0 장부의 기존
bounded storage 함수를 재사용한다. 응답 감사나 P0 장부 수용 규칙은 변경하지 않았다.

`started` 디렉터리를 원자적으로 생성한 한 작성자만 Windows Job 실행에 도달한다.
두 번째 호출이나 다른 handle은 기존 시작 claim을 재사용하지 못한다. 요청·파일·경로
검증이 시작 claim 전에 실패하면 프로세스는 실행되지 않는다. claim 이후 deadline,
실행 실패·출력 오류·시간 초과·잘못된 수집 결과는 슬롯을 소모하고 중단한다. 중간에
죽어 claim만 남으면 `in_flight_or_interrupted`이며 자동 복구·재실행하지 않는다.

직접 제한하는 단위는 **supervised worker 1회**다. 그 안에서 CLI를 한 번만 시작하고
자식 수를 제어하는 일은 연결할 호스트 worker의 계약이다. 작업 실행 제한은 최대 120초,
정리는 최대 10초이며 기존 supervisor의 시작·컴파일 watchdog 여유 20초를 사용한다.
전체 not-after 시각 안에 이 여유가 들어갈 수 없으면 시작하지 않는다. 내부 API 횟수나
토큰 hard cap을 구현했다고 표시하지 않는다.

환경은 기존 `nativeEnvironment`로 좁힌다. API key 및 NODE_OPTIONS 같은 임의 실행
환경을 전달하지 않고, Claude에는 기존 구독 OAuth 변수만 지원한다. profile의 실제
인증·공급자·정상 hook 검증은 호스트 worker가 수행해야 한다. 이번에는 모델을 실행하지
않았고 자격 파일을 읽거나 복사하지 않았다.

## worker와 증거 연결

worker는 로컬 환경으로 ticket hash와 실행별 correlation nonce를 받는다. stdout에는
정확히 한 개의 다음 JSON envelope를 반환해야 한다.

```json
{
  "schema_version": 1,
  "ticket_sha256": "<고정 ticket hash>",
  "run_nonce": "<이번 실행 correlation nonce>",
  "parent_thread_id": "<실제 부모 ID>",
  "children": [
    {
      "thread_id": "<실제 자식 ID>",
      "packet_sha256": "<예약된 packet hash>",
      "spawn_mode": "fork_context_false",
      "completed": true
    }
  ],
  "completion": "completed"
}
```

Claude의 spawn_mode는 `general_purpose_foreground`다. 질문 순서·수·hash, 서로 다른
부모/자식 ID, 중복 자식과 잘못된 nonce를 검사한다. stdout/stderr 원문은 저장하지 않는다.
nonce는 공개 상관 식별자이며 호스트 출처를 암호학적으로 인증하는 자격 정보가 아니다.

정리 결과는 호출자가 제출하는 모델 텍스트에서 얻지 않는다. 실제 Windows Job 결과의
할당·종료·activeProcesses 0을 기록하고 재개 시 다시 검사한다. supervisor 실패로 정리를
확인하지 못하면 `supervisor_failed_cleanup_unverified`로 남기고 재실행하지 않는다.
실패 실행에서 사용량을 얻지 못했으면 null을 기록한다.

`settle`은 adapter가 만든 불변 report만 받으며 다음을 대조한다.

1. 실행 envelope와 보고서의 host·CLI version·부모/자식 ID 및 질문 순서.
2. 모든 관련 native 기록의 timestamp 존재와 실행 시작~종료 시간 안의 범위.
   오래된 transcript에 새 ticket만 붙이는 소급 수용을 거부한다.
3. 부모 prompt hash와 각 자식의 정확한 P0 packet 하나, 비텍스트 추가 입력·도구 부재.
4. 엄격한 결과 JSON, packet binding, 인용 구간, answered 상태와 미해결점 부재.

가시 결과와 실행 연결이 맞으면 상태는 `observed`다. 이것은 의미 정확성 합격이나
P0 `auditVerificationCall` receipt가 아니다. `native_delivery_verified`,
`full_input_observed`, `semantic_quality_verified`는 false, `p0_receipt`는 null이다.
잘못된 결과는 `stopped/evidence_rejected` 및 허용된 고정 failure code로 기록한다.
이미 식별·대조한 사용량은 결과 형식 실패 시에도 보존한다.

이 저장소는 검토한 로컬 worker와 task 소유 파일을 신뢰하는 실행 기록이다. 같은 OS
권한을 가진 악성 작성자가 ticket·파일·기록을 모두 바꾸는 것을 막는 서명 시스템은 아니다.
native API의 전체 입력이나 누락된 응답 ID를 이 nonce·hash로 입증하지 않는다.

## 집계 사용량 계약

[verification-execution-usage.cjs](../scripts/verification-execution-usage.cjs)의
`summarizeExecutionUsage(reports)`는 다음 단위를 구분한다.

| 호스트 | 단위 | 입력·출력 처리 |
|---|---|---|
| Claude | 최종 assistant message snapshot | 입력·cache 생성·cache 읽기를 더하고 output에 포함된 thinking을 재가산하지 않음 |
| Codex | 서로 다른 thread의 마지막 누적 snapshot | inputTokens·outputTokens·totalTokens를 사용하고 cached/thinking 상세를 재가산하지 않음 |

동일 thread, 혼합 host, Claude 메시지 ID 충돌과 Codex의 불일치 counter를 거부한다.
원 counter를 thread별로 보존하며 `native_api_response_count: null`,
`completeness_verified: false`, `monetary_cost: null`이다. P0가 사용하던 보수적인 예약
차감 규칙을 덮어쓰지 않는다. 이 모듈은 관측 사용량을 별도 실행 회계 단위로 정리한다.

기존 완료 세션을 새 회계 함수로 로컬 재검증했다. Claude는 29,924, Codex는
130,963토큰으로 앞선 결과와 일치했다. 새 model 요청이나 기존 기록의 소급 ticket
수용은 하지 않았다. 결과는 `.superpowers/verification-execution-94/usage-replay.json`이다.

## 검증과 보존

[실행 테스트](../tests/verification-execution.test.cjs) 13개와 기존 adapter/P0 52개,
**65 PASS / fail 0 / skip 0**다. 동시성 1, 테스트별 timeout 30초다.

```powershell
node --test --test-concurrency=1 --test-timeout=30000 tests/verification-execution.test.cjs tests/verification-host-adapter.test.cjs tests/verification-ledger.test.cjs tests/verification-native-audit.test.cjs tests/verification-packet.test.cjs
```

새 테스트는 실제 Node worker와 Windows Job을 사용해 선예약, 동시 실행 1회, timeout,
정상 종료 후 detached 자식 정리, nonce/출력/종료 실패, 중단 claim 재실행 금지,
요청·artifact·ticket 변경, 오래된 기록, profile junction 변경, 정리 기록 변조와
코드펜스 결과 거부를 검사했다. JSONL은 명시적인 합성 fixture이며 native 모델을
모방한 품질 증거가 아니다. API key 제외도 worker 안에서 확인했다.

첫 검사에서는 fixture 코드가 설정한 임시 task root 밖에 있어 11개 모두 실행 전
차단됐다. 경계 검사는 유지하고, 검토한 fixture를 그 임시 root 안에 복사하도록
테스트 배치를 고쳤다. 이후 11개 통과, 추가 경계 검사를 포함한 최종 65개 통과를
확인했다. task-created 임시 디렉터리만 정리했다.

기존 파일 중 변경한 것은 storage helper를 재사용하도록 export한
`verification-ledger.cjs`와, native timestamp 범위·누락 여부 및 불변 report 접근을
추가한 `verification-host-adapter.cjs`다. 그 밖의 시작 파일은 hash로 보존했다.
제품 hook·skill·manifest·설치·프로필 설정은 바꾸지 않았다. 새 의존성, 운영 위임,
모델 호출, 원격 쓰기는 없다. 전체 제품 검사와 설명 품질 시험은 재실행하지 않았다.

## 다음 연결 지점

실행 계층과 회계 단위의 로컬 계약은 준비됐다. 다음 작업은 기존 Codex/Claude
수집 worker를 이 ticket-envelope 계약에 맞추고, 실제 packet·결과 지시를 정상 자식
진입점에 전달하는 것이다. 현재 probe worker는 이 새 envelope를 출력하지 않으므로
그대로 넣으면 실패한다. rc.13 정상 plugin 연결과 설명 품질 시험은 그다음 단계다.
전체 system/developer 입력 관측과 Codex 응답 ID의 한계는 여전히 명시적으로 남아 있다.
