# Fact 판정 범위168: 사실 단계 통과, 중첩 최종 제출 실패

후보 `0.2.0-rc.13+codex.20260913123742` / `ttak-factscope168`은 CLOSED/RESTORED다.
전체 목표는 active / No-Go다. 필수 Go 조건이나 원래192 subjects/516 requests를 바꾸지 않았다.

## 수정과 검증

167의 fact는 정답7,7,7을 도출하고도 오류 인용문을 미해결 conflict로 분류했다.
168은 기존 fact schema의 verdict/issues 설명과 request-wide packet 지시3곳만 고쳤다.
확정 가능한 정정과 실제 필요한 입력·관측의 부재를 구분한다. 필드·enum·7필드 결과·
hash·순서·독립성·교정·Stop을 바꾸지 않으며 conflict를 answered로 승격하지 않는다.

새5검사 포함 집중 RED219PASS/1FAIL →220PASS/0skip, qualified Node71파일/754PASS/0skip,
Python79 및 conformance PASS. helper9검사/23syntax, skill·marketplace·local resume PASS.
generic plugin validator는 기존 host MCP 경로 비호환 UNRUN을 보존한다.
runtime34파일 고정, 정상 설치·11hook 정확한 파일/명령/해시 검토·양쪽 활성화 PASS.

## 실제 calibration

167과 동일한 전체 calibration JSON을 사용했다. 원래 오류안을 수정하지 않고 최초
독립 final 검토에 넣고, 실제 판정 후에만 허용된 교정을 하도록 하는 공개 가상 진단이다.
prompt SHA `618695971de468dd23657abc411dc9d2bf5e4c24439878a1aba50b419d700426`.

실제 Haiku fact는 7,7,7과 인용 초안의 정정을 `answered`, issues빈배열로 반환했고
부모가 실제 결과를 조회했다. 변경 없는 오류안, 원문과 실제 fact가 fresh final 검증자에게
전달됐다. 검토 본문이 마지막 field인167 배치도 실제 전달됐다. 이것은 이번 행의
fact 판정·입력 전달 근거이며 일반적인 의미 정확성이나 오류 검출 합격은 아니다.

최종 검증자는 `revise_explanation`을 선택하려 했지만 `requirement_review`에
`<parameter name="essential_requirements">[0]` 조각을 문자열로 넣고 다른 필드를
누락/잘못 배치했다. 잘못된 final 제출3회는 모두 guard가 거부했다. 이후 기존4-turn
한도에 도달해 보고서 없이 멈췄다. 부모의 “resource limit” 설명은 즉시 원인인
잘못된 도구 입력을 놓친다. 결과 없는 child를 재개하거나 다시 배정하지 않았다.

**유효한 final 판정·최종 결과 조회·교정·완료 전달은 UNRUN**이다. 잘못된 입력의
`revise_explanation`을 의미 거절 PASS로 세지 않는다. CLI success/exit0이어도
retained unavailable, final submittedfalse/replynull, 논리 Stop1 `continue:false`다.
frozen compiler로 실제 fact 제출·receipt·조회와 final 등록·발급·전달을 재생해 retained와
일치시켰다. 실패 감사 SHA:
`6e00c2912c26e71e60f030f013a48a861d3963b954b6530d3924d5c550009673`.

## 장부와 다음 수정

새 배정 native12/관리8(복원2)/내부 최대88, 실제3/8(복원2)/2, 후속9 UNRUN.
Haiku67929ms/exit0, 모든 Job cleanup 확인·active process0. 완료 모델 응답13,
input275063/output5576=**280639 tokens**, thinking3030은 output부분집합이다.
native terminal과 대조했으며 in-flight 불확실성은 없다. 누적 **1041(624/417)**.
기존 프로필 선택을 정상 복원하고 후보를 비활성화했다. 배치 소유 ON 파일2만 이전
부재 상태로 돌렸으며 evidence/cache는 보존했다. 중간 OFF 제거 시험은 하지 않았다.
Job 정리는 native interrupt/cancel 증거가 아니다. 원래 복합 양 host·정상·보류·재개와
전체192/516을 포함한 필수 출하 조건은 여전히 미완료다.

다음은 동일한9개 검사와 issue 연결을 중첩 없이 제출하는 입력 표현을 조사한다.
이미 거부된 제출을 사후 정규화해 승인하지 않으며, 결과 의미·모든 검사·한도·guard를
유지한 새 후보를 로컬 검증한 뒤 별도 배치로 실제 실행한다.
