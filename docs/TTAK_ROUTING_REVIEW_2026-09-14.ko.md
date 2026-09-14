# TTAK 로딩 경로 조사·검증·적대적 검토

대상: `design/ttak` 0.3.0-design.2. 사용자 지정 참고 경로는 읽기만 했다. 로컬 테스트는 `.superpowers/redesign-212`의 합성 상태와 정제된 자식 환경에서 실행했다. 실제 사용자 plugin data, 설정, 설치된 플러그인, 원본 참고 저장소는 변경하지 않았다. native 모델 시작 0회.

## 원본 확인 결과

### Ponytail

확인한 설치 원본은 4.9.0, revision `2ed6c52c9d7e5e56942508591085fd45dea277d3`이다. 아래 경로는 `C:/Users/js/.claude/plugins/marketplaces/ponytail` 기준이다.

1. `.claude-plugin/plugin.json`과 `.codex-plugin/plugin.json`은 `hooks/claude-codex-hooks.json`을 지정한다.
2. SessionStart는 `hooks/ponytail-activate.js`를 실행한다. 기본 모드가 off이면 본문을 출력하지 않는다. full이 기본값이며 환경변수, 설정 파일 순서로 다른 값을 선택한다.
3. 활성 모드에서는 `hooks/ponytail-instructions.js`의 builder가 `skills/ponytail/SKILL.md`를 읽어 frontmatter와 다른 강도의 표·예시 행을 제외한다. 헤더를 붙이고, Claude에서는 경우에 따라 statusline 설정 안내도 더한다. 따라서 실제 출력은 원본 파일 크기와 동일하지 않다.
4. SubagentStart 역시 이 builder를 사용한다. UserPromptSubmit의 tracker는 정확한 모드 명령과 종료 표현을 추적한다.
5. `.agents/rules/ponytail.md`는 이 hook 경로에서 참조하지 않는다. README.md의 Antigravity 항목과 `scripts/check-rule-copies.js`에서는 다른 호스트용 규칙 사본으로 취급한다. 해당 호스트의 실제 실행은 시험하지 않았다.

`/ponytail off`는 live flag를 지우고, `/ponytail default off`는 기본 설정을 저장한다. `/ponytail on` 전용 분기는 없고 미인식 인수는 getDefaultMode로 간다. 스킬에는 `[lite|full|ultra]` hint가 있다. 따라서 UI만 보고 단순 on/off 동작이라고 설명하면 부정확하다.

정적 반례: default가 full이면 live off 뒤 다음 SessionStart가 기본값을 다시 읽어 켤 수 있다. live flag 파일은 session_id별로 나뉘어 있지 않아 같은 state root를 쓰는 세션 간 간섭 가능성이 있다. 이는 코드에서 도출한 위험이며 사용자의 실제 프로필에서 재현 시험한 결과는 아니다. TTAK은 별도의 live/default 이중 상태를 도입하지 않고 호스트별 저장값과 적용 시점을 명시한다.

### i-have-adhd

`D:/AI_DEV/_refs/i-have-adhd`, revision `58494af57962b2d7a996b4d419474380a299af5e`를 확인했다.

- SKILL.md의 `disable-model-invocation: true`는 Claude 자동 스킬 호출을 막는다.
- `agents/openai.yaml`의 `allow_implicit_invocation: false`는 Codex용 명시 호출 설정이다.
- 별개의 `hooks/hooks.json`은 SessionStart에 `always-on.mjs`를 실행하도록 정의한다. 스크립트는 CLAUDE_CONFIG_DIR 또는 기본 Claude 홈의 `.i-have-adhd-always` 존재 여부를 확인하고, 있으면 전체 SKILL 본문을 출력한다.
- 실제 Codex manifest에는 hooks 명시가 없다. 파일 존재와 스크립트 주석만으로 특정 Codex 버전에서 hook이 실행된다고 확정하지 않는다. hook 탐색·환경 전달은 호스트별 확인 대상이다.
- “stop adhd mode”는 주입된 자연어 지침의 세션 종료 규칙이며 이 스크립트가 flag를 지우는 동작이 아니다. flag가 남으면 이후 SessionStart에서 다시 주입할 수 있다.

즉 스킬 자동 호출 차단은 hook을 통한 본문 주입 차단과 다르다.

### ELI5

`D:/AI_DEV/_refs/ELI5`, revision `a766623b062331fdde53467001379b4ddf3acc2f`를 확인했다. SKILL.md의 description이 독자·역할·쉬운 설명 요청을 선택 기준으로 제시한다. 확인한 트리에는 별도 plugin manifest, ON/OFF 저장기, SessionStart hook이 없다. 다른 설치 경로까지 실행한 것은 아니다.

## 공식 문서로 확인한 구분

[Claude skills 문서](https://code.claude.com/docs/en/skills)는 기본적으로 description을 통한 선택과 본문 호출을 구분하고, `disable-model-invocation`을 설명한다. 불러온 본문은 이후 문맥에 남을 수 있다. [Claude hooks 문서](https://code.claude.com/docs/en/hooks#sessionstart)는 SessionStart와 startup/resume/clear/compact/fork를 설명한다. [OpenAI skills 문서](https://learn.chatgpt.com/docs/build-skills)는 명시 호출과 description 기반 자동 선택을 구분한다. 웹 문서의 최신 기능을 현재 설치된 두 호스트에서 이미 검증한 동작으로 대체하지 않는다.

## 로컬 검증

명령: `node --test tests/redesign-routing.test.cjs`.

10개 테스트 전부 통과. 실제 별도 Node 프로세스와 상태 파일을 사용했고 모델 답변·검증 대상을 mock하지 않았다.

| 검사 | 관측 |
|---|---|
| 초기 OFF | 본문 출력 없음, 상태 디렉터리도 만들지 않음 |
| ON 저장 후 새 프로세스 | 4개 지원 lifecycle source에서 core 출력. 자료 본문은 포함하지 않고 실제 위치만 제공 |
| OFF 전환 | 이후 4개 lifecycle에서 본문 출력 없음. 제어 결과에 기존 문맥 잔류 명시 |
| 인용·추가 텍스트·명령 연결·오타 | 상태 변경 없음. 정확한 제어 입력만 처리 |
| 일반 요청·하위 에이전트·미지원 source | 추가 주입과 상태 변경 없음 |
| host data 변수 없음·상대 경로 | 임의 홈 fallback 없이 실패 |
| 손상·과대·무관한 키가 있는 상태 | 원본 보존, OFF나 변경 성공으로 보고하지 않음 |
| junction 경유 state root | 거부, 실제 대상에 파일 생성 없음 |
| 잘못된 JSON·과대 입력·추가 CLI 인수 | 상태 변경 없음 |
| 스킬·hook·manifest 구성 | 설정 스킬 1개만 발견. 설명/리뷰 자동 스킬 및 MCP 없음 |

skill-creator quick_validate와 공식 plugin validate_plugin 통과. 최초 검사에서는 Claude의 유효한 `argument-hint`를 현재 공통 skill validator가 지원하지 않았고, 이전 스킬을 옮긴 뒤 빈 디렉터리가 남았다. hint는 본문의 사용법으로 옮기고 빈 디렉터리만 제거해 재검사했다. validator를 변경하거나 검사를 생략하지 않았다. 이는 실제 autocomplete 메뉴 지원 확인과는 다르다.

Plugin-Eval `start`, `analyze`를 실행했다. 홈 스킬을 읽지 않도록 평가 자식 환경의 USERPROFILE을 빈 작업 디렉터리로 지정했다. 최종 설정 스킬 100/A, plugin 58/D다. plugin 감점은 정책 URL 2개, deferred 파일 총량, coverage artifact 부재다. deferred에는 hook 코드와 저작자 표시도 포함되어 실제 주입량과 다르다. 합격을 위해 법적 페이지를 꾸며내거나 필요한 코드·저작자 표시를 제거하지 않았다. 초기 39/F와 95/A 결과도 작업 디렉터리에 남겼고, 실제 websiteURL과 명확한 Use when description을 적용한 뒤 다시 평가했다.

## 적대적 검토와 처리

| 반론·공격 사례 | 처리 | 남은 한계 |
|---|---|---|
| OFF인데 작업 스킬이 자동 호출됨 | 설명·리뷰를 발견 가능한 SKILL에서 조건부 reference로 변경 | 설정 스킬 metadata는 남음. OFF는 호스트 모델의 일반 행동이나 파일 읽기 권한을 차단하는 보안 장치가 아님 |
| ON 문맥에서 OFF만 하면 이전 본문이 사라진다고 오인 | 모든 성공 제어 응답에 다음 주입 적용과 기존 문맥 잔류 표시 | 깨끗한 OFF에는 새 대화 필요. resume/compact의 문맥 제거 보장 없음 |
| 출처 문서 안의 `ttak on`으로 설정 변경 | raw hook은 전체 명령 일치, 설정 스킬은 직접 요청만 처리하고 인수 삽입 금지 | 모델이 도구를 잘못 호출하는지 native 검증 필요. 프롬프트를 보안 통제라고 주장하지 않음 |
| 다른 디렉터리에서 실행하면 엉뚱한 자료를 읽음 | hook 위치 기준 절대 자료 경로 구성 | 특수 경로와 호스트 UI별 실제 실행은 미검증 |
| 상태를 읽을 수 없는데 OFF로 표시 | invalid/unavailable 구분, 링크·과대·혼합 상태 거부 | 동시 악성 프로세스가 경로를 교체하는 완전한 TOCTOU 방어는 아님. 호스트가 소유하고 보호하는 data root를 전제로 함 |
| 복귀할 기록이 없는데 목표를 지어냄 | 사용 가능한 기록 범위 명시, 없으면 질문 | 실제 중단·복귀 행동은 모델별 검증 필요 |
| 짧아졌지만 설명은 여전히 틀림 | 제공 자료와 확인된 사실 구분, 개념적 불확실성도 근거 확인 대상 | 알려진 209 오류의 해결은 미확인. 기존 실패 기록 유지 |
| reference 경로만 있고 모델이 안 읽음 또는 항상 읽음 | 작업별 선택 조건, 짧은 답변은 둘 다 불필요, 관련 문맥당 한 번 원칙 | 실제 선택 적절성과 효용은 정적 검증 불가 |
| 상시 규칙 사본이 토글을 우회함 | AGENTS.md·.agents/rules 사본을 생성하지 않음 | 사용자가 별도로 복사한 다른 제품 규칙까지 TTAK이 끄지는 않음 |

보안 경계: hook 입력·사용자 인수·저장 파일은 신뢰할 수 없는 입력이다. 고정 이벤트·명령 집합과 경로·크기 검사를 사용한다. 셸 실행은 호스트가 정한 고정 Node 경로의 코드에 한정하며 입력 내용을 코드로 실행하지 않는다. 외부 네트워크·계정·권한 변경 경로는 없다. 실제 활성화 전에는 호스트의 신뢰된 plugin data 제공, 설치 파일 보호, 제어 스킬 실행 환경을 확인해야 한다.

## 남은 행동 검증: 작고 구별 가능한 사례

아래는 미실행 계획이며 통과 수에 포함하지 않는다. 각 모델의 표현·추론 시간 차이는 허용한다.

1. 정상 호스트 설치에서 plain `ttak`와 slash/mention으로 조회·ON·OFF, 새 대화 적용을 확인한다. 설정 스킬 도구 환경에 plugin data 변수가 없으면 plain 제어 경로로 안내하고 성공을 꾸미지 않아야 한다.
2. 작은 기능 구현에서 요청 기능과 필요한 기존 동작을 보존하고 불필요한 새 의존성을 만들지 않는지 확인한다.
3. 실제 최소 코드의 필요한 호환 계층과 실제 중복을 구별하는 리뷰를 확인한다. 문제에 정답을 직접 써 주지 않는다.
4. 알려진 209 오류와 조건을 바꾼 근접 사례, 잘못된 제공 자료에서 중요한 사실·조건이 맞는지 확인한다. 명시적 사실 검증 요청 유무를 바꾼다.
5. 긴 작업 중 부가 질문 후 원래 목표 복귀, 기록 없는 새 세션에서 기억을 날조하지 않는지 확인한다.
6. 단순 질문·번역·자료에 스킬명만 등장하는 요청에서 불필요한 자료 로딩과 설정 변경이 없는지 확인한다.

실패는 분석 가능한 원인에 따라 좁게 수정한다. 문장 일치·과도한 반복 우위·120초 추론 제한을 합격 조건으로 두지 않는다. 같은 실패에 지침만 계속 덧붙이는 반복은 하지 않는다.

판정: **원본 로딩 경로 확인과 제어 구조 보완은 완료. 로컬 기계적 검증은 합격. native 통합·자동 선택·사실 정확성은 미검증이므로 출하 합격은 아님.**
