# 개발 일시 중단 — 107–186 배치 전체 색인

2026-09-14 KST. [전체 브리핑](PAUSE_BRIEFING_2026-09-14.ko.md)의 근거 부록이다.
중단 이후 개발·native 재실행은 없으며, 이미 닫힌 장부·각 행 process/review·복원 기록을 읽기 전용으로 집계했다.

## 집계 범위와 단위

- 기준점은 session 10 / 106 종료의 825회(Claude496/Codex329)다. 그 이전 실행은 아래 80개 배치 합계에 포함하지 않는다.
- native 275회 = 활성화 행159 + 부모 모델 세션 행116. 내부 검증자 시작191회는 별도다.
- 관리585회 중 원복/비활성화159회다. 관리 시작을 모델 호출로 세지 않는다.
- 새 native 배정662회 중 실제275회, 배정 후 UNRUN387회다. 80개 배치별 상한의 미배정298회는 예약도 소비도 아니다.
- 원래 Haiku/Luna 출하 비교의192 subjects/516 requests는 별도 UNRUN이다. 과거 예약·FAIL·UNRUN을 새 배정에 옮기지 않았다.
- tokens는 닫힌 장부의 관측 합계23,105,092다. 입력·캐시·출력 포함 기록이며 청구액이 아니다. timeout30개 배치에는 미보고 in-flight 사용량 가능성이 명시돼 있다. 초기6개 장부는 그 flag 자체가 없으므로 false로 채우지 않았다.
- 배치 PASS1 / FAIL79는 의도적으로 결함을 겨냥한 개발 진단의 종료 판정이다. 무작위 제품 실패율이나 전체 Go 판정이 아니다.
- 860개 native/관리 process 보고서의 cleanup/active0/assigned-before-resume와80개 복원 기록을 확인했다. 살아 있는 프로세스는 별도의 현재 점검에서도0이었다.

기계용 전체 기록: [inventory.json](../.superpowers/pause-briefing-2026-09-14/inventory.json).
현재 정지 점검: [audit.json](../.superpowers/pause-briefing-2026-09-14/audit.json).
초기107의 tokens는 각 실행 review의 두 usage 필드 합계224,756으로 보완했다.
107–109의 관리 수는 실제 reservation/process 파일로 보완했다. 누적값은 매 배치에서 다음 장부와 일치함을 대조했다.

## 단계별 정산

| 배치 | native 실제 | 관리 실제 | 내부 검증자 | 관측 tokens | 배정 후 UNRUN |
|---|---:|---:|---:|---:|---:|
| 107–120 | 51 | 99 | 39 | 4,085,339 | 47 |
| 121–145 | 89 | 175 | 47 | 6,238,632 | 111 |
| 146–166 | 70 | 151 | 55 | 7,715,442 | 104 |
| 167–179 | 40 | 104 | 32 | 2,841,669 | 116 |
| 180–186 | 25 | 56 | 18 | 2,224,010 | 9 |

## 배치별 전체 색인

native는 실제/배정이다. 관리/내부는 서로 다른 단위다. 각 제목 링크에 당시 변경·실패 원인·로컬/native 근거와 복원이 있다.
세부 FAIL 코드와 당시 candidate 값은 inventory 및 원래 batch-closed.json을 보존했다.

| 배치 | 작업·근거 문서 | native | UNRUN | 관리/내부 | 관측 tokens | 종료 판정·실패 행 |
|---|---|---:|---:|---:|---:|---|
| 107 | [설명 시도와 보류 본문 결합 107](NATIVE_ATTEMPT_107.ko.md) | 5/6 | 1 | 7/0 | 224,756 | FAIL · `05-claude-resume` |
| 108 | [정상 plugin 독립 완료 경로 108](NATIVE_COMPLETION_108.ko.md) | 3/8 | 5 | 7/4 | 227,165 | FAIL · `03-claude-simple` |
| 109 | [순차 독립 검증 109](NATIVE_SEQUENCE_109.ko.md) | 3/4 | 1 | 7/0 | 63,966 | FAIL · `03-claude-simple` |
| 110 | [정상 plugin packet 수신 110](NATIVE_RETRIEVAL_110.ko.md) | 4/4 | 0 | 7/5 | 435,863 | FAIL · `04-codex-simple` |
| 111 | [자식 수명주기 111](NATIVE_CHILD_LIFECYCLE_111.ko.md) | 3/4 | 1 | 8/1 | 197,891 | FAIL · `03-codex-simple` |
| 112 | [직접 전달 112](NATIVE_DISPATCH_112.ko.md) | 3/8 | 5 | 7/0 | 194,211 | FAIL · `03-codex-simple` |
| 113 | [현재 시도 연결 113](NATIVE_BINDING_113.ko.md) | 3/8 | 5 | 7/0 | 122,782 | FAIL · `03-codex-simple` |
| 114 | [단일 전달 114](NATIVE_ATOMIC_114.ko.md) | 3/8 | 5 | 7/1 | 266,750 | FAIL · `03-codex-simple` |
| 115 | [결과 보관 115](NATIVE_RETENTION_115.ko.md) | 4/8 | 4 | 7/2 | 370,163 | FAIL · `04-claude-simple` |
| 116 | [호스트 분리 116](NATIVE_HOST_116.ko.md) | 4/8 | 4 | 7/6 | 488,971 | FAIL · `04-codex-simple` |
| 117 | [결과 API 안내 117](NATIVE_WIRE_117.ko.md) | 4/8 | 4 | 7/7 | 467,519 | FAIL · `04-claude-simple` |
| 118 | [질문 단위 검증 118](NATIVE_QUESTION_UNIT_118.ko.md) | 3/8 | 5 | 7/3 | 203,137 | FAIL · `03-claude-simple` |
| 119 | [질문 중립성과 native 반환 형식 119](NATIVE_RETURN_119.ko.md) | 4/8 | 4 | 7/5 | 380,988 | FAIL · `04-codex-simple` |
| 120 | [Typed native 결과 수신 120](NATIVE_TYPED_RETURN_120.ko.md) | 5/8 | 3 | 7/5 | 441,177 | FAIL · `05-claude-unresolved` |
| 121 | [진입 절차 121](NATIVE_ENTRY_121.ko.md) | 3/8 | 5 | 7/0 | 88,652 | FAIL · `03-claude-unresolved` |
| 122 | [정상 보류 진입 122](NATIVE_WITHHOLDING_ENTRY_122.ko.md) | 3/8 | 5 | 7/0 | 47,782 | FAIL · `03-claude-unresolved` |
| 123 | [보류 정정·재개와 입력 schema 123](NATIVE_CORRECTION_AND_SCHEMA_123.ko.md) | 7/8 | 1 | 7/2 | 411,122 | FAIL · `07-claude-simple` |
| 124 | [제출 schema와 최종 길이 조건 124](NATIVE_SUBMISSION_SCHEMA_124.ko.md) | 3/8 | 5 | 7/3 | 241,583 | FAIL · `03-claude-simple` |
| 125 | [최종 형식 검증과 보류 전달 실패 — 125](NATIVE_FINAL_AND_DELIVERY_125.ko.md) | 5/8 | 3 | 7/5 | 449,932 | FAIL · `05-claude-unresolved` |
| 126 | [보류 전달 교정과 요청 평가 누락 — 126](NATIVE_DELIVERY_AND_OMISSION_126.ko.md) | 3/8 | 5 | 7/0 | 74,502 | FAIL · `03-claude-unresolved` |
| 127 | [독립 보류문 검토와 native 호출 자리표시자 실패 — 127](NATIVE_NOTICE_REVIEW_127.ko.md) | 3/8 | 5 | 7/0 | 111,001 | FAIL · `03-claude-unresolved` |
| 128 | [보류 검토 실행·수정과 요구 해석 오류 — 128](NATIVE_NOTICE_MEANING_128.ko.md) | 3/8 | 5 | 7/2 | 166,993 | FAIL · `03-claude-unresolved` |
| 129 | [원래 요구 인용 결합과 보류 수정 지연 — 129](NATIVE_CLAUSE_AND_LATENCY_129.ko.md) | 3/8 | 5 | 7/2 | 150,511 | FAIL · `03-claude-unresolved` |
| 130 | [원문 재사용 입증과 정정 분류 실패 — 130](NATIVE_CACHED_NOTICE_REPAIR_130.ko.md) | 3/8 | 5 | 7/2 | 168,186 | FAIL · `03-claude-unresolved` |
| 131 | [구조화 정정 반환과 실패 호출의 상태 누락 — 131](NATIVE_REPAIR_FAILURE_131.ko.md) | 3/8 | 5 | 7/2 | 274,308 | FAIL · `03-claude-unresolved` |
| 132 | [부모 호출 receipt 보강과 검토 정정 target 위치 실패 — 132](NATIVE_TARGET_NESTING_132.ko.md) | 3/8 | 5 | 7/1 | 194,898 | FAIL · `03-claude-unresolved` |
| 133 | [Haiku 보류 통과와 Luna 원문 범위 불일치 — 133](NATIVE_REQUEST_SCOPE_133.ko.md) | 4/8 | 4 | 7/1 | 217,718 | FAIL · `04-codex-unresolved` |
| 134 | [Luna 보류 통과와 Haiku 실제 정정 적용 뒤 timeout — 134](NATIVE_NOTICE_FAST_PATH_134.ko.md) | 4/8 | 4 | 7/2 | 262,596 | FAIL · `03-claude-unresolved` |
| 135 | [첫 정정 누락 해소, 검토 입력과 결함 출력의 혼동 — 135](NATIVE_NOTICE_REPRESENTATION_135.ko.md) | 3/8 | 5 | 7/1 | 184,912 | FAIL · `03-claude-unresolved` |
| 136 | [보류문 승인과 설명 보류의 결과 필드 혼동 — 136](NATIVE_NOTICE_VERDICT_136.ko.md) | 3/8 | 5 | 7/1 | 144,610 | FAIL · `03-claude-unresolved` |
| 137 | [전용 보류문 검토 제출 통과, 인용 문자열 반환 변형 — 137](NATIVE_NOTICE_RETURN_137.ko.md) | 3/8 | 5 | 7/1 | 155,867 | FAIL · `03-claude-unresolved` |
| 138 | [정확한 보류 반환과 잘못된 근거 부족 판정 — 138](NATIVE_NOTICE_ANCHORING_138.ko.md) | 3/8 | 5 | 7/1 | 153,234 | FAIL · `03-claude-unresolved` |
| 139 | [선행 요청 평가와 요구 충족 가능성의 혼동 — 139](NATIVE_ASSESSMENT_VERDICT_139.ko.md) | 3/8 | 5 | 7/1 | 156,925 | FAIL · `03-claude-unresolved` |
| 140 | [요청 평가 회복과 충분하지 않은 성능 근거 요청 — 140](NATIVE_NOTICE_EVIDENCE_140.ko.md) | 3/8 | 5 | 7/2 | 279,326 | FAIL · `03-claude-unresolved` |
| 141 | [정확한 보류문과 잘못된 선행 해결책 목록 — 141](NATIVE_ASSESSMENT_SCOPE_141.ko.md) | 3/8 | 5 | 7/2 | 286,740 | FAIL · `03-claude-unresolved` |
| 142 | [Gap 분류와 부모 재작성에서 추가된 무조건 쓰기 주장 — 142](NATIVE_ASSESSMENT_TRANSFER_142.ko.md) | 3/8 | 5 | 7/2 | 284,154 | FAIL · `03-claude-unresolved` |
| 143 | [독립 평가의 직접 전달 143](NATIVE_DIRECT_ASSESSMENT_143.ko.md) | 4/8 | 4 | 7/2 | 349,122 | FAIL · `04-codex-unresolved` |
| 144 | [원문 선택 144](NATIVE_ORIGINAL_SOURCE_144.ko.md) | 3/8 | 5 | 7/1 | 164,424 | FAIL · `03-codex-unresolved` |
| 145 | [전체 검증 결과 표시와 양 호스트 보류·재개·정상 대조](NATIVE_ENVELOPE_AND_CONTROLS_145.ko.md) | 8/8 | 0 | 7/11 | 1,219,534 | PASS(배치 한정) |
| 146 | [원래 복잡한 설명의 준비 인자 형식 실패](NATIVE_PREPARATION_SHAPE_146.ko.md) | 3/4 | 1 | 5/1 | 178,934 | FAIL · `03-claude-complex` |
| 147 | [준비 인코딩 통과, 부모 질문 계획 실패](NATIVE_REQUEST_PLAN_147.ko.md) | 3/4 | 1 | 7/1 | 181,894 | FAIL · `03-claude-complex` |
| 148 | [요청 전체 사실 검증 경로, 선행 평가의 거짓 근거 부족](NATIVE_DERIVATION_BOUNDARY_148.ko.md) | 3/4 | 1 | 7/1 | 210,104 | FAIL · `03-claude-complex` |
| 149 | [거짓 보류 해소와 정상 준비 전달, 전체 시간 한도 실패](NATIVE_PREPARATION_LATENCY_149.ko.md) | 3/8 | 5 | 7/2 | 182,084 | FAIL · `03-claude-complex` |
| 150 | [원문·fact 참조 전달 PASS, 시간과 의미 FAIL](NATIVE_REFERENCES_AND_SEMANTICS_150.ko.md) | 3/8 | 5 | 7/2 | 181,937 | FAIL · `03-claude-complex` |
| 151 | [사실 우선 작성 151](NATIVE_FACTS_FIRST_151.ko.md) | 3/8 | 5 | 7/2 | 212,978 | FAIL · `03-claude-complex` |
| 152 | [원문 기반 계산과 최종 검토 실패 152](NATIVE_SOURCE_COMPUTATION_152.ko.md) | 3/8 | 5 | 7/2 | 259,718 | FAIL · `03-claude-complex` |
| 153 | [전용 최종 검토 153](NATIVE_FINAL_REVIEW_153.ko.md) | 3/8 | 5 | 7/2 | 205,831 | FAIL · `03-claude-complex` |
| 154 | [검토 요약 상한 실패 154](NATIVE_COMPACT_REVIEW_154.ko.md) | 3/8 | 5 | 7/2 | 264,290 | FAIL · `03-claude-complex` |
| 155 | [동일 후보 Luna 호스트 범위 155](NATIVE_LUNA_SCOPE_155.ko.md) | 2/4 | 2 | 2/2 | 175,654 | FAIL · `02-codex-complex` |
| 156 | [실제 결과 참조 반환 156 — 종료·복원](NATIVE_RESULT_REFERENCES_156.ko.md) | 5/10 | 5 | 8/6 | 731,904 | FAIL · `05-claude-complex` |
| 157 | [비승인용 최종 검토 형식 preview 157 — 종료·복원](NATIVE_FINAL_PREVIEW_157.ko.md) | 5/10 | 5 | 8/6 | 917,919 | FAIL · `05-claude-complex` |
| 158 | [검증자용 계산 실행 표 158 — 종료·복원](NATIVE_MODEL_WITNESS_158.ko.md) | 3/10 | 7 | 8/2 | 363,717 | FAIL · `03-claude-complex` |
| 159 | [최종 검토 상태 전달159 — CLOSED / RESTORED / FAIL](NATIVE_REVIEW_STATE_159.ko.md) | 3/10 | 7 | 8/2 | 314,668 | FAIL · `03-claude-complex` |
| 160 | [항목별 최종 검토 160 — 종료 및 평가 정정](NATIVE_REVIEW_CHECKS_160.ko.md) | 3/10 | 7 | 8/2 | 229,369 | FAIL · `03-claude-complex` |
| 161 | [실제 fact별 부분 대조161 — 정상 전달과 원래 과제 실패](NATIVE_FACT_REVIEW_161.ko.md) | 5/10 | 5 | 8/6 | 786,788 | FAIL · `05-claude-complex` |
| 162 | [계산 사실162 — 실제 원문 결합과 최종 전달 실패](NATIVE_COMPUTED_FACTS_162.ko.md) | 3/10 | 7 | 8/2 | 373,738 | FAIL · `03-claude-complex` |
| 163 | [정확한 최종 본문 전달163 — 정상 대조와 원래 과제 실패](NATIVE_EXACT_DELIVERY_163.ko.md) | 5/10 | 5 | 8/6 | 905,879 | FAIL · `05-claude-complex` |
| 164 | [계산 본문의 사전 제공164 — fact 범위와 최종 작성의 분리](NATIVE_COMPUTED_ACCOUNT_164.ko.md) | 3/10 | 7 | 8/2 | 373,315 | FAIL · `03-claude-complex` |
| 165 | [실제 fact에 연결된 최종 구성165](NATIVE_FACT_COMPOSITION_165.ko.md) | 3/10 | 7 | 8/2 | 376,412 | FAIL · `03-claude-complex` |
| 166 | [기본 최종 구성 recipe166](NATIVE_COMPOSITION_RECIPE_166.ko.md) | 3/10 | 7 | 8/2 | 288,309 | FAIL · `03-claude-complex` |
| 167 | [최종 검토 대상 배치167: fact의 잘못된 장애 분류](NATIVE_FACT_OBSTACLE_167.ko.md) | 3/12 | 9 | 8/1 | 192,793 | FAIL · `03-claude-calibration` |
| 168 | [Fact 판정 범위168: 사실 단계 통과, 중첩 최종 제출 실패](NATIVE_FACT_SCOPE_168.ko.md) | 3/12 | 9 | 8/2 | 280,639 | FAIL · `03-claude-calibration` |
| 169 | [동일9검사의 flat 제출169: Haiku 교정 흐름 통과, Luna 시간 초과](NATIVE_FLAT_FINAL_169.ko.md) | 4/12 | 8 | 8/5 | 674,928 | FAIL · `04-codex-calibration` |
| 170 | [Codex 최종 등록·검증 연결170 — 실제 실행 결과](NATIVE_JOINED_RECIPE_170.ko.md) | 3/12 | 9 | 8/1 | 136,566 | FAIL · `03-codex-calibration` |
| 171 | [현재 검증자 challenge 참조171 — 실제 경로 통과, 정정 검토 중 timeout](NATIVE_SUBMISSION_REFERENCE_171.ko.md) | 3/12 | 9 | 8/3 | 158,352 | FAIL · `03-codex-calibration` |
| 172 | [정상 Codex parent cache·recipe172](NATIVE_PARENT_CACHE_172.ko.md) | 3/12 | 9 | 8/2 | 226,854 | FAIL · `03-codex-calibration` |
| 173 | [실제 결과 지점의 다음 분기 전달173](NATIVE_RESULT_HANDOFF_173.ko.md) | 3/12 | 9 | 8/3 | 189,385 | FAIL · `03-codex-calibration` |
| 174 | [정상 준비·첫 fact 연결174](NATIVE_ENTRY_RECIPE_174.ko.md) | 3/12 | 9 | 8/3 | 144,620 | FAIL · `03-codex-calibration` |
| 175 | [정상 recipe 축약과 code-mode 양도175](NATIVE_COMPACT_RECIPE_175.ko.md) | 3/12 | 9 | 8/2 | 227,831 | FAIL · `03-codex-calibration` |
| 176 | [정상 code-mode 양도 directive176](NATIVE_YIELD_DIRECTIVE_176.ko.md) | 3/12 | 9 | 8/3 | 183,874 | FAIL · `03-codex-calibration` |
| 177 | [실제 오류 인용의 검토 대상177](NATIVE_REVIEW_TARGET_177.ko.md) | 3/12 | 9 | 8/2 | 180,055 | FAIL · `03-codex-calibration` |
| 178 | [source별 issue 영역178 — 정상 최초 조회 관측, 교정 검증 시간 초과](NATIVE_SCOPED_ISSUES_178.ko.md) | 3/12 | 9 | 8/3 | 145,707 | FAIL · `03-codex-calibration` |
| 179 | [초기 metadata 탐색179 — 네 항목 조회, 교정 등록 전 timeout](NATIVE_ENTRY_DISCOVERY_179.ko.md) | 3/12 | 9 | 8/2 | 100,065 | FAIL · `03-codex-calibration` |
| 180 | [inline MCP180 — 패키지 검증 통과, 정상 설명의 참조 결합 실패](NATIVE_INLINE_MCP_180.ko.md) | 3/4 | 1 | 8/1 | 141,889 | FAIL · `03-codex-simple` |
| 181 | [current 원문181 — Luna 정상 통과, Haiku 결과 조회 실패](NATIVE_CURRENT_ALIAS_181.ko.md) | 4/4 | 0 | 8/4 | 459,683 | FAIL · `04-claude-simple` |
| 182 | [host별 결과 조회182 — Claude 영수증 복사 실패](NATIVE_RESULT_HOST_182.ko.md) | 3/4 | 1 | 8/1 | 163,041 | FAIL · `03-claude-simple` |
| 183 | [Claude3필드 조회183 — Haiku 정상 통과, Luna 전달 실패](NATIVE_THREE_FIELD_READ_183.ko.md) | 4/4 | 0 | 8/4 | 447,987 | FAIL · `04-codex-simple` |
| 184 | [승인된 전달 출처184 — Luna 경계 통과, Haiku 등록 순서 실패](NATIVE_DELIVERY_SOURCE_184.ko.md) | 4/6 | 2 | 8/3 | 363,617 | FAIL · `04-claude-delivery` |
| 185 | [Claude 조회 인계185 — 로컬 통과, native 영수증 형식에서 실패](NATIVE_CLAUDE_HANDOFF_185.ko.md) | 3/6 | 3 | 8/1 | 163,913 | FAIL · `03-claude-delivery` |
| 186 | [compact receipt186 — 전달 경계 통과, 승인 범위 표현 실패](NATIVE_RECEIPT_FRAMING_186.ko.md) | 4/6 | 2 | 8/4 | 483,880 | FAIL · `04-codex-delivery` |

187은 [설계 기록](../.superpowers/release-loop-187/DESIGN.ko.md)만 있으며 구현·배정·관리·native 시작은 모두0이다.
이 색인은 실행 지시나 재개 승인이 아니다. 사용자 요청으로 개발을 중단한 상태를 정리한 기록이다.
