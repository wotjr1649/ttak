# TTAK 재설계 조사와 Plugin-Eval 결과

현재 설계는 [ON/OFF·자동 적용 재설계](TTAK_REDESIGN_2026-09-14.ko.md)와 [로컬 검증·적대적 검토](TTAK_ROUTING_REVIEW_2026-09-14.ko.md)를 따른다. 아래 design.1 평가 수치와 이전 후보 기록은 당시 증거이며 현재 설계의 출하 합격을 뜻하지 않는다.

2026-09-14 조사. 범위는 지정 글 정독, 원본 지침의 선택·크기 실측, 비활성 스킬 초안 작성과 정적 평가다. 모델 호출, 새 설치, 활성화, 기존 runtime 변경은 없다. 설계 결정은 [재설계안](TTAK_REDESIGN_2026-09-14.ko.md), 측정 원자료는 [JSON](TTAK_REDESIGN_MEASUREMENTS_2026-09-14.json)에 있다.

## 지정 글에서 채택한 원칙

Eric Provencher의 2026-09-11 [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)는 짧고 구체적인 선택 설명, 필요한 자료의 조건부 로딩, 과도한 작업 순서 축소, 상황에 맞는 문서 참조, 완료 범위 명시를 제안한다. 서로 다른 모델을 쓰는 저장소에서는 같은 지침의 영향이 달라질 수 있다는 점도 반영한다. TTAK은 이를 기능 선택과 문맥 예산에 적용하며, 특정 모델의 향상을 다른 모델에서 이미 관측한 효과처럼 보고하지 않는다.

TTAK의 해석은 지침의 목적을 모델 통제에서 작업별 판단 지원으로 좁히는 것이다. 중요한 결과 조건은 남기되, 답변 형식·단계 수·검토 횟수·예상 시간·비유를 일괄 강제하지 않는다. 기존 호스트의 권한과 보안 통제를 제거하라는 뜻이 아니다.

## 평균 크기와 권장 크기는 다르다

| 자료 | 대상·방법 | 확인한 값 | 해석의 한계 |
|---|---|---|---|
| Ling·Zhong·Huang, Agent Skills: A Data-Driven Analysis | 2026-02-05까지 한 공개 marketplace의 40,285개 기록. SKILL.md를 tiktoken o200k_base로 계산 | 평균 1,895token, 중앙값 1,414token, 90백분위 3,935token | 한 시점·한 표본의 preprint 통계. 전체 생태계 평균이나 권장 목표가 아님 |
| Agent Skills 명세 | 발견 metadata, 활성화 본문, 조건부 resources를 구분 | metadata 약 100token, 본문 5,000token 미만 권장, SKILL.md 500줄 미만 | 관측 평균이 아닌 형식·운영 권고. 상한에 가깝게 채우라는 뜻이 아님 |
| Claude Code 비용 문서 | 세션 시작 CLAUDE.md와 요청 시 사용하는 skills를 구분 | CLAUDE.md는 핵심만 포함해 200줄 미만을 목표로 제안 | 모든 플러그인의 core에 200줄이 적당하다는 의미가 아님 |

통계의 원문과 tokenizer·표본 설명은 [논문 §2.1·§3.1](https://arxiv.org/html/2602.08004v1)에 있다. 로딩 단계의 권고는 [Agent Skills 명세](https://agentskills.io/specification#progressive-disclosure), 상시 지침을 줄이는 설명은 [Claude Code 비용 문서](https://code.claude.com/docs/en/costs#move-instructions-from-claudemd-to-skills)에서 확인했다. Anthropic의 [skill 작성 지침](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices#progressive-disclosure-patterns)도 본문 500줄 미만과 필요한 자료의 분리를 권고한다.

상시 주입되는 AGENTS.md·CLAUDE.md, 필요할 때 읽는 SKILL.md, 도구 정의, 재사용된 대화 기록을 하나의 평균으로 합치지 않는다. 이번 수치만으로 모든 상시 지침의 대표 평균을 확정하지 않는다. TTAK의 작고 일반적인 방향성은 위 스킬 평균보다 훨씬 짧아도 된다.

## 참고 원본의 실측

현재 비교에 사용한 고정 원본의 원문 해시를 재확인했다. 전체 파일에는 frontmatter가 포함되며 본문은 frontmatter와 양끝 공백을 제외한다. 줄 수는 본문 기준이다. 원본을 모델 지침으로 실행하거나 설치하지 않았다.

| 원본 지침 | 파일 전체 byte | 본문 byte | 본문 줄 수 | Plugin-Eval 방식의 파일 token 추정 |
|---|---:|---:|---:|---:|
| Ponytail | 6,637 | 5,699 | 101 | 1,654 |
| Ponytail Review | 2,383 | 1,865 | 45 | 593 |
| i-have-adhd | 6,813 | 6,391 | 130 | 1,704 |
| ELI5 | 7,965 | 7,242 | 111 | 1,987 |

핵심 세 지침(Ponytail·i-have-adhd·ELI5)의 파일 평균은 약 7,138byte, 본문 평균은 6,444byte다. Ponytail의 두 스킬 파일 합계는 9,020byte지만 항상 함께 읽는다는 뜻은 아니다. 이는 참고 대상으로 선택한 세 제품의 수치이며 웹 전체의 평균이 아니다.

고정 출처:

- [Ponytail](https://github.com/DietrichGebert/ponytail/blob/2ed6c52c9d7e5e56942508591085fd45dea277d3/skills/ponytail/SKILL.md), [Ponytail Review](https://github.com/DietrichGebert/ponytail/blob/2ed6c52c9d7e5e56942508591085fd45dea277d3/skills/ponytail-review/SKILL.md): `2ed6c52c9d7e5e56942508591085fd45dea277d3`
- [i-have-adhd](https://github.com/ayghri/i-have-adhd/blob/58494af57962b2d7a996b4d419474380a299af5e/skills/i-have-adhd/SKILL.md): `58494af57962b2d7a996b4d419474380a299af5e`
- [ELI5](https://github.com/DreambigOu/ELI5/blob/a766623b062331fdde53467001379b4ddf3acc2f/skills/eli5/SKILL.md): `a766623b062331fdde53467001379b4ddf3acc2f`

Plugin-Eval 0.1.0의 추정식은 `ceil(JavaScript 문자열 길이 / 4)`다. 논문의 o200k_base 실제 토큰화와 다른 방법이므로 추정치를 논문의 정확한 백분위에 대입하지 않는다. 모델별 실제 token 수나 가격으로도 표현하지 않는다.

## Plugin-Eval 적용과 해석

사용한 skill은 plugin-eval → evaluate-plugin → improve-skill이며, 재작성에는 skill-creator와 writing-for-agents를 적용했다. improve-skill에 적힌 다른 사용자 홈의 skill-creator 경로 대신 현재 세션에 제공된 실제 skill-creator를 읽었다.

평가기는 `.superpowers`를 자동 제외하지 않으며 기본 baseline 산출에 사용자 홈의 스킬도 읽는다. 따라서 기존 후보는 해시가 일치하는 33개 runtime 파일의 패키지를 대상으로 평가하고, 평가 프로세스의 홈은 작업 전용 빈 디렉터리로 제한했다. 인증·과거 대화·사용자의 다른 스킬을 분석하지 않았다. baseline은 도구에 내장된 임계값이며 실제 설치 스킬 표본 평균이 아니다.

수행한 명령 흐름은 `plugin-eval start … --request "Evaluate this plugin."`, `analyze`, 설명 스킬의 `--brief-out`, 원본 네 스킬의 `analyze`, 새 초안의 `analyze`, 세 쌍의 `compare`다. 설치된 CLI를 절대 경로의 Node로 실행했고 JSON 결과를 보존했다.

| 정적 평가 대상 | 이전 점수 | 새 초안 점수 | 파일 로드 token 추정 전 → 후 |
|---|---:|---:|---:|
| ttak-explain | 86 / B | 100 / A | 3,349 → 312 |
| ttak-review | 91 / B | 100 / A | 667 → 290 |
| plugin 묶음 | 11 / F | 58 / D | 4,453 → 808 |

설명 스킬의 우선 수정 지적은 큰 본문 비용이었다. 리뷰 스킬에는 description의 선택 상황과 크기 지적이 있었다. 새 본문과 짧은 Use when description으로 정리했다. 100점은 형식·정적 휴리스틱 검사 결과이며, 실제 설명 정확성이나 출하 합격이 아니다.

plugin 묶음의 총점은 그대로 제품 판정에 쓰지 않는다.

- 이전 inline MCP 객체는 실제 설치와 공식 플러그인 검사에서 통과했지만 Plugin-Eval은 경로 문자열이어야 한다며 감점했다.
- website/privacy/terms URL 필수 판정은 배포 메타데이터 기준이다. 이 지적으로 기능 실패나 보안 취약점이 관측된 것은 아니다. 점수를 올리려고 존재하지 않는 정책 URL을 만들지 않았다.
- deferred 예산은 코드 파일을 텍스트로 계산한다. 이전 95,526token 추정은 그 코드가 모두 모델에 주입됐다는 증거가 아니다.
- 새 manifest의 유효한 문자열 defaultPrompt에서 분석기가 `.join` 오류를 냈다. 동일한 의미의 지원되는 배열 형식으로 바꾼 뒤 분석을 완료했다. 오류 기록을 결과 해석에 남긴다.

## 검증과 다음 실행 준비

새 스킬 두 개는 skill-creator의 `quick_validate.py`를 통과했고 비활성 prototype manifest는 공식 `validate_plugin.py`를 통과했다. 참조 경로·원문 SHA-256·크기·본문 범위·변경 diff를 확인한다. 파일이 짧다는 이유만으로 새 행동이 옳다고 판정하지 않는다.

Plugin-Eval의 `init-benchmark`로 별도 작업 디렉터리에 설정을 만들고, 사용자가 이미 제시한 목적에 맞게 세 과제로 구체화했다: 필요한 호환 계층을 보존하는 리뷰, 주어진 수치로 관리자에게 설명하기, 관련 없는 단순 질문을 단순하게 끝내기. 코드가 없는 리뷰·설명에서 파일 수정을 성공 조건으로 두던 기본 템플릿은 그대로 사용하지 않았다.

설치된 구현은 `benchmark --dry-run`을 지원하지 않는다. skill 본문의 오래된 예시를 따라 실제 모델 실행으로 대체하지 않았다. benchmark는 미실행이며, core ON/OFF와 진행 복귀는 prototype의 hook 연결 전에는 이 설정으로 검증할 수 없다. 추론 설정·유한 실행 예산·정상 호스트 설치·종료 정리를 확정한 뒤 기존 Haiku/Luna 검증 경로에서 실행할 과제다. 모델을 Astra로 임의 교체하지 않았다.

원본 질문과 답변, 민감한 홈 파일을 외부 평가 서비스로 전송하지 않았다. 평가 원본과 benchmark 설정은 `.superpowers/redesign-211/`에, 공개 가능한 크기·점수·해시 요약은 연결한 JSON에 있다. 기존 209의 사실 오류는 미해결 기록으로 유지하며, 새 설계의 행동 검증과 출하는 별도다.
