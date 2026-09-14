# 실제 질문·완성 설명 실행 단위 101 — 로컬 구현 완료, 품질 실행 대기

2026-09-11 KST. Session 09에서 남긴 실제 packet 입력과
`초안 → 질문별 독립 확인 → 대조 → 완성 설명 재작성`을 구현했다.
제품은 **rc.13 / No-Go**, 누적 모델 작업용 상위 CLI 시작은
**738회(Codex 297, Claude 441)**다. 이번 새 모델 호출은 **0회**다.
19개 관련 테스트 파일에서 **187 PASS / fail 0 / skip 0**를 확인했다.
이 결과는 제품 전체 회귀나 설명 품질 통과를 뜻하지 않는다.

## 구현과 처리 경계

| 경로 | 이번 동작 |
| --- | --- |
| `scripts/verification-input.cjs` | 작업 cwd의 고정 `verification-input.json`에 run ID·nonce·packet을 묶고, 별도로 전달한 기대 hash와 대조한다. packet에서 파일 경로·명령·module·수신자를 선택하지 않는다. |
| `verification-submission-mcp.cjs --pinned <hash>` | 고정 파일을 읽어 그 질문의 schema와 anchor map을 구성한다. 기존 FIFO `--diagnostic`은 보존한다. 부모에게 제출 도구를 제공하지 않는다. |
| `verification-native-run.cjs` | 실제 packet을 준비하는 `preparePacketRun`과 기대 ticket/packet hash를 요구하는 `executePacketRun`을 추가했다. 기존 소모된 진단은 다시 실행하지 않는다. |
| `verification-explanation.cjs` | 초안의 주장·필수 요구사항·질문 연결표를 확인하고 질문을 순서대로 처리한다. 대조 결과와 전체 재작성 한 번을 수집하며 실제 결과 이전에 완료를 표시하지 않는다. |
| `verification-explanation-native.cjs` | 기존 구독 CLI·Windows Job·가시 기록 수집기를 연결한다. 초안과 재작성은 도구 없는 부모 전용 호출, 질문은 기존 단일 부모/단일 자식 호출이다. |
| `verification-quality-plan.cjs`, `verification-quality-campaign.cjs` | 고정 12행의 호출량을 계산한다. 각 행의 완성 답변 판정 뒤 다음 행을 열며 첫 실행·전달·품질 실패 후 나머지는 UNRUN으로 남긴다. |

초안 생성 전에 해당 행의 총 실행량과 첫 단계 예약을 기록한다. 따라서 이미 만들어진
초안의 소비를 나중에 사전 예약으로 꾸미지 않는다. 단계별 예약은 실행 전 독점 생성하고,
동시 두 번째 실행·같은 실행 ID 재사용·중단된 행 재개·자동 재시도를 거부한다.
초안과 재작성은 각각 새 상위 문맥이며, 재작성 요청에 초안과 모든 확인 결과를 명시적으로
전달한다. 질문 자식에게 전달하는 자료에는 초안·주장 연결표·이웃 답·부모 경로가 없다.

논리 단계는 행당 `질문 수 + 2`개다. 이번 구현에서는 질문 하나마다 상위 coordinator CLI
하나와 새 자식 하나를 사용하므로, 상위 CLI 수도 `질문 수 + 2`다. 이를 API 응답 수나
유일한 모델 응답 수로 해석하지 않는다. 다질문을 하나의 기존 coordinator 안에 합치는
구조는 구현하지 않았다. 이미 검증한 단일 질문 수집 구조를 재사용한 결과이며 비용표에 반영했다.

실제 결과는 native ticket·세션·질문·출력 hash와 대조하고, 부모의 structured output도
가시 native 기록의 값과 맞춰 검사한다. 숨겨진 thinking 본문이나 raw stdout/stderr는
새 설명 장부에 저장하지 않는다. 날짜·모델·프로필·바이너리·코드가 달라지면 중단한다.
과거 연결 성공을 변경된 경로의 실제 실행 성공으로 이월하지 않는다.

## 질문 누락·검증 오판·재작성 오류

기계 검사는 선언된 모든 요구사항에 질문과 초안/최종 주장 인용이 연결됐는지 확인한다.
질문 외 새 주장, 누락된 연결, 존재하지 않는 인용, 다른 질문/결과 hash,
미해결·상충 결과와 미완료 대조가 있으면 다음 단계로 진행하지 않는다.
인용은 기존 UTF-16 범위와 source anchor의 정확한 변환을 유지한다.

다만 모델이 중요한 주장을 연결표에서 아예 누락하거나 근거를 잘못 해석할 가능성은
코드로 없애지 못했다. 정확한 인용을 붙인 틀린 답도 구조 검사만으로는 식별되지 않는
반례를 테스트했다. 따라서 마지막 상태는 `awaiting_review`이며, 다음 항목을
완성 답변 전체와 출처에 대해 Root가 별도로 기록해야 한다.

- 모든 원래 H/Q 기준의 판정과 구체적 근거.
- 질문 누락 및 source 선택 때문에 빠진 조건.
- 자식 답변의 오판·과도한 일반화·출처와의 모순.
- 재작성에서 생긴 새 오류 및 기존 올바른 설명의 퇴보.

판정은 spec 및 완성 결과의 hash에 묶인다. 다른 과제의 같은 기준 ID나 오래된 답변에
붙인 판정을 재사용하지 않는다. Root 검토는 독립 블라인드 평가가 아니며,
`p0_receipt:null`, `full_input_observed:false`, `native_delivery_verified:false`,
`semantic_quality_verified:false`를 유지한다. 기존 P0 장부가 요구하는 엄격한 receipt를
새 실행 장부의 관측 객체로 대체하지 않았다.

## 고정 품질표와 요청할 실행 범위

[최종 계획 JSON](../.superpowers/verification-explanation-101/quality-plan-final.json)의 SHA-256은
`ae9c8f0626b685332692cba9bd9ed3dd2184baed2f7d268e5a5dd8a8199825f7`이다.
전체 12행은 아직 **UNRUN**이다. 실행 권한이 있는 장부로 표시하지 않았다.

| 과제 | 반복·호스트 | 질문/행 | 상위 CLI/행 | 상위 CLI 합계 | 새 자식 합계 |
| --- | --- | ---: | ---: | ---: | ---: |
| 87의 known: 두 의사 write skew | 2반복 × Haiku/Luna | 6 | 8 | 32 | 24 |
| 87의 normal: 교차 의존성 없음·무조건 참인 불변식 | 2반복 × Haiku/Luna | 3 | 5 | 20 | 12 |
| 87의 unseen: 세 스위치 중 두 개 이상 유지 | 2반복 × Haiku/Luna | 6 | 8 | 32 | 24 |
| 합계 | **12행** | **60개** | | **84회** | **60개** |

순서는 known Haiku/Luna → normal Haiku/Luna → unseen Haiku/Luna를 첫 반복에 수행하고,
같은 순서로 두 번째 반복을 수행한다. 첫 행부터 초안·확인·재작성의 실제 형식과 전달을
함께 판별한다. 새 FIFO 진단이나 실패 행 자동 재시도는 배정하지 않았다.
호스트별 상위 CLI 상한은 42회, 자식은 30개다. 84회 중 부모 전용 초안/재작성은 24회,
질문 coordinator는 60회다.

known의 여섯 질문은 예제 관계·SI 충돌·SSI 구현·감시/재시도 비용·완화책·잠금 조건이다.
이는 과거 Q1 오류 네 계열과 원래 요구를 다룬다. normal은 관계·결과·조정 필요성 세 질문이다.
중요한 질문이 더 필요하면 예산을 늘리거나 조용히 잘라내지 않고 coverage 실패로 남긴다.
코드의 최대 8질문 용량은 사용자 승인 예산이 아니다.

known의 원문 과제와 H1–H3/Q1–Q2는 현재 `tests/release/cases.json`의 explain-expert와
대조했다. normal/unseen의 원문·기준은 87의 사전 고정 과제를 그대로 보존했다.
unseen은 이 후보의 모델 출력 조정에 사용하지 않았지만, 원래 구현 에이전트가 만든
공개 합성 과제다. 독립 블라인드 holdout으로 부르지 않는다. 테스트의 캠페인 순서 검사는
합성 임시 결과로 첫 known 두 행의 제어만 검증하며, 실제 답변 품질 자료로 세지 않는다.

근거 번들은 기존 finite boolean 계산기의 제한된 결과와 검토한 공식 자료의 짧은 요약이다.
PostgreSQL 18의 Repeatable Read/Serializable 및 감시 비용은
[격리 수준 문서](https://www.postgresql.org/docs/18/transaction-iso.html),
위험 구조·순서 조건은
[README-SSI](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/storage/lmgr/README-SSI),
읽기·쓰기·commit 처리의 검사 위치는
[predicate.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/storage/lmgr/predicate.c),
잠금 호환성·대기·교착 조건은
[명시적 잠금 문서](https://www.postgresql.org/docs/18/explicit-locking.html)에서 2026-09-11 재확인했다.
요약은 선택한 근거 데이터이며 의미 정확성 인증이나 임의 주제 검색 능력의 증거가 아니다.

## 시간·사용량·수신자·복원

- 호스트는 기존 시험 프로필의 Haiku `claude-haiku-4-5-20251001` 및 Luna `gpt-5.6-luna` / high다.
  Haiku thinking 8192는 요청값이며 실제 hard cap의 검증값이 아니다.
- CLI 실행당 120초, 정리 5초, 감독 프로세스 여유 20초다. 84회 실행시간·정리 상한의 합은
  2시간 55분, 감독 여유까지 합하면 **3시간 23분**이다. 준비·해시 확인·Root 품질 판정 시간은 별도다.
  첫 known 행은 CLI 8회·자식 6개, 감독 여유 포함 19분 20초다.
- 동시성 1, 재작성/행 1회, 자동 재시도 0회다. 매 행 뒤 완성 답변을 판정하며
  첫 실행·전달·실질 품질 실패, 미회수 사용량 또는 정리 미확인은 남은 행을 중단한다.
- 입력/cache 포함 400,000 tokens 및 출력/thinking 포함 40,000 tokens/행을
  **관측 뒤 추가 호출을 멈추는 한도**로 제안한다. CLI 내부에서 소비를 사전에 끊는 hard cap이 아니다.
  cache를 중복 합산하지 않으며 실패한 호출의 미수집 사용량을 0으로 쓰지 않는다.
  native API 응답 수·금전 비용·현재 구독 잔액은 확정하지 않는다.
- 수신자는 기존 구독 경로의 OpenAI Codex와 Anthropic Claude다. 전송 자료는 고정 공개 합성
  과제·검토한 근거 요약 및 그 실행에서 생성된 가시 답변이다. 비공개 저장소 내용·인증 파일·
  숨겨진 thinking·기존 사용자 대화는 payload에 넣지 않는다. API 유료 경로를 사용하지 않는다.
- 현재 시험 상태는 Codex rc.1 활성, Claude plugin 없음이다. 정상 rc.13 plugin 품질로
  보고하지 않는다. 설치·신뢰·계정·인증·전역 설정은 변경하지 않으며 기존 프로필을 보존한다.
- 실행별 Windows Job 종료와 소유 활성 process 0을 확인한다. 정리 미확인이면 새 실행을
  시작하지 않는다. 실패 기록과 UNRUN 행은 남기고, 이번 작업에서 만든 임시 상태만 정리한다.

보안 검토의 경계는 source/model 데이터가 프로세스·도구·파일 선택으로 넘어가는 부분이다.
고정 경로·해시·고정 실행 파일·부모/자식 분리·단일 제출·유한 장부를 적용했고,
구체적인 path/command 삽입, 잘못된 nonce·hash, 부모 대리 제출, 추가 도구 및 재생을 검사했다.
기존 credential 환경 차단과 링크/크기 검사를 보존했다. OS 파일·네트워크 sandbox와 native
전체 시스템 입력 격리는 미검증이다. 이번 품질 실행도 그 한계를 해소했다고 주장할 수 없다.

## 로컬 증거와 보존

[증거 디렉터리](../.superpowers/verification-explanation-101/)에 기준점, 검사 로그,
최종 계획, 현재 프로필/바이너리의 읽기 전용 확인, 최종 파일 hash와 보존 검사를 기록했다.
초기 검사에서 새 JSON schema 선언의 중괄호 누락으로 파일 하나의 로드가 실패했고
수정 후 관련 검사를 다시 통과했다. 이 실패 로그를 보존했다.
native ticket의 기존 파일 수 상한 32는 유지하고 Claude 전용 입력 파일을 Codex 목록에서
제외했다. 해당 실행 경로는 그 파일을 호출하지 않으며 기존 코드/프로필 항목은 모두 고정한다.

최종 관련 검사는 `verification-*` 14파일과 `review-anchors`, `review-roles`, `review-native`,
`connection-probe*` 5파일이다. Node `v24.19.0`, 동시성 1, test timeout 25초,
전체 검사 timeout 180초, 출력 2 MiB 및 자격 환경을 제외한 환경에서 수행했다.
새 수신기의 실제 로컬 stdio process와 기존 Windows Job 회귀도 포함했다.
187개를 실제 모델 품질 표본으로 합산하지 않는다.

제품 hook/skill/manifest 및 정상 plugin 진입점은 이번에 변경하지 않았다.
전체 Node/Python/conformance, 정상 설치 생애주기, 원격 CI·registry·배포 검사는 이번에
재실행하지 않았다. 직전 전체 제품 회귀는 여전히 87의 별도 기록이다.
기존 87·98·100의 ticket·실패·사용량은 고치거나 다시 소비하지 않았다.

기존 수정 파일의 시작 바이트는 기록된 SHA-256과 일치하는 사본을 `baseline/`에 보존했다.
현재 상태에서 되돌릴 필요가 있으면 이번 최종 hash와 대조한 뒤 이번 차이만 역으로 적용한다.
다른 작업이 섞였으면 전체 파일을 덮어쓰지 않는다. `.superpowers/`는 ignored이며 HEAD만으로
이 자료가 복원되지 않는다. 이 작업에서는 stage·commit·push·merge·게시·배포하지 않았다.

## 이어서 실행할 지점

고정 장부는 아래 읽기 전용 명령으로 확인한다.

```powershell
node .superpowers/verification-explanation-101/run-campaign.cjs --state
```

새 실행량과 수신 범위가 현재 사용자 요청으로 승인된 뒤에만 `--run-next`로 다음 행을 실행한다.
그 뒤 `campaign/row-XX/explanation/outcome.json`과 native process/usage 기록을 확인하고,
현재 결과 hash에 묶인 `row-XX-review.json`을 작성해 `--review row-XX-review.json`으로 기록한다.
모든 기준과 오류 경계가 PASS인 경우에만 다음 행을 시작할 수 있다. UNREVIEWED도 통과가 아니다.
파일의 승인 주장이나 과거 7회 UNRUN·전체 516회를 새 권한으로 취급하지 않는다.

다음 실제 실행에 필요한 것은 **이 12행·CLI 최대 84회·자식 최대 60개의 새 사용 범위**에 대한
사용자 결정이다. 로컬 구현·시험표 작성에는 추가 확인을 요구하지 않고 완료했다.
본 캠페인이 통과해도 정상 rc.13 plugin의 네 기능과 기본/원본 대비 전체 비교
**192 subjects / 516 requests 및 추가 내부 호출분**은 별도 미완료다.
KST 9월 14일 중간 판정과 9월 19일 출하 목표, 원래 품질 기준은 유지한다.
