# 검증자용 계산 실행 표 158 — 종료·복원

목표 **active / No-Go**.157의 실제 wrong-state/오승인과 긴 계산 근거를 대조해,
원래 source에서 재계산한 짧은 실행 표를 fact/final verifier packet에 제공한다.
후보 `0.2.0-rc.13+codex.20260913070044`, namespace `ttak-witness158`.

## 범위와 보존

원래 O4는 사용한 구현·잠금 주장을 정확히 한정하라는 요구다. 주어진 구현을 모두
설명하라는 의무로 바꾸지 않는다. 원문 전체, 부모용 sourceModels/model_evidence,
독립 fact와 정확한 final 검토·400-byte 제출·preview1회·native 영수증/결과 조회·
Stop 및 모든 원래 출하 조건을 유지한다. 새 도구·모델 호출·영구 원문 저장은 없다.

native packet의 model_evidence만 projection을 사용한다. source provenance와 원시
정의는 그대로이고, analyzeScenario에서 실제 계산한 concurrent-start witness와
serial witness를 받는다. 위반 순서가 있으면 그 witness를 선택한다. 각 행에 거래,
실제 guard 읽기값·outcome·적용된 쓰기·state_after를 결합한다. state_columns의
순서와 상태 벡터가 대응한다. 검사한 순서 수·aggregate invariant 결과와 모델 밖
DB/모든 interleaving을 검증하지 않았다는 한계를 명시한다. source나 부모가 쓴
computed 결과 라벨을 믿거나 실행하지 않는다.

원래 입력의 검증자용 model_evidence는2735→1607 bytes, fact packet은14092→13234
bytes다. 원문6240 bytes/SHA와 부모용 근거는 동일하다. 표에는 T1 이후[false,true],
직렬 T2의 guard_read_values={A:false}, guard_false와 writes_applied={}가 직접
나타난다. 이 local probe는 native 의미 품질이나 오류 해결의 인증이 아니다.

## 로컬·설치 근거

새 projection 검사6개: 핵심4 RED→PASS, packet 연결1 RED→6 PASS. 이름/셀 순서 변경,
guard false·쓰기 충돌·직렬 위반 구분, 실제 witness 선택·전체 원문 보존·부모 계약 보존,
secret/Unicode/실행 객체 거부와 허용된 경계 크기에서 기존16000-byte 상한을 확인했다.
최종 **Node61파일/686 PASS/0skip, Python79, conformance PASS**. helper9검사/
24 syntax, skill/marketplace 검증 PASS. 수명주기 보존·재개 검사는 local-only다.
범용 plugin helper의 기존 per-host MCP 비호환은 역사FAIL/현재UNRUN으로 보존했다.

157 대비33 runtime 파일 중4개(manifest2·계산근거/packet 코드2)만 바뀌었다. 이전
personal과157의 설치·비활성·불변 source를 확인하고 helper 기본UTC cachebuster와
새 task-local scaffold를 사용했다. 정상 양쪽 등록·설치,33파일/11hook 경로·명령·해시
대조 후 신뢰 설정과 정상 활성화가 통과했다. 전역 설정·인증·결제·모델 변경은 없다.

## 배정·현재 상태

새 native10/상한12: 양쪽 활성화 → 원래 복잡 과제 양쪽 → Nori 정상 양쪽 → 보류 양쪽
→ 같은 세션 상태 재개 양쪽. 이번 변경이 model_evidence 경로에만 영향을 주므로
원래 과제를 정상 대조보다 먼저 판별한다. 관리8/상한12(읽기 전용 목록1·준비5·복원2),
내부검증상한66, 동시성1·native120초+cleanup5초·관리20초+5초·supervisor20초,
자동재시도0을 유지한다. 종전 누적1004(600/404)와157 미사용/UNRUN은 별도 장부다.
원래192 subjects/516 requests 출하 비교도 별도로 유지하며 현재UNRUN이다.

양쪽 활성화는PASS,03-claude-complex는실패해 후속7개행을UNRUN으로 닫았다.
표 정확성만으로 Go를 내리지 않는다.157의 preview 중복과 실패 뒤 추가 호출·요구 완화,
근거 없는 비용 관계·알려진 의미 오류도 계속 필수 회귀다.

근거: `.superpowers/release-loop-158/`의 `DESIGN.ko.md`, `original-witness-probe.json`,
`allocation.json`, `source-delta.json`, `manifest-final.json`, `native-plan-final.json`,
`full-qualified-final/`, `helper-qualified.json`, `management/`, `rows/`.

## 실제 실패·정산

원래 Haiku 과제는120006ms timeout, cleanup_verified=true/소유process0으로 끝났다.
예약된 세션과 실제 연결된 자식2개의 완료 기록만 새 recovery에 회수했다. 숨겨진
reasoning text나 전체 transcript는 복사하지 않았다. 모델의 completed 응답14개에서
관측 **363717 tokens** = input354954 + output8763(thinking3113은 일부)다.
terminal CLI aggregate가 없고 진행 중 미보고 사용량 가능성true를 유지한다.

실제 packet의 실행 표·fact 영수증·원래 결과 조회·final 준비와 첫 preview까지의
상태 재생이 retained attempt와 일치한다. 이 행의 A/B 읽기·상태 서술은 표와 맞았다.
그러나 preview617/727/562 bytes 뒤 중복preview가 거부됐고, 실제제출465/448/417도
거부됐다. final Agent는4-turn에서 미완료. 부모는 비활성SendMessage와 실패 뒤
결과 조회를 시도했고, 부모final/Stop 전에timeout됐다. outer state는unavailable,
attempt는pending, final submitted=false다. 취소/재개 성공이나Stop PASS로 세지 않는다.

fact의 읽기/쓰기 의존성 부정과 final의 SSI 전체 비차단·lock-free 서술 및 잠금의
no-retry 비용 제외는 미충족이다. 거부된approve_explanation은 이를 놓쳤다. 과거
계산 근거의 명시적read/write·write/write edge 목록이 새projection에서 빠진 것도
확인했다. 누락은 사실이나, 그것이 native 오류의 원인이라고 확정하지는 않는다.
다음 수정에서 이 근거를 복원하고 parity 검사를 추가한다. preview 반복은 별도
전달/상태 안내 경계를 조사하며, 같은 요약 문구 재시도나guard 완화는 하지 않는다.

실패 감사 SHA `4bfffaea3bdcc77744946d8eb62afb5ef2c094a28728e94721423378c4f783de`.
회수 SHA `78286132abc717001bbb57d8762c1d2b2a055a1a175d4f88a1259292ce546e09`.
최종 **FAIL_TIMEOUT_DUPLICATE_PREVIEW_AND_SEMANTICS / CLOSED / RESTORED**.
native3/10배정/상한12, 후속7 UNRUN·상한미사용9. 관리8(복원2 사용), 내부Agent2.
누적 **1007(Claude602/Codex405)**. 정상 대조는158에서UNRUN이며157의 통과를
전용하지 않는다. 모든 소유Job/process0·양쪽 선택·자체ON파일2개 원래부재를
복원했다. 캐시·등록·비활성 신뢰metadata·실패근거를 보존했고 mid-sessionOFF 없음.
