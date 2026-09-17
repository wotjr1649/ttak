# 질문 단위 검증 118

목표는 **active / No-Go**다. 후보 `0.2.0-rc.13+codex.20260912131238`의 정상
Haiku 실행은 68,755 ms 안에 fact 2개와 final 1개를 각각 새 Agent로 완료했다.
실제 packet·자식 ID·결과 hash·최종 본문 및 정상 Stop은 기계 감사 PASS이고,
세 문장의 답은 요청한 두 번의 읽기와 남은 값에 대해 정확했다.

그러나 질문 `nori_read_example`의 target이 이미 계산한 읽기 결과와 남은 값
`7, 7, 7`을 제시했다. 중립 질문으로 결과를 독립 도출하게 한 것이 아니므로
**질문 독립성 FAIL**이다. 정확한 최종 답과 receipt만으로 이 결함을 통과시키지 않았다.
5개였던 fact 질문은 2개로 줄었으나, 질문 단위 안내가 단일 질문이나 중립성을
보장했다고 주장하지 않는다. 후속 5행은 새 UNRUN이며 과거 예약을 재사용하지 않았다.

Node 510·Python 78·conformance, 집중 105, Codex 수집기 5, 새 Claude session 인수
검사 2개가 통과했다. 30개 후보 파일은 source/freeze/정상 설치 경로에서 대조했다.
신규 session ID 예약과 실제 Claude result의 일치를 확인했다. timeout 출력 보류 guard는
그대로다. skill·marketplace helper는 PASS, 범용 plugin helper의 기존 MCP 경로 비호환은
과거 FAIL을 유지하고 UNRUN으로 남겼다.

상위 native 배정 8 / 실제 3 / 상한 12, 관리 7 / 상한 12, 복원 예약·실제 2다.
내부 Agent 시도·시작 3, 완결 모델 응답 16, 관측 203,137 tokens다. 새 누적은
**867회(Claude 517, Codex 350)**다. 모든 소유 Job 정리와 두 프로필 선택 복원을
확인했다. 시험에서 만든 ON 상태 파일 2개만 원래 부재로 복구했고 근거·캐시는 보존했다.
세션 중간 OFF 주입 제거 시험은 하지 않았다.

119에서는 `explanation_prepare`의 target·conditions 스키마에 답 없는 조사 대상과
원래 주어진 전제의 차이를 명시하고, 모호했던 “결과 상태를 질문에 포함” 표현을
“중간·최종 상태는 verifier가 도출할 답”으로 바꾼다. 필드 이름·입력 상한·독립 문맥·
최종 검사·기존 H/Q는 유지한다. 이 안내의 효과는 새 정상 plugin에서 판정한다.

근거는 `.superpowers/release-loop-118/`의 `manifest-final.json`, `full-qualified/`,
`rows/03-claude-simple/completion-audit.json`, `rows/03-claude-simple/review.json`,
`batch-closed.json`, `management/`, `own-state-restored.json`이다. 원래 전체 비교
**192 subjects / 516 requests**, 알려진 실패·미조정 사례·반복과 나머지 기능은 미완료다.
