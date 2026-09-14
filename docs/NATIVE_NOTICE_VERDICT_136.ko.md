# 보류문 승인과 설명 보류의 결과 필드 혼동 — 136

후보 `0.2.0-rc.13+codex.20260912193021`은 제안 정정을 구조화된 `proposed_corrections`로
검토 packet에 함께 결합하고, 제출된 보류문과 검토자의 결함 목록을 구분했다. 실패
피드백은 설명과 보류문이 승인되지 않았음을 명시한다. 집중164, 전체 Node45파일 /
569 PASS / 0 skip, Python78, conformance와 정상 설치·11개 hook 검토를 통과했다.

Haiku의 첫 proposal은 원문6,491자를 정확히 전달했지만 `corrections:[]`로 T1 평가를
빠뜨렸다. 실제 검토자는 실측 자료 부족을 올바르게 인정하면서 notice가 적절하다고
썼고, `verdict:withheld`와 `issues:[]`를 함께 제출했다. 이는 검토 승인과 설명 보류를
혼동한 모순이다. `verification_missing_failure_reason` 검증은 이를 거부했다. T1 평가
누락도 찾지 못했으므로 enum만 바로잡아 성공으로 삼을 수 없다.

부모의 추가 Agent 시도도 거부됐다. 단 하나의 실제 검토자와 그 조회까지의 체인이
보존 상태와 일치했고, typed 결과의 실제 수락은0개다. 안팎 unavailable와 실제 Stop의
`continue:false`가 유지됐다. 부모는 마지막에 검토 실패·미승인을 정확히 인정했다.
그러나 필수 실측 요구 삭제를 제안해 사용자 본문도 완전한 통과가 아니다.

## 근거와 다음 수정

`.superpowers/release-loop-136/rows/03-claude-unresolved/failure-audit.json`과 `review.json`,
`batch-closed.json`에 기록했다. Native3/8(상한12), 관리7/7(복원2), Agent시도2 / 실제1,
완료응답7개 / **144,610 tokens**, 59,278ms 정상 종료다. 후속5행 UNRUN, 두 프로필
선택 및 task-created ON파일2개 복원, 모든 Job 정리·process0을 확인했다. 원본과
캐시는 남겼다. 누적 **932회(Claude557 / Codex375)**, 전체 active / No-Go다.
원래192 subjects / 516 requests 비교는 아직 UNRUN이다.

137은 문구 추가만 반복하지 않고, 보류문 전용 제출 계약을 둔다. `approve_notice`와
`revise_notice`로 검토 대상을 명시하고, 필수 요구 검토와 요청된 초안 평가 검토를
별도 필수 필드로 받는다. 실제 native 결과는 기존 final proof로 결합하며, 모순된
판정·빈 결함·다른 actor·상태·목적의 제출은 계속 차단한다. 필드 존재만으로 의미
검토를 통과했다고 주장하지 않으며, 같은 원래 과제를 정상 plugin으로 다시 검증한다.
