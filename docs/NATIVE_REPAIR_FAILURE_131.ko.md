# 구조화 정정 반환과 실패 호출의 상태 누락 — 131

후보 `0.2.0-rc.13+codex.20260912181403`에서 짧은 `notice_correction`과 전용
`explanation_repair_notice`를 구현했다. 원문·proposal·실제 결과 해시에 결합해
corrections에 추가하고 새 독립 검토를 요구한다. 정상/반례 집중155, 전체 Node45파일 /
560 PASS / 0 skip, Python78, conformance를 통과했다. 두 정상 설치·활성화, 검토한
11개 hook 및 30개 후보 파일 일치도 확인했다. 이는 출하 품질 통과가 아니다.

## Native에서 드러난 두 경계

Haiku는 초기 보류안에서 T1 평가를 이미 unresolved / contradicted로 분류했다.
첫 독립 검토자는 이를 바로잡는 typed correction을 정확히 반환했지만, 보류가 타당한
실측 요구도 오류 목록에 넣었다. 모든 issue가 correction이어야 하는 전용 수리 조건에
맞지 않아 호출은 `explanation_notice_repair_unavailable`로 실패했다.

그 뒤 부모는 `explanation_decide` revision1을 사용했고, 새 검토자의 complete와
정확한 보류 본문 전달까지 진행했다. 109,122ms에 정상 종료됐으며 Stop의 1회 전달
교정도 관측했다. 그러나 실패한 수리 호출이 unavailable로 보존되지 않았으므로
**전체 행은 FAIL**이다. 뒤의 올바른 본문을 실패 회복 경로의 합격으로 바꾸지 않는다.

`.superpowers/release-loop-131/rows/03-claude-unresolved/failure-audit.json`은 성공한
두 review 체인의 전체 native receipt가 retained attempt와 일치하면서도, 그 사이
실패한 수리 호출이 상태에 반영되지 않았음을 보인다. 최초 성공 전용 감사의 1–2회
호출 가정은 3회 실제 호출과 맞지 않아 실패했고, 실제 행을 재실행하지 않고 감사했다.

## 정산과 다음 작업

Native3/8(상한12), 관리7/7(상한12, 복원2/2), 내부Agent2개, 완료응답13개 /
274,308 tokens. 후속5행 UNRUN. 소유 Job 정리·process0, 후보 비활성화·기존 선택
복원 및 task-created ON파일2개 부재 복원을 완료했다. 캐시와 실패 근거는 보존했다.
누적 native915회(Claude547 / Codex368). 목표는 active / No-Go이며, 원래
192 subjects / 516 requests와 나머지 출하 조건은 미완료다.

다음 후보에서는 정상 호스트의 실패 도구 lifecycle을 확인해 체크 실패를 보존한다.
또한 settled assessment가 처음부터 unresolved에 들어간 경우를 exact requirement
target에 결합해 정정할 수 있도록 한다. 원문 요구를 임의로 없애거나 검사 실패 후
다른 경로로 완료하는 동작은 허용하지 않는다. 모델·시간 한도·최종 재검토를 유지한다.
