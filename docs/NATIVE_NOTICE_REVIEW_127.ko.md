# 독립 보류문 검토와 native 호출 자리표시자 실패 — 127

후보 `0.2.0-rc.13+codex.20260912164429`에 독립 보류문 검토를 구현했다. 그러나 실제
Haiku는 검증자 호출의 자리표시자를 XML로 해석해 정확한 launch prompt를 보내지
않았고, 기존 guard가 Agent 시작 전에 거부했다. 독립 보류문 검토의 실제 의미 품질은
이번 배치에서 UNRUN이다. 전체 목표는 active / No-Go다.

## 구현·검증 범위

`explanation_decide`는 원래 요청 전체와 revision을 받아 보류문 및 검토 packet을
발급한다. 원문 해시를 정상 UserPromptSubmit에 결합하고, fresh native 검증자의
실제 ID·typed 결과·종료 receipt가 있어야 정확한 보류문을 전달할 수 있다. 검토자가
승인한 것은 보류문이며 완성 설명 complete로 전환되지 않는다. 누락된 명시적 평가도
검토하며 보류문 수정은 한 번만 허용한다. 실패·취소·다른 binding·활성 검증자·지출된
교정 예산을 바꾸어 성공시키지 않는다. durable state에는 원문·본문 대신 metadata만 둔다.

새 원문 입력에 공통 JSON 검사와 평문 안전 검사를 적용했다. 수정 중 입력 안전 반례가
이를 빠뜨린 경로를 찾았다. 바인딩 반례의 다른 ID는 유효한 UUID로 고쳐서, 포맷 검사가
아닌 실제 원래 요청 결합 검사를 시험했다. 집중 138 PASS, 전체 Node 45파일 / 543 PASS /
0 skip, Python 78 PASS, conformance PASS다. 모형 receipt 시험은 native 의미 검증이 아니다.

## 실제 실패·정산

Haiku는 원래 6,491자 요청을 정확히 전달하고 corrections 필드도 채웠다. 그러나
정정의 basis에는 잘못된 읽기 집합 설명이 섞여 있어 독립 검토가 필요했다. 도구 응답의
`Agent.prompt`는 아직 `<packet.prompt>` 자리표시자였고, 실제 호출은
`<packet.prompt>해시</packet.prompt>`였다. 고정 guard의 재생은
`verification_unknown_packet`을 재현했다. 이어 부모의 child-only getter 호출도
거부됐고 unavailable가 보존됐다. 이 실패를 의미 검토자의 오판으로 분류하지 않는다.

근거는 `.superpowers/release-loop-127/rows/03-claude-unresolved/failure-audit.json`이다.
46,856ms, 모델 응답 4개, 111,001 tokens, Agent 시도 1개 / 실제 시작 0개다.
Native 3/8, 관리 7/7(복원 2/2), 후속 5행 UNRUN. 두 프로필 선택 및 task-created
ON 파일 부재를 복원했고 캐시·실패 원본은 보존했다. 누적 상위 native는 903회
(Claude539 / Codex364)다. 원래 192 subjects / 516 requests 비교는 미실행이다.

128은 같은 guard를 유지하고, 각 packet 응답에 정확한 `Agent` 호출 객체를 직접
제공한다. 보류·fact·다음 fact·final의 같은 자리표시자 경계를 함께 수정한다.
