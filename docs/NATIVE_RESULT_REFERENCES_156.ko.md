# 실제 결과 참조 반환 156 — 종료·복원

목표 **active / No-Go**. 후보 `0.2.0-rc.13+codex.20260913052124`의
짧은 정상 대조는 두 호스트에서 통과했으나 원래 Haiku 복잡 과제가
**FAIL_SUMMARY_LIMIT_AND_SEMANTICS**로 실패해 배치를 종료·복원했다.
남은 출하 조건은 미완료이며 정상 대조는 Go 판정이 아니다.

## 변경한 경계

기존 typed result compiler는 전체 result/final_text와 별도로 짧은 receipt_text를
만든다. 영수증은 `ttak-verification-receipt-v1`, challenge, 실제 result SHA의 세
필드뿐이다. 정상 자식 반환이 제출 해시와 일치해도 새 `referenced` 단계로 남으며,
그 자체로 다음 fact/final이나 설명 완료를 허용하지 않는다.

부모의 정상 `explanation_result` PreToolUse가 정확한 자식 native 기록에서 이미
제출된 결과를 읽는다. actual call SHA·result SHA·부모/자식·turn·cwd·모델/버전과
실제 tool_use/result 쌍을 확인한 후 read-only MCP에 원래 값을 전달한다. 정확한
PostToolUse까지 대조해야 `returned`가 된다. final의 질문 범위와 모든 사실 receipt가
갖춰져야 완료가 된다. 기존 전체 JSON 반환도 기존 검증 경로를 그대로 거친다.

새 raw 결과 파일이나 외부 저장소는 없다. 기존 transcript의 코드·reasoning을
실행/출력/복사하지 않으며, 선택한 결과 외의 내용은 전달하지 않는다. 8MiB/10000행·
항목/깊이/UTF-8·regular/nlink1·경로/파일 동일성 경계를 재사용했다. 누락·변조·다른
자식·잘못된 parent path·hardlink·실패한 Pre/Post는 사용할 수 없다. 자식이 부모의
조회 도구를 호출하면 거부하고 다른 turn의 부모 상태를 훼손하지 않는다.

400-byte final 요약과 모든 상세 issue/전체 결과/질문 범위·단일 수정·독립 검증·
실제 native 종료·정확한 최종 본문·보류/실패/재개·120초 제한은 유지했다.
154에서 거부된 호출을 수용하거나 그 배치를 재실행하지 않았다. 공유 skill에는
영수증과 실제 답의 구분을 추가하고 호스트별 wire는 adapter에 남겼다.

## 로컬 근거

신규 parser·영수증 단계·정상 hook/MCP·위조·누락·변조·읽기 실패·code recipe·
400-byte 경계 검사15개가 추가됐다. 최종 **Node58파일/668 PASS/0skip, Python79,
conformance PASS**, 집중263 PASS다. 첫 전체 회귀의 provider-neutral 실패는 공유
skill의 호스트 이름을 중립 문구로 바꿔 해결했다. 검사 자체는 완화하지 않았다.

실제154/155 기록에서 원래 제출 결과를 읽는 local probe도 해시 일치로 통과했다.
Codex0.154.0 자식 header의 id는 자식이고 session_id는 루트라는 관측에 parser와
반례를 맞췄다. 이 probe는 과거 전체 JSON 흐름을 읽은 것이며 새 native 흐름의 성공으로
계산하지 않았다. 최초 fixture UUID 오류·schema 가정·helper 개수 오류와 실패 로그도
보존했다. 범용 plugin helper의 기존 per-host MCP 비호환은 역사 FAIL/현재 UNRUN이다.

33파일을 고정했고14 MCP tools,11 hooks를 정상 설치에 반영했다. 기본 전역 personal
파일이 없어서 그 update 경로는 중단했다. 승인된 시험 프로필의 정상 CLI 목록과
Claude 등록 상태에서 이름이 비어 있음을 확인한 뒤, 루트 내부에 helper의 기본 이름
personal로 새 scaffold를 만들었다. 전역 파일은 생성하지 않았다. 정상 등록·설치와
정확한 파일/명령/해시 검토 후 신뢰 설정을 사용했다.

## 실제 정상 대조

| 호스트 | 시간 | 완료 응답 | 관측 tokens | 결과 |
|---|---:|---:|---:|---|
| Haiku | 62972ms | 13 | 259771 | 두 영수증·원래 결과 조회·정확한3문장·Stop PASS |
| Luna/high | 88570ms | 10 | 174244 | 두 영수증·원래 결과 조회·정확한2문장·Stop PASS |

원래 Nori 정의로 두 read가 모두7을 반환하고7이 남는 것을 설명했다. 쓰기/동시성/
영속성/시간 보장을 추가하지 않았다. 양쪽 실제 native 상태 전이 재생이 retained state와
일치하고, 각각 독립 fact/final 검증자2개와 정확한 제출·자식 반환·조회가 확인됐다.
이 대조만으로 복잡 과제 H/Q나 일반 의미 검증 능력을 인증하지 않는다.

Luna 검토의 “two-sentence limit” 표현은 원래2–3 범위보다 좁다. 실제2문장은 원래
범위 안이라 이 대조에서 잘못된 승인은 아니지만, 모든 유효한3문장을 수용한다는
일반화 근거로 삼지 않는다. 이 표현상 한계는 review.json에 남겼다.

감사 SHA: Haiku `49a0a54dd09bbc26300eefcb9bc0dce890873be96883df0c7d15aa31a6ef52a0`,
Luna `46e1e751e15d4d87d06891296fc8cb829394df9c0895952fc28cff8b34ba80f8`.

## 원래 복잡 과제 실패

Haiku는115304ms에 정상 프로세스 종료했지만 final 검토 요약697/730/785 bytes가
400을 넘어서 정상 PreToolUse에서 거부됐다. 동결 compiler로 같은 입력 오류를
재현했고 final submitted=false / unavailable, 실제 Stop continue=false가 일치했다.
fact 영수증과 정확한 native 결과 조회는 성공했다. 부모는 검사가 실패했고 설명이
승인되지 않았다고 보고했으며 재제출·새 binding을 시도하지 않았다.

검증자가 제출하려던 approve_explanation에도 별도 의미 결함이 있었다. fact의
“four atomic cells”는 실제2개 셀 A/B와 다르다. 최종문에는 처리량 감소 비율이
transaction duration에 비례한다는 근거 없는 정량 관계와 “Unrelated transactions
see no impact”라는 근거 없는 비용 제외가 있었다. 따라서 형식 수정만으로 이 사례를
통과시킬 수 없다. 실제 final은 거부됐으므로 승인된 설명이나 H/Q PASS로 세지 않는다.

실패 감사 SHA `93606e8312e7618a8d8469ba1da229175f65fa6fc995f6aeafa6acd7aa486e9b`.
이 행의 완료응답12, tokens297889(input289379/output8510; thinking3533은 일부)다.

## 배정·정산·다음 작업

새 native10/상한12, 관리8/상한12(읽기 전용 목록1·복원2 포함), 내부검증상한66,
동시성1·자동재시도0. native120초+cleanup5초, 관리20초+5초, supervisor20초다.
종전 누적994(594/400)와 원래192 subjects/516 requests는 별도 장부다.

활성화2·정상대조2 PASS 뒤05-claude-complex가 실패했다. native5/10배정/상한12,
후속5 UNRUN, 상한미사용7. 관리8(복원예약/사용2), 실제 내부Agent6/상한66이다.
전체 완료응답35, **731904 tokens** = input715587 + output16317,
thinking7119는 output 일부다. 실제 CLI/model usage와 대조했고 새 누적은
**999(Claude597 / Codex402)**다.

모든 소유 Job 정리·process0, 두 프로필 선택과 자체 ON 파일2개의 원래 부재를
복원했다. 캐시와 미검증 상태·근거는 보존했으며 세션 중간 OFF 주입 제거는 하지 않았다.
다음은 제출 전에 정확한 UTF-8 크기를 확인하는 비승인용 format preview를 조사한다.
기존 final 제출 guard를 유지하고, 위 의미 오류들은 별도 필수 회귀로 남긴다.
같은 Haiku 요약 축소 안내만 다시 실행하지 않는다. 목표는 계속 active다.

근거: `.superpowers/release-loop-156/`의 DESIGN, allocation, packaging,
manifest-final, source-delta, native-result-source-probe, focused-qualified,
full-qualified-final, helper-qualified, management, rows/*/{completion-audit,review}.
