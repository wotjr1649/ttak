# 147 — 준비 인코딩 통과, 부모 질문 계획 실패

후보 `0.2.0-rc.13+codex.20260913002556`은 146의 입력 형식 오류를 고치기 위해
Claude의 준비 문서를 명시적인 `plan_json`으로 전달했다. 기존 구조화된 입력도
유지하며, 두 경로 모두 원래 필드·타입·원문·크기·질문 상한 검사를 거친다.
문자열 추출이나 잘못된 인자의 묵시적 복구는 허용하지 않았다.

로컬 반례는 수정 전 1 PASS / 4 FAIL, 수정 후 5 PASS였다. 집중 215 PASS,
전체 **Node 49파일 / 620 PASS / 0 skip, Python 79 PASS, conformance PASS**다.
정상 등록·설치·해시 검토·활성화 후 원래 6,240자 복잡한 H/Q 요청을 실행했다.

실제 Haiku 준비 호출은 원문·current binding을 보존했고 `plan_json`은 정상 객체와
세 배열로 해석됐다. **인코딩 전달 PASS**다. 그러나 부모가 blocks 5개에 중복된
questions 12개를 연결해 기존 최대 8개 검사에서 `verification_invalid_list`로
차단됐다. 준비 전체가 통과한 것은 아니며 뒤쪽 검사를 통과했다고 추정하지 않는다.

Q1–Q5는 같은 snapshot·interleaving·불변식 기제를, Q6/Q7/Q11은 SSI의 탐지·재시도·비용을,
Q8–Q10은 잠금 기제와 위험을 나눠 반복했다. Q12는 추가 대안 비교였다.
실패한 목록을 자르거나 다시 묶어 수용하지 않았다. 정상 fact/final 검증은 UNRUN이다.

부모는 명시적으로 미검증인 완성 설명을 냈다. SSI 중단 시점을 commit으로만 한정하고,
이상이 없는 트랜잭션의 재시도 비용을 0으로 단정하는 등 Q1 오류가 남았다.
실제 Stop은 `continue:false`와 미검증 사유를 남겼고 retained attempt는 unavailable다.
CLI success는 설명 승인 근거가 아니다. 전체 흐름과 H/Q 판정은 **FAIL**이다.

## 정산과 다음 수정

새 배정 native 4 / 관리 7(설정 5·복원 2), 각 ceiling 12, 동시성 1이었다.
실제 native 3 / 관리 7 / 내부 평가 1 / 응답 7 / **181,894 tokens**다.
Haiku 행은 118,900ms에 종료했다. 후속 Luna 1행 UNRUN이며 미사용 ceiling 9회를
다음 배정에 합산하지 않는다. 누적 **971(Claude 580 / Codex 391)**다.

소유 Job process 0, 두 프로필 선택 복원, task-created ON 파일 2개만 원래 부재로
복원, source/frozen runtime 31개 해시 일치를 확인했다. 캐시·신뢰·원본 근거는 보존했다.
세션 중간 OFF 제거 시험은 하지 않았다.

다음은 부모가 질문 목록과 출처를 재작성하는 계획 계층을 수정한다. 원래 요청 전체에서
독립적인 사실 답을 도출하고, 별도 fresh 검토가 정확한 최종 본문의 모든 주장·요구를
대조하는 경로를 검토한다. 기존 8개 상한과 실패 상태, native receipt 검사는 유지한다.
이 설계의 의미 품질·지연 효과는 아직 입증되지 않았다.

근거: `.superpowers/release-loop-147/batch-closed.json`, `full-qualified/result.json`,
`rows/03-claude-complex/`의 failure-audit·review·process·원본 collected 및 복원 기록.
전체 목표 **active / No-Go**, 원래 **192 subjects / 516 requests** 비교를 포함한
나머지 출하 조건은 여전히 미검증이다.
