# 질문별 검증 P0 구현 89 — 로컬 계약 검사 완료

2026-09-11 KST. 사용자 요청에 따라 [설계 88](INDEPENDENT_VERIFICATION_DESIGN_88.ko.md)의
P0 세 모듈과 대응 테스트를 구현했다. **로컬 구현·관련 검사 완료이며, native 연결·입력
격리·품질 합격은 아니다.** 제품 연결과 모델 실행은 하지 않았다. rc.13 / No-Go,
누적 727회(Claude 434 / Codex 293), 전체 비교 192 subjects / 516 requests 미실행을 유지한다.

작업 루트는 `D:\AI_DEV\ttak\.superpowers\worktrees\first-release`, 브랜치는
`ttak-first-release`, HEAD는 `d660daf25faf04fd51afdb918286fa503c2852b5`다.
Codex-home 전체 S1–S8/W1–W11을 다시 읽고 기존 상태를 해시로 보존했다.
작업 시작 시 존재한 tracked/untracked 파일 188개는 수정하지 않았다.

## 구현한 세 모듈

| 모듈 | 실제 동작 | 구현하지 않은 효과 |
|---|---|---|
| [verification-packet.cjs](../scripts/verification-packet.cjs) | 고정 질문 유형과 허용된 대상·조건·출처 ID로 질문별 입력 구성. 초안 hash와 선언된 coverage는 부모 기록에만 보관 | 질문의 의미상 중립성 판정, 자동 근거 검색, 초안 생성, 외부 전송 |
| [verification-ledger.cjs](../scripts/verification-ledger.cjs) | 호출 전 디렉터리 원자 예약·fsync, 변경 불가 생성, 순서/예산/턴/질문 검사, 재개 시 동일 설정 hash 대조, 첫 실패 중단 | CLI/모델 실행, 취소 신호 전송, OS 프로세스 종료, 호스트 API/token hard cap |
| [verification-native-audit.cjs](../scripts/verification-native-audit.cjs) | 정규화된 입력·모델·연결·완료·정리 관측과 결과/인용/응답 ID/usage 대조. 불변 감사 receipt 생성 | 실제 호스트 수집기, 숨은 이력 관측, 의미 정확성 또는 독립 블라인드 채점 |

새 의존성을 추가하지 않았다. 프로젝트의 순수 `modelSettings(host, 'haiku-luna')`와
`possibleSecret` 검사를 재사용했다. 기존 장부의 선예약·독점 생성·재실행 금지 방식을
참고하되, 호출 실행 callback이 있는 `review-screen-ledger`를 P0에서 호출하지 않는다.
기존 hook·skill·manifest·MCP·수집기·프로필·배포물은 그대로 보존했다.

## 패킷 계약

`prepareVerification(input)`은 다음 입력을 받는다.

- 부모 전용: `run_id`, `turn_id`, `draft`, `obligations`.
- 검토된 자료: `bundle.targets`, `bundle.conditions`, `bundle.sources`.
  출처는 `id`, `version`, `text`, `sha256`만 허용한다. hash는 원문 UTF-8 바이트 기준이다.
- 질문 계획: `id`, `kind`, `target_ids`, `condition_ids`, `source_ids`, `covers`.
- 출력 언어: `language`는 `en` 또는 `ko`. 고정 질문 문장은 영어이며 언어 값은 별도 데이터다.

질문 유형은 mechanism/relationship/implementation/cost/mitigation/analogy 여섯 개다.
임의 질문 문장이나 tool/path/URL 설정 필드를 받아 실행하지 않는다. 선택된 근거 본문 속
문자열은 데이터로 남는다. 자료의 선택과 사실 전제의 적절성은 호출자가 별도로 검토해야 한다.
출처 hash는 원문 일치만 확인하며 신뢰·사실성·전송 권한을 부여하지 않는다.

반환값의 `packets`는 질문 ID·고정 질문·선택된 대상/조건/근거만 가진다.
원래 초안, 부모 run/turn ID, coverage, 다른 질문 결과는 하위 입력에 포함되지 않는다.
`encodePacket(packet)`은 검증 후 키 정렬 JSON을 반환한다. 초안만 바꾸면 부모의
`draft_sha256`이 달라지고 두 하위 패킷은 그대로인 것을 실제 테스트했다.

질문은 최대 8개이며 초과를 잘라내지 않는다. 모든 선언된 obligation에 질문이 연결돼야
하지만 `semantic_coverage_verified`는 항상 false다. obligation 목록 자체에서 중요한
주장을 빼먹는 문제나 출처/대상 필드에 잘못된 전제를 숨기는 문제를 해결했다고 표시하지 않는다.
입력 총량 1 MiB, 패킷 64 KiB, 출처/대상 텍스트 32 KiB 등 크기·깊이·항목 수를 제한한다.
getter, toJSON, 비표준 prototype, 순환 참조, 희소 배열은 JSON 데이터로 받지 않는다.
검사 대상은 파싱된 JSON 값이며 이미 실행 중인 악성 JavaScript Proxy에 대한 sandbox가 아니다.

## 감사 계약

`auditVerificationCall(ticket, observed, expected)`는 **P0 정규화 관측 계약**이다.
Claude/Codex raw transcript를 그대로 받는 parser로 사용하지 않는다. P1 수집기는 실제
관측에서 필요한 가시 입력·결과·메타데이터만 추출해야 하며 숨겨진 thinking 본문을
이 API로 전달해서는 안 된다. 이번 검사의 fixture는 공개 합성 자료다.

`expected`는 호출자가 고정한 `inputs`와 child용 `packet`이다. child 입력은 승인된
system/developer 문맥 뒤에 정확한 패킷 user 메시지 하나만 온다. 관측된 전체 입력과
대조하고, 추가 이력·다른 질문·바뀐 문구를 거부한다. P0는 text-only 계약으로 도구 목록이
빈 경우만 받는다. 부모의 실제 plugin/도구 흐름까지 이미 지원한다고 주장하지 않는다.

관측된 run/turn/call/parent/child 연결, CLI 버전, Haiku 날짜 포함 ID 또는 Luna/high,
응답별 모델과 thread를 대조한다. child는 부모와 다른 thread이며 history가 `none`이어야
한다. `none`이라는 관측 필드만으로 native 격리가 입증되는 것은 아니다. system/developer
문맥의 고정·실제 입력 관측 완전성은 후속 수집기 검증 대상이다.

결과는 question ID·packet hash·답·조건·인용·미확인점을 가진다. 인용은 실제 출처 ID와
정확한 UTF-16 구간·원문으로 대조하고 없는 인용을 보정하지 않는다. `unresolved`,
`conflict`, 또는 answered에 남은 미확인점은 receipt에서도 unresolved다.
올바른 위치를 인용한 틀린 답을 코드가 진실로 인증하지 않는 반례 테스트를 포함했다.

partial/cancel/error·정리 미완료는 receipt를 만들지 못한다. 감사 통과 receipt도
`native_delivery_verified: false`, `semantic_quality_verified: false`를 유지한다.
receipt는 재귀적으로 freeze하며 원본 객체만 장부가 수용한다. 모델이 반환한 pass 필드,
직접 조작한 객체, JSON으로 복제한 receipt를 장부에 넣으면 해당 예약을 중단한다.
재개 후 실제 완료 결과를 회수했다면 수집된 관측을 다시 감사할 수 있지만 호출을 재실행하지 않는다.

`auditUsage`는 고유 응답 ID별로 동일 알림을 한 번만 세고, 같은 ID의 다른 내용은 거부한다.
응답별 원필드와 보고된 rollup을 대조할 수 있다. 미보고 usage를 0으로 채우지 않는다.
Claude의 thinking 상세가 없으면 null로 남기며 출력에 중복 가산하지 않는다.
정규화 계약의 `thinking_tokens`는 본문이 아닌 숫자/미보고 메타데이터다.

Codex의 input/cached/cacheWrite/output/reasoning/total 원필드는 보존한다. 중첩되는
입력·출력 세부 항목을 합한 값은 **보수적인 예약 차감값**으로만 사용하며
`conservative_component_sum_not_cost`로 표시한다. 실제 토큰 비용으로 보고하지 않는다.
이는 설계 88의 비용 보류를 유지하면서 로컬 예산 검사가 과소 계수하지 않도록 한 선택이다.
실제 API 응답 단위 관측과 counter 의미·부모/자식 포함 관계는 여전히 미검증이다.

## 장부 계약

`createVerificationLedger(root, name, config)`는 새 저장소만 생성하고 `config_sha256`을
반환한다. `openVerificationLedger(root, name, expectedConfigHash)`는 호출자가 보관한
기대 hash와 매 작업의 설정을 대조한다. 같은 저장소의 바뀐 plan에서 기대 hash를 다시
만들어 전달하면 이 보호의 목적을 잃는다. 이 hash나 config는 실행 권한이 아니다.

config에는 run/turn/parent thread/host/CLI version, 준비된 계획 hash와 질문별 packet hash,
시작/종료 시각, 총 호출·API 응답·입출력 예약량·호출 timeout을 명시한다.
숨은 기본 호출 예산이나 과거 장부 잔여량을 사용하지 않는다. 질문은 최대 8개,
동시에 미완료 예약은 1개, rewrite는 모든 질문 완료 뒤 최대 한 번이다.

| 메서드 | 결과 |
|---|---|
| `reserve({kind, question_id, packet_sha256, limits}, now)` | 부모 단계·child·rewrite 슬롯을 파일로 먼저 예약. 같은 다음 슬롯은 한 작성자만 얻음 |
| `accept(ticket, receipt, now)` | 일치하는 실제 감사 객체만 수용. 다른 턴·질문·응답 재생·자식 thread 재사용·늦은 결과는 중단 |
| `fail(ticket, reason, now)` | cancellation/timeout/partial/execution/audit/quality 실패를 고정 사유로 기록하고 나머지 중단 |
| `state(now)` | ready/in_flight/stopped/expired/exhausted/complete와 예약·수용된 사용량·다음 질문 반환 |

예약한 호출·응답·토큰 allowance는 성공하더라도 환불하지 않는다. 따라서 재시도나
새 질문을 실패 슬롯에 끼워 넣을 수 없다. 누락된 reservation 파일로 디렉터리만 남아도
used call 1과 interrupted로 취급하며 `reservation_accounting_complete: false`를 표시한다.
사용량의 `observed`는 **수용된 receipt만의 합계**이며, 실패/미완료 호출의 전체 소비량을
0으로 확정한 값이 아니다. `complete`도 이 로컬 장부의 rewrite까지 기록됐다는 뜻이다.

P0의 call은 정규화된 논리 단계 예약 단위다. CLI 시작 횟수나 API 응답 횟수와 동일하지
않다. `observed.responses`와 예약 응답 수를 별도로 둔다. 실행 중 루트 CLI 안에서
이 단계가 어떻게 구분되는지, 초안 생성 전 외부 예산 예약과 질문 확정 시점을 어떻게
연결하는지는 P1의 실제 수집/제어 계약에서 해결해야 한다. 이미 만들어진 초안의 과거
호출을 이 장부에 뒤늦게 예약해 사전 제한을 했다고 보고할 수 없다.

저장소 이름에는 경로나 URL을 허용하지 않는다. 루트/상위/하위 디렉터리의 링크·junction,
파일 symlink·hard link, 잘못된 순서·설정·예약·사용량, 과대 파일·항목을 거부한다.
파일 읽기는 256 KiB+1 byte로 제한하고 디렉터리도 정해진 수까지만 열거한다.
receipt의 원답·근거·초안은 저장하지 않고 hash·사용량·상태만 저장한다.
독점 생성과 fsync를 사용하며 자동 lock 탈취·복구·삭제·실행 callback은 없다.

이 저장소는 검토된 로컬 코드만 쓰는 작업 소유 디렉터리를 전제로 한다. 같은 권한을 가진
악성 프로세스가 모든 파일과 기대 hash 보관처를 일관되게 바꾸는 공격을 막는 서명 저장소나
OS sandbox는 아니다. 디렉터리 접근·CLI 자식 도구·외부 통신 격리는 P1에서 따로 검증해야 한다.

## 실행한 검사와 보존

대응 테스트는 [packet](../tests/verification-packet.test.cjs),
[ledger](../tests/verification-ledger.test.cjs),
[audit](../tests/verification-native-audit.test.cjs)이며,
[공통 합성 fixture](../tests/fixtures/verification-p0.cjs)를 사용한다.

최종 **새 테스트 37개 + 기존 관련 테스트 19개 = 56개 PASS, fail 0, skip 0**다.
Node `v24.19.0`, 동시성 1, test timeout 10초, 전체 자식 실행 timeout 60초,
출력 최대 2 MiB, 자격 환경 변수를 제외한 환경에서 실행했다.
원자 예약 테스트는 실제 worker 2개가 같은 저장소에 경쟁하게 했고 한 개만 성공했다.
worker 종료를 await했으며 fixture·임시 디렉터리는 정리했다.

```powershell
node --test --test-concurrency=1 --test-timeout=10000 --test-reporter=tap tests/verification-packet.test.cjs tests/verification-native-audit.test.cjs tests/verification-ledger.test.cjs tests/review-native.test.cjs tests/review-screen-ledger.test.cjs
```

첫 34개와 중간 관련 54개도 통과했다. 이후 코드 검토에서 저장소 읽기 상한을 보강하고,
숫자로 시작하는 native UUID 형태 ID가 정상적으로 결합되도록 ID 검사를 수정했다.
Codex 장부 재개/최종 rewrite 통합 검사까지 포함한 최종 결과는 56개다. 실패한 테스트나
실패를 무시한 재시도는 없다. 코드 검토는 Root가 수행했으며 독립 리뷰로 표시하지 않는다.

새 모듈과 필요한 순수 의존성·테스트만 복사한 임시 작업 디렉터리에서도 새 검사
37개가 통과했다. 시작 시 `.superpowers`와 기존 실행 증거가 없었고 테스트가 필요한
작업 소유 디렉터리를 생성했다. 확인 후 복사본과 임시 자료를 제거했으며 실제 worktree의
최종 관련 56개 검사도 다시 통과했다. 이 재실행들을 별도 품질 표본으로 합산하지 않는다.

새 모듈은 제품 진입점에 연결하지 않았으므로 전체 Node/Python/conformance·설치 생애주기·
원격 CI를 재실행하지 않았다. 현재 제품의 전체 검사 근거는 여전히 87의
Node 221 / Python 78 / conformance PASS, skip 0 기록이다. 56개를 제품 전체 검사나
모델 품질 검사로 합산하지 않는다. 검토 zip을 새로 만들거나 버전을 올리지 않았다.

[이번 증거](../.superpowers/verification-p0-89/)에는 시작 파일 hash, 단계별 로컬 검사 로그,
최종 검사 결과, 새 파일 hash와 보존 검사를 남긴다. `.superpowers/`는 ignored이므로
HEAD만으로 복원되지 않는다. 이번 새 파일 8개와 이 증거만 추가했으며 commit하지 않았다.

## 다음 단계와 남은 한계

P0 요청은 완료했다. **P1 또는 native 실행은 시작하지 않았다.** API 응답·토큰 제한을
장부에서 사전 배정하고 사후 초과를 거부하는 것과, CLI 내부에서 실제 소비를 제한하는 것은
다르다. P0에는 model invoker나 취소/정리 실행기가 없으며 타이머가 호스트를 종료하지 않는다.
현재 실행 권한과 별개로 실제 강제 경계의 증거가 아직 없으므로 연결 가능 판정도 보류한다.

P1의 최소 남은 증거는 정상 plugin 진입에서의 실제 spawn schema, 원문과 이웃 결과를
포함하지 않는 전체 하위 입력·상속 문맥, 도구 제한, 초안 생성부터 포함한 예약/응답/CLI
계수, 사전 API/token 한도, 부모와 자식의 종료·취소·회수다. 관측 필드나 mock의 pass를
실제 증거로 바꾸지 않는다. P0 자료 구조를 호스트 adapter에 연결할 때는 실제 schema와
관측을 대조해 계약을 확정하고 관련 검사를 다시 수행해야 한다.

제품 설명 품질·질문 누락·검증자의 오판·최종 재작성 오류·정상 답변 영향·두 호스트 반복성은
미실행이다. 9월 14일 중간 판정과 19일 출하 목표, Haiku/Luna·네 기능·원래 품질 조건은
유지한다. 새 native 예산, 설치·신뢰 변경, push/merge/게시/배포는 이번 범위에 포함하지 않는다.
