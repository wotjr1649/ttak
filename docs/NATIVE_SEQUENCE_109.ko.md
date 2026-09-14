# 순차 독립 검증 109

전체 목표는 **active / No-Go**다. 후보 `0.2.0-rc.13+codex.20260912092100`의 배치를
첫 Haiku 정상 설명 실패로 닫았다. 원래 출하 기준이나 전체 비교를 완료한 것으로 보지 않는다.

108의 `unavailable` 뒤 후속 launch 허용을 반례로 재현해 수정했다. MCP가 한 packet만
공개하고 실제 이전 native 결과가 확인돼야 다음 packet으로 넘어가도록 연결했다. 원래
요청의 가정을 verifier에 전달하고 결과 형식을 검사하는 도구 두 개도 추가했다. packet은
현재 stdio 연결의 유한 메모리에만 보관하며 파일·네트워크·자식 프로세스 접근은 추가하지 않았다.

고정 후보의 Node **477 PASS**, Python **78 PASS**, conformance PASS이며, 별도 수집기
시험 2개도 PASS다. skill·marketplace 검사는 PASS다. 변경 없는 범용 plugin 검사기의
호스트별 MCP 경로 비호환은 108의 FAIL을 보존하고 근거 없는 동일 재실행은 하지 않았다.

사전 배정은 상위 native 4회 / 상한 12회, 관리 7회 / 상한 12회, 복원 관리 몫 2회다.
내부 verifier 상한은 20개다. 순차 단계에 필요한 부모 요청 상한 20, verifier 상한 3을
명시했고 시간 120초·정리 5초·supervisor 여유 20초·동시성 1은 유지했다.

두 호스트의 정상 설치·hook 11개 대조·신뢰·ON 제어는 통과했다. Haiku는 이번에 설명부터
내보내지 않고 검증 준비로 시작했고, 첫 packet만 요청했다. 그러나 부모가 2,931자 packet에
마지막 줄바꿈 하나를 붙여 2,932자로 전달했다. 내용 누락이나 의미 변형이 아니라 바이트
형식 차이다. 정확한 결합 검사가 첫 Agent 요청을 거부했고,
실제 verifier는 시작되지 않았다. 부모가 그 뒤 제한을 언급하며 미검증 완성 설명을 제공했다.
호스트의 `success`/exit 0과 별개로 Stop 및 저장된 상태는 unavailable이며 제품 판정은 FAIL이다.

상위 native **3회**, 실제 내부 Agent **0개**, 거부된 Agent 요청 **1건**이다. 새 사용량은
**63,966 tokens**(캐시 포함 입력 60,694 / 출력 3,272)다. 누적은 **836회(Claude 503,
Codex 333)**다. Codex 정상 설명 행 하나는 UNRUN, 상한 미사용은 9회다. 108의 미실행
5회·상한 미사용 9회, 107·106의 닫힌 장부와 원래 192 subjects / 516 requests 비교를
새 소비로 계산하지 않는다. 원래 전체 비교는 아직 UNRUN이다.

관리 7회를 완료해 두 시험 프로필의 이전 선택을 복원하고 후보를 비활성화했다. 후보가
만든 ON 상태 파일 두 개만 원래의 부재로 복구했으며 원본 결과·증거·캐시는 보존했다.
각 Windows Job의 정리와 소유 프로세스 0을 확인했다. 세션 중간 OFF 시험은 하지 않았다.

다음 110은 긴 본문을 모델이 복사하는 경로를 반복하지 않는다. 짧은 packet 식별자로
native verifier를 시작하고 기존 MCP의 고정 packet을 직접 조회하도록 바꾼다. 조회한
실제 수신자와 내용도 hook에서 대조한다. 이 흐름과 의미 정확성은 구현·native 검증 전이며,
정상 완료·보류·재개 및 전체 출하 비교를 계속 진행해야 한다.

근거: `.superpowers/release-loop-109/manifest.json`, `native-plan.json`, `full-frozen/`,
`rows/03-claude-simple/failure-audit.json`, `batch-closed.json`, `management/`,
`own-state-restored.json`. 숨겨진 thinking 본문은 별도로 저장하거나 출력하지 않았다.
