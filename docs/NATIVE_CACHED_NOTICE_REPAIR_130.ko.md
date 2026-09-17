# 원문 재사용 입증과 정정 분류 실패 — 130

후보 `0.2.0-rc.13+codex.20260912173157`에서 revision1의 `request: "current"`가
실제로 같은 연결의 원문을 재사용했다. 부모의 수정 입력은 원문 6,491자 대신 7자였고,
반환된 원문·전체 proposal·원래 UserPromptSubmit 해시가 일치했다. 전체 native receipt
재생도 retained attempt와 일치했다. 이는 전송 경로 증거이며 전체 품질 PASS는 아니다.

첫 독립 검토자는 빠진 T1 평가를 정확히 지적했다. 부모는 T1이 B를 읽고 A에 쓴다는
평가를 corrections가 아니라 새로운 unresolved / missing_evidence 항목에 넣었다.
두 번째 검토자는 주어진 S1이 이미 이 평가를 해결하므로 근거 부족이 아니라는 점을
정확히 지적했다. 두 결과는 모두 withheld이며, 이후 120초 한도에 도달했다.
승인된 보류문이나 완성 설명은 전달되지 않았다. 배치 FAIL, 전체 목표 active / No-Go다.

## 근거와 정산

기록은 `.superpowers/release-loop-130/rows/03-claude-unresolved/failure-audit.json`,
`batch-closed.json`, `config-restored.json`, `own-state-restored.json`이다.
집중 149 PASS, 전체 Node 45파일 / 554 PASS / 0 skip, Python 78 PASS,
conformance PASS다. 시간 초과 후 소유 Job 정리·잔여 process 0을 확인했다.

Native 3/8(상한12), 관리 7/7(상한12, 복원2/2), 내부 Agent 2개, 완료 응답10개,
관측 168,186 tokens다. 진행 중 사용량 미보고 가능성이 남는다. 후속 5행 UNRUN,
후보 비활성화·기존 선택 복원·task-created ON 파일2개 부재 복원을 완료했다.
캐시·실패 근거는 보존됐다. 누적 native 912회(Claude545 / Codex367)다.
원래 192 subjects / 516 requests 비교는 별도의 미완료 조건이다.

## 다음 변경

131은 검토자가 `notice_correction: {claim, correction, basis}`를 반환하고,
전용 `explanation_repair_notice`가 실제 native 결과에 결합된 데이터만 corrections에
추가한다. 원래 unresolved 요구는 변경하지 않으며, 한 번의 수정 몫을 소비하고
새 독립 검토를 요구한다. 보류 검토 이외의 typed correction, 변경된 결과·원문·proposal,
다른 연결·시도·후보, 소모된 예산은 거부한다. 모델과 120초 한도는 유지한다.
