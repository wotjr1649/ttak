# 149 — 거짓 보류 해소와 정상 준비 전달, 전체 시간 한도 실패

후보 `0.2.0-rc.13+codex.20260913010707`은 요청 평가에서 필요한 외부 전제·관측과
답변이 도출·선택·구성할 결과를 구분하도록 수정했다. 필수 실측값은 실제 측정을
요구하며, 인용·binding·receipt 검사는 그대로다. 집중 221 PASS, 전체 **Node 626 /
Python 79 / conformance PASS**다. 새 인용 회귀의 첫 실행에서 gap-free fixture를
보류안으로 만든 시험 오류를 확인해 실제 gap fixture로 고쳤다. 의미 효과를 로컬
문구 일치 검사로 인증하지 않았다.

실제 Haiku는 같은 6,240자 원래 요청에 essential_gaps가 없다고 올바르게 평가했다.
이어서 148의 새 draft 준비를 정상 호출했고, 정확한 원문·5,129자 초안 해시와
`REQUEST_FACTS` packet을 고정했다. fresh 사실 검증자가 부모 초안 없이 원문 전체를
정상 MCP로 읽은 것까지 관측했다. 실제 호출·반환·상태 재생이 retained attempt와 일치한다.

그러나 **120,016ms timeout**으로 사실 결과와 최종 검토·전달은 완료되지 않았다.
정상 Stop도 미관측이다. 소유 Job process 0 이후 예약된 해당 부모·등록된 자식 기록만
한 번 회수했고, 비어 있는 supervisor stdout을 그대로 보존했다. 실제 native 취소를
관측한 것은 아니며 retained attempt는 pending이다. 이를 취소·완료 PASS로 계산하지 않는다.

부모는 원문 6,240자를 assessment와 prepare에 각각 다시 생성했다. 부모 텍스트 이후
tool 인자 출력까지 관측된 간격은 각각 15,425ms와 39,010ms였다. 뒤쪽에는 초안도
포함된다. 이는 메시지 시각의 간격이며 분리된 CPU·token throughput 측정이 아니다.
정상 완료 지연 개선을 입증한 것도 아니다.

새 배정 native 8 / 관리 7(복원 2 포함), 내부 verifier 상한 44, 각 시작 ceiling 12,
동시성 1이었다. 실제 native 3 / 관리 7 / 내부 시작 2 / 완료 응답 8 /
**관측 182,084 tokens**다. 실행 중 미보고 사용량 가능성이 있어 완전한 사용량으로
단정하지 않는다. 후속 5행 UNRUN, 미사용 ceiling 9회는 다음 배정과 분리한다.
누적 **977(Claude 584 / Codex 393)**다. 두 프로필 선택·task-created ON 파일 2개를
복원했고 source/frozen runtime 31개 해시를 확인했다. 세션 중간 OFF 시험은 없다.

실행표 준비 도중 직전 complex-only 계획에 없는 보류·재개 필드를 참조하는 local
helper 오류가 있었다. 이미 고정된 31개 후보 파일을 확인·보존하고, 기존 145의 정확한
대조 입력으로 없던 계획 파일 두 개만 완성했다. freeze·설치·native를 중복하지 않았다.

다음은 부모의 반복 원문·결과 전송과 불필요한 선행 평가를 줄이는 경로 조사다.
정확한 cached 참조와 정상 설명 우선 분기를 검토하되, 독립 fact·정확한 final 검토,
실제 근거 부족 평가, 모든 binding 검사와 120초 경계는 유지한다.

근거: `.superpowers/release-loop-149/`의 `batch-closed.json`, `preparation-recovery.json`,
`full-qualified/`, `rows/03-claude-complex/timeout-recovery.json`·`timeout-audit.json`·
`review.json` 및 복원 기록. 전체 **active / No-Go**, 원래 **192 / 516** 등 미검증 조건은 남아 있다.
