# 질문 중립성과 native 반환 형식 119

목표는 **active / No-Go**다. 후보 `0.2.0-rc.13+codex.20260912132155`에서
target·conditions를 “답 없는 조사 대상 / 주어진 전제”로 구분했다. Haiku 정상 대조는
중립 질문·fact 2개·final 1개·정확한 두 문장·정상 Stop을 통과했다. 68,926 ms,
16응답 / 206,409 tokens다. 진행 안내 5개도 원문에 보존했으며 미검증 초안은 없다.
질문은 여전히 서로 겹치는 2개였다. 질문 수나 전체 품질의 반복 성공을 보장하지 않는다.

Luna도 중립적인 전체 상태 변화 질문 1개를 만들었다. 실제 fact/final 자식은 각각
결과 도구를 한 번 호출하고 `reply.structuredContent.final_text`를 code mode로
표시했다. 하지만 **final 자식의 종료 메시지가 그 JSON이 아니라 `answer` 필드의
일반 문장**이었다. SubagentStop이 이를 올바른 receipt로 인정하지 않았고,
상태는 unavailable, final receipt는 없다. native wait·close 두 쌍은 모두 관측됐다.

부모는 처음에 존재하지 않는 `tools.explanation_prepare`와 추측한 스키마를 사용했다가
정규 도구를 찾아 진행했다. final 반환 실패 후 보류 호출도 두 번 거부됐고,
최종 부모 답변 없이 120,007 ms에 timeout됐다. 실제 12응답 / 174,579 tokens를
회수했다. timeout 후 미회수 진행 중 소비 가능성이 있다. 단순히 공급자 지연이나
도구 한도 부족으로 분류하지 않는다. 후속 보류·재개 4행은 UNRUN이다.

Node 510·Python 78·conformance, 집중 105, 수집기 5, 세션 인수 2가 PASS다.
새 사용량 감사기도 과거 양 호스트 완료 원본과 재생 대조했다. source/freeze/설치된
30파일을 대조하고 hook 11개를 정상 API로 검토·신뢰했다. 두 프로필을 복원했고
시험 ON 파일 2개만 원래 부재로 되돌렸다. 원본·캐시·불리한 결과는 보존했다.

상위 native 배정 8 / 사용 4 / 상한 12, 관리 7 / 상한 12, 복원 예약·사용 2다.
내부 Agent 시도·시작 5, 완결 응답 28, 관측 **380,988 tokens**다. 닫힌 누적은
**871회(Claude 519, Codex 352)**다. 전체 목표와 원래 **192 subjects / 516 requests**,
known/unseen/반복, 나머지 기능·실패·취소·재개 기준은 아직 완료하지 않았다.

120은 [공식 Codex SubagentStop 계약](https://learn.chatgpt.com/docs/hooks)의
`decision: "block"` continuation을 사용한다. 실제 자식의 typed 결과 제출을 먼저
관측하고, 그 해시와 종료 JSON을 대조한다. 이미 제출된 결과를 일반 문장으로 잘못
반환한 경우에만 같은 native 자식에서 한 번 형식을 교정한다. 제출 누락·변조·다른
자식·중복 제출·두 번째 교정은 거부한다. 결과 원문을 상태 파일에 저장하지 않으며,
새 verifier 실행이나 의미 판정 변경으로 실패를 덮지 않는다. 호스트 실제 동작은
120의 로컬 반례 및 새 정상 실행에서 별도로 확인해야 한다.

근거: `.superpowers/release-loop-119/manifest-final.json`, `full-qualified/`,
`rows/03-claude-simple/completion-audit.json`, `rows/03-claude-simple/review.json`,
`rows/04-codex-simple/failure-audit.json`, `batch-closed.json`, `management/`,
`own-state-restored.json`. 숨겨진 reasoning과 원본 transcript는 복사하지 않았다.
