# 148 — 요청 전체 사실 검증 경로, 선행 평가의 거짓 근거 부족

후보 `0.2.0-rc.13+codex.20260913005219`은 부모가 질문 목록과 선택 출처를 재작성하는
단계를 없앴다. 두 호스트의 같은 `explanation_prepare`는 원문과 초안을 받는다.
컴파일러는 부모 초안을 보여 주지 않는 `REQUEST_FACTS`를 만들고, 실제 fact 결과 이후
별도 fresh 검증자가 정확한 최종 본문·원문·모든 필수 요구를 검토한다. 초안 해시와
native receipt·최종 본문 결합은 그대로다. 기존 structured/plan_json 컴파일러의
8개 상한과 모든 검사를 보존하며, 12개 질문이나 혼합 인자는 계속 거부한다.

새 검사 수정 전 1 PASS / 4 FAIL, 구현 후 4 PASS / 1 FAIL이었다. 남은 실패는 새
fixture가 UUID 대신 일반 ID로 attempt를 만든 오류였고, fixture를 실제 계약에 맞춘
뒤 5 PASS였다. 집중 220 PASS, 전체 **Node 50파일 / 625 PASS / 0 skip,
Python 79 PASS, conformance PASS**, skill·marketplace·수집기 검사도 통과했다.
이 결과는 native 의미 품질을 인증하지 않는다.

## 실제 실패

정상 설치·활성화 후 같은 6,240자 원래 복잡한 H/Q 요청을 실행했다. 그러나 Haiku는
선행 요청 평가부터 시작했고, 그 독립 평가가 완화책의 답이 출처에 명시돼 있지 않다는
이유로 잘못된 essential_gaps 2개를 만들었다. 새 정상 준비와 fact/final 경로는
**UNRUN**이다. 이 후보의 새 구조가 실제 전달됐다고 주장하지 않는다.

제공된 S2는 Serializable의 직렬 동등성과 전체 트랜잭션 재시도를, S1은 두 직렬
순서가 모두 불변식을 보존함을 준다. 이를 이용한 완화책은 답변이 도출할 결과이지,
사용자가 별도 출처로 제공해야만 하는 입력이 아니다. 평가는 요구하지 않은 전체 비용
비교까지 추가했고 S2가 abort frequency를 준다고 잘못 기술했다. 부모도 이 분류를
받아들여 불필요한 완화책 출처·실측 비용을 사용자에게 요구했다. 전체 의미 **FAIL**이다.

실제 원문·packet·fresh child·typed 제출·7필드 반환·retained receipt 재생은 일치했다.
첫 보류 helper의 current binding도 유효했다. 하지만 첫 `request_quote`가 원문의
`give`를 `Provide`로 바꿔 정확한 원문에 없었다. 실제 인자 재생은
`withholding_request_quote_not_found`다. 잘못된 인용을 정규화하거나 수선하지 않았다.
부모의 후속 재호출도 차단됐고, 실제 Stop은 `continue:false` 및 unavailable를 보존했다.

## 정산과 다음 행동

새 배정 native 4 / 관리 7(복원 2 포함), 각 ceiling 12, 동시성 1.
실제 native 3 / 관리 7 / 내부 평가 1 / 응답 8 / **210,104 tokens**다.
Haiku 행 118,436ms, 후속 Luna 1행 UNRUN, 미사용 ceiling 9회는 다음 배정과 분리한다.
누적 **974(Claude 582 / Codex 392)**다. 소유 Job process 0, 두 프로필 선택 복원,
task-created ON 파일 2개 원래 부재 복원, source/frozen 31개 해시 일치를 확인했다.
기존 캐시·신뢰·근거를 보존했다. 세션 중간 OFF 제거 시험은 하지 않았다.

다음은 선행 평가의 근거 부족 판정 경계를 고친다. 필요한 외부 전제·관측이 실제로
없는 것과, 주어진 전제로 답변이 계산·선택·구성해야 할 결과를 구분한다. 실측 요구가
정말 미충족인 경우의 보류 및 정확한 원문 인용 검사는 유지한다. 원래 정상·보류 과제의
native 대조 없이 수정 효과를 완료로 계산하지 않는다.

근거: `.superpowers/release-loop-148/batch-closed.json`, `full-qualified/`,
`rows/03-claude-complex/failure-audit.json`·`review.json`·원본 collected 및 복원 기록.
전체 **active / No-Go**, 원래 **192 subjects / 516 requests**와 나머지 출하 조건은 미검증이다.
