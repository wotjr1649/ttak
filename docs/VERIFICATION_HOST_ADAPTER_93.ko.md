# 호스트 adapter 93 — 로컬 변환·실제 기록 재검증 완료

2026-09-11 KST. [연결 진단 92](NATIVE_CONNECTION_92.ko.md) 이후 사용자 계속 요청으로
호스트 기록을 P0 입력·결과·사용량 계약에 연결하는 로컬 전처리 모듈을 구현했다.
**전처리와 검사는 완료했지만 P1 전체 또는 rc.13 정상 plugin 연결 완료는 아니다.**
필요한 native 증거가 없는 상태에서 P0 장부에 성공 receipt를 넣지 않는다.
추가 모델 호출은 0회, 누적 731회(Claude 436 / Codex 295), rc.13 / No-Go를 유지한다.

## 구현

[verification-host-adapter.cjs](../scripts/verification-host-adapter.cjs)는 파일·프로세스·네트워크
접근이 없는 데이터 모듈이다. P0 packet 검증과 `validateAnswer`, `auditUsage`를 재사용한다.
임의 경로·명령·URL을 실행하지 않으며, raw transcript 문자열을 받은 뒤 허용된 가시 필드만
반환한다. thinking 본문과 원본 오류 본문은 반환값이나 오류 메시지에 넣지 않는다.

| API | 기능 |
|---|---|
| `prepareChildInput(host, packet)` | 현재 관측한 버전·모델을 고정하고 정확한 P0 user packet과 별도 결과 형식 지시를 준비한다. 지시가 실제 자식에게 전달됐다고 표시하지 않는다 |
| `collectClaudeTranscript(jsonl, binding)` | 부모 session·자식 agent·isSidechain·버전·모델을 대조하고 native assistant message ID별 마지막 usage를 선택한다 |
| `collectCodexTranscript(jsonl, binding)` | thread·버전·모델·effort·완료와 마지막 누적 usage를 읽는다. 응답 ID가 없으므로 `responses: null`을 유지한다 |
| `reconcileClaudeUsage(reports, modelUsage)` | 같은 부모에 속한 서로 다른 thread의 메시지 ID 충돌을 검사하고 P0 `auditUsage`로 전체 rollup을 대조한다 |
| `parseChildResult(packet, text)` | JSON 객체 하나만 받고 packet binding·출처·인용 구간을 검사한다. 코드펜스·주변 문장·중복 JSON key·임의 보정을 거부한다 |
| `assessChildForLedger(report, packet)` | 정확한 단일 user packet·도구 부재·결과를 검사하되 부족한 증거를 blockers로 반환한다. `ready_for_ledger: false`, `receipt: null`이다 |

지원 버전은 실제 관측된 Claude 2.1.266과 Codex 0.154.0이다. 다른 버전을 호환된 것으로
추정하지 않는다. 새 의존성은 없다. 임의 JS 객체를 transcript로 받지 않고 JSONL 문자열만
받는다. 최대 2 MiB·2048행·행당 256 KiB로 제한한다. binding은 P0의 데이터 검사를 거친다.
반환 report는 재귀적으로 freeze하고 모듈 내부에서 생성한 객체만 후속 감사 함수가 받는다.
이 표식은 호스트 출처의 인증이나 악성 로컬 작성자에 대한 서명이 아니다.

Claude의 동일 UUID 재전달은 내용이 같을 때만 무시한다. 같은 message ID의 usage는
입력 category가 유지되고 output·thinking이 역행하지 않을 때 최종 상태로 갱신한다.
알림별 값을 더하지 않는다. 서로 다른 ID의 응답을 합치거나, 알 수 없는 thinking을
0으로 채우지 않는다. 부모 `tool_result`와 이미지 같은 비텍스트 user 블록의 존재를
별도로 기록하며 자식의 단일 packet 검사에서 거부한다. server tool도 도구로 기록한다.

Codex는 누적 counter의 중복 알림을 합산하지 않는다. 누락된 counter, 역행, 다른
thread·버전·모델·effort, 종료 오류·미완료를 거부한다. custom tool 코드와 결과는
도구 사용 존재로만 기록하며, `exec` 본문을 평가해 spawn 증거를 만들어내지 않는다.

## 왜 아직 plugin을 교체하지 않았는가

현재 실제 기록은 user 본문 및 가시 응답 중심이다. 전체 system/developer 입력을
포착하지 못했으므로 가시 user 메시지 목록을 전체 입력이라고 이름 붙일 수 없다.
또한 현재 Codex 누적 usage에 임의의 응답 ID를 붙이면 P0의 응답별 감사 의미가 달라진다.
P0 장부의 성공 수용을 위해 필요한 실제 spawn·완료·정리와 사전 예약 ticket의 연결도
이 전처리 모듈이 생성할 수 있는 증거가 아니다.

따라서 부족한 증거를 채우는 것처럼 보이게 하거나 기존 감사 검사를 제거하지 않았다.
P0 `auditVerificationCall` 또는 `ledger.accept`를 자동 호출하지 않으며, 기존 rc.13의
scenario review·Stop hook·skill을 새 경로로 교체하지 않았다. 다음이 남아 있다.

1. 가시 입력과 전체 입력을 구분한 채 실제 호스트 수집 증거를 사전 예약 ticket에 결합한다.
2. Claude의 결과 형식 지시가 실제 독립 자식에 전달되는 진입점을 마련한다. 현재
   `prepareChildInput`의 지시 문자열은 준비 자료이며 설치된 agent 정의가 아니다.
3. Codex의 응답 식별 증거를 확보하거나, 집계 관측을 별도 회계 단위로 취급하는 계약을
   설계한다. 누적 snapshot을 실제 API 응답으로 둔갑시키지 않는다.
4. 그 증거를 사용하는 정상 rc.13 plugin 연결·회귀 검증 후 설명 품질 시험으로 진행한다.

이 구현은 P1의 전처리 단위를 완료한 것이다. 모델을 호출하는 runtime adapter, 정상
plugin 진입, 완전한 입력 격리, 의미 정확성 및 설명 품질은 완료로 보고하지 않는다.

## 검증

[대응 테스트](../tests/verification-host-adapter.test.cjs) 15개와 기존 P0 37개,
**52 PASS / fail 0 / skip 0**다. Node 동시성 1, 테스트 timeout 15초로 실행했다.
초기 50개 통과 뒤 비텍스트 입력·server tool·중복 JSON key에 대한 방어 검사를 보강했다.

```powershell
node --test --test-concurrency=1 --test-timeout=15000 tests/verification-host-adapter.test.cjs tests/verification-packet.test.cjs tests/verification-native-audit.test.cjs tests/verification-ledger.test.cjs
```

완료된 native 기록도 새 adapter로 로컬 재검증했다. 모델 재실행은 아니다.

- Claude 부모 2개·자식 1개 메시지의 최종 usage가 result.modelUsage와 일치한다.
  input 29, cache creation 17,153, cache read 11,496, output 1,246, thinking 906이다.
  thinking은 출력에 포함되고 비중첩 합계 29,924를 유지한다.
- 실제 Claude 코드펜스 결과는 엄격한 결과 parser가 거부했다. 합격시키려고 본문을
  바꾸거나 fenced JSON을 자동으로 벗기지 않았다.
- Codex 자식 누적 input 9,744, cached 1,792, output 21, total 9,765를 복원했다.
  응답 ID 목록은 null, 전체 입력 관측은 false다.

기계 검증과 실제 기록 대조는 Root가 수행했으며 독립 블라인드 감사가 아니다.
제품 진입점은 바꾸지 않아 전체 Node/Python/conformance·설치·원격 CI를 재실행하지 않았다.

작업 시작 시 tracked/untracked 파일 203개를 hash로 고정했다. 이 모듈·테스트·문서
3개만 추가했고 기존 파일은 보존했다. 증거는 `.superpowers/verification-adapter-93/`에
시작 hash, 단계별 native 재검증 및 최종 보존·검사 결과로 남겼다. ignored 증거는
HEAD만으로 복원되지 않는다. 모델 호출·운영 위임·설치·프로필 변경·원격 쓰기는 없었다.
