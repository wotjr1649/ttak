# TTAK 첫 출하 현황

## 현재: 결함 해결과 출하 검증 재개 — 2026-09-14

사용자의 후속 요청에 따라 결함 수정, 발견된 결함의 추가 분석·수정, 남은 검증을 재개했다.
**전체 출하 판정은 아직 No-Go다.** 아래의 PAUSED 및 native 미실행 설명은 이전 단계의 기록이다.
최신 진행 상황과 검증 범위는 [재개 기록](RELEASE_RESUME_2026-09-14.ko.md)을 참조한다.

## 후속 사용자 요청: 고정 120초 제한 제거 — 2026-09-14

모델 실행의 고정 120초 상한·기본값을 제거하고 실행 계획에 유한 시간 예산을
명시하도록 변경했다. 시간 예산 소진과 답변 품질 실패를 구분한다.
[변경 범위와 출하 영향](INFERENCE_TIME_BUDGET.ko.md)을 참조한다.
이번에는 해당 코드 변경과 로컬 검증만 수행하며 새 native·설치·전체 비교는 없다.
아래 186 후보 일치·중단 기록은 변경 전 체크포인트다. 전체 출하 판정은 계속 No-Go다.

## 현재 상태: 사용자 요청으로 개발 일시 중단 — 2026-09-14 KST

**PAUSED / 전체 Go 미달성.**186은 CLOSED/RESTORED이며187은 설계만 있고
구현·배정·관리·native 시작0이다. 중단 요청 뒤 제품 수정이나 모델 실행은 하지 않았다.
현재 runtime33파일은186 고정본과 일치하고, 두 시험 프로필의 선택 복원·후보 비활성·
후보 ON2파일 원상부재·작업 소유 프로세스0을 읽기 전용으로 다시 확인했다.
목표 도구의 `active`는 미완료 목표 보존 상태다. pause API가 없어 완료/blocked로
바꾸지 않았으며, 이 아래 과거 checkpoint의 다음 작업 문구는 재개 승인이 아니다.

[전체 브리핑과 미완료 원인](PAUSE_BRIEFING_2026-09-14.ko.md),
[107–186 전체 배치 색인](PAUSE_BATCH_INDEX_2026-09-14.ko.md)을 작성했다.
이번80개 배치의 실제 상위 native275(활성화159/부모 모델 행116), 관리585(원복159),
내부 검증자191, 관측 장부23,105,092tokens를 대조했다. 기존825를 포함한 누적은
1100(Claude649/Codex451)이며, 현재 Haiku/Luna의 원래192subjects/516requests는 별도 UNRUN이다.
186 양쪽 최종 검증·정확 전달 PASS와 Luna의 승인 범위 표현 FAIL을 구분해 기록했다.
187의 새 delivery 상태/Code Mode reader 수정은 구현하지 않았다.

## 최신 후속 작업186: 양쪽 전달 경계 통과, Luna 승인 범위 표현 실패

후보 `+20260913223209` / `ttak-frame186`, runtime33파일이다.
compact receipt 전체를 감싼 언어 없는 단일 code fence를 명시적 입력 형식으로 추가했다.
추가 문장/다중블록/다른 label을 추출하지 않으며 필드·challenge·실제 제출 hash·조회·
승인 scope/본문 비교는 유지한다. legacy full-result parser도 그대로다.
집중41PASS/3FAIL→44PASS, **Node860/Python81/conformance PASS**,
공식 plugin·skill/marketplace·helper12/26구문·local resume PASS다.
새 native6/관리8(원복2)/내부44·동시성1, 다른6 native상한 미배정이다.
양쪽 정상 설치/활성화·33파일/11hook 대조 후 Haiku64306ms/Luna83017ms에 실제
두 검증/결과 조회·첫 표지 전달의 Stop 차단·도구 없는 정확한1회 교정은 모두 통과했다.
Claude는 actual next_step 인수를 사용해 final 등록을 먼저 수행했다.
첫 Claude 감사기의 non-text block 오인은 원본 보존/별도3검사 후 corrected 감사로 대조했다.
그러나 Luna의 final 등록 전 commentary가 초안을 approved wording이라 불러 승인 범위의
명확한 구분에 실패했다. [compact receipt186](NATIVE_RECEIPT_FRAMING_186.ko.md)은
**CLOSED/RESTORED**, native4/관리8(원복2)/child4/23완료응답/**483880tokens**,
누적 **1100(649/451)**다. 원래 simple2행 UNRUN·다른6회 미배정, 소유 process0·
원래 선택·ON2파일 원상부재다. 실제 네 영수증은 bare라 새 framing native 분기는 UNRUN이다.
Codex 부모 Code Mode의 별도 framing reader도 후속 대조에서 확인돼 연결 검증이 남는다.
다음은 host-checked delivery 상태를 부모 출력에 보존하고 receipt reader 계약을 일치시키는 일이다.
전체 Go와 필수 H/Q·192/516은 계속 active/미충족이다.

## 최신 후속 작업185: Claude 조회 인계 로컬 통과, native 영수증 형식 실패

후보 `+20260913221251` / `ttak-handoff185`, runtime33파일이다.
Claude 정상 `explanation_result` 응답에 현재 단계의 다음 도구/인수를 자동 제공하고,
native hook이 실제 관측 상태로 이를 독립 재계산한다. final 등록 전 Agent 시작을
안내하지 않는다. public 조회3필드·모든 공개 schema와 기존 native recipe·영수증/
원문/revision/미등록 packet 거부는 유지한다. Codex 경로와 보류/assessment 안내도 동일하다.
집중30PASS/5FAIL→36PASS, 전달 통합44PASS다. 중간 감사 전제 오류와 첫 전체
852PASS/4FAIL(cache fixture의 fact 조회 생략)을 보존하고 검사를 실제 순서에 맞췄다.
최종 **Node856/Python81/conformance PASS**, 공식 plugin·skill/marketplace·
helper12/26구문·local resume PASS다. 새 native6/관리8(원복2)/내부44 배정,
동시성1·다른6 native상한 미배정이다. 양쪽 정상 설치/활성화·33파일/11hook 대조 뒤
Haiku delivery probe는39479ms에 fact 영수증을 언어 없는 단일 코드 블록으로 반환해
현재 parser가 거부했다. 내부 JSON은 실제 제출 영수증과 정확히 같지만 정상 결과 조회/
새 next_step/final/전달 경계는 UNRUN이다. attempt/state/Stop은 unavailable다.
[Claude 조회 인계185](NATIVE_CLAUDE_HANDOFF_185.ko.md)는 **CLOSED/RESTORED**,
실제 native3/관리8(원복2)/child1/7완료응답/**163913tokens**, 누적 **1096(647/449)**다.
남은3행 UNRUN·다른6회 미배정이며 소유 process0·원래 선택·ON2파일 원상부재다.
다음은 compact receipt의 단일 블록 형식 호환성을 검토하되 실제 제출/해시/필드/조회
검증과 실패 기록을 보존한다. 전체 Go와 필수 H/Q·192/516은 active/미충족이다.

## 최신 후속 작업184: Luna 전달 교정 통과, Haiku 최종 등록 순서 실패

후보 `+20260913213925` / `ttak-delivery184`, runtime33파일을 고정했다.
완료된 설명의 Stop 안내가 실제 `explanation_result.delivery.final_text`를 가리킨다.
legacy full-result 경로는 검토된 packet의 literal 본문을 가리키며 보류 안내와
정확한 본문/해시·독립 검증·1회 교정·실패 거부는 그대로다.
초기 전체848PASS/1FAIL과 호환 테스트의 감사 오류 두 건을 보존했다.
최종 집중142PASS, **Node849/Python81/conformance PASS**, 공식 plugin·skill·
marketplace·helper12/27구문·local resume PASS다.
새 배정 native6/관리8(원복2)/내부44, 동시성1이며 나머지6 native상한은 미배정이다.
양쪽 정상 설치/활성화·33파일/11hook 대조를 마쳤다.
Luna delivery probe는83397ms에 정확한 표지 첫 전달→Stop block→도구 없는1회 교정→
승인된2문장 본문/Stop completed를 실제 입증했다. 실제 fact/final 및 본문 의미 PASS,
9완료응답/130807tokens다. 이는 원래 비교 subject나 품질 개선 증거가 아니다.
Haiku는58029ms, fact 조회 뒤 final 등록 없이 후보 digest를 challenge로 사용해
Agent를 시작하려다 거부됐다. 이후 final 등록도 실패 상태에서 거부됐다.
최종 verifier/전달 경계는 UNRUN, 저장 상태/Stop은 unavailable이다.
[전달 출처184](NATIVE_DELIVERY_SOURCE_184.ko.md)는 **CLOSED/RESTORED**다.
실제 native4/관리8(원복2), 내부 시도4 중 child3·거부1,
18완료응답/**363617tokens**, 누적 **1093(645/448)**다.
양쪽 원래 simple2행은 UNRUN이며 다른6회는 처음부터 미배정이다.
소유 process0·원래 선택·ON2파일 원상부재를 확인했다. 다음은 Claude 결과 조회에
실제 단계별 다음 동작을 제공하고 hook이 독립적으로 확인하는 일이다.
모든 필수 출하 조건과 원래192subjects/516requests의 Go 목표는 active/미충족이다.

## 최신 후속 작업183: Claude3필드 정상 통과, Luna exact 전달 실패

후보 `+20260913211542` / `ttak-receipt183`, runtime33파일이다.
Claude 결과 조회의 공개 schema를 기존 native_dispatch의3필드로 맞추고,
수동 receipt 복사 옵션과 Codex wait 안내 한 문장만 제외했다.
Codex15개 metadata·다른14개 Claude 도구와 모든 실행/receipt/원문/실패 guard·
native recipe는182와 동일하다. 정확한 legacy receipt도 내부 계약대로 계속 검사한다.
집중35PASS/1FAIL →36PASS, **Node848/Python81/conformance PASS**,
공식 plugin·skill/marketplace·helper12/28구문·local resume PASS다.
새 native4/관리8(원복2)/내부22, 동시성1·다른8 native상한 미배정이다.
[정상 설명183](NATIVE_THREE_FIELD_READ_183.ko.md)의 Claude simple은61802ms,
3필드 실제 조회2회·독립 fact/final·정확한2문장 전달·Stop과 본문 PASS다.
Codex는78530ms에 두 독립 검증/결과 조회와 승인된 delivery까지 관측했지만,
부모가 승인된 첫 구절을 생략하고 Stop 뒤에도 같은 변경 본문을 반복해 FAIL이다.
첫 Stop은 이미 참조 객체인 check_final.final_text 입력을 복사하라는 낡은 출처를
가리켰다. 교정1회가 소진돼 blocked→stopped/unavailable다. 부모 recipe 생략도 남는다.
**CLOSED/RESTORED**, native4/관리8(원복2)/내부4/완료 응답22/**447987tokens**,
소유 process0·양쪽 원래 선택·ON2파일 원상부재, 누적 **1089(643/446)**다.
배정 미사용0·처음부터 미배정8이다. 다음은 Stop 안내가 실제 승인된
explanation_result.delivery.final_text를 가리키도록 고치는 일이다.
정확한 비교·1회 교정 한도를 유지한다. Go와 필수 H/Q·192/516은 OPEN/active다.

## 최신 후속 작업182: Codex 전용 flag 분리, Claude의 영수증 복사 실패

후보 `+20260913210215` / `ttak-read182`, runtime33파일이다.
Claude tools/list의 결과 조회에서 Codex 전용 include_next_step 옵션만 제외했다.
Codex15개 metadata와 Claude의 다른14개 metadata, 모든 hook·실행·receipt·실패
거부 및 native recipe는181과 byte 동일하다. 값을 자동 제거하거나 오류를 무시하지 않는다.
집중33PASS/2FAIL →35PASS, **Node847/Python81/conformance PASS**,
공식 plugin·skill/marketplace·helper12/27구문·local resume PASS다.
새 native4/관리8(원복2)/내부22 배정, 동시성1이며 다른8 native상한은 미배정이다.
정상 설치·33파일/11hook 대조·양쪽 활성화 후
[Claude simple182](NATIVE_RESULT_HOST_182.ko.md)이25180ms exit0으로 끝났지만 FAIL이다.
부모가 선택적 receipt_text에 실제 영수증 대신 Agent의 agentId 안내문을 넣었다.
정상 Pre가 거부했으며 fact referenced/verdict:null·final:null, Stop/state/attempt는
unavailable다. 부모는 실패를 알린 뒤 미검증 완성 설명을 덧붙였다. 실제 fact는
4문장이라 최종2–3문장 조정도 필요했지만 결과 조회/최종 검증/승인된 전달은 UNRUN이다.
**CLOSED/RESTORED**, native3/관리8(원복2)/내부1/완료 응답7/**163041tokens**,
소유 process0·양쪽 원래 선택·자체 ON2파일 원상부재, 누적 **1085(641/444)**다.
후속 Codex1행은 UNRUN이고 다른8회는 처음부터 미배정이다.
다음은 Claude의 정상3참조필드에 필요 없는 receipt 복사 입력/안내를 공개 schema에서
제외하는 일이다. 실제 영수증·원문·실패/재시도 거부는 유지한다.
실패 본문 보류와 모든 출하 H/Q·192/516 및 Go는 OPEN/active다.

## 최신 후속 작업181: Luna 정상 통과, Haiku의 Codex 전용 flag 실패

후보 `+20260913203706` / `ttak-alias181`, runtime33파일이다.
정상 Codex Pre가 current 요청+explicit fact 배열의 원문을 실제 native 기록에서
해석하고, explicit final의 원문/fact/revision 결합을 호출 전에 검사한다.
Post 재검사와 direct legacy·양쪽 current 참조 계약, 나머지 runtime은180과 같다.
부모 client-cache 의존성은 아직 제거하지 않았다.

집중 수정 전35PASS/3FAIL →38PASS, delivery 통합49PASS다.
첫 전체842PASS/1FAIL은 이전 Post 거부 시점을 기대한 검사였으며 실패 기록을 보존했다.
거부를 Pre로 앞당기고 final/pending 영수증 부재도 검사한 새 전체는
**Node843/Python81/conformance PASS**, 공식 plugin validator·helper12/30구문·
skill/marketplace·local resume PASS다. 33파일/11hook 대조와 정상 양쪽 설치/활성화를
마쳤다. [정상 설명181](NATIVE_CURRENT_ALIAS_181.ko.md)의 Codex simple은82602ms,
독립 fact/final·정확한2문장 전달·Stop과 본문 판정 PASS다. 양쪽 current를 사용해
새 혼합 입력 분기의 native 입증은 UNRUN이다. Claude는49431ms exit0이지만,
정확한 fact와 final 승인 뒤 Codex 전용 include_next_step을 receipt 없이 넣었다.
정상 Pre가 거부했고 부모가 실패 안내에 미검증 완성 설명을 덧붙였다. Stop/state는
unavailable이며 최종 조회/승인된 전달은 UNRUN이다. 해당 행은 FAIL이다.
배정은 native4/관리8(원복2)/내부22, native ceiling12 중8회 미배정이다.
**CLOSED/RESTORED**, 실제 native4/관리8(원복2)/내부4, 완료 응답22/
**459683 tokens**. 배정 미사용0·처음부터 미배정8이며 소유 process0,
양쪽 원래 선택·자체 ON2파일 원상부재를 확인했다. 누적 **1082(639/443)**.
과거180의1UNRUN과 새 배정을 구분한다. 다음은 Claude에 노출된 Codex 전용
결과 조회 schema의 분리다. 실패 뒤 본문 보류와 client cache·calibration 및
모든 필수 H/Q·192/516과 Go 목표는 OPEN/active다.

## 최신 후속 작업180: package PASS, 혼합 current 참조의 결합 실패

후보 `+20260913193620` / `ttak-inline180`, runtime33파일이다.
Codex MCP의 command/args/cwd/빈 env를 manifest inline 객체로 옮겼고,
중복 companion 파일은179 frozen에 보존한 채 현재 bundle에서 제거했다.
후보 hash 목록에서 그 경로만 빼며 inline 설정을 포함한 manifest 결합은 유지한다.
나머지 검증 script/recipe/검사는179와 byte 동일하다. 수집기 검토 경로와 freeze 목록도
새 선언을 사용하고, 바뀐 실행 필드나 중복 companion을 거부한다.

집중 Node89/Python14, **Node837/Python81/conformance PASS**.
그동안 UNRUN이던 **공식 generic plugin validator도 현재/frozen 후보에서 PASS**,
helper12검사/32구문·skill/marketplace·local resume PASS다.
새 배정은 native4/관리8(원복2)/내부22, 동시성1이다. native ceiling12 중8회는
이번에 배정하지 않았다. 정상 설치·33파일/11hook 대조·양쪽 활성화를 마쳤고,
변경된 정상 MCP에서 준비·실제 fact 제출/반환/조회를 관측했다.
[정상 설명180](NATIVE_INLINE_MCP_180.ko.md)은 부모의 결과 저장 생략과 client 조회
실패 뒤, current 요청+literal fact 배열을 legacy 분기가 문자 current로 컴파일해
실패했다. 정상 Post/dispatch Pre/Stop이 거부·unavailable를 보존했다.
최종 verifier/검토된 전달은 UNRUN이다.
**CLOSED/RESTORED**, 실제 native3/관리8(원복2)/내부1/완료 응답8/**141889 tokens**.
부모 원장119349와 checkpoint 일치, 소유 process0·남은 배정1행 UNRUN,
처음부터 미배정8회다. 누적 **1078(637/441)**.
다음은 current source 참조 처리와 부모 client-cache 의존성의 실행형 재현/수정이다.
179 교정 timeout·검토 전 commentary·recipe 생략과 그 외 필수 H/Q·192/516은
OPEN이며, 이 패키지 작업은 전체 Go 완료가 아니다.

## 최신 후속 작업179: 네 entry 조회, 교정 등록 전 timeout

후보 `+20260913191321` / `ttak-discovery179`, runtime34파일이다.
공통 skill에서 현재 entry metadata만 조회한다. 실제178의 목록에 새 탐색 코드를
적용하면15개/35615바이트 대신1개/5740바이트를 그대로 반환한다. 이는 로컬 대조이며
native 지연 개선은 아직 미입증이다. 모든 runtime script/hook/recipe/검사는178과
byte 단위로 동일하다.

집중50PASS, **Node836/Python79/conformance PASS**, helper12검사/29구문,
skill/marketplace·local resume PASS다. 첫 전체835PASS/1FAIL은 공통 skill의
공급자명 표기였고 실제 적용 조건인 code-mode host로 수정했다. 검사 기준과 실패
기록은 유지했다. generic validator 비호환은 아직 UNRUN이다.
새 native12/관리8(원복2)/내부88 배정 아래 정상 설치·11hook 대조·양쪽 활성화를
마쳤다. [정상 calibration179](NATIVE_ENTRY_DISCOVERY_179.ko.md)의 실제 탐색은
네 entry/10951바이트였고 metadata→entry18210ms로 지연 개선은 없었다.
최초 final은 source별 issue와 정상 조회가 맞았지만48377ms가 걸렸다.
부모가 검토 전 correction literal을 commentary에 출력한 뒤120006ms timeout,
교정 등록/검증/전달·Stop UNRUN이다. retained pending/FINAL0 returned/withheld다.
**CLOSED/RESTORED**, native3/관리8(원복2)/내부2/완료 응답7/**100065 tokens**.
완료 부모 원장47871과 checkpoint가 일치하지만 마지막 commentary 이후
미완료 응답의 in-flight 불확실성은 남는다. 후속9 UNRUN·소유 process0,
누적 **1075(636/439)**다. 탐색 문구 반복을 멈추고 독립적인 패키지 validator
비호환을 조사한다. 품질 실패·원래192/516과 전체 Go는 미완료/active다.

## 최신 후속 작업178: source별 issue 영역 사용, 교정 검증 시간 초과

후보 `+20260913184556` / `ttak-domains178`, runtime34파일이다. public 최종
제출의 `issues`와 `fact_issues`를 나누고 각 검사에 해당 영역의 인덱스만 허용한다.
기존 canonical 세 그룹/단일 issue 목록으로 모든 값과 연결을 보존해 변환하며,
아홉 검사·전체16개 및 결과/근거 한도·strict legacy 파싱을 유지한다.
177에서 관측한 native quote/target guard는 byte 단위로 그대로다.

177 actual 입력의 공통 인덱스 문제와 새 영역 거부를 재현했다. 합성 정상 대조를
native 완료로 간주하지 않는다. 집중59PASS, **Node832/Python79/conformance PASS**,
helper12검사/29구문·skill/marketplace·로컬 resume PASS다. generic validator는
기존 비호환으로 UNRUN이다.
[정상 calibration178](NATIVE_SCOPED_ISSUES_178.ko.md)에서 최초 final은 오류를
final/request에만 연결했고, fact_issues는 비웠다. 정상 native 결과 조회가 이를
수용해 교정 단계로 갔지만, fresh child 시작 뒤120016ms timeout이다.
교정 코드/제출/조회·최종 전달·Stop은 UNRUN, retained pending/FINAL1 launched다.
부모의 일부 recipe 검사 생략도 남아 있다.
**CLOSED/RESTORED**, native3/관리8(원복2)/내부3/완료 응답9/**145707 tokens**.
부모 checkpoint에 없는 완료25308을 대조했고 in-flight 불확실성을 유지한다.
소유 process0·후속9 UNRUN, 누적 **1072(635/437)**다.
다음은 실제 첫 metadata15개/35615바이트를 필요한 entry로 좁히는 수정과 검증이다.
원래192/516·네 기능/혼합·모든 H/Q와 Go 목표는 미완료/active다.

## 최신 후속 작업177: 잘못된 fact 귀속을 정상 native 조회가 거부

후보 `+20260913181943` / `ttak-target177`, runtime34파일이다. fact public 필드
세 개에 대상을 명시하고, 최종 보류의 정상 native 조회에서 기존 child snapshot의
정확한 packet과 인용 대상(request/final/actual fact)을 대조한다. 잘못된 연결은
자동 수정·pass·재조회 복구 없이 실패한다. 같은 아홉 검사·canonical 결과·strict
legacy 입력·native recipe·시간 한도를 보존했다.

176의 실제 잘못된 수용을 재현하고 현재 reader의 거부를 확인했다. 집중45PASS,
**Node822/Python79/conformance PASS**, helper12검사/30구문·skill/marketplace·
로컬 resume PASS다. 전체 첫821PASS/1FAIL의 구 schema 기대값도 실패로 보존했다.
generic validator 비호환은 UNRUN이다.
[정상 calibration177](NATIVE_REVIEW_TARGET_177.ko.md)은 정확한 fact 조회 뒤,
최초 final의 `fact_computed_outcomes`가 final-only 오류를 연결해 실패했다.
정상 부모 Pre가 결과 조회를 거부했고, 부모는 검증 실패를 알렸다. 실제 Stop은
stopped/unavailable, 저장 state/attempt unavailable·FINAL0 referenced·verdict:null이다.
교정 등록/검증/전달은 UNRUN이며 exit0을 완료로 세지 않는다.
**CLOSED/RESTORED**, 새 배정12/관리8(원복2)/내부88 중 실제 native3/관리8(원복2)/
내부2/완료 응답10/**180055 tokens**. 최종 checkpoint와 native 원장이 일치한다.
모든 관측 turn 완료·소유 process0, 후속9 UNRUN, 누적 **1069(634/435)**다.
다음은 final과 fact에 공유되는 issue 인덱스의 표현 구조다. 기존 인용/대상 guard를
유지한다. 원래192/516·네 기능/혼합·모든 H/Q·최종 Go는 미완료, 목표 active다.

## 최신 후속 작업176: 양도 directive 실제 사용, 교정 MCP 호출 전 timeout

후보 `+20260913174342` / `ttak-yield176`, runtime34파일이다. normal Codex의
waiting recipe 첫 줄에 yield60000 directive를 제공했다. 첫 줄 외 실행 본문·packet·
검사·native60초/전체120초 한도는175와 같다. 집중48PASS,
**Node808/Python79/conformance PASS**, helper12검사/30구문·skill/marketplace·
로컬 resume PASS다. generic validator 비호환은 UNRUN이다.

[정상 calibration176](NATIVE_YIELD_DIRECTIVE_176.ko.md)에서 세 waiting recipe가
첫 줄을 사용했고 exact entry·최초 오류안 withheld·실제 조회가 통과했다. 최초 final의
부모 code는 delivery 비교를 생략했다. 교정 fresh child는 코드만 내보내고120008ms
timeout, retained pending/FINAL1 launched·submitted:false·submission/reply/verdict
null이다. **교정 실제 MCP 호출·조회·전달·Stop UNRUN**이다. 완료된 두 recipe는
각19756/25875ms로30초 미만이라 native 양도 경계나 지연 개선은 입증하지 못했다.
fact-review 세 검사의 final-only 오류 귀속도 OPEN이다.
**CLOSED/RESTORED**, native3/관리8(원복2)/내부3/완료 응답10/**183874 tokens**.
checkpoint에 없는 완료 부모31352를 원장과 대조했다. third의 완료 사용량0기록은
소모0을 뜻하지 않으며 in-flight 불확실성을 유지한다. 후속9 UNRUN,
누적 **1066(633/433)**. 다음은 fact-review 대상 귀속의 실행형 반례와 경계 조사다.
원래192/516·네 기능/혼합·모든 H/Q와 전체 Go는 미완료, 목표 active / No-Go다.

## 최신 후속 작업175: 축약 recipe 사용, 별도 final 등록·code-mode 양도·timeout

후보 `+20260913171818` / `ttak-short175`, runtime34파일이다. normal Codex의
정적 recipe를 줄이면서 모든 호출·검사·오류·native lifecycle을 보존했다.
동일 transport에서174/175의 before/after 동등성·경계 **47PASS**,
**Node807/Python79/conformance PASS**, helper12검사/28구문·skill/marketplace·로컬
resume PASS다. generic validator 비호환은 UNRUN이다. 정적 bytes 감소를 native
시간 개선으로 인정하지 않는다.

[정상 calibration175](NATIVE_COMPACT_RECIPE_175.ko.md)에서 entry와 모든 spawn
검사가 사용됐지만 첫 final 등록/dispatch를 나눴다. native withheld를 기다리던
code-mode가31026ms에 cell5를 양도했고, 별도 부모 wait 응답29923tokens가 관측됐다.
실제 결과는 그 wait 뒤에 도착했다. 교정 등록/dispatch 후120초 timeout,
retained pending/FINAL1 planned·native launch binding 없음이다.
**교정 native 검사·부모 조회·전달·Stop UNRUN**, fact-review 대상 혼동도 OPEN이다.
**CLOSED/RESTORED**, native3/관리8(원복2)/내부2/완료 응답11/**227831 tokens**.
checkpoint에 없는 완료 부모31946을 원장과 대조했고 in-flight 불확실성을 유지한다.
후속9 UNRUN, 누적 **1063(632/431)**. 다음은 최초 code-mode 양도 설정을 조사하되
native120초·verifier60초·모든 guard는 유지한다. 전체 Go 목표는 active / No-Go다.

## 최신 후속 작업174: 준비·첫 fact 연결 확인, 정정 Post/반환 전 timeout

후보 `+20260913165045` / `ttak-entry174`, runtime34파일이다. normal Codex의
기존 준비 도구 metadata에서 한 번의 준비+첫 fact 실행 recipe를 제공했다.
model_evidence가 있으면 준비만 반환해 부모가 먼저 검사한다. 기존 native lifecycle과
바인딩 검사를 유지했고 shared skill은 진입 연결만 추가했다. 동일 binding의 모든
prepare packet·legacy compiler·host adapter 및 Claude metadata는173과 같다.
**집중42 / Node807 / Python79 / conformance PASS**, helper12검사·27구문·
로컬 resume·skill/marketplace PASS다. generic validator 비호환은 UNRUN이다.

[정상 calibration174](NATIVE_ENTRY_RECIPE_174.ko.md)에서 연결 entry가 사용됐고,
실제 fact와 변경 없는 오류안의 withheld·조회가 통과했다. 첫 final recipe는 부모가
일부 client 검사를 생략해 다시 작성했다. 교정 fresh verifier에서 MCP complete
결과는 나왔지만120초 내 PostToolUse 승인·native receipt·부모 조회·전달·Stop은
미관측이다. 저장 상태는 pending/FINAL1 launched, submitted:false, reply/verdict null.
첫 final의 fact-review 대상 혼동도 OPEN이다. **CLOSED/RESTORED**,
native3/관리8(원복2)/내부3/완료 응답9/**144620 tokens**. checkpoint에서 빠진
완료 부모 응답25503을 native 원장과 대조해 포함했고 in-flight 불확실성을 유지한다.
후속9 UNRUN, 누적 **1060(631/429)**. 다음은 현재 검사 전부를 보존하면서 반복
작성하는 정상 recipe의 크기를 줄이는 조사다. 원래192/516과 모든 H/Q·Go는
미완료이며 목표 active / No-Go다.

## 최신 후속 작업173: next_step·연결 recipe 실제 사용, 정정 결과 반환 전 timeout

후보 `+20260913161723` / `ttak-next173`, runtime34파일이다. normal Codex의 명시적
actual receipt 조회에 현재 분기의 next_step을 제공하며, native Post는 실제 fact 상태와
revision으로 metadata 전체를 재계산한다. 준비 응답은 현재 packet 코드만 제공하고,
final 제안·교정 코드는 actual result 뒤에 배치했다. shared skill은 전체 code recipe와
argument-object 경로를 구분한다. 같은 binding의 verifier packet·legacy compiler 및
Claude/assessment/notice adapter는172와 동일하다. 집중304PASS,
**Node800/Python79/conformance PASS**, helper12검사·26구문·로컬 resume·skill/marketplace
PASS, generic validator의 기존 경로 비호환은 UNRUN이다.

[실제 calibration173](NATIVE_RESULT_HANDOFF_173.ko.md)은 두 next_step을 조회하고,
final 등록+실행을 두 번 모두 연결 recipe로 수행했다. 오류안은 원문 그대로 withheld됐고
정정본의 fresh verifier도 실제 typed complete를 제출했다. 그러나120초 timeout으로
retained pending/FINAL1 launched+submitted, reply/verdict null이다. **정정 native 반환·
부모 조회·완료 전달·Stop UNRUN**이며 typed complete만으로 완료를 인정하지 않는다.
초기 fact-review 항목의 final-only 결함 연결도 OPEN이다. **CLOSED/RESTORED**,
native3/관리8(복원2)/내부3/완료 응답11/**189385 tokens**. checkpoint에 없는 완료 부모
응답26971을 native 원장과 대조해 포함했다. in-flight 불확실성 유지, 후속9 UNRUN,
누적 **1057(630/427)**. 다음은 준비 응답→첫 fact 실행의11483ms handoff 조사다.
원래192/516과 모든 H/Q·Go 조건은 미완료이며 목표 active / No-Go를 유지한다.

## 최신 후속 작업172: current final 참조 통과, 연결 recipe 미사용·timeout

후보 `+20260913154054` / `ttak-cache172`, runtime34파일이다. actual result read의
정확한 단일 전달과 기존 native guards를 사용해 Codex도 final request/facts current를
참조한다. client는 binding·latest previous만 보관하며 선행 assessment 재사용과 legacy
명시적 전달을 보존한다. 집중292PASS, **Node788/Python79/conformance PASS**,
helper12검사·27구문·로컬 resume·skill/marketplace PASS다. 모든 frozen 파일은 원래
1048576-byte 한도와 해시로 재검사했다. 일반 validator의 기존 경로 비호환은 UNRUN이다.

새 배정 native12/관리8(복원2)/내부 ceiling88, concurrency1, native120초+정리5초를
유지했다. 정상 설치·11hook의 파일/명령/hash 대조·양쪽 활성화 PASS다.
[실제 calibration172](NATIVE_PARENT_CACHE_172.ko.md)은 current final 참조로 원문과
실제 fact를 정확히 전달했고, 변경 없는 오류안을 유효하게 withheld·조회했다. 그러나
부모가 연결 final recipe를 실행하지 않고 등록과 dispatch를 나눈 뒤120초 timeout이다.
retained pending/FINAL0 returned-withheld, **정정 등록·새 verifier·완료 전달·Stop UNRUN**.
정적 크기 감소는 실제 시간 개선 증거가 아니다. fact-review 항목의 잘못된 연결도 OPEN이다.
**CLOSED/RESTORED**, native3/관리8(복원2)/내부2/완료 응답11/**226854 tokens**,
checkpoint와 완료 native 사용량 일치·in-flight 불확실성 유지, 후속9 UNRUN,
누적 **1054(629/425)**. 다음은 실제 결과를 받은 지점에 필요한 다음 recipe를 함께
제공하는 전달 구조 조사다. 원래192/516 및 모든 H/Q는 미완료, 목표 active / No-Go다.

## 최신 후속 작업171: current 실제 제출·조회 통과, 정정 verifier 중 timeout

명시적 result challenge 참조를 현재 관측된 fresh verifier에만 normal Pre에서 연결했다.
literal 거부와 기존 native 해시·결과/본문 한도·Stop은 유지한다. 집중248PASS,
**Node774/Python79/conformance PASS**, 후보 `+20260913140836` / `ttak-submit171`,
runtime34파일·정상 설치·11hook 검토·양쪽 활성화 PASS.
[실제 calibration171](NATIVE_SUBMISSION_REFERENCE_171.ko.md)의 fact와 최초 final은
current 제출·정확 결과 조회를 완료했다. 변경 없는 오류안을 유효하게 withheld하고,
정정본 등록·세 번째 fresh verifier 시작까지 진행했으나120초 timeout이었다.
retained pending/FINAL1 launched, **정정 판정·조회·최종 전달·Stop UNRUN**.
연결 final recipe도 실제2회 사용됐다. 부모5회 호출, final 프로그램3041/3105 bytes,
직전 응답→다음 final 호출 간격19502/19706ms를 다음 조사 근거로 남긴다.
per-check 연결 문제는 OPEN이다. **CLOSED/RESTORED**, native3/관리8(복원2)/내부3/
완료 응답9/**158352 tokens**. timeout checkpoint에 없던 완료 부모 응답27224를
native 원장으로 확인해 포함했다. in-flight 불확실성은 남고 후속9 UNRUN,
누적 **1051(628/423)**. 원래192/516과 전체 Go는 미완료, 목표 active / No-Go를 유지한다.

## 최신 후속 작업170: final recipe 연결, fact challenge 한 글자 누락으로 FAIL

Codex 최종 등록 뒤 기존 독립 검증 lifecycle을 한 recipe로 연결했다. 기존 spawn 코드와
Claude adapter는 동일하다. 집중233PASS, **Node767/Python79/conformance PASS**.
후보 `+20260913132542` / `ttak-joined170`, runtime34파일·정상 설치·11hook 검토·활성화 PASS.
[실제 calibration170](NATIVE_JOINED_RECIPE_170.ko.md)의 fresh Codex fact verifier가
64자리 challenge의 마지막 한 글자 `2`를 누락했다. normal Pre guard가63자리 제출을
거부했고 retained unavailable·Stop 중단이다. 결과 제출/조회·최종 등록이 없어
**연결된 final recipe의 native 효능은 UNRUN**이다. 실패 시도는 고치거나 재실행하지 않는다.
**CLOSED/RESTORED**, 실제 native3/관리8(복원2)/내부1/완료 응답7/**136566 tokens**,
terminal 대조·in-flight 불확실성 없음, 후속9 UNRUN, 누적 **1048(627/421)**.
다음은 현재 관측된 verifier만 사용할 수 있는 명시적 result challenge 참조다.
잘못된 literal·다른 actor·지난 시도는 계속 거부한다. 인용/항목 연결 잔여 문제와
원래192/516 및 전체 Go는 미완료, 목표 active / No-Go를 유지한다.

## 최신 후속 작업169: flat 제출·Haiku 교정 통과, Luna 정정 검토 전 timeout

동일9개 검사를 최상위 필드로 제출하고 기존3개 결과 그룹으로 손실 없이 구성한다.
모든 검사·issue 연결·결과/본문 한도·native 바인딩·Stop은 그대로다. 집중227PASS,
**Node761/Python79/conformance PASS**. 후보 `+20260913125553` / `ttak-flat169`,
runtime34파일·정상 설치·11hook 검토·활성화 PASS.
[실제 calibration169](NATIVE_FLAT_FINAL_169.ko.md)의 Haiku는 변경 없는 오류안의 유효한
보류→1회 교정→새 검토→정확한 최종 전달·Stop을88075ms에 완료했다. 이 배정 경계만 PASS다.
Luna는 유효한 최초 보류·결과 조회 후 정정본을 등록했으나 새 검증자 dispatch 전에120초
timeout이었다. retained pending/FINAL1 planned, 정정본 검토·전달·Stop UNRUN.
양쪽의 per-check 항목 연결과 Haiku의 인용 공백 문제는 OPEN이다. 모든 보고 항목을 인증하지 않는다.
**CLOSED/RESTORED**, 실제 native4/관리8(복원2)/내부5/완료 응답30/**674928 tokens**,
Luna 미관측 in-flight 가능. 후속8 UNRUN, 누적 **1045(626/419)**.
다음은 관측된 Codex final 등록→검증 실행의13317ms handoff 조사·단일 recipe 연결이다.
원래192/516과 전체 Go는 미완료, 목표 active / No-Go를 유지한다.

## 최신 후속 작업168: fact 정정 판정 통과, 중첩 최종 제출 FAIL

fact 전용 verdict/issues 설명과 packet 지시를 실제 사실 확정 가능 여부로 맞췄다.
API·enum·guard·결과·한도는 동일하다. 집중220PASS,
**Node754/Python79/conformance PASS**. 후보 `+20260913123742` / `ttak-factscope168`,
runtime34파일·정상 설치·11hook 검토·양쪽 활성화 PASS.
[동일 calibration168](NATIVE_FACT_SCOPE_168.ko.md)에서 실제 fact는 정답7,7,7과 정정을
answered로 반환했고, 변경 없는 오류안이 새 최종 검증자에게 정확히 전달됐다.
그러나 중첩 검사 객체를 잘못 직렬화한 제출3회가 거부돼4-turn 한도에서 보고서 없이
중단됐다. `revise_explanation` 의도만으로는 유효한 판정이 아니며 **최종 거절·교정·
완료 전달 UNRUN**이다. retained unavailable·Stop continue:false, 재개/재배정 없음.
**CLOSED/RESTORED**, 실제 native3/관리8(복원2)/내부2/완료 응답13/**280639 tokens**
(terminal 대조), 후속9 UNRUN, 누적 **1041(624/417)**. 다음은 동일9검사의 중첩 없는
제출 표현이다. 원래192/516과 전체 Go 목표는 미완료이며 active / No-Go를 유지한다.

## 최신 후속 작업167: fact의 잘못된 장애 분류로 최종 검토 UNRUN

normal final packet의 값과 한도를 보존하며 검토 본문을 마지막에 배치했다.
배치 검사4PASS, 집중215PASS, **Node749/Python79/conformance PASS**.
후보 `+20260913121102` / `ttak-target167`, runtime34파일·정상 설치·11hook 검토·활성화 PASS.
[실제 calibration167](NATIVE_FACT_OBSTACLE_167.ko.md)의 fact는 정답7,7,7을 도출하고도
인용 초안의 오류를 `conflict`로 분류하며 이미 주어진 정의를 재확인하라고 했다.
부모의 변경 없는 최초 오류안은 normal guard가 거부했고 **final packet·검증자 없음**.
새 최종 배치의 native 효능은 UNRUN이며 최종 거절 PASS로 계산하지 않는다.
CLI success/exit0이어도 retained unavailable·Stop `continue:false`다.
**CLOSED/RESTORED**, 새 배정 native12/관리8(복원2)/내부 최대88,
실제 native3/관리8(복원2)/내부1/완료 응답8/**192793 tokens**(terminal 대조).
후속9 UNRUN, 누적 **1038(622/416)**. 다음은 사실 확정과 인용 초안 판정의 역할 경계다.
원래192/516과 모든 Go 조건은 미완료, 목표 active / No-Go를 유지한다.

## 최신 후속 작업166: 기본 참조도 미사용, 최종 오승인 후 조회 전 timeout

요청-wide fact를 사용자 언어·독자·명시 형식에 맞추고, 양 host의 최종 recipe는
전체 fact 참조를 기본값으로 제시하도록 맞췄다. 적합하지 않으면 literal로 조정하며
revision1과 독립 최종 검토·실제 native 결과의 해시/순서/조회·Stop은 그대로다.
실행형 recipe 검사 RED3FAIL/2PASS →5PASS, 집중211PASS,
**Node745 / Python79 / conformance PASS**. 후보 `+20260913114319` / `ttak-recipe166`,
runtime34파일, helper9검사/24syntax PASS. 새 배정 native10/관리8(복원2)/내부 최대66.
정상 설치·11hook 파일/명령/해시 검토·양쪽 활성화 PASS.
[기본 recipe166](NATIVE_COMPOSITION_RECIPE_166.ko.md)의 원래 Haiku fact는 계산 본문만
정확히 반환했다. 부모는 독자에 맞춘다며 literal로 대안3개를 작성했고, 잘못된 RR 재시도
제외와 잘못된 인원 수를 최종 검증자가 오승인했다. 모호한 `A=false (now true)`는
후속 정정에서 독립 확정 실패 사유에서 제외했다. 부모 최종 조회·전달·Stop 전
timeout이어서 retained는 pending이다. **CLOSED/RESTORED**, native3/관리8(복원2)/
내부2/완료 응답11/**288309 tokens**(미관측 in-flight 가능), 누적 **1035(620/415)**.
후속7 UNRUN. 참조 기본값 수정은 반복하지 않고 독립 최종 검토의 대상 배치·판별력을
조사한다. 원래192/516과 모든 Go 조건은 미완료, 목표 active / No-Go다.

## 최신 후속 작업165: 본문 참조 미사용, literal 최종 오승인·timeout

`final_text: {"fact_answers":"current"}`로 전체 실제 fact 본문을 순서대로 구성하는
최초 제안 선택지를 추가했다. 요청 언어·독자·형식·요구에 이미 맞을 때 사용하며,
맞춤 작성과 revision1은 literal 경로를 유지한다. 현재 native 결과의 전체 SHA와
순서·완료 읽기를 대조하고 독립 최종 검토·정확한 Stop을 유지한다. 소비된 결과를
다시 읽거나 slot을 되돌리지 않으며 hook/MCP 코드는 바꾸지 않았다.
RED6FAIL → 집중206PASS/0skip, **Node740 / Python79 / conformance PASS**.
후보 `+20260913112509` / `ttak-compose165`, runtime34파일, helper9검사/24syntax PASS.
[본문 구성165](NATIVE_FACT_COMPOSITION_165.ko.md)에서 정상 설치·11hook 검토·양쪽 활성화는
PASS다. 원래 Haiku는 literal을 선택해 별도 본문을 작성했고, SSI가 commit에서만
개입한다는 오류를 최종 검증자가 오승인했다. 정확한 본문 전달과 Stop은 실제 PASS지만
상위 프로세스는120초 timeout이다. 새 참조 선택지의 native 효과는 미사용으로 UNRUN이다.
**CLOSED/RESTORED**, native3/관리8(복원2)/내부2/완료 응답13,
**376412 tokens**(terminal 합계 없어 미관측 in-flight 가능), 누적 **1032(618/414)**.
후속7 UNRUN. 다음은 실제 fact 작성 형식과 최종 adapter 기본값의 불일치 수정이다.
**192 / 516 UNRUN**, 전체 목표 **active / No-Go**를 유지한다.

## 최신 후속 작업 164: 원래 과제 정확 전달 PASS, 부모의 새 구현 주장·오승인 FAIL

fact 검증자에게 원문 모델별 실제 계산 본문·SHA를 사전에 제공한다. 기존 원문과
witness·edge는 그대로이고, 최종 검증에는 이미 실제 fact가 있으므로 중복 추가하지 않는다.
새 자료는 필수 구현 근거나 실측을 대신하지 않으며 Stop·결과·교정 한도는 유지했다.
RED0PASS/6FAIL → 집중178PASS/0skip, **Node732 / Python79 / conformance PASS**.
후보 `+20260913104538` / `ttak-account164`, runtime34파일, helper9검사/23syntax PASS.
정상 설치·11hook의 파일/명령/해시 검토와 양쪽 활성화는 PASS다.
[계산 본문164](NATIVE_COMPUTED_ACCOUNT_164.ko.md)의 원래 Haiku에서 실제 사전 본문·
계산형 제출·독립 결과 조회·정확한 최종 전달·Stop을 확인했다. fact는 모델 범위와
직렬 조정 비용에 머물렀지만, 부모가 SQL 잠금으로 snapshot까지 직렬화한다는
잘못된 구현과 자기 read/write 집합 기준을 새로 넣었고 최종 검증자는 오승인했다.
**CLOSED/RESTORED**, native3/관리8(복원2)/내부2/완료 응답13,
**373315 tokens**(native terminal과 대조), 누적 **1029(616/413)**. 후속7 UNRUN.
다음은 실제 fact에 연결된 최종 구성 경로다. 원래 **192 / 516 UNRUN**,
전체 목표 **active / No-Go**를 유지한다.

## 최신 후속 작업 163: 양쪽 정확 전달 PASS, 원래 과제의 의미·전달 교정 FAIL

최종 결과 조회에 기존 cache의 검토된 본문·SHA·승인 범위를 함께 반환하고,
hook이 실제 native 결과와 retained SHA·purpose를 대조하도록 수정했다. Codex
recipe도 정확한 delivery를 표시한다. 누락·자체 재해시·범위 확대·다른 후보/수정·
만료 cache는 거부하며, 제목/공백을 포함한 정확한 Stop과1회 교정은 그대로다.
집중29PASS/0skip, **Node725 / Python79 / conformance PASS**, runtime34파일 고정,
helper9검사/22syntax PASS. 후보 `+20260913101917` / `ttak-delivery163`이다.
[정확 전달163](NATIVE_EXACT_DELIVERY_163.ko.md)에서 양쪽 정상 대조의 실제 조회·
동일 본문·Stop을 확인했다. 원래 Haiku도 정확한 본문을 조회했지만 표 구분선과
마지막 빈 줄을 바꿨고, Stop 교정에는 동일하다는 주장만 답해 unavailable로 중지됐다.
CLI exit0/success는 이 실패를 성공으로 바꾸지 않는다. 행/열 혼동·잠금 snapshot·
SSI deadlock 부정 등 최종 오승인도 남았다. **CLOSED/RESTORED**, native5/관리8
(복원2)/내부6/완료 응답38, **905879 tokens**(native terminal 사용량과 대조),
누적 **1026(614/412)**. 후속5와 원래 **192 / 516 UNRUN**, 목표 **active / No-Go**.
다음은 보충 사실을 선택하기 전에 계산기가 구성할 전체 사실·완화책·비용을
검증자에게 보여주는 경로다. Stop의 정확한 본문 결합은 유지한다.

## 최신 후속 작업 162: 계산 fact 실제 제출 PASS, 최종 오승인·본문 불일치·timeout

유한 모델의 사실 부분을 검증자가 다시 서술하지 않고, 원문과 SHA가 일치하는
명세를 제출하면 기존 계산기가 구성하도록 통합했다. retained state에는 원문 모델
SHA만 추가하며 명세·프롬프트를 새로 저장하지 않는다. native 제출·결과 재독해와
정상 MCP 문맥에서 다른 모델이나 기존 자유문장 대체를 거부한다. 모델 없는 설명과
과거 문자열 결과 파싱·8000-byte 답변·독립 최종 검토·receipt/read/Stop은 유지한다.
compiler6PASS, 통합10PASS, 집중160PASS/0skip이다. 새 schema의 중첩 한도 실패는
기존 제한을 유지하고 같은 검증 정의를 로컬 `$defs`로 배치하여 고쳤다.
최종 **Node714 / Python79 / conformance PASS**, 후보 `+20260913093423` /
`ttak-computed162`의34파일 고정, helper9검사/23syntax PASS다. 정상 등록·설치와
11hook의 파일/명령/해시 검토와 양쪽 활성화를 확인했다.
[계산 fact162](NATIVE_COMPUTED_FACTS_162.ko.md)의 원래 Haiku complex에서 실제
source-bound 계산 제출·두 receipt/read와 최종9항목 승인을 관찰했다. 그러나 승인된
본문에 PostgreSQL predicate lock 부정과 RR/Serializable 잠금 trace 오류가 남았다.
부모는 제목을 추가했고 Stop이 정확한 본문 불일치를 차단했다. 교정 전120초 timeout.
**CLOSED/RESTORED**, native3/관리8(복원2)/내부2/완료 응답13,
**373738 tokens**(미보고 in-flight 사용량 가능), 누적 **1021(611/410)**다.
후속7 UNRUN이며161 정상 대조를162에 전용하지 않는다. 전체 목표 **active / No-Go**,
원래 **192 / 516 UNRUN**이다. 다음 수정은 실제 결과 조회에서의 정확한 본문 전달과
추가 구현 설명의 의미 검증 누락을 분리해 다룬다.

## 최신 후속 작업 161: 실제 fact별 보고·정상 대조 PASS, 원래 과제 오승인·timeout

160의 확정된 SQL 행 잠금/snapshot 과장을 보수적으로 검사하고, 최종 검증 packet에
실제 fact별 ID·결과 SHA·본문 위치가 결합된 부분 보고를 추가했다. 모델 계산과
원문·답변·최종 승인·receipt/read/Stop은 보존했다. 부분 검사0건은 인증이 아니다.
수정 전 집중117PASS/4FAIL → 수정 후122PASS/0skip, 실제160 본문 로컬 재생에서
fact와 제안의 과장 각1건 확인. **Node702 / Python79 / conformance PASS**,
helper9검사/23syntax PASS, 후보 `+20260913084004` / `ttak-facts161`의34파일 고정.
[실제 fact 대조161](NATIVE_FACT_REVIEW_161.ko.md)에서 양쪽 정상 Nori의 객체 제출·
receipt/read·정확한 최종 본문·Stop을 확인했다. 원래 Haiku도 객체 제출과 실제
fact별 보고·최종 결과 조회까지 진행했지만, 교차 읽기 부정과 잠금 재시도 과장을
검토자가 오승인했고 부모 최종 답변 전120초에 종료됐다. 부분 검사0건은 통과 근거가 아니다.
**CLOSED/RESTORED**, native5/관리8(복원2)/내부6/관측 응답35,
**786788 tokens**(미보고 사용량 가능), 누적 **1018(609/409)**. 후속5와 원래
**192 / 516 UNRUN**, 전체 목표는 **active / No-Go**다.

## 최신 후속 작업 160: 검토 객체 전달 확인, 최종 제출 전 timeout

세 필수 검토를 고정된 항목별 객체로 받고, 모든 결함을 실제 issue index에
연결한다. 기존 400-byte 결과 필드에 손실 없이 인코딩하며, 새 공용MCP는
자유문장·혼합 형식·누락 항목·연결되지 않은 issue를 거부한다. 이전 문자열
형식과 preview의 거부 검사는 보존했다. 사실성·H/Q·영수증·결과조회·Stop,
모델과 실행 한도는 그대로다. **Node696 / Python79 / conformance PASS**,
집중136PASS/0skip, 후보34파일. `+20260913080307` / `ttak-checks160`의
정상 설치·11hook 검토·활성화는 양쪽 PASS다. 원래 Haiku complex는120초에
종료됐고 최종 검토 객체의 실제 제출·반환·부모 final·Stop은 미관측이다.
[실제 검토160](NATIVE_REVIEW_CHECKS_160.ko.md)에 종료 근거와 의미 평가 정정을
남겼다. SQL 행 잠금이 동시 snapshot 자체를 막는다는 과장은 확인했지만,
SSI의 “추가 검사 불필요”를 업무 guard 제거로 해석했던 평가는 철회했다.
**CLOSED/RESTORED**, native3/관리8(복원2)/내부2/관측 응답9,
**229369 tokens**(미보고 in-flight 사용량 가능), 누적 **1013(606/407)**다.
후속7과 원래 **192 / 516은 UNRUN**, 전체 목표는 **active / No-Go**다.

## 최신 후속 작업 159: dependency·다음 단계·실패 반환 전달 확인, 형식·의미 FAIL

158에서빠진read/write·write/write edge를복원하고, preview 응답에소비된1회예산과
다음strict제출단계를명시했다. 실패한등록Agent 반환에는상태를바꾸지않고
model-visible PostToolUse 추가문맥으로재개불가를알린다. 실제400-byte제출,
receipt·결과조회·Stop은유지했다. **Node689 / Python79 / conformance PASS**,
focused21PASS/0skip, 후보33파일고정. `+20260913073140` / `ttak-state159`의
정상설치·11hook검토·활성화는양쪽PASS. [실제검토159](NATIVE_REVIEW_STATE_159.ko.md)에서
preview1회→실제제출과실패후추가문맥을확인했다. 그러나review421/428bytes거부,
guard_false/주체·잠금범위오류와오승인이남았다. **CLOSED/RESTORED**,
native3/관리8(복원2)/내부2/응답13, **314668tokens**, 누적 **1010(604/406)**.
후속7과원래 **192 / 516은UNRUN**, 목표는 **active / No-Go**다.

## 최신 후속 작업 158: 실제 계산 표 전달, 원래 과제 중복preview·timeout·의미 FAIL

[계산 실행 표158](NATIVE_MODEL_WITNESS_158.ko.md)은 원래 요청에서 재계산한 읽기값·
적용 쓰기·실행 뒤 상태를 짧은 witness 행으로 묶어 독립 검증자에게 준다. 원문과
부모용 근거·모든 guard/출하 기준은 유지했다. **Node686 / Python79 / conformance
PASS**,33파일 고정. `+20260913070044` / `ttak-witness158` 양쪽 설치·활성화PASS.
원래 Haiku는preview 중복·실제제출 거부 후120초timeout, 부모final/Stop 미관측이다.
의존성 부정·SSI비차단 확대·잠금no-retry와 오승인이 남았다. projection의 명시적
dependency edge 누락도 수정 대상이다. **CLOSED/RESTORED**, 후속7 UNRUN,
native3/관리8(복원2)/내부2, **관측363717 tokens**(미보고 가능true), 누적
**1007(602/405)**. **active / No-Go**, 원래 **192 / 516 UNRUN**.

## 최신 후속 작업 157: preview 정상 대조 양쪽 PASS, 원래 과제 중복 호출·의미 FAIL

[최종 검토 preview157](NATIVE_FINAL_PREVIEW_157.ko.md)은 실제 제출 전 세 요약의
UTF-8 길이만 측정한다. 실제400-byte 제출·native 영수증·결과 조회·Stop 경계는
유지했다. **Node680 / Python79 / conformance PASS**,33파일 고정이며 정상 등록·
설치·hook 검토·활성화는 양쪽 PASS다. 후보 `+20260913062012`, `ttak-preview157`.
정상 Nori 양쪽에서 실제preview1회·엄격한 제출·영수증/조회·정확한 최종문·Stop을
확인했다. Haiku는419/406 초과를 줄여 통과했다. 원래 complex는preview 중복으로
거부되고, 잘못된B값·비례 비용·오승인과 실패 뒤 추가 호출·미검증 수용 제안이 남았다.
**CLOSED/RESTORED**, 후속5 UNRUN, native5/관리8(복원2)/내부6,
**917919 tokens**, 누적 **1004(600/404)**. 다음은 의미 검사 공백 조사다.
원래 **192 / 516 UNRUN**, 목표 **active / No-Go**다.

## 최신 후속 작업 156: 결과 참조 정상 대조 양쪽 PASS, 원래 과제 형식·의미 FAIL

[실제 결과 참조156](NATIVE_RESULT_REFERENCES_156.ko.md)은 짧은 native 영수증 뒤
실제 제출 결과를 정상 도구로 읽어야 진행되는 경계를 구현했다. **Node668 / Python79 /
conformance PASS**, 33파일 고정이다. Haiku/Luna 정상 Nori 대조에서 각각2개의
영수증·실제 결과 조회·정확한3/2문장·Stop과 상태 재생을 확인했다. 토큰259771/174244.
원래 Haiku complex는 요약697/730/785 bytes로400 상한에서 거부됐고, 검토자가
놓친 셀 수·비례 비용·무영향 주장 오류도 확인했다. 후속5 UNRUN, 두 프로필 복원,
native5 / 관리8 / 내부6 / **731904 tokens**, 누적 **999(597/402)**다.
다음은 비승인용 UTF-8 format preview 조사와 별도 의미 회귀다. **active / No-Go**,
원래 **192 / 516 UNRUN**이며 정상 대조만으로 H/Q나 전체 목표를 완료하지 않는다.

## 최신 후속 작업 155: 동일 후보 Luna 최종 검토 전 timeout

[Luna 범위155](NATIVE_LUNA_SCOPE_155.ko.md)는154 후보를 변경하지 않고 정상 설치에서
재사용했다. fact 제출·반환과 final 준비/전달은 관측했으나120초에 종료됐다.
fact JSON 재출력 구간21초, 최종 검증자 시작은 부모 시작 뒤115초였다. 완료된 H/Q는
없다. 후속2 UNRUN, Codex 복원/Claude 무변경, native2 / 관리2 / 내부2 /
**관측175,654 tokens**(미보고 가능), 누적 **994(594/400)**. 새 helper9 PASS,
전체 Node653/Python79/conformance는154의 동일 파일 근거를 재사용했다.
다음은 정상 제출·자식 완료·정확한 결과 결합을 보존하는 결과 참조 전달과 부모 왕복
축소다. 상한 완화·거부 결과 수용은 하지 않는다. **active / No-Go**, **192 / 516 UNRUN**.

## 최신 후속 작업 154: final 요약 크기 거부로 FAIL

[간결한 검토154](NATIVE_COMPACT_REVIEW_154.ko.md)의 실제 요약802/873/749 bytes가
400 상한을 넘었다. 정상 guard가 거부하고 Stop은 unavailable을 유지했다. 같은 호출을
재시도하지 않았다. 후속5 UNRUN, 두 프로필 복원, native3 / 관리7 / 내부2 /
**264,290 tokens**, 누적 **992(594/398)**. 집중248 / 전체 **Node653 / Python79 /
conformance PASS**다. 다음은 정확한 결과 참조 전달 조사와 별도 Luna 범위 확인이다.
전체 **active / No-Go**, 원래 **192 / 516 UNRUN**을 유지한다.

## 최신 후속 작업 153: 전용 final 보류 제출 PASS, 반환 timeout·검토 의미 FAIL

[전용 최종 검토153](NATIVE_FINAL_REVIEW_153.ko.md)은 새 세 영역 검토와 실제
revise_explanation 제출을 확인했다. SSI 오류를 지적했지만 반환 전120초 timeout,
일부 잠금 반박도 잘못돼 전체 FAIL이다. 후속5 UNRUN, 두 프로필 복원,
native3 / 관리7 / 내부2 / **관측205,831 tokens**(미보고 가능), 누적 **989(592/397)**.
집중247 / 전체 **Node652 / Python79 / conformance PASS**다. 다음은 간결한 검토 전달과
정확한 제안/근거 재사용 및 반례 기반 검토다. 전체 **active / No-Go**, **192 / 516 UNRUN**이다.

## 최신 후속 작업 152: 정상 final·Stop 완료, 의미 거짓승인 FAIL

[원문 계산152](NATIVE_SOURCE_COMPUTATION_152.ko.md)은 원문에서 다시 계산한 모델을
정상 fact/final에 결합해 116.4초에 최종 전달·Stop까지 완료했다. 그러나 비용/차단/시점
오류를 final verifier가 본문 복사와 함께 승인해 전체 FAIL이다. 후속5 UNRUN,
두 프로필 복원, native3 / 관리7 / 내부2 / **259,718 tokens**, 누적 **986(590/396)**.
전체 **Node649 / Python79 / conformance PASS**다. 다음은 요구·주장·fact 이유를
분리한 전용 final 검토 형식이다. 전체 **active / No-Go**, 원래 **192 / 516 UNRUN**이다.

## 최신 후속 작업 151: 사실 우선 진입 PASS, timeout과 인과 의미 FAIL

[사실 우선151](NATIVE_FACTS_FIRST_151.ko.md)은 선행 초안 없이 정상 독립 사실 검증을
시작했다. 그러나 fact와 제안 final이 교차 읽기/쓰기를 부정하고, 120초에 final 검사
도중 종료돼 전체 FAIL이다. scenario_review는 평가 구간0으로 의미를 인증하지 않았다.
후속5 UNRUN, 두 프로필 복원, native3 / 관리7 / 내부2 / **관측212,978 tokens**
(미보고 가능), 누적 **983(588/395)**. 집중236 / 전체 **Node641 / Python79 /
conformance PASS**다. 다음은 원문 기반 자동 유한모델 근거 결합이다.
전체 **active / No-Go**, 원래 **192 / 516 UNRUN**을 유지한다.

## 최신 후속 작업 150: 정확한 참조 전달 PASS, timeout과 의미 FAIL

[참조·의미 150](NATIVE_REFERENCES_AND_SEMANTICS_150.ko.md)은 실제 Claude의 원문·fact
참조와 정상 설명 우선 진입을 입증했다. 최종 verifier 실행 중 120초에 종료됐으며,
실제 fact와 제안된 본문에도 잠금·snapshot·SSI·비용 오류가 있다. 후속 5행 UNRUN,
두 프로필 복원, native 3 / 관리 7 / 내부 2 / **관측 181,937 tokens**(미보고 사용량 가능),
누적 **980(586/394)**다. 집중 231 / 전체 **Node 636 / Python 79 / conformance PASS**.
다음은 의미 범위·유한모델/출처 검사 및 정확한 초안 수정 전송 조사다. 전체
**active / No-Go**, 원래 **192 / 516 UNRUN**을 유지한다.

## 최신 후속 작업 149: 정상 준비·원문 packet 전달 PASS, 120초 timeout

[준비 지연 149](NATIVE_PREPARATION_LATENCY_149.ko.md)에서 실제 Haiku의 거짓 근거 부족이
해소됐고, 새 draft 준비와 원문 전체 fact packet 전달까지 관측했다. 하지만 120초에
사실 결과 이전에 종료돼 전체 FAIL이다. 후속 5행 UNRUN, native 3 / 관리 7 / 내부 2 /
**관측 182,084 tokens**이며 실행 중 미보고 사용량 가능성을 남긴다. 누적 **977(584/393)**,
두 프로필 복원, 전체 **Node 626 / Python 79 / conformance PASS**다. 다음은 반복 전송과
불필요한 선행 평가를 줄이는 경로 조사다. 전체 **active / No-Go**, **192 / 516 UNRUN**이다.

## 최신 후속 작업 148: 요청 전체 준비 구현, 선행 평가의 거짓 보류로 FAIL

[도출 경계 148](NATIVE_DERIVATION_BOUNDARY_148.ko.md)은 질문 목록 재작성 없이 원문
전체의 독립 fact와 별도 final을 준비하는 경로를 구현했다. 집중 220 / 전체 Node 625 /
Python 79 / conformance PASS다. 그러나 실제 Haiku 선행 평가가 도출 가능한 완화책을
근거 부족으로 오판하고 인용문도 바꿨다. 새 정상 준비는 UNRUN이며 전체 행 FAIL이다.
두 프로필 복원, native 3 / 관리 7 / 내부 1 / **210,104 tokens**, 누적 **974(582/392)**다.
다음은 외부 전제 부족과 답변이 도출할 결과를 구분하는 평가 경계 수정이다.
전체 **active / No-Go**, 원래 **192 / 516 UNRUN**을 유지한다.

## 최신 후속 작업 147: 명시적 준비 인코딩 PASS, 중복 질문 12개로 FAIL

[요청 계획 147](NATIVE_REQUEST_PLAN_147.ko.md)은 실제 Haiku의 `plan_json` 객체·배열
전달과 원문 binding을 입증했다. 그러나 부모가 질문 12개를 만들어 기존 상한 8개에서
차단됐고 정상 fact/final 검증은 시작되지 않았다. 미검증 본문에도 Q1 오류가 있다.
Luna 1행 UNRUN, 두 프로필 복원, native 3 / 관리 7 / 내부 1 / **181,894 tokens**,
누적 **971(580/391)**다. 전체 **Node 620 / Python 79 / conformance PASS**이며,
다음은 질문 목록 생성 계층의 수정이다. 전체 **active / No-Go**, **192 / 516 UNRUN**을 유지한다.

## 최신 후속 작업 146: 원래 복잡한 설명의 준비 인자 형식 FAIL

[준비 형식 146](NATIVE_PREPARATION_SHAPE_146.ko.md)은 145와 같은 후보로 원래
복잡한 H/Q를 검사했다. Haiku의 원문·current binding과 선행 평가는 정상이었지만,
준비 호출에서 blocks를 문자열로 보내고 questions/sources를 누락해 차단됐다.
검증 없이 직접 낸 본문에도 Q1 오류가 있다. Luna1행 UNRUN, 두 프로필 복원,
native3 / 관리5 / 내부1 / **178,934 tokens**, 누적 **968(578/390)**다.
고정 호스트의 MCP strict 전달 한계를 조사했으며, 다음은 기존 검사를 유지하는
명시적 단일 JSON 준비 인코딩이다. 전체 **active / No-Go**와 **192 / 516 UNRUN**을 유지한다.

## 최신 후속 작업 145: 같은 후보의 양 호스트 보류·재개·정상 대조 PASS

[표시·대조 145](NATIVE_ENVELOPE_AND_CONTROLS_145.ko.md)는 검증 결과의 표시 순서만
binding 필드 우선으로 바꾸고 기존 값·해시·반환 검사를 유지했다. 두 호스트의 원래
보류 과제, 같은 세션 재개, Nori 정상 대조까지 8행 PASS다. native8 / 관리7 /
내부11 / 응답60 / **1,219,534 tokens**, 누적 **965(576/389)**다. 두 프로필과
ON 파일을 복원했다. 비교 freeze의 새 원문 모듈 누락도 수정·변조 검사했고 최종
**Node615 / Python79 / conformance PASS**다. 원래 복잡한 H/Q, 실패·취소·재개와
전체 **192 / 516** 등은 여전히 미검증이다. 전체 **active / No-Go**이며, 다음
별도 배정은 같은 후보의 원래 복잡한 H/Q 진단이다. 개별 배치 PASS는 목표 완료가 아니다.

## 최신 후속 작업 144: Luna의 native 원문 선택 PASS, 검증 반환 형식 FAIL

[원문 선택 144](NATIVE_ORIGINAL_SOURCE_144.ko.md)은 정상 Pre에서 `request: current`를
실제 같은 turn의 6,491자 원문으로 바꾼 것을 입증했다. 독립 평가의 typed 제출 뒤
child가 7필드 결과 대신 내부 answer만 반환해 binding이 실패했다. 미검증 상태를
보존하고 후속5행을 UNRUN으로 닫았다. 두 프로필 복원, **164,424 tokens**, 누적
**957회**, 전체 **Node613 / Python78 / conformance PASS**다. 145는 반환 표시의
필드 순서를 바꾸되 엄격한 값·형식 대조를 유지한다. 전체 **active / No-Go**, 원래
**192 / 516** 등 미검증 출하 조건은 그대로다.

## 최신 후속 작업 143: Haiku 직접 전달 PASS, Luna 첫 원문 전달 FAIL

[직접 평가 전달 143](NATIVE_DIRECT_ASSESSMENT_143.ko.md)은 실제 평가의 구조화된
gap·정정을 부모 재작성 없이 formatter에 전달하고 별도 fresh 보류 검토를 유지한다.
후보 `0.2.0-rc.13+codex.20260912222958`의 집중198 / 전체 Node603 / Python78 /
conformance는 PASS다. Haiku의 원래 보류 과제는 실제 직접 전달·검토·의미 PASS다.
Luna는 로드된 skill을 포함하면서 원문의 필수 요구 꼬리를 바꿔 첫 Pre에서 차단됐다.
후속4행 UNRUN, 두 프로필 복원, **349,122 tokens**, 누적 **954회**다. 다음은
첫 요청의 native 전달 경계 조사다. 전체 **active / No-Go**이며 재개·정상 완료와
원래 **192 / 516** 등 모든 미검증 출하 조건은 남아 있다.

## 최신 후속 작업 142: 부모가 정정에 무조건 쓰기 주장을 추가

[평가 결과 전달 142](NATIVE_ASSESSMENT_TRANSFER_142.ko.md)에서 gap 분류와
선행 읽기 평가는 올바랐으나, 부모가 모든 schedule에서 T1이 A에 쓴다는 주장을
추가했고 보류 검토도 이를 승인했다. T2→T1 직렬 순서의 guard_false가 반례다.
후속5행 UNRUN, 두 프로필 복원, **284,154 tokens**, 누적 **950회**, Node
**590 / Python78 / conformance PASS**다. 전체 **active / No-Go**, 원래
**192 / 516은 오프라인 재확인·실제 UNRUN**이다. 143은 구조화된 독립 평가의
gap·정정을 첫 보류안으로 기계적으로 전달해 부모 재작성 단계를 줄인다.

## 최신 후속 작업 141: 보류문은 정확하나 검토 근거에 잘못된 완화책 포함

[요청 평가 범위 141](NATIVE_ASSESSMENT_SCOPE_141.ko.md)에서 실제 선행 평가·보류
검토·최종 전달은 일치했고 보류문도 정확했다. 그러나 두 검토자가 모두 불변식
위반을 그대로 받아들이는 것을 완화책으로 열거해 내부 검토 근거 FAIL이다.
후속5행 UNRUN, 두 프로필 복원, **286,740 tokens**, 누적 **947회**, Node
**589 / Python78 / conformance PASS**다. 전체 **active / No-Go**, 원래
**192 / 516 UNRUN**이다. 142는 선행 평가와 보류 요구 검토의 범위를 실제
근거 부족·요청된 주장 평가로 좁혀, 수행하지 않는 전체 해결책의 선행 생성을 줄인다.

## 최신 후속 작업 140: 선행 평가·보류 경로 PASS, 근거 충분성 FAIL

[보류 근거 충분성 140](NATIVE_NOTICE_EVIDENCE_140.ko.md)에서 선행 요청 평가와
별도 보류 검토·실제 최종 전달은 통과했다. 부모가 필요한 성능 자료에 중단 비율을
대안으로 추가했고 최종 검토도 승인했다. 중단 비율만으로 정확한 slowdown은
결정되지 않아 의미 FAIL이다. 후속5행 UNRUN, 두 프로필 복원, **279,326 tokens**,
누적 **944회**, Node **588 / Python78 / conformance PASS**다. 전체
**active / No-Go**, 원래 **192 / 516 UNRUN**이다. 141은 제안한 근거가 원래
필수 요구를 실제로 해결할 수 있는지 별도 native 검토 필드로 대조한다.

## 최신 후속 작업 139: 실제 요청 평가, 근거 부족을 평가 실패로 오판

[요청 평가 판정 139](NATIVE_ASSESSMENT_VERDICT_139.ko.md)에서 원래 요청만 본 Haiku는
정확한 T1 평가를 반환했으나, 실측 자료 부족을 요청 평가 자체의 실패로 혼동해
unresolved를 제출했다. 전체 native receipt·상태 재생은 일치하고 후속 보류 호출과
실제 Stop은 미검증 상태를 유지했다. 마지막 요구 삭제 제안도 FAIL이다. 후속5행
UNRUN, 두 프로필 복원, **156,925 tokens**, 누적 **941회**, Node **584 / Python78 /
conformance PASS**다. 전체 **active / No-Go**, 원래 **192 / 516 UNRUN**이다.
140은 요구 충족 가능성과 평가 자체의 완료를 구분하는 전용 typed 결과로 수정한다.

## 최신 후속 작업 138: 보류 경로 기계 PASS, 전체 초안 필요라는 오판

[보류 선입력 영향 138](NATIVE_NOTICE_ANCHORING_138.ko.md)에서 Haiku 부모와 검토자가
이미 주어진 T1 주장을 평가하려면 별도 전체 초안이 필요하다고 함께 잘못 판단했다.
실제 호출·결과·한 번 전달 교정·정확한 본문 결합은 PASS지만 의미 FAIL이다. 후속5행
UNRUN, 두 프로필 복원, **153,234 tokens**, 누적 **938회**, Node **573 / Python78 /
conformance PASS**다. 전체 **active / No-Go**, 원래 **192 / 516 UNRUN**이다.
139는 부모 보류안을 보지 않는 원래 요청·근거 평가를 먼저 수행하고, 그 실제 결과에
보류안과 새 최종 검토를 결합하는 순서로 수정한다.

## 최신 후속 작업 137: 전용 보류문 검토 제출, 반환 인용 문자열 변형

[보류 반환 137](NATIVE_NOTICE_RETURN_137.ko.md)에서 검토자는 전용 도구로 필수
실측 요구와 누락된 T1 평가를 정확히 판정했다. 하지만 최종 반환의 한 quote에서
문자 백슬래시-n을 줄바꿈으로 바꿔 해시 대조가 실패했다. 이후 수리도 실패 상태에서
차단됐다. 후속5행 UNRUN, 두 프로필 복원, **155,867 tokens**, 누적 **935회**,
Node **572 / Python78 / conformance PASS**다. 전체 **active / No-Go**, 원래
**192 / 516 UNRUN**이다. 138은 결함별 단일 issue·짧은 원문 인용과 주어진 초안
주장의 직접 평가를 다듬으며, 반환 불일치와 수리 조건의 차단은 유지한다.

## 최신 후속 작업 136: 보류문 검토의 판정 모순, 미승인 고지는 관측

[보류 판정 구분 136](NATIVE_NOTICE_VERDICT_136.ko.md)에서 Haiku의 첫 T1 평가는
다시 빠졌고, 검토자는 적절한 보류문이라고 쓰면서 withheld와 빈 issues를 제출했다.
실제 검증은 거부하고 unavailable를 보존했다. 부모는 미승인을 인정했지만 필수 요구
삭제를 제안해 FAIL이다. 후속5행 UNRUN, 두 프로필 복원, **144,610 tokens**, 누적
**932회**, Node **569 / Python78 / conformance PASS**다. 전체 **active / No-Go**,
원래 **192 / 516 UNRUN**이다. 137은 보류문 전용 판정과 별도 평가 필드를 도입한다.

## 최신 후속 작업 135: 첫 정정 포함, 검토자의 구조 혼동과 거짓 승인 주장

[보류 표현 구분 135](NATIVE_NOTICE_REPRESENTATION_135.ko.md)에서 Haiku는 첫 proposal에
정확한 T1 정정을 포함했다. 검토자가 이미 포함된 정정을 자신의 issues에도 요구해
잘못 거부했고, 중복 수리 실패 뒤 후속 호출은 차단됐다. 실제 pending receipt와 Stop은
미검증을 보존했지만 부모는 마지막에 승인됐다고 잘못 주장했다. 후속5행 UNRUN,
두 프로필 복원, **184,912 tokens**, 누적 **929회**, Node **567 / Python78 /
conformance PASS**다. 전체 **active / No-Go**, 원래 **192 / 516 UNRUN**이다.
136은 제안 정정과 검토 결함을 구분하고 실패 응답의 미승인 상태를 명시한다.

## 최신 후속 작업 134: Luna 보류 통과, Haiku 정정 적용 후 새 검토 UNRUN

[첫 보류안·실제 수리 134](NATIVE_NOTICE_FAST_PATH_134.ko.md)에서 Luna는 정확한
원문으로 독립 보류 검토·정정·최종 전달을 통과했다. Haiku는 T1 평가를 누락했으나
실제 검토자의 정정을 전용 수리 호출로 적용한 것까지 입증했다. 첫 검토가72초 걸려
수정 후 새 검토·최종 전달 전 timeout이다. 후속4행 UNRUN, 두 프로필 복원,
**262,596 tokens**(완전성 미보장), 누적 **926회**, Node **566 / Python78 /
conformance PASS**다. 전체 **active / No-Go**, 원래 **192 / 516 UNRUN**이다.
135는 첫 proposal의 정정 항목을 명시하도록 하고 이미 해결되는 평가를 구분한다.

## 최신 후속 작업 133: Haiku 원래 보류 통과, Luna 원문에 host metadata 포함

[원문 범위 133](NATIVE_REQUEST_SCOPE_133.ko.md)에서 Haiku는 필수 실측 요구와
정확한 T1 정정을 독립 검토·본문 결합 후 전달했다. 중간 추가 문구는 Stop이 거부해
한 번의 교정을 거쳤다. Luna는 원문 앞 자동 환경 문맥까지 넣어 첫 호출이 거부됐고,
재호출도 실패 상태에서 차단된 뒤 timeout이다. 후속4행 UNRUN, 두 프로필 복원,
**217,718 tokens**(완전성 미보장), 누적 **922회**, Node **565 / Python78 /
conformance PASS**다. 전체 **active / No-Go**, 원래 **192 / 516 UNRUN**이다.
134는 사용자 과제 원문과 자동 host 문맥의 경계를 명확히 하고 Luna부터 검사한다.

## 최신 후속 작업 132: 실패 보존 유지, 정정 target의 객체 위치 불일치

[정정 target 132](NATIVE_TARGET_NESTING_132.ko.md)에서 첫 검토자는 정확한 정정과
원래 요구 인용을 골랐지만 target 필드를 정정 객체 안에 넣어 strict 제출이 거부됐다.
후속5개 호출도 차단되고 실제 Stop·retained state는 미검증을 유지했다. 117초 정상
종료를 품질 PASS로 세지 않는다. 후속5행 UNRUN, 두 프로필 복원, **194,898 tokens**,
누적 **918회**, Node **564 / Python78 / conformance PASS**다. 전체 **active /
No-Go**, 원래 **192 / 516 UNRUN**이다. 133은 정정과 해당 target을 같은 객체에
두되 추가 필드·다른 요구 삭제·결과 변경을 거부한다.

## 최신 후속 작업 131: typed 정정 반환, 실패 수리 호출의 상태 보존 누락

[수리 실패 131](NATIVE_REPAIR_FAILURE_131.ko.md)에서 Haiku는 정확한 typed 정정을
반환했지만 수리 도구 조건에 맞지 않는 issue가 섞여 호출이 실패했다. 이후 부모가
수동 revision1과 보류 승인·정확한 전달까지 진행했고, 앞선 실패가 보존되지 않아
**FAIL**이다. 109초 정상 종료, 후속5행 UNRUN, 두 프로필 복원, **274,308 tokens**,
누적 **915회**, Node **560 / Python78 / conformance PASS**다. 전체 **active /
No-Go**, 원래 **192 / 516 UNRUN**이다. 다음 변경은 실패 도구 lifecycle 보존과
잘못 분류된 unresolved 항목에 대한 정확한 정정 결합이다.

## 최신 후속 작업 130: 원문 재사용 입증, 정정 내용을 근거 부족으로 재분류

[원문 재사용·정정 130](NATIVE_CACHED_NOTICE_REPAIR_130.ko.md)에서 실제 수정 호출은
원문 6,491자 대신 `current` 7자를 사용했고, 원문·proposal·native receipt가 일치했다.
두 검토자는 모두 정확했지만 부모가 해결된 T1 평가를 unresolved에 넣어 수정에 실패했고
120초 timeout으로 배치 FAIL이다. 후속 5행 UNRUN, 두 프로필 복원, 관측 **168,186
tokens**(완전성 미보장), 누적 **912회**, Node **554 / Python78 / conformance PASS**다.
전체 **active / No-Go**, 원래 **192 / 516 UNRUN**이다. 131은 실제 검토자의 typed
정정 데이터를 전용 수리 호출이 corrections에 적용하고 새 독립 검토를 요구한다.

## 최신 후속 작업 129: 요구 인용 결합, 보류 수정 호출 뒤 timeout

[인용·지연 129](NATIVE_CLAUSE_AND_LATENCY_129.ko.md)에서 첫 검토자는 필수 실측
요구를 유지하며 빠진 T1 평가를 찾았다. 부모는 6,491자 원문을 다시 입력했고,
첫 반환과 수정 호출 사이 31.6초가 지났다. 두 번째 검토 중 timeout으로 FAIL이다.
후속 5행 UNRUN, 두 프로필 복원, 관측 **150,511 tokens**(완전성 미보장), 누적
**909회**, Node **547 / Python78 / conformance PASS**다. 전체 **active / No-Go**,
원래 **192 / 516 UNRUN**이다. 130은 단 한 번의 수정에서 동일 연결의 원문을 재사용한다.

## 최신 후속 작업 128: 보류 검토 실행 통과, 두 번째 검토자의 요구 해석 오류

[보류 의미 128](NATIVE_NOTICE_MEANING_128.ko.md)에서 실제 검증자 2개가 실행됐다.
첫 검토자는 빠진 T1 평가를 찾았지만, 두 번째는 원문의 필수 실측 요구를 정성적
설명으로 대체해도 된다고 잘못 판단했다. 부모 timeout으로 배치 FAIL이다. 후속
5행 UNRUN, 두 프로필 복원, 관측 **166,993 tokens**(완전성 미보장), 누적 **906회**,
Node **545 / Python78 / conformance PASS**다. 전체 **active / No-Go**, 원래
**192 / 516 UNRUN**이다. 129에서는 보류 항목과 정확한 원래 요구 문장을 결합한다.

## 최신 후속 작업 127: 독립 보류 검토 구현, Agent 호출 자리표시자 실패

[독립 보류 검토 127](NATIVE_NOTICE_REVIEW_127.ko.md)에서 원문·보류문·native 결과를
결합하는 검토를 구현했다. 실제 Haiku는 정확한 원문을 전달했지만 Agent prompt의
자리표시자를 XML로 해석하여 guard가 시작 전에 거부했다. 독립 검토 자체는 UNRUN이다.
후속 5행 UNRUN, 두 프로필 복원, **111,001 tokens**, 누적 **903회**, Node **543 /
Python78 / conformance PASS**다. 전체 **active / No-Go**, 원래 **192 / 516 UNRUN**이다.
128은 정확한 Agent 호출 객체를 응답에 직접 제공해 다시 검증한다.

## 최신 후속 작업 126: 실제 전달 교정 통과, 별도 요청 평가 누락

[전달·누락 126](NATIVE_DELIVERY_AND_OMISSION_126.ko.md)에서 Haiku의 단계별 Stop
교정과 정확한 보류 본문 전달을 입증했다. 그러나 명시적인 T1 읽기 오류 평가를
전부 누락해 FAIL이다. 후속 5행 UNRUN, 두 프로필 복원, **74,502 tokens**, 누적
**900회**, Node **531 / Python78 / conformance PASS**다. 전체 **active / No-Go**,
원래 **192 / 516 UNRUN**이다. 127은 보류문에도 독립적인 원래 요청 대조를 추가한다.

## 최신 후속 작업 125: 양 정상 대조 통과, 보류 후 잘못된 단계의 Stop 안내

[최종 형식·전달 125](NATIVE_FINAL_AND_DELIVERY_125.ko.md)에서 Haiku의 실제 문장 수
수정·재검증과 Luna 정상 완료를 통과했다. Haiku 보류는 부연을 덧붙였고, Stop이
이미 결정된 상태에도 일반 검증 시작을 안내해 정확한 재전달에 실패했다. 후속 3행
UNRUN, 두 프로필 복원, **449,932 tokens**, 누적 **897회**, Node **527 / Python78 /
conformance PASS**다. 전체 **active / No-Go**, 원래 **192 / 516 UNRUN**이다.
126에서는 결정 단계별 교정을 구현하고 보류·재개부터 정상 plugin으로 검증한다.

## 최신 후속 작업 124: native 제출·최종 결합 통과, 명시된 문장 수 위반

[제출 schema 124](NATIVE_SUBMISSION_SCHEMA_124.ko.md)에서 Haiku 검증자3개의 typed
제출과 최종 본문·Stop을 통과했다. 그러나 “두세 문장” 요청에 네 문장을 complete로
판정해 의미 FAIL이다. 후속5행 UNRUN, 두 프로필 복원, **241,583 tokens**, 누적
**892회**, Node **527 / Python78 / conformance PASS**다. 전체 **active / No-Go**,
원래 **192 / 516 UNRUN**이다. 125는 최종 판단의 명시적인 독자·형식·길이 조건을
보강하고 정상 완료부터 검증한다.

## 최신 후속 작업 123: 양 보류·상태 재개 통과, 정상 검증의 입력/반환 schema 혼동

[정정·재개·schema 123](NATIVE_CORRECTION_AND_SCHEMA_123.ko.md)은 양 호스트 보류와
같은 세션 상태 재개를 통과했고 Codex의 결합 정정 본문도 입증했다. Haiku 정상
완료는 반환 JSON 필드를 도구 입력에 넣어 실패했다. 후속1행 UNRUN, 두 프로필
복원, **411,122 tokens**, 누적 **889회**, Node **526 / Python78 / conformance
PASS**다. 전체 **active / No-Go**, 원래 **192 / 516 UNRUN**이다. 124에서는
입력 schema를 단일 정의로 제공하고 정상 완료부터 재검증한다.

## 최신 후속 작업 122: 정상 보류 동작 통과, 요청된 초안 정정 누락

[보류 진입 122](NATIVE_WITHHOLDING_ENTRY_122.ko.md)은 Haiku가 처음부터 유효한
보류를 선택하고 정확한 본문·저장·실제 Stop을 통과했다. 그러나 함께 요청된 T1 읽기
오류 평가를 누락해 의미 FAIL이다. 후속 5행 UNRUN, 두 프로필 복원, 관측
**47,782 tokens**, 누적 **882회**, Node **523 / Python 78 / conformance PASS**다.
목표 **active / No-Go**, 원래 **192 / 516 UNRUN**이다. 123에서는 완성 설명 보류와
제공된 근거로 해결된 짧은 정정을 별도로 표현하는 본문 계약을 검토·구현한다.

## 최신 후속 작업 121: 준비 입력 실패를 보존하고, 보류 진입 분기 수정

[진입 절차 121](NATIVE_ENTRY_121.ko.md)은 Haiku의 잘못된 준비 입력과 원본 요청
누락으로 FAIL이다. 이후 보류 입력 자체는 유효했지만 실패 상태가 보존돼 거부됐다.
후속 5행 UNRUN, 두 프로필 복원, 관측 **88,652 tokens**, 닫힌 누적 **879회**다.
Node **522 / Python 78 / conformance PASS**, 목표 **active / No-Go**, 원래
**192 / 516은 UNRUN**이다. 122는 필수 근거 부족을 초안 준비 전에 판단하는
진입 절차를 새 후보의 정상 보류부터 검증한다.

## 최신 후속 작업 120: 양 호스트 typed 정상 완료 통과, 보류 입력의 숨은 제약으로 FAIL

[Typed 결과 수신 120](NATIVE_TYPED_RETURN_120.ko.md)은 같은 후보의 양 호스트 정상
대조에서 실제 결과 제출 ID/hash·반환 JSON·최종 본문·Stop을 통과했다. Haiku 보류는
공개 schema에 없던 평문 제약에 `>=`가 걸려 실패했다. 후속 3행 UNRUN, 두 프로필
복원, 관측 **441,177 tokens**, 닫힌 누적 **876회**다. Node **521 / Python 78 /
conformance PASS**, 목표 **active / No-Go**, 원래 **192 / 516은 UNRUN**이다.
121은 기존 검사를 유지하고 보류 schema를 일치시킨 뒤 보류·재개부터 검증한다.

## 최신 후속 작업 119: Haiku 중립 질문 통과, Luna 최종 JSON 대신 일반 문장 반환

[Native 반환 119](NATIVE_RETURN_119.ko.md)에서 Haiku 정상 대조는 PASS다. Luna는
typed final 결과를 제출했지만 자식 종료 메시지에 JSON 대신 answer 문장만 반환해
receipt가 거부됐고 부모 완료 없이 timeout됐다. 후속 4행 UNRUN, 두 프로필 복원,
관측 **380,988 tokens**, 닫힌 누적 **871회**다. Node **510 / Python 78 /
conformance PASS**, 목표 **active / No-Go**, 원래 **192 / 516은 UNRUN**이다.
120에서 실제 typed 결과에 묶인 1회 native 출력 교정을 구현·검증한다.

## 최신 후속 작업 118: 정상 종료와 정확한 답, 답이 포함된 독립 질문으로 FAIL

[질문 단위 118](NATIVE_QUESTION_UNIT_118.ko.md)은 Haiku가 fact 2개·final 1개를
68.8초에 완료했지만 질문 target에 계산한 답을 넣어 독립성 FAIL이다. 정확한 본문과
기계 감사 PASS로 이를 덮지 않았다. 후속 5행 UNRUN, 두 프로필 복원, 관측
**203,137 tokens**, 닫힌 누적 상위 native **867회**다. Node **510 / Python 78 /
conformance PASS**, 목표 **active / No-Go**, 원래 **192 / 516은 UNRUN**이다.
119는 스키마의 조사 대상과 주어진 전제를 구분해 정상 plugin에서 검증 중이다.

## 최신 후속 작업 117: Luna 결과 API 통과, Haiku 질문 분할로 시간 초과

[결과 API 안내 117](NATIVE_WIRE_117.ko.md)은 Luna의 정규 도구·단일 결과 제출·최종
본문·Stop이 PASS다. Haiku는 한 메커니즘을 5개 fact로 나눠 final 전에 timeout됐다.
빈 보고서는 supervisor의 timeout 출력 보류였으며 원본에서 실제 5개 verifier와
사용량을 회수했다. 전체 관측 **467,519 tokens**, 누적 상위 native **864회**, 두
프로필 복원, 후속 4행 UNRUN이다. 최종 Node **509 / Python 78 / conformance PASS**,
목표 **active / No-Go**, 원래 **192 / 516은 UNRUN**이다. 118의 질문 단위를 검증한다.

## 최신 후속 작업 116: Haiku 정상 완료 통과, Luna 자식 결과 API 사용 오류와 timeout

[호스트 분리 116](NATIVE_HOST_116.ko.md)은 Haiku fact/final 4개와 정확한 본문·Stop을
통과했다. Luna는 자식의 도구 이름·MCP 반환 경로 추측으로 중복 제출이 발생했고,
final receipt와 부모 본문 없이 timeout됐다. 두 프로필 복원, 후속 4행 UNRUN,
Node **508 / Python 78 / conformance PASS**, 관측 **488,971 tokens**, 누적 상위
native **860회**다. 목표는 **active / No-Go**, 원래 **192 / 516은 UNRUN**이다.
117에서는 자식의 정확한 결과 API와 반환 경로를 제공한다.

## 최신 후속 작업 115: Luna 정상 완료 통과, Haiku 초안 선출력·호스트 경로 혼동 실패

[결과 보관 115](NATIVE_RETENTION_115.ko.md)은 Luna 실제 fact/final 2개와 정확한 본문·
Stop까지 PASS지만, Haiku가 검증 전 초안을 출력하고 잘못된 host 경로를 사용해 전체
배치는 FAIL이다. 두 프로필 복원, 후속 4행 UNRUN, 관측 **370,163 tokens**, 누적
상위 native **856회**다. 최종 Node **503 / Python 78 / conformance PASS**다.
목표는 **active / No-Go**, 원래 **192 / 516은 UNRUN**이며 116의 host 분리를 검증한다.

## 최신 후속 작업 114: 실제 fact 전달 성공, 반환 결과 전사로 최종 검사 실패

[단일 native 전달 114](NATIVE_ATOMIC_114.ko.md)은 Luna 실제 자식에게 정확한 packet을
전달하고 결과를 받았지만, 부모가 challenge를 변경해 최종 검사가 실패했다. 후속 5행은
UNRUN이고 두 프로필은 복원했다. Node **500 / Python 78 / conformance PASS**, 실제
내부 Agent **1회**, 관측 **266,750 tokens**, 누적 상위 native **852회**다. 목표는
**active / No-Go**, 원래 **192 / 516은 UNRUN**이다. 115는 결과 객체를 code-mode
세션에 보관해 최종 검사까지 다시 입력하지 않고 전달하는 절차를 검증한다.

## 최신 후속 작업 113: 현재 시도 연결 성공, dispatch 실행 연결 실패

[현재 시도 연결 113](NATIVE_BINDING_113.ko.md)은 정상 Codex의 입력 갱신과 plan 결합을
입증했지만 모델이 dispatch 결과를 spawn으로 전달하지 않아 정상 완료는 FAIL이다.
내부 Agent 시도 0회, MCP 거부 3회, 후속 5행 UNRUN이며 두 프로필을 복원했다.
최종 Node **496 / Python 78 / conformance PASS**, 사용량 **122,782 tokens**,
누적 상위 native **849회**다. 전체 목표는 **active / No-Go**, 원래 **192 / 516은 UNRUN**이다.
114에서는 현재 packet 결합과 단일 code-mode dispatch→spawn 절차를 검증한다.

## 최신 후속 작업 112: 직접 전달 준비, 시도 ID 전사 오류로 실제 자식 시작 전 실패

[Native 직접 전달 112](NATIVE_DISPATCH_112.ko.md)의 고정 후보는 Node **491 / Python
78 / conformance PASS**다. 그러나 Codex가 시도 ID 두 글자를 잘못 옮겨 결합 검사가
실패했고 실제 verifier 0개로 timeout됐다. 후속 다섯 행은 UNRUN, 프로필은 복원했다.
누적 상위 native는 **846회**, 목표는 **active / No-Go**, 원래 **192 / 516 비교는
UNRUN**이다. 113은 명시적인 current 표지만 실제 세션 값으로 연결하는 훅 경로를 검토한다.

## 최신 후속 작업 111: Codex 자식 상태 복구, MCP 연결 간 packet 전달 실패

[자식 수명주기 111](NATIVE_CHILD_LIFECYCLE_111.ko.md)에서 실제 자식 초기 안내·부모
시도 보존·turn 결합·수집기 분리를 확인했다. 올바른 packet 조회는 자식 MCP 연결에서
실패했고 부모는 설명을 보류했다. 정상 완료는 FAIL, Haiku 설명 행은 UNRUN이다.
최종 Node **487 / Python 78 / conformance PASS**, 누적 상위 native **843회**다.
두 프로필을 복원했으며 목표는 **active / No-Go**, 원래 **192 / 516 비교는 UNRUN**이다.
112에서는 Codex의 native programmatic 전달을 검토해 connection-local cache 의존을 없앤다.

## 최신 후속 작업 110: Haiku 정상 완료 통과, Codex 자식 상태·수집기 실패

[정상 packet 수신 110](NATIVE_RETRIEVAL_110.ko.md)에서 Claude 기본 plugin MCP 자동
로드로 사실 Agent 3개·최종 Agent 1개와 정확한 최종 본문·Stop 허용을 입증했다.
이는 단순 가상 정의 사례 한 건의 PASS다. Codex는 자식 조회 안내 누락, 부모 session
상태 교체, 자식 종료를 부모 완료로 오인한 수집기 결함으로 FAIL이다. 두 프로필은 복원했다.
누적 상위 native는 **840회**이며 후보 Node **483 / Python 78 / conformance PASS**와
실제 품질은 구분한다. 목표는 **active / No-Go**, 원래 **192 / 516 비교는 UNRUN**이다.
111은 실제 반례에 따라 자식 시작 안내·turn 결합·수집기 thread 구분을 수정한다.

110의 준비 중 Claude 기본 plugin MCP 도구 이름과 명시적 연결의 이름이 다름을 공식
계약에서 확인했습니다. 107–109의 Claude 근거는 **설치된 skill·hook과 명시적으로 연결한
bundled MCP** 범위이며, 기본 MCP 자동 로드까지 입증한 것으로 보지 않습니다. 그 이름공간을
코드·검사에 반영해 기본 자동 로드의 Haiku 단순 사례를 검증했습니다. 110의 첫 준비본은 호출 0회로 보존하고
새 고정본으로 대체했으며 배정을 중복 소비하지 않습니다.

## 최신 후속 작업 109: 첫 호출의 긴 packet 복사 오류, 직접 조회로 전달 방식 변경

[순차 검증 109](NATIVE_SEQUENCE_109.ko.md)의 실제 첫 Agent 요청은 packet 복사 불일치로
거부됐습니다. 실제 verifier는 0개이며, 이후 미검증 설명을 제공했으므로 FAIL입니다.
Node 477 / Python 78 / conformance PASS를 실제 완료 성공으로 바꾸지 않습니다.
상위 native 누적은 836회입니다. 배치를 닫고 두 프로필을 복원했습니다. 다음 반복은
긴 복사를 없애고 verifier가 기존 MCP에서 고정 packet을 직접 받는 흐름입니다.
목표는 **active / No-Go**, 원래 192 subjects / 516 requests 비교는 UNRUN입니다.

## 이전 후속 작업 108: 독립 완료 경로 실패, 순차 전달·실패 처리

[정상 plugin 독립 완료 108](NATIVE_COMPLETION_108.ko.md)은 정상 설치와 활성화 후 첫 Haiku
설명에서 실패했습니다. 여러 verifier의 동시 요청, `unavailable` 뒤 후속 launch가 다시
실행되는 결함, 입력 가정 누락과 잘못된 verifier 응답을 확인했습니다. 성공한 완료로
계산하지 않고 나머지 다섯 행을 UNRUN으로 닫았습니다. 전체 목표는 **active / No-Go**입니다.

고정 후보는 Node 470 / Python 78 / conformance PASS지만 실제 완료 흐름은 FAIL입니다.
누적 상위 native는 833회이며 이번 내부 Agent는 실제 4개, 요청 7건입니다. 두 프로필을
복원했습니다. 109에서 실제 반례에 따라 실패 상태의 launch 거부와 한 번에 한 packet만
전달하는 흐름을 수정하고 있습니다. 원래 192 subjects / 516 requests 비교는 UNRUN입니다.

## 이전 후속 작업 107: 양쪽 실제 보류 확인, 상태 확인 재개 오분류

[설명 시도 검증 107](NATIVE_ATTEMPT_107.ko.md)에서 시도·후보·보류 본문을 결합한 정상
plugin으로 Haiku와 Luna의 필수 실측 부재 보류를 확인했습니다. Claude 재개에서는 미검증
안내가 유지됐지만 상태 확인만 요청한 turn을 새 설명으로 분류하는 결함이 나타났습니다.
배치를 5회 사용 후 닫고 Codex 재개는 UNRUN으로 보존했습니다. 목표는 **active / Go 미달성**입니다.

최종 해당 후보는 Node 456 / Python 78 / conformance PASS입니다. 정상 설명의 독립 검증·
complete 경로, 의미 품질과 원래 전체 비교는 미완료입니다. 누적 native 830회이며 시험
프로필 선택·후보 ON 상태를 복원했습니다. 세부 사용량과 보조 검사 실패도 107에 기록했습니다.

## 이전 후속 작업 106: 실제 보류 실패 확인, 저장·재개 복구

[정상 plugin 검증 106](NATIVE_WITHHOLDING_FINDINGS_106.ko.md)에서 양쪽 host의 설치·활성화를
확인했습니다. Haiku는 원후보와 skill 수정 후보 모두 필수 근거가 부족한 완성 설명을 제공해
보류 계약에 실패했습니다. 수정 후보의 첫 보류 안내가 Stop 후속 응답에서 완성 설명으로
바뀐 실제 기록을 확보했습니다. 이후 행은 UNRUN으로 보존했습니다.

새 상위 native 시작은 **4회**, 누적 **825회**입니다. 시험 프로필의 기존 선택과 후보의
ON 저장 상태를 복원했고 잔여 소유 프로세스는 없습니다. 추가로 실패 기록이 재개 때
사라지는 결함과 손상된 JSON이 새 작업까지 막는 결함을 수정했습니다. 최신 로컬 후보는
**Node 446 / Python 78 / conformance PASS**이며 정상 설치·native 재개는 미검증입니다.
의미 판단과 완료를 집행하는 경계가 남아 있으므로 **rc.13 / No-Go**를 유지합니다.

## 이전 후속 작업 105: 전체 로컬 회귀 통과, 정상 plugin 보류 검증 준비

사용자의 수동 제거 후 생성된 `Python/`이 없고 104 후보의 256개 파일이 그대로임을 확인했습니다.
기존 Python 절대 경로로 전체 검사를 다시 실행해 **Node 443 PASS, Python 78 PASS,
conformance selftest PASS**를 확인했습니다. 자동 설치는 재발하지 않았고 새 모델 호출은 0회입니다.

[정상 plugin 검증 계획 105](NATIVE_WITHHOLDING_PLAN_105.ko.md)에 후보 22개 파일과
양쪽 host의 활성화·미해결 주장·정상 답변·검사 실패·재개·취소 12회 실행표를 고정했습니다.
기존 승인 잔여 1회 외 추가 11회와 시험 프로필의 후보 설치·활성화는 아직 실행하지 않았습니다.
의미 오류 미탐지와 실제 보류는 미검증이므로 **rc.13 / No-Go**를 유지합니다.

## 이전 작업 104: 회귀 대조·중지 처리 보완

[수정 기록 104](VERIFICATION_REMEDIATION_104.ko.md)에 102의 구조 오류 5개와 103의 완성 흐름
7개를 고정했습니다. 탐지된 미해결 오류·검사 실패는 중지 사유를 반환하며, 거부된 근거는
같은 turn에서 실패 상태를 유지합니다. 그러나 과거 H/Q FAIL 4개가 모두 제한적인 Stop
의미 검사를 통과했고, 정상 plugin의 실제 보류는 입증하지 못했습니다. 새 native 호출은 0회입니다.

최종 관련 Node **59 PASS**, Python **78 PASS**, conformance selftest는 통과했습니다.
전체 Node 시도는 **436 PASS / 2 FAIL**입니다. Windows Python 별칭이 작업 루트에 런타임을
자동 설치한 원인을 고쳐 기존 interpreter의 절대 경로를 필수로 지정합니다. 생성 폴더의
재귀 삭제는 shell-guard가 거부해 전체 회귀가 미완료입니다. 기존 주입 내용을 지우는 OFF
기능·테스트는 추가하지 않았습니다. 아래 내용은 이전 103 후보의 결과로 보존합니다.

## 최신 판정: 세 계약과 실행 중단 원인 보완, 의미 정확성 실패로 No-Go

[계약 검증 103](VERIFICATION_CONTRACT_103.ko.md)에서 부모의 구조화 출력, Claude 메타
이벤트 감사, 주장-질문 연결 생성을 수정했습니다. 본문·인용을 한 블록에서 구성하고,
유효한 질문/의무 쌍과 결과 비교·주장별 검토표를 로컬에서 고정합니다. 실제 중단 원인을
따라 Claude 고정 자식 입력, Codex 독립 검증 세션, 제출 스키마와 상태 검사를 보완했습니다.

최종 관련 회귀는 **22파일 / 252 PASS / fail 0 / skip 0**, 실제 Claude 부모 기록 재생은
**18개 PASS**입니다. 102의 잘못된 연결은 계속 거부됩니다. 별도 장부의 새 상위 CLI는
**82회(Codex 31, Claude 51)**, 질문 검증 예약은 55회이며 82개 Job 모두 정리됐습니다.
누적 **821회(Codex 328, Claude 493)**, 상한 83회 중 잔여 1회입니다. 회수 사용량은
**1,343,477 tokens**이나 중단된 native의 일부 사용량은 미회수입니다.

Luna의 앞선 정상 대조와 첫 고정 unseen 완성 답변은 H/Q를 통과했습니다. 최종 Haiku
진단도 8단계를 완료하고 SSI 오류 하나를 고쳤지만, 다른 오류가 남고 snapshot 시점 오류가
추가돼 Q1은 실패했습니다. known 과제의 오류도 남았습니다. 최종 계약의 반복 검증,
정상 rc.13 plugin 품질, 전체 **192 subjects / 516 requests**는 미실행 또는 미충족입니다.
현재 시험 프로필은 Codex rc.1·Claude plugin 없음이며 제품 **rc.13 / No-Go**를 유지합니다.

## 이전 판정: 승인된 품질 캠페인 첫 기록 거부로 중단, No-Go

[실제 실행 102](NATIVE_EXPLANATION_102.ko.md)에서 첫 Haiku 초안 CLI는 정상 종료했지만,
Claude가 추가한 구조화 출력용 메타 입력을 부모 수집기가 거부했습니다.
사후 회수한 초안은 기존 주장-질문 coverage 검사에서도 실패했습니다.
첫 실패 중단 조건에 따라 **상위 CLI 1회 사용·자식 0개**, 첫 행 후속 7단계와
나머지 11행, 총 **83회분은 UNRUN**으로 보존했습니다.

이번 관측 사용량은 33,071 tokens, 프로세스 정리와 잔류 소유 process 0을 확인했습니다.
누적 **739회(Codex 297, Claude 442)**이며 제품은 **rc.13 / No-Go**입니다.
최종 설명은 생성되지 않아 최종 H/Q, 정상 rc.13 plugin 품질, 전체 192 subjects /
516 requests는 미실행입니다. 기존 코드와 실패 장부를 보존했으며 재시도하지 않았습니다.

## 이전 판정: 실제 질문·완성 설명 경로 구현, 품질 실행 전 No-Go

[검증 101](VERIFICATION_EXPLANATION_101.ko.md)에서 실제 packet 고정 입력,
초안·질문별 독립 확인·전체 재작성과 첫 실패 중단 장부를 구현했습니다.
관련 회귀는 **19파일 / 187 PASS / fail 0 / skip 0**이며 제품 전체 회귀와 구분합니다.
새 모델 호출은 0회로 누적 **738회(Codex 297, Claude 441)**를 유지합니다.
과거 [98](NATIVE_VERIFICATION_98.ko.md)·[100](VERIFICATION_SUBMISSION_100.ko.md)은 연결 근거입니다.

고정 품질표는 12행, 상위 CLI 최대 84회·새 자식 문맥 60개이며 모두 UNRUN입니다.
새 실행 범위에 대한 결정이 남았습니다. 제품은 **rc.13 / No-Go**, 현재 시험 프로필은
Codex rc.1 활성·Claude plugin 없음입니다. 새 경로의 실제 품질, 정상 rc.13 plugin 흐름,
192 subjects / 516 requests는 미실행이며 원래 네 기능과 출하 기준을 유지합니다.

## 이전 판정: rc.13 통합, 필수 교정 동작 확인, 최종 정밀성 실패로 No-Go

[통합 검증 87](NATIVE_VALIDATION_87.ko.md)에서 검토한 다섯 파일을 제품에 반영했고
Node 221개·Python 78개·conformance 검사가 통과했습니다. 양쪽 정상 설치의 OFF/ON도
모두 통과했습니다. 첫 Haiku 설명에서 정확한 근거를 사용한 필수 교정이 한 번 실행됐지만,
수정 답변에 실질적인 오류가 남았습니다. Root 검토는 H1–H3/Q2 통과, Q1 실패입니다.

이번 **5회 사용·7회 미실행으로 중단**, 누적 **727회(Claude 434, Codex 293)**입니다.
작업용 프로필 복원을 확인했습니다. Luna 품질·정상 답변 영향·반복 재현성과 전체 비교
**516회는 미실행**입니다. 원격 CI·registry 검증도 미실행이며 출하 목표는 미달성입니다.
같은 후보의 추가 native 호출은 권고하지 않고, 새 대체 설계도 채택하지 않았습니다.
기존 제품 경계와 원래 품질 기준을 유지하며 로컬 rc.13을 출하·게시하지 않았습니다.

## 이전 판정: 문자열 응답 거부 확인, rc.13 수정안 준비, No-Go

[실제 경계 진단 86](NATIVE_DIAGNOSIS_86.ko.md)의 Haiku 2회에서 `tool_response`가 문자열이고
이를 `unverified_tool_result`로 거부하는 것을 확인했습니다. 턴은 초기화돼 있었습니다.
기록된 도구 값도 JSON으로 읽으면 재계산 결과와 완전히 일치했습니다. 같은 엄격한 검증으로
문자열을 처리하는 별도 rc.13 사본을 준비해 실제 기록 재생 여섯 조합과 Node 25개를 통과했습니다.
수정안은 제품 반영·설치·native 실행 전이며 제품 본체는 rc.12를 유지합니다.

누적 **722회(Claude 431, Codex 291)**, 이번 진단 **2회 사용으로 완료**했습니다.
작업용 프로필 복원도 확인했습니다. 전체 비교 **516회 미실행**, 정상 답변 변화·추가 비용과
네 기능의 기본·원본 대비 개선은 미검증입니다. 다음 통합·검증 제안은 확인 전 실행하지 않습니다.

## 이전 판정: rc.12 필수 교정 실패 재현, No-Go

[실제 모델 검증 85](NATIVE_VALIDATION_85.ko.md)에서 양쪽 OFF/ON은 통과했지만 첫 Haiku 설명의
근거 저장이 다시 실패했습니다. 기존 비용 오류 감지기가 수정 답변을 요청했으나 필수 근거
교정은 작동하지 않았습니다. Root 검토에서 H1–H3/Q2는 통과, 최종 SSI 설명의 Q1은 실패입니다.
배열 호환성 수정만으로 실제 원인을 해결하지 못했으며 정확한 실패 단계는 미확정입니다.

누적 **720회(Claude 429, Codex 291)**, 이번 **5회 사용·7회 미실행으로 중단**했습니다.
작업용 프로필을 복원했고 제품 코드는 바꾸지 않았습니다. 원문을 기록하지 않는 별도 진단
사본과 일곱 로컬 검사만 준비했습니다. 다음 권고는 새 Haiku 진단 최대 2회이며 확인 전 실행하지 않습니다.
전체 비교 **516회 미실행**, 원래 네 기능의 출하 목표는 미달성입니다.

## 이전 판정: rc.12 호스트 형식 수정, 실제 교정 미검증으로 No-Go

[실제 모델 검증 84](NATIVE_VALIDATION_84.ko.md)에서 rc.11의 양쪽 OFF/ON 네 행이 통과했지만,
첫 Haiku 설명에서 필수 교정이 시작되지 않아 중단했습니다. 제 구현이 Claude의 MCP content
배열을 전체 결과 객체로 가정한 오류였습니다. rc.12는 두 형식을 동일한 재계산 대조로 처리합니다.
실제 도구 결과의 로컬 재생, Node 219개·Python 78개·conformance 검사가 통과했습니다.
rc.12의 실제 모델 실행·정상 답변 변화·추가 비용·정밀성 개선은 아직 확인하지 못했습니다.

누적 **715회(Claude 426, Codex 289)**에는 이번 **5회**가 포함됩니다.
84 장부는 12회 중 **5회 사용·7회 미실행으로 중단**했고 작업용 프로필을 복원했습니다.
전체 비교 **516회 미실행**, 출하 목표는 미달성입니다. 새 후보의 다음 native 검증은 별도 확인 전 실행하지 않습니다.

## 이전 판정: rc.11 로컬 준비 완료, 실제 품질 미검증으로 No-Go

[출하 준비 83](RELEASE_PREPARATION_83.ko.md)은 근거 기반 한 번의 최종 교정 경로,
설치·업데이트·제거, 격리와 전체 회귀 검사, CI 범위와 패키지를 다룹니다.
Claude OFF/ON은 정상 동작했고 토큰 사용은 0개였습니다. Codex OFF는 이전 플러그인이
활성화된 것을 수집기가 감지해 중단했습니다. CLI 키 경로의 따옴표가 이름에 포함되는
원인을 확인하고, 수정된 설정으로 후보 훅만 활성화되는 것을 모델 없는 조회로 검증했습니다.
품질 8행은 모두 미실행이며 정상 답변 변화·추가 지연·토큰 효과를 아직 판단할 수 없습니다.

누적 **710회(Claude 423, Codex 287)**에는 이번 제어 요청 시도 3회가 포함됩니다.
83 장부는 12회 중 **3회 사용·9회 미실행으로 중단**됐고 재시도하지 않았습니다.
전체 비교 **516회 미실행**, 출하 목표는 미달성입니다. 다음 네이티브 실행은 새 계획 확인이 필요합니다.

## 이전 판정: rc.10 실제 Haiku 정밀성 실패

[실제 모델 검증 80](NATIVE_VALIDATION_80.ko.md)에서 수정하지 않은 rc.10을 실행했습니다.
정상 정책·skill·MCP 계산과 구현 근거 2개가 전달됐지만 Q1 정밀성에 실패했습니다.
두 독립 채점자의 불합격을 root가 확정했으며 H1–H3와 Q2는 통과로 보존했습니다.
첫 실패 중단 조건에 따라 나머지 3회는 미실행입니다. Luna와 반복 재현성은 미검증입니다.
누적 **707회(Claude 421, Codex 286)**, 이번 별도 검증 상한 4회 중 **1회 사용·3회 미사용**,
전체 비교용 **516회 미사용**입니다. 출하 목표는 미달성입니다.

## 이전 기록: rc.10 로컬 정밀성 개선

[정밀성 개선 79](PRECISION_79.ko.md)에서 재시도·비용 단정의 검사와 공식 구현 근거를
추가했습니다. 실제 rc.9 Haiku는 일부 초안만 제출해 근거 전달 조건이 발동하지 않았고,
최종 답변의 정밀성 Q1은 실패했습니다. rc.10은 이 전달 조건과 추가 단정 검사를
수정했으며 Node 203개·Python 77개가 통과했습니다. rc.10의 실제 모델 품질은 미검증입니다.
누적 **706회(Claude 420, Codex 286)**, 별도 추가 진단 6회는 모두 사용했으며
전체 비교용 **516회 미사용**입니다. 출하 목표는 미달성입니다.

## 이전 후보: rc.8 구현 및 실제 교정 경로 확인

[실제 Stop 검증 76–78](STOP_VALIDATION_76_78.ko.md)에서 Haiku와 Luna 모두
실제 피드백 후 수정 답변을 완료했습니다. 일반 과제에서는 rc.7 Haiku의 필수
H1–H3와 재시도 비용 Q2가 통과했지만 정밀성 Q1은 실패했습니다.
현재 rc.8은 OFF 상태의 자동 개입 회귀와 수집기를 수정한 로컬 후보이며,
Node 197개·Python 77개가 통과했습니다. rc.8 자체의 모델 품질은 미검증입니다.
누적은 **705회(Claude 419, Codex 286)**입니다. 이번 별도 추가 상한 6회 중
5회를 사용했고 **1회 미배정**, 전체 비교용 **516회 미사용**입니다.
전체 비교와 Opus/Sol 검증은 아직 시작하지 않았으며 출하 목표는 미달성입니다.
아래 숫자와 판정은 이전 후보 및 각 진단 시점의 역사적 기록입니다.

## 이전 후보와 근거 기록

**최종 판정: 이번 `0.2.0-rc.1` 후보는 출하하지 않습니다(No-Go). 원래 목표는 미달성입니다.**
[출하 판단 보고서](RELEASE_DECISION.ko.md)에 기준별 미달과 이번 개발 라운드의 작업 경계를
정리했습니다. 같은 접근의 추가 진단과 제품 통합은 진행하지 않으며, 기존 코드·실패 기록과
남은 진단 2회·전체 비교용 516회를 보존합니다. 아래 내용은 이 판단에 이른 근거 기록입니다.
[고정 호스트 출력 계약 확인 71](HOST_OUTPUT_CONTRACT_71.ko.md)에서 설치된 Codex의 정적
프로토콜을 내보내 확인했습니다. 이력 append와 출력 schema는 발견했지만 정상 최종 답변
교체·사실 검증으로 볼 근거는 확보하지 못했습니다. 새 출력 엔진이나 모델 호출은 시작하지 않았습니다.
[서브에이전트 재평가 70](REASSESSMENT_70.ko.md)에서 판정·아키텍처·예산을 독립 검토했습니다.
현재 계산 결과를 자유 자연어로 재작성하는 경로의 추가 문구 진단과 제품 통합을 보류합니다.
원래 기준은 유지하고 최종 출력 경로와 제품 적합성을 먼저 설계합니다. 추가 native 호출은 0회입니다.
[고정 계획 69](SCENARIO_REPEAT_69.ko.md)는 첫 Haiku 실행에서 교차 읽기·쓰기 모순이
재발해 중단했습니다. 모델·도구·계산 결과는 정상이었지만 최종 설명의 필수 품질이
실패했습니다. 나머지 Haiku/Luna 두 호출은 미실행입니다. 최신 누적 **698회(Claude 413,
Codex 285)**, 진단 잔여 **2회**, 전체 비교 **516회** 미사용입니다.
도구 출력에 실행 순서를 명시한 뒤 [Luna 진단 68](MITIGATION_BOUNDARY_67.ko.md)을 1회
실행했습니다. 도구 응답이 재계산과 일치했고, 최종 답변은 수동 검토에서 해당 전문가
과제의 필수 3항목·품질 2항목을 충족했습니다. 단일 진단이며 반복·기본/원본 비교·설치
제품 합격은 아닙니다. 68 시점 누적 **697회(Claude 412, Codex 285)**, 진단 잔여 **3회**,
전체 비교 **516회** 미사용입니다.
승인된 [Luna 진단 66](LUNA_SCENARIO_66.ko.md)을 1회 실행했습니다. 모델·입력·도구 호출과
계산 결과 일치를 확인하고 프로세스를 정리했습니다. 최종 답변의 직렬 실행/serializable
구분이 불명확해 전문가 설명 품질은 합격 처리하지 않았습니다. 66 시점 누적 **696회
(Claude 412, Codex 284)**, 진단 잔여 **4회**, 전체 비교 **516회** 미사용입니다.
사용자가 실행한 진단 64에서 Haiku의 시나리오 작성·도구 호출은 정상 완료됐습니다.
JSON 응답을 잘못 비교한 감사 오류는 오프라인에서 정정했습니다. 최종 답변의 원문
보존 요구는 실패했지만, 이 한 답변의 원래 과제 필수·품질 항목은 수동 검토에서
충족했습니다. 반복 개선·제품 합격 증거는 아닙니다. 64 시점 누적 **695회(Claude 412,
Codex 283)**, 진단 잔여 **5회**, 전체 비교 **516회** 미사용입니다.
진단 63은 계산된 사실을 제공해도 Haiku가 전체 interleaving을 검증했다고 과장하고
조건 불충족을 트랜잭션 중단으로 설명해 실패했습니다. 새 결정적 설명 생성기와
읽기 전용 도구를 구현했으며 관련 로컬 검사 20개가 통과했습니다. 네이티브 도구 연결과
모델의 최종 전달 정확도는 당시 미검증이었습니다. 63 시점 누적은 **694회(Claude 411, Codex 283)**,
진단 잔여 **6회**, 전체 비교용 **516회**는 미사용입니다.
[제한된 네이티브 진단 기록](FINITE_SCENARIO_NATIVE_PLAN.ko.md)에 64 결과와 감사 정정을 남겼습니다.
감사 61은 한 리뷰 과제의 과거 Luna 기록 6개와 현재 관측 조건을 대조했습니다.
전체 합격으로 자동 반영하지 않습니다. 모듈 62는 제한된 상태 모델에서 의존성과
불변식 위반을 직접 계산하며 로컬 테스트 7개가 통과했습니다. 실제 모델 사용·설명
품질·제품 통합은 당시 검증하지 않았습니다. 62 시점 추가 호출은 0회, 진단 잔여는 7회였습니다.
최신 [개발 진단 60](DEVELOPMENT_DIAGNOSTIC_60.ko.md)은 양 호스트에서 기본/TTAK 조건을
각각 2회, 총 8회 실행했습니다. 기능 검사는 모두 통과했지만 Haiku는 동률 2회,
Luna는 기본 모델 선호 1회·TTAK 선호 1회로 반복적인 개선을 입증하지 못했습니다.
60 시점 누적 693회, 진단 잔여 7회이며 전체 비교용 516회는 미사용이었습니다.
진단 59는 생성 전에 공식 근거를 제공했지만 Haiku 답변에 교차 읽기·쓰기 모순과
행 잠금의 재시도 동작 오류가 남았습니다. 동일 재시험이나 제품 통합은 하지 않았습니다.
누적 685회, 진단 잔여 15회이며 전체 비교 배정 516회는 유지됩니다.
준비 58에서 Haiku·Luna용 별도 입력 고정·검증 도구를 완성하고 192개 비교의 준비
snapshot을 저장·검증했습니다. 변조·범위 검사 6개가 통과했습니다. 모델 호출은 0회이며
설명 품질 미해결 상태와 진단 잔여 16회는 유지합니다. 전체 비교는 시작하지 않았습니다.
진단 56은 두 문단만 검토해도 교차 읽기 모순을 놓쳤습니다. 진단 57의 기본 Haiku
답변은 교차 읽기를 구분했지만 잠금 SQL 등 해결책에 오류가 남았습니다. 단일 비교로
지침의 인과 효과나 모델의 일반적 능력을 단정하지 않습니다. 누적 684회, 진단 잔여 16회입니다.
이전 진단 55에서는 원문 구간 ID 방식으로 첫 근거 보고의 인용 검증을 통과했습니다.
문맥 보고가 15문단 중 7문단만 반환해 중단됐고, 의미 판단 오류도 남았습니다.
수정 호출은 실행하지 않았습니다. 누적 682회, 진단 잔여 18회입니다.
이전 진단 54에서는 Haiku 독립 검토 연결부를 추가했고 관련 Node 검사 66개가 통과했습니다.
첫 실제 근거 검토는 원문과 다른 인용으로 거부됐고 문맥·수정 호출은 하지 않았습니다.
보고서의 의미 판단 오류도 확인했습니다. 누적 680회, 진단 잔여 20회입니다.
[Haiku 설명 진단 기록](LOW_MODEL_EXPLANATION_DIAGNOSTICS.ko.md)에 근거를 보존했습니다.

이전 [Haiku 설명 진단 52·53](LOW_MODEL_EXPLANATION_DIAGNOSTICS.ko.md)에서 기존 본문과
사건 표 변경안 모두 교차 읽기 설명의 내부 모순으로 실패했습니다. 변경안은 복구했고
Luna 재시험은 하지 않았습니다. 누적 679회, 진단 잔여 21회이며 제품 설명 품질은 미해결입니다.
[Haiku·Luna 새 검증 조건](LOW_MODEL_RELEASE.ko.md)을 사용자 결정에 따라 분리했습니다.
양 호스트의 필수 품질, 원본 대비 중대 퇴보 없음, 기본 모델 대비 반복되는 실질 개선이
합격 기준입니다. 진단 51의 Haiku 연결 1회는 모델·입력·thinking 존재를 확인했으며
thinking 상한 수치는 요청값으로만 남습니다. 그 시점 누적은 677회, 진단 잔여 23회였습니다.
제품 개선과 전체 비교는 진행 중이고 Opus·Sol은 하위 모델 합격 이후의 계획입니다.

이전 [진단 50 출하 경로 재평가](RELEASE_PATH_REASSESSMENT.ko.md)는 제품 기준과 진단 설계를
분리했습니다. 저장된 진단 49 보고의 미확인 주장 4개 때문에 현재 결합 코드가 자동 수정
전에 중단됨을 로컬에서 확인했습니다. 새 구현안을 시험할 근거가 부족해 검토 구조 통합과
모델 시험 확대를 당시 보류했습니다. 추가 모델 호출은 0회였으며 진단 잔여 24회를 보존했습니다.
이 현황은 진단 46의 예산 산정과 실행부 구현까지 반영합니다. 진단 45의 Claude 도구 흐름 검사는 정상 완료됐습니다.
이후 [진단 47 재검토 준비](REASSESSMENT_47.ko.md)에서 독립 검토 구조의 채택을 미확정으로 두고,
근거·문맥 역할 분리 후보의 입력과 판정 기준을 준비했습니다. 최대 18회 시험과 미배정 9회를
구분했으며, 실제 실행 준비는 미완료입니다. 추가 모델 호출과 제품 변경은 없습니다.
후속 [로컬 역할 검토 구현](REVIEW_ROLES.md)은 출력 검증·결합·수정 후 두 역할 재검토를
연결했고, 신규 17개를 포함한 관련 Node 검사 45개가 통과했습니다. 실제 모델 정확도와
CLI 세션 분리의 증거는 아니며 설치된 제품에는 아직 연결하지 않았습니다.
이후 [진단 48](NATIVE_REVIEW_TRANSPORT.md)에서 양 호스트 각각 1회의 실제 근거 역할 호출을
검사했습니다. 모델·effort·정확한 프롬프트·한글/이모지 출력·프로세스 종료를 확인했고,
관련 로컬 테스트는 총 57개가 통과했습니다. 설명 품질과 전체 수정 흐름의 합격 증거는 아닙니다.
[진단 49 품질 시험](ROLE_SCREEN_49.ko.md)은 첫 Claude 근거 검토가 필수 오류 문장을
누락해 1회 호출 뒤 중단했습니다. 나머지 17개 작업은 미실행이며, 후보를 제품에 연결하지
않았습니다. 호출 장부 검사를 포함한 관련 로컬 테스트 63개는 통과했습니다.
세부 증거와 변경하지 않은 합격 기준은
[출하 기록](RELEASE.md)에 있습니다. 전체 목표는 TTAK 한 번의 설치로 Ponytail·ELI5·i-have-adhd의
핵심 사용 목적을 충족하는 것입니다. 명령 이름, 말투와 강도 설정까지 그대로 복제하는 범위는 아닙니다.

## 구현과 검증은 어디까지인가

| 기능 | 현재 구현 | 관측된 검증 | 아직 완료되지 않은 것 |
|---|---|---|---|
| 간결한 개발 | 불필요한 추상화·중복을 줄이도록 안내하는 공통 정책 | 과거 비교에서 TTAK의 작은 개발 예제는 두 호스트 각각 8/8 기능 검사 통과 | 현재 후보 전체 비교, 실제 저장소 편집 전반의 버그 감소 입증 |
| 복잡성 리뷰 | `ttak-review`: 요구사항과 호출 관계를 근거로 제거 가능한 복잡성 검토 | 두 호스트에서 명시적 스킬 호출 확인, 과거 비교 응답과 채점 이견 검토 | 현재 후보의 반복 비교 합격; 일반적인 사실·보안 검증 기능은 아님 |
| 독자별 설명 | `ttak-explain`: 초보자·실무자·전문가·의사결정자에 맞춰 설명 | 현재 설명 본문으로 두 호스트 합계 14개 제한된 시험과 실제 본문 전달 확인 | 알려진 사실 오류 해결, 독자 적합성과 정확도의 전체 반복 비교 |
| 진행·중단 복귀 안내 | 공통 정책으로 현재 단계·완료 사항·막힌 점·복귀할 작업 안내 | 과거 비교에 중간 질문, 실패 원인 변경, 복귀 과제 포함 | 현재 후보 전체 비교에서 상태 기억·정직한 완료 보고의 반복 합격 |
| 혼합 작업 | 리뷰·설명 스킬과 공통 정책 함께 사용 | 과거 비교에서 원본 세 개 동시 사용 조건 포함 | 현재 후보가 혼합 과제에서도 원본 대비 중대한 품질 저하가 없는지 확인 |

두 호스트는 Windows의 Claude Code와 Codex CLI입니다. 현재 시험 모델은 각각
`claude-haiku-4-5-20251001`(thinking 요청 8192, effort 미지정), `gpt-5.6-luna / high`입니다.
기존 `claude-sonnet-5 / medium` 결과는 과거 기록으로 보존하며 새 Haiku 관측과 구분합니다.
스킬의 명시적 호출은 두 호스트에서 확인했습니다. Claude의 자동 선택은 작은 리뷰 2개와
아동 설명 2개에서 확인했으며, Codex의 자동 선택은 아직 검증되지 않았습니다.

## 효과는 얼마나 있는가

확인된 작은 개발 예제에서는 Codex 원본이 마지막 예외 대신 `RuntimeError`를 발생시킨 사례가
있었고 TTAK는 해당 기능 검사를 통과했습니다. 다만 기본 모델도 같은 예제를 통과했으므로
이 결과만으로 TTAK의 일반적인 버그 감소 효과를 주장할 수는 없습니다.

설명에서는 TTAK와 원본 모두 사실 오류가 관측됐고, 두 채점 모델이 같은 오류를 놓치기도 했습니다.
채점 점수나 두 모델의 동의만으로 정확도를 인증하지 않습니다. 전체 승률, 정확도 향상률,
개발시간·비용 절감률은 아직 제시할 근거가 없습니다. 과거 작은 비교에서는 TTAK의 응답 시간이
더 길었던 항목도 있습니다. 품질 기준을 통과한다면 관측된 시간·사용량 증가를 공개할 수 있다는
합의는 유지합니다.

## 현재 막고 있는 결함과 해결 상태

전문가용 데이터베이스 설명에서 잠금 대기 후의 동작을 잘못 설명하는 결함이 반복됐습니다.
설명 지침을 바꾼 수정안들은 이 오류가 재발하면 철회했고, 실패한 응답도 보존했습니다.

별도의 검토 모듈과 로컬 MCP 어댑터는 문단을 빠짐없이 처리하고 다른 문단의 인용이나 순서
위반을 거부합니다. Claude의 실제 도구 권한 검사도 통과했습니다. 그러나 **처리 완료는 사실
정확도 인증이 아닙니다.** 이 모듈은 아직 출하 스킬에 연결되지 않았습니다.

검토된 오류 인용만 수정하고 나머지 문자를 보존하는 Node.js 수정 모듈도 구현했습니다.
과거 수정 기록 두 단계와 결과가 정확히 일치했고, 수정 위치의 모호함·중첩·미검토 변경을
거부하는 검사와 실제 로컬 도구 통신을 포함해 관련 Node 테스트 22개와 Python 출하 테스트 37개가 통과했습니다.
인용이 서로 겹쳐 반복될 때 잘못된 위치를 수정할 수 있었던 Python 실험 코드의 버그도 고쳤습니다.
Node 수정 모듈이 이모지의 절반만 인용한 수정이나 깨진 Unicode 대체 문장을 허용하던 결함도
실패하는 테스트로 재현한 뒤 수정했습니다. 정상적인 이모지 교체는 통과합니다.
이 모듈 역시 아직 출하 스킬에 연결되지 않았으며, 수정 문장의 사실 정확도를 보장하지 않습니다.

로컬 어댑터에는 `review_repair`를 연결했습니다. 수정이 성공하면 새 검토 ID를 만들고,
수정된 문서 전체의 재검토를 요구합니다. 실패하면 이전 상태를 유지합니다. 승인된 진단 45에서
Claude가 검토 시작·오류 제출·수정·새 ID로 재검토하는 도구 호출 4회를 모두 성공했습니다.
권한 거부는 0건, 소요 시간은 약 10.5초였고 글로벌 등록이나 영구 설정 변경은 없었습니다.
정답과 수정 내용을 지정한 도구 흐름 검사이므로 설명 품질이나 사실 오류 탐지 효과의 증거는 아닙니다.

독립 검토·수정·전체 재검토의 호출 순서와 예산 중단을 관리하는 실행부도 구현했습니다.
관련 Node 테스트는 총 28개를 통과했습니다. 실제 CLI를 실행하는 연결부는 아직 없으며,
서로 다른 세션 ID를 요구하는 로컬 테스트만으로 독립 실행이 입증된 것은 아닙니다.

| 검토 방식 | 이번까지의 관측 | 판단의 한계 |
|---|---|---|
| 한 세션에서 16문단 순서대로 검토, 근거 제공 | 모두 처리했지만 알려진 오류 문단 3개 중 2개만 지적 | 사실 검증 경로로 채택하기에 부족 |
| 놓친 문단 하나를 새 세션에서 검토, 동일한 초안·근거 제공 | 진단 43에서 오류 지적, 약 17초·CLI 1회 | 알려진 문단 1개; 전체 정확도·오탐·수정 효과를 입증하지 않음 |
| 과거 문단별 독립 검토와 제한된 수정·재검토 | 초안 1개의 기록된 오류를 수정하는 데 22회·합계 약 300초 | 제품 통합 전 실험이며, 최종 문맥 전체를 다시 검토한 결과도 아님 |

## 출하까지 남은 조건

1. 알려진 설명 결함을 해결하고, 효과가 확인된 변경만 제품에 반영합니다.
2. 변경된 기능을 두 호스트에서 실제 사용할 수 있는지 확인합니다. 독립 검토를 채택한다면
   실행·수정·중단 처리와 사용량까지 확인해야 합니다.
3. 같은 과제·모델·환경으로 기본 모델, 해당 원본, TTAK를 비교합니다. 혼합 과제의 원본 조건은
   세 원본 동시 사용입니다. 16개 과제 × 2회 × 3조건 × 2호스트, 총 192개 응답 시험이 기준입니다.
4. 현재 후보의 모든 필수 기준을 통과하고, 각 기능에서 원본 대비 중대한 품질 저하가
   해결되지 않은 채 남아 있지 않아야 합니다. 다른 기능의 점수로 실패를 상쇄하지 않습니다.
5. 결과와 한계를 일치시킨 출하 보고를 완성합니다. 실제 외부 배포는 대상과 권한이 확정돼야 합니다.

과거 192개 비교 응답은 이전 지침의 결과입니다. 이를 현재 후보의 완료 실적으로 바꿔 세지 않습니다.
현재 상태를 하나의 완성도 백분율로 표현하면 구현과 품질 검증을 혼동하므로 사용하지 않습니다.

## 시험 사용량

진단 49까지 시험·채점·진단 CLI 호출은 **676회: Claude 397회, Codex 279회**입니다.
진단 44는 저장된 기록만 재생했으므로 모델 호출을 추가하지 않았습니다.
실패·폐기한 실험도 포함합니다. 주 개발 대화와 별도로 구분한 설정·제어 호출은 이 수치 밖입니다.

620회 시점에 정한 추가 시험 구간에서 진단·재시험 80회 중 56회를 사용했습니다.
남은 상한은 진단·재시험 **24회**와 알려진 결함 해결 후 전체 비교 **516회**입니다.
진단 47에서 계획한 선별 시험은 18회 중 1회 실행 후 중단했습니다. 미실행 17회를
동일 후보 재시도나 새로운 실험으로 자동 전환하지 않습니다.
진단 46에서 기존 답변 길이로 계산하면 독립 검토를 추가한 전체 비교는 수정 없이도 약 818회,
답변마다 한 번 수정하고 같은 문단 수로 재검토하면 약 1,152회입니다. 이전 기본 모델·원본
호출 260회를 모두 재사용할 수 있다고 가정해도 각각 558회·892회이며, 재사용 가능성은 아직
검증하지 않았습니다. 따라서 기존 상한 안에 들어간다고 볼 수 없습니다. 추가 모델 호출 없이
실행부를 구현했으며, 연결 시험 후 실제 사용량을 반영해 전체 비교 예산을 다시 제안해야 합니다.
세부 계산은 [검토 흐름과 예산](REVIEW_WORKFLOW.md)에 있습니다.
이는 그 안에 반드시 출하한다는 보장이 아닙니다. 검토 실행 구조를 바꾸면 실제 필요한 호출 수도
달라지므로 이 상한 안에서 다시 산정해야 합니다. CLI 호출 수는 내부 요청 수, 구독 한도 비율,
금액과 같지 않습니다. 추가 크레딧·API 과금·대체 모델을 사용하지 않습니다.
