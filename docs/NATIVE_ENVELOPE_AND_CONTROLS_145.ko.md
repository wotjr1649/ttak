# 145 — 전체 검증 결과 표시와 양 호스트 보류·재개·정상 대조

후보 `0.2.0-rc.13+codex.20260912233010`, runtime 31파일. 이 8행 진단은 PASS다.
전체 출하 목표는 **active / No-Go**이며, 원래 복잡한 H/Q와 전체 비교 등은 아직 남았다.

## 원인 수정과 로컬 근거

144에서 Luna child는 typed 도구의 전체 JSON을 출력하고도 최종 반환에는 내부 answer만
선택했다. 표시 JSON의 긴 answer가 첫 필드였다. `resultSubmission`의 표시 순서를
`protocol, challenge, kind, verdict, answer, issues, checked_questions`로 바꿨다.
canonical 값·해시, native identity·제출 영수증, 전체 7필드 검증은 바꾸지 않았다.
유효한 내부 JSON answer만 반환하면 여전히 복사 기회 없이 실패한다. SyntaxError인
기존 한 번의 native 복사 교정 조건도 유지했다.

- 표시 순서 새 검사: red 208 PASS / 1 FAIL. 구현 뒤 새 반례의 Stop 이전 상태 기대가
  잘못돼 209 PASS / 1 FAIL. 실제 외부 unavailable→부모 Stop의 내부 unavailable 전이를
  함께 검증하도록 수정한 최종 집중 검사: **210 PASS / 0 FAIL / 0 skip**.
- 최초 전체: **Node 48파일 / 615 PASS, Python 78 PASS, conformance PASS**.
- 원래 비교 수집기 검토 중 새 원문 선택 모듈이 freeze와 설치 파일 대조 목록에서
  빠진 것을 발견했다. 실제 누락·변조 수용 반례 2 FAIL을 확인하고 두 목록을 수정했다.
  관련 12검사와 최종 전체 **Node615 / Python79 / conformance PASS**.
- skill·marketplace 검증 PASS. 기존 per-host MCP 경로와 호환되지 않는 범용 plugin
  helper는 과거 FAIL을 보존하고 UNRUN으로 남겼다. 이를 PASS로 바꾸지 않았다.
- 후보의 실제 정상 설치·31파일 대조·11개 hook의 정확한 정의와 hash 검토 후 신뢰,
  양쪽 정상 ON 활성화를 확인했다. pinned Claude 2.1.266과 Codex 0.154.0을 유지했다.

## 실제 행별 결과

| 행 | 판정 | 시간(ms) | 독립 검증자 | 모델 응답 | 관측 tokens |
|---|---|---:|---:|---:|---:|
| Claude 활성화 | PASS | 4,493 | 0 | 0 | 0 |
| Codex 활성화 | PASS | 6,207 | 0 | 0 | 0 |
| Luna 원래 보류 과제 | PASS | 109,415 | 2 | 10 | 202,850 |
| Haiku 원래 보류 과제 | PASS | 81,785 | 2 | 12 | 291,689 |
| Haiku 같은 세션 재개 | PASS | 5,719 | 0 | 1 | 38,136 |
| Luna 같은 세션 재개 | PASS | 10,207 | 0 | 1 | 33,598 |
| Haiku Nori 정상 대조 | PASS | 114,694 | 5 | 26 | 480,639 |
| Luna Nori 정상 대조 | PASS | 84,154 | 2 | 10 | 172,622 |

두 보류 과제 모두 원래 6,491자 요청의 실측 요구와 T1의 B 읽기 정정을 보존했다.
평가→직접 안내 구성→fresh 최종 검토→정확한 본문 전달을 실제 영수증과 retained state로
재생했다. Haiku는 한 번의 부모 Stop 복사 교정을 사용했다. 검증자 복사 교정은 0회다.
두 재개는 보류 안내의 검토 완료와 설명 자체의 미검증을 구분했으며, 누락 실측을
계속 요구했다. 이전 응답 사용량은 재개 사용량에서 제외했다.

두 정상 대조는 각 read가 7을 반환하고 저장된 7이 유지됨을 2~3문장으로 설명했다.
Haiku는 추가 요청 평가와 서로 겹치는 사실 질문 3개를 사용했다. 전체 검증자를
누락하지 않고 계수했다. 마감까지 여유가 5.3초뿐이므로 성능 개선이나 복잡 과제의
안정성을 주장하지 않는다. Nori 대조는 원래 복잡한 H/Q 합격을 대체하지 않는다.

감사기에서 실제로 관측한 두 경로도 보완했다. Codex의 빈 commentary만 반환 수에서
제외하고 모든 비어 있지 않은 메시지·빈 final은 남겼다(collector 7검사 PASS).
Haiku의 선행 평가→정상 검증 전환을 재생에 포함했다. 기존 parser가 이미 허용한
전체 JSON fence 2회는 내부 값과 실제 child/Agent 반환이 정확히 같은지 대조했다.
원본 collected 기록, guard, 형식 대안과 판정 기준은 바꾸지 않았다.

## 정산·복원·다음 조건

새 배정 native8 / 관리7(복원2), 각 ceiling12, 동시성1, 내부 검증자 ceiling40.
실제 native8 / 관리7 / 내부11 / 완료 모델 응답60 / **1,219,534 tokens**.
새 배치 계획의 UNRUN은 없고 native ceiling 미사용4회는 다음 배정에 합산하지 않는다.
과거 144 등 FAIL·UNRUN을 보존한다. 누적은 **965(Claude576 / Codex389)**다.

모든 Windows Job의 소유 process 0을 확인했다. 두 프로필 선택을 복원하고 후보를
비활성화했다. 이번 배치가 만든 ON 파일 2개만 원래의 부재 상태로 복원했으며,
캐시·신뢰 metadata·실행 근거는 보존했다. 세션 중간 OFF 제거 시험은 하지 않았다.
마지막 closure는 runtime 31개 소스/고정본 hash와 실제 선택 복원을 다시 확인했다.

근거는 `.superpowers/release-loop-145/`의 `batch-closed.json`, 전체 검사 폴더,
각 행의 `*-audit.json`·`review.json`, 관리·신뢰·복원 기록이다.
다음은 같은 고정 후보의 원래 복잡한 H1–H3/Q1–Q2 설명 진단이다. 그 뒤 필수
known/새 사례/변형/반복, 실제 검사 실패·취소·재개, 네 기능·혼합 과제의 원래
**192 subjects / 516 requests**, 양 호스트의 실질 개선과 퇴보 부재를 입증해야 한다.
전체 비교는 아직 실제 UNRUN이며, 진단 성공으로 전체 목표를 완료 처리하지 않았다.
