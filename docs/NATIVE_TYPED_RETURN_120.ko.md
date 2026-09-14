# Typed native 결과 수신 120

목표는 **active / No-Go**다. 후보 `0.2.0-rc.13+codex.20260912134918`은 양 호스트
정상 설명 대조에서 실제 typed 결과 호출 ID·응답 hash·종료 JSON·부모 본문·Stop을
통과했다. Luna는 fact 1개·final 1개, 11응답 / 152,857 tokens / 104,193 ms,
Haiku는 fact 2개·final 1개, 16응답 / 205,861 tokens / 83,960 ms다. 질문은 중립적이고
두 읽기와 남은 값을 정확히 설명했다. 이번 새 후보의 두 호스트 정상 대조 근거다.

결과 도구의 실제 Pre/Post 관측을 추가하고 hash만 저장한다. 결과를 제출하지 않았거나
종료 JSON이 제출 내용과 다르면 완료를 인정하지 않는다. Codex에서 이미 유효한 결과를
제출했지만 일반 문장으로 반환한 경우에만 동일 자식에서 1회 출력 교정을 요청한다.
새 verifier나 새 의미 판단을 재실행하지 않는다. 새 로컬 반례 11개와 119 원본 데이터
재생에서 이를 확인했다. **이번 native 실행에서는 교정 0회**이므로 그 분기의 실제
호스트 continuation은 미입증이다. 기존 정상 반환과 실제 typed 수신만 PASS로 기록한다.

Haiku 보류 행은 FAIL이다. 첫 `explanation_decide`의 근거 문장에 `B >= 1`을 넣어
기존 평문 검사가 거부했다. 공개 스키마는 이 금지 문자를 선언하지 않았다. 그 뒤 새
prepare도 거부됐고 최종 본문은 bound 보류 형식이 아니었다. 자료가 없는 실측값과
T1이 B를 읽는 사실은 식별했지만, 이미 주어진 시나리오로 해결되는 draft 오류에 대해
사용자 확인을 다시 요구했다. 정상 Stop은 unavailable·미검증 상태를 명시했다.
3응답 / 82,459 tokens / 73,608 ms이며 내부 Agent는 0개다. 후속 3행은 UNRUN이다.

최종 Node **521 / Python 78 / conformance PASS**, 집중 116, 수집기 5, 세션 인수 2,
추가 hook 이름 라우팅 14개 대조가 PASS다. 첫 새 테스트 fixture 두 기록은 MCP content
envelope 누락으로 setup에서 실패했으며 대상 동작의 재현 근거로 쓰지 않았다. 수정한
fixture와 실제 119 데이터 재생을 사용했다. 그 구분은 `replay-return-119.json`에 남겼다.

상위 native 배정 8 / 실제 5 / 상한 12, 관리 7 / 상한 12, 복원 예약·사용 2다.
내부 Agent 시도·시작 5, 완결 모델 응답 30, 관측 **441,177 tokens**다. 누적은
**876회(Claude 522, Codex 354)**다. 모든 Job 정리와 두 프로필 복원을 확인하고,
시험 ON 파일 2개만 원래 부재로 되돌렸다. 근거·캐시는 보존했다. 중간 OFF 시험,
새 모델·유료 API·인증·전역 설정 변경·게시·배포는 하지 않았다.

121은 평문 검사를 완화하지 않고 같은 제약을 공개 schema에 넣는다. unsupported
complete 선택지와 빈 unresolved 목록도 schema에서 제외한다. 주어진 근거로 이미
반박된 draft에는 확인 질문 대신 교정 내용을 표시하도록 필드를 명확히 한다.
고정 CLI의 strict 변환은 제한된 키만 지원하고 현재 pattern·길이 조건에는 fallback하므로
강제 decoding을 보장한다고 주장하지 않는다. 기존 로컬 검사와 실제 native 판정이 필요하다.

근거는 `.superpowers/release-loop-120/`의 `manifest-final.json`, `full-qualified/`,
`typed-return-final/`, `replay-return-119.json`, `rows/*/completion-audit.json`,
`rows/05-claude-unresolved/failure-audit.json`, `batch-closed.json`, `management/`,
`own-state-restored.json`이다. 원래 **192 subjects / 516 requests**와 known/unseen/반복,
전체 기능·혼합, 실패·취소·재개 조건은 미완료다.
