# TTAK 재설계: 하나의 ON/OFF와 필요한 자료만 읽기

상태: `0.3.0-design.2` 로컬 실행 초안. 이전 `ef59a03`의 비활성 두 스킬 설계를 대체한다. 기존 209 runtime 33개 파일은 그대로 보존하며 설치·활성화·출하는 하지 않았다. 실제 모델의 자동 선택과 설명 정확성은 미검증이다.

## 제품 판단

**Track · Trim · Adapt · Keep — 딱 필요한 만큼. 딱 알아듣게. 딱 끝낸다.**

- Ponytail: 기존 구현 재사용, 현재 필요 없는 복잡성 제거, 요청한 동작 보존을 채택한다. 극단적 축약, 의무 전체 탐색, 기능 축소 납품은 제외한다.
- i-have-adhd: 필요한 진행 안내, 눈에 보이는 완료, 중단 후 목표 복귀를 채택한다. 진단 가정, 매 턴 상태 반복, 의무 시간 추정은 제외한다. 복귀는 접근 가능한 대화·작업 기록 범위다. 없는 기억은 만들어내지 않는다.
- ELI5: 독자·목적별 깊이와 어휘를 채택한다. 나이별 고정 관념, 필수 비유, 정확성을 낮추는 단순화는 제외한다. 제공 자료의 주장과 확인된 사실을 구분한다.

지침은 판단 방향을 제공한다. 사용자 요구, 중요한 사실 조건, 권한과 보안 경계는 보존한다. 짧다는 이유로 기능이나 검증을 삭제하지 않는다. 범용 사실 인증이나 모델 간 합의를 제품 약속으로 삼지 않는다.

## 참고 구현에서 확인한 로딩 경로

| 참고 | 실제 경로 | TTAK 판단 |
|---|---|---|
| Ponytail 4.9.0 | SessionStart → activate → instruction builder → `skills/ponytail/SKILL.md` 본문. SubagentStart도 같은 builder 사용 | 상태를 코드로 읽고 필요한 본문을 주입하는 원리는 채택. 전체 스킬·하위 에이전트 반복 주입은 제외 |
| Ponytail `.agents/rules/ponytail.md` | 위 hook의 입력이 아님. README는 Antigravity용 상시 workspace rule 배치를 설명 | Claude marketplace 안에 파일이 있다는 이유로 주입된다고 판단하지 않음. TTAK은 별도 상시 rules 사본을 만들지 않음 |
| i-have-adhd | Claude `disable-model-invocation: true`, Codex `allow_implicit_invocation: false`. 별개 SessionStart hook은 상시 활성화 flag가 있으면 전체 본문 출력 | 스킬 자동 호출과 hook 주입은 독립 경로임을 반영. 큰 본문 전체 주입은 제외 |
| ELI5 | 독자·설명 목적을 넓게 설명한 description으로 스킬 선택. 확인한 트리에는 별도 toggle hook 없음 | 독자 맞춤 설명만 조건부 자료로 유지 |

Ponytail 기본값은 full이고 환경변수·설정 파일이 우선한다. `/ponytail off`는 live flag를 지우며, `/ponytail default off`는 다음 세션 기본값을 저장한다. `/ponytail on` 전용 분기는 없다. 알 수 없는 인수는 기본 모드로 간다. 스킬의 argument-hint는 `[lite|full|ultra]`다. 이 동작을 단순한 `[on|off]` 토글과 동일시하지 않는다.

경로·revision·SHA와 원본의 한계는 [조사 및 적대적 검토](TTAK_ROUTING_REVIEW_2026-09-14.ko.md)에 기록한다.

## 사용자 제어

**`ttak`은 저장 상태 조회, `ttak on`은 ON 저장, `ttak off`는 OFF 저장이다.** 초기값은 OFF. 기존 호스트별 저장 의미를 유지하며 session-only/default 두 상태를 추가하지 않는다.

Claude의 `/ttak:ttak on`, 단축 `/ttak on`, Codex의 `$ttak on`에 해당하는 설정 스킬을 제공한다. raw prompt hook은 완전 일치하는 별칭만 인식한다. 실제 호스트의 slash/mention 전달 방식과 스킬 실행 환경은 native 검증이 남아 있으므로 UI 동작을 이미 검증했다고 주장하지 않는다. 호스트 변수가 없으면 다른 홈 경로를 추측하지 않는다.

| 상황 | 저장·주입 동작 |
|---|---|
| 설정 없음 또는 OFF에서 새 대화 | 공통 지침·조건부 자료 주입 0byte. 설정 조회는 파일을 만들지 않음 |
| `ttak on` | 해당 호스트의 plugin data에 ON 저장. 다음 SessionStart부터 적용 |
| ON에서 startup/resume/clear/compact | core만 주입. 조건부 자료의 위치와 선택 기준 포함 |
| ON에서 일반 개발·짧은 질문 | core의 방향성만 적용. 자료를 무조건 읽지 않음 |
| ON에서 독자 맞춤 설명·복잡성 리뷰 | 해당 자료를 필요할 때 읽음. 새 답변마다 다시 읽거나 고정 절차를 강제하지 않음 |
| `ttak off` | OFF 저장. 이후 SessionStart에서 추가 core 주입 없음 |
| 이미 ON 자료를 읽은 대화 | 기존 문맥 삭제 불가. resume/compact로 이전 내용이 완전히 사라진다고 보장하지 않음. 깨끗한 OFF 사용에는 새 대화 필요 |
| 다른 열린 세션 | 저장값은 호스트 단위로 공유하지만 이미 들어간 문맥은 즉시 바뀌지 않음 |
| SubagentStart | 추가 주입 없음. 부모의 필요한 작업 맥락 전달에 의존하며 전 자식의 동일한 TTAK 행동은 약속하지 않음 |
| fork 또는 알 수 없는 source | 이번 hook matcher 범위 밖. 상속 문맥과 적용 여부를 보장하지 않음 |
| 읽기·쓰기 실패, 손상 상태 | ON/OFF 성공을 거짓 보고하지 않음. 지침 주입을 확인할 수 없다고 표시 |

OFF는 호스트에 대한 일반 질문 답변을 막는 기능이 아니다. TTAK이 제공하는 자동 지침 경로를 끈다. 설정 스킬의 이름·description은 OFF에서도 발견될 수 있으며, 설정 문의를 처리하기 위해 남는다. 따라서 전체 플러그인 문맥 비용 0이라고 주장하지 않는다.

## 구성과 자동 적용

```text
design/ttak/
  .codex-plugin/plugin.json
  .claude-plugin/plugin.json
  skills/ttak/SKILL.md       # 설정 조회·변경만
  hooks/hooks.json          # SessionStart, UserPromptSubmit만
  hooks/ttak.cjs             # 정확한 제어 입력과 core 출력
  hooks/state.cjs            # 기존 상태 읽기·원자적 저장 재사용
  policy/core.md             # ON일 때의 방향성과 조건부 자료 선택
  references/explain.md      # 독자 맞춤 설명
  references/review.md       # 필요한 복잡성 판단
```

이전 두 작업 스킬을 독립적으로 자동 발견되게 두면 OFF 상태에서도 선택될 수 있다. 따라서 그 본문을 references로 옮겼다. 새로운 자동 적용은 **ON core의 조건부 자료 선택**이며, 두 개의 독립 자동 스킬 호출이 아니다. 설정 스킬은 정상 발견을 유지하되 일반 개발·설명 요청으로 설정을 바꾸지 않는다. 추가 `allowed-tools`, MCP, 강제 검토 에이전트, 호스트 설정 수정은 없다.

상시 지침 사본을 AGENTS.md나 `.agents/rules`에 추가하지 않는다. 그러면 hook OFF와 무관한 두 번째 주입 경로가 생긴다. core가 출력한 자료 경로는 plugin의 실제 위치에서 구성되며 현재 작업 디렉터리에 의존하지 않는다.

## 크기와 판단 기준

| 구성 | UTF-8 본문 byte | 읽는 시점 |
|---|---:|---|
| core template | 1,077 | ON SessionStart |
| 경로가 포함된 실제 core | 1,177 | 이번 테스트 설치 경로 기준; 설치 경로 길이에 따라 달라짐 |
| 설정 스킬 | 796 | 설정 스킬 선택 시 |
| 설명 자료 | 1,126 | 관련 설명 작업에 필요할 때 |
| 리뷰 자료 | 983 | 복잡성 리뷰 작업에 필요할 때 |

초기 core 690byte보다 387byte 늘었다. 조건부 선택과 기억 범위를 명확히 하는 데 필요했다. 이전 800byte 예산은 경고 기준으로 낮추고 강제 합격선으로 사용하지 않는다. 새 template은 기존 runtime core 3,645byte보다 약 70.5% 작다. 실제 호출 토큰·비용 감소율은 아직 측정하지 않았다.

## 검증과 출하 경계

로컬 프로세스로 실행한 10개 테스트는 저장·주입·명령 경계·손상 상태·경로 링크·입력 크기·패키지 구성을 검사한다. 스킬과 공식 plugin 구조 검사도 통과했다. Plugin-Eval은 정적 분석용으로 사용한다. 전체 점수는 실제 지침 주입이나 정확성의 합격선이 아니다.

적대적 검토에서 남긴 핵심 위험은 실제 호스트의 스킬 실행 환경, 동적 자료 선택의 누락·과잉, 알려진 설명 오류, 기존 문맥의 OFF 잔류다. 앞의 두 구조적 문제는 로컬로 검증했지만 호스트 통합과 설명 정확성은 native 실행이 필요하다. 대표 개발·리뷰·설명·진행 과제와 오류의 조건 변경 사례를 검증하되 문장 일치, 원본 전체 기능 재현, 192개 비교 우위를 요구하지 않는다.

5초 hook 실행 제한은 작은 로컬 제어 프로세스를 위한 것이다. 모델 추론에 120초 고정 제한을 되살리지 않았다. 정상 출하 패키지로 활성화하기 전 실제 호스트 연동과 필요한 행동 검증이 남는다.
