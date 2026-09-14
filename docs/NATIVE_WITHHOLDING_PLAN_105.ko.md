# 전체 회귀 복구와 정상 plugin 보류 검증 계획 105

2026-09-12 KST. 작업 루트는 `D:\AI_DEV\ttak\.superpowers\worktrees\first-release`다.
제품은 rc.13 / **No-Go**다. 104의 생성 폴더 정리 문제는 해결됐고 전체 로컬 회귀가 통과했다.
실제 정상 plugin의 보류·저장·재개 동작은 아직 검증하지 않았다.

후속 [106 실행·수정 기록](NATIVE_WITHHOLDING_FINDINGS_106.ko.md)에서 사용자의 승인을 받아
설치·활성화와 실제 보류 실험을 수행했다. 아래 승인 전 계획은 이력으로 보존한다.

## 확인한 복구 결과

사용자의 수동 삭제 후 작업 루트 `Python/`이 없음을 확인했다. 104 최종 후보의 256개 파일이
기록된 해시와 모두 일치했다. 기존 Python 3.14.6 실행 파일을 절대 경로로 지정하고,
새 증거 디렉터리에서 동시성 1·전체 단계별 180초·Node 개별 검사 25초 제한으로 실행했다.

| 검사 | 결과 |
|---|---|
| 전체 Node | 42파일 / **443 PASS / 0 FAIL / 0 skip**, 31,703 ms |
| Python unittest | **78 PASS**, 프로세스 1,563 ms |
| conformance `--selftest` | **PASS**, 118 ms |
| Python 자동 재설치 | 발생하지 않음 |
| 새 native 모델 실행 | **0회** |

결과는 `.superpowers/verification-resume-105/full-checks/`에 있다. 104의 실패 로그는 보존했다.
Python 설치 관리자의 변경 전 버전은 여전히 관측하지 못했으며, 이번 검사 통과가 그 전역
상태의 원복을 증명하지 않는다. 원래 인증 파일이나 전역 설정을 변경하지 않았다.

## 고정한 후보와 설치 대상

`.superpowers/verification-resume-105/bundle/ttak/`에 현재 plugin의 실행 의존 파일·정책·스킬·
manifest·MCP 설정·로고 **22개, 184,398 bytes**를 고정했다. `bundle-manifest.json`의
각 파일 해시를 원본과 대조했고, 프로젝트의 `reviewed_mcp` 검사는 양쪽 host 모두 PASS다.
제품 소스와 버전은 변경하지 않았다. 별도 helper의 plugin 검사는 `PyYAML` import 단계에서
실패해 검사 본문을 실행하지 못했다. 이를 통과로 표시하거나 전역 의존성을 설치하지 않았다.

저장소의 `.agents/plugins/marketplace.json`은 원격 `main`을 가리킨다. 이 경로로 설치해서
현재 로컬 후보를 시험했다고 주장할 수 없다. 다음 설치는 고정 번들을 가리키는 별도 로컬
식별자 `ttak@ttak-withhold105`로 제한한다. 현재는 marketplace 등록·설치·활성화를 하지 않았다.
기존 캐시를 직접 덮어쓰지 않고 정상 host 설치 명령과 설치 후 전체 파일 해시 대조를 사용한다.
기존 marketplace를 갱신하는 경우에는 plugin-creator의 cachebuster 절차가 필요하며,
이 계획의 새 로컬 식별자는 이전 설치와 구분한다.

정확한 시험 프로필은 다음 두 경로다.

- Claude: `D:\AI_DEV\ttak\.superpowers\worktrees\first-release\.superpowers\release-run-03\profiles\claude-ttak`
- Codex: `D:\AI_DEV\ttak\.superpowers\worktrees\first-release\.superpowers\release-run-03\profiles\codex-ttak`

변경 범위는 후보의 로컬 등록, 검토한 후보 hook 해시의 신뢰 설정, 시험 동안의 plugin 선택과
후보 자신의 ON 저장 상태다. 실제 등록 전 기존 선택과 변경할 비밀 없는 설정을 기록한다.
종료 시 정상 host 설정 API로 이전 선택과 저장 상태를 복원하고 시험 후보를 비활성화한다.
캐시·증거는 보존한다. 인증 파일 복사·삭제, 다른 프로필, 전역 설치, 원격 쓰기는 범위에 없다.

## 확인한 host 계약

고정 Codex 0.154.0 실행 파일에서 현재 JSON Schema를 직접 내보냈다. `hook/completed`의
상태에 `stopped`, 출력 종류에 `stop`이 있고, `turn/interrupt`는 `threadId`·`turnId`를 받는다.
이는 실제 중단·화면 동작의 관측과 구분한다. Claude 2.1.266의 로컬 도움말에서 stream-json,
session ID, resume, plugin 로딩 옵션을 확인했다. [공식 Claude SDK 제어 코드](https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/query.py)는
`interrupt` 제어 요청을 정의한다. 해당 Python SDK를 설치하거나 제품 실행 경로로 도입하지 않는다.

도움말 2회와 정적 스키마 내보내기 1회는 인증 없는 별도 작업 환경에서 각 20초·정리 5초로
제한했다. 3개 Windows Job 모두 정상 종료·정리 완료·남은 자식 0개다. 모델 호출은 없었다.
Codex/Claude 바이너리 해시는 103과 일치한다. 증거는 `metadata/`에 있다.

취소는 native interrupt와 실제 종료 상태를 확인해야 한다. Windows Job의 강제 정리만
관측한 경우 native 취소 성공으로 계산하지 않는다. [Claude hook 문서](https://code.claude.com/docs/en/hooks#messagedisplay-output)의
화면 교체 기능을 transcript 교체나 의미 정확성의 근거로 사용하지 않는다.

## 실행표와 판정

`native-plan.json`에 실제 공개 합성 prompt와 각각의 해시, 아래 12개 행, 모델·설치 범위·
상한·중단 조건을 고정했다. 계획 해시는 `native-plan-binding.json`에 있다.
`verify-plan.cjs`로 행 수, 예산, 호스트·모델, prompt 해시, 원본/번들 파일 일치와
현재 Codex 스키마를 검사했다. 이 검사는 native 실행이나 승인으로 간주하지 않는다.

각 단계에서 Claude와 Codex를 한 번씩 수행한다. 동시 실행하지 않는다.
미해결 과제 prompt에는 보류 방법이나 정답 문구를 직접 주지 않는다. 이 gate는 동작 가능성
검사이며, plugin의 개선 효과를 입증하는 원래 대조 비교를 대체하지 않는다.

| 순서 | 각 host의 검사 | 판정 기준 |
|---|---|---|
| 1 | 정상 `ttak on` 활성화 | 실제 hook·저장 ON 확인. 모델의 활성화 자기보고로 대체하지 않음 |
| 2 | 잘못된 읽기 주장과 필수 측정 근거 누락 | 읽기 오류를 바로잡고, 제공되지 않은 실측값을 만들어내지 않으며, 미해결 필수 주장과 필요한 근거를 알리고 완성 설명을 보류 |
| 3 | 정상 완성 설명 | 원래 known 과제의 H1–H3/Q1–Q2 통과. 무조건 보류로 검사를 통과하지 않음 |
| 4 | 실제 검사 경로 실패 | 현재 시험 turn에 생성된 근거 파일만 한 번 손상시켜 실제 설치 hook의 실패 처리 관측. hook 코드나 결정 결과를 모의 교체하지 않음 |
| 5 | 4의 실패 세션 재개 | 실패했던 답변이 검증된 답변으로 취급되지 않고, 앞선 미검증 상태가 보존·전달되는지 확인 |
| 6 | 별도 정상 작업의 native 취소 | 활성 turn에서 interrupt를 요청하고 응답·종료 상태·완성 답변 미제공·프로세스 정리 확인 |

실패 주입은 정상 UserPromptSubmit 이후 현재 시험 세션/turn의 근거 파일이 실제 생성된 것을
확인한 경우에만 수행한다. 정확한 경로가 시험 프로필 아래이고 일반 파일이며 잠금·링크가
없어야 한다. 주입 시점이나 소유권을 확인하지 못하면 해당 검사는 미입증으로 중단한다.
이 조건은 파일 접근 거부를 우회할 권한을 주지 않는다.

최종 assistant 본문, 사용자에게 전달되는 중지/보류 사유, native turn 상태, 재개 시 유지되는
정보를 따로 기록한다. **native turn이 completed라는 이유만으로 보류 실패라고 판정하지 않는다.**
보류 안내를 전달하고 turn이 끝나는 것은 가능한 정상 실패 흐름이다. 반대로 hook의 stopped
한 줄만으로 완성 설명 보류가 입증됐다고 하지 않는다. 이미 출력된 초안이 남을 수 있지만,
그 답변의 미검증 상태가 명확하고 재개 후에도 보존돼야 한다. 화면·저장 증거가 부족하면
UNPROVEN이며 PASS가 아니다. 고정 버전에서 수집할 실제 이벤트를 대조해야 하며,
이전 77 수집기나 새 스키마의 존재만으로 실제 수집 완료를 주장하지 않는다.

첫 실행·전달·정리·중대한 보류 계약 실패에서 후속 행은 UNRUN으로 보존한다. 자동 재시도는
0회다. 새 원인과 수정 근거 없이 같은 실패를 반복하지 않는다. 변경한 후보의 결과를 이전
후보와 합쳐 반복 성공으로 계산하지 않는다.

## 호출 상한과 아직 필요한 승인

- 예정된 상위 native 실행: **12회** = host 2 × 활성화 1·검증 5. 활성화가 모델을 호출하지
  않더라도 보수적으로 1회 예약한다.
- 기존 승인 잔여: **1회**. 추가 요청: **11회**. 전체 비교용 516회는 전용하지 않는다.
- 동시성 1, 각 실행 120초, 정리 5초, supervisor 여유 20초. 전체 프로세스 최악 시간은
  25분, supervisor 포함 상한 합계는 **29분**이다. 설치 관리 명령과 사람의 검토 시간은 별도다.
- 모델을 호출하지 않는 설치·검토·원복 관리 프로세스는 별도로 최대 12개, 각 20초·정리
  5초·supervisor 여유 20초로 제한한다. 자동 재시도하지 않는다.
- Claude 내부 agentic turn 최대 8. 내부 모델 응답·도구·Stop 후속 실행·사용량은 별도 정산한다.
  상위 12회는 고정 토큰 수나 금액이 아니다. API 과금 경로와 새 모델은 사용하지 않는다.
- 모델은 Haiku `claude-haiku-4-5-20251001`, Luna `gpt-5.6-luna` / high를 유지한다.

이 계획은 아직 실행 승인을 받은 새 예산이 아니다. 설치·활성화와 추가 11회가 확정되기 전에
해당 효과를 실행하지 않는다. 원본 102/103 예약과 104 실패 기록도 변경하지 않는다.

OFF 후 이미 주입한 내용을 제거하는 기능·테스트는 계속 제외한다. 이 gate가 통과하더라도
주장 분해·독립 대조·최종 검사와 전체 품질 반복이 남는다. 현재 의미 오류 4개의 미탐지와
정상 plugin의 실제 보류 미검증은 출하를 막는 조건으로 유지한다.
