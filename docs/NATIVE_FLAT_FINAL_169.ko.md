# 동일9검사의 flat 제출169: Haiku 교정 흐름 통과, Luna 시간 초과

후보 `0.2.0-rc.13+codex.20260913125553` / `ttak-flat169`은 CLOSED/RESTORED다.
전체 Go는 미완료이며 목표는 active다. 기존 제품 범위·H/Q·원래192 subjects/516 requests를 유지한다.

## 변경과 로컬 근거

168의 실제 final 검증자는3개 중첩 검사 객체를 잘못 직렬화했고 거부 후4-turn에서 멈췄다.
169는 같은9개 검사를 최상위 도구 필드로 노출한다. 각 필드는 여전히 필수이며 pass 또는
유효한 issue indices다. compiler는 정확한9개를 기존3개 그룹으로 일대일 구성한 뒤 원래
검증/인코딩을 사용한다. 기존 strict grouped 입력은 호환되지만 혼합·누락·추가·강제 변환은
거부한다. 이미 거부된168 입력을 사후 복구하거나 승인하지 않는다.

9개 검사 의미·모든 issue 참조·7필드 결과·review당400bytes·issue16·fresh native 검증·
실제 결과 조회·교정 횟수·Stop을 보존했다. hook/MCP/skill 본문은 바꾸지 않았다.
신규6검사와 양 host 실제 hook/MCP/native-file parser/Stop 경로1검사를 추가했다.
RED222PASS/4FAIL → 최초 GREEN225PASS/1FAIL(기존 preview 문구 단언) → 최종227PASS/0skip.
문구 단언만 새 필드 표현에 맞췄으며 preview 소진·400bytes·공격 문자열 비승격은 유지했다.
qualified **Node72파일/761PASS/0skip, Python79, conformance PASS**.
helper9검사/24syntax, skill·marketplace·local resume PASS. generic validator 기존 비호환
UNRUN은 과거 FAIL과 함께 보존한다. runtime34파일 고정·정상 설치·11hook 검토·활성화 PASS.

## 실제 Haiku calibration

167/168과 동일한 원문과 오류안을 썼다. 최초 오류안이 변경 없이 독립 final에 들어갔고,
검증자는 실제 flat 결과로 “읽기가 값을0으로 바꾼다”는 모순을 보류했다. 부모는 실제 결과를
조회하고 한 번 정정했으며, 새 검증자의 complete 결과와 정확한 최종 본문·Stop까지 완료했다.
88075ms/exit0, fresh verifier3, 완료 응답19, **457036 tokens**를 native terminal과 대조했다.
completion 감사 SHA `51e79c254882e5385780400339befcb3161fc3279cdbc2e2afe7a7723bc34325`.

최종 본문은 두 문장으로 두 읽기와 최종 저장값이7임을 정확히 설명한다. **배정된 짧은
교정 흐름 경계만 PASS**다. 오류 issue 인용은 `to0`/`remains0`에 공백을 추가했고,
final-only 오류를 일부 fact-review 항목에도 연결했다. 이 인용 정밀도·항목 연결은 OPEN으로
남긴다. 모든9개 보고 항목의 정확성이나 전체 출하 합격을 인증하지 않는다.

## 실제 Luna calibration

fact answered와 최초 오류안의 유효한 withheld·실제 결과 조회까지 통과했다. 오류 인용은
이번에는 원문 그대로다. 부모가 정정본 revision1을 등록했지만, 새 dispatch·검증자 시작 전에
120015ms timeout이 발생했다. 정정본 final slot은 planned, attempt는 pending이다.
정정본 검증·부모 최종 전달·Stop은 UNRUN이다. 기존2child는 모두 완료·wait·close됐고
전체 Job cleanup·active process0을 확인했다. 결과 없는 작업을 재개/재배정하지 않았다.

frozen compiler로 실제 두 native 제출·반환·조회와 정정본 등록까지 재생해 retained와
대조했다. failure 감사 SHA `3d6b000f598cf032955a014ef6285b33a5e2cee202fef1fa5a5c336ca891b500`.
부모7+child2+2=완료 응답11, **217892 tokens**를 native 기록과 checkpoint의 누적값으로
대조했다. timeout이므로 미관측 in-flight 사용량 가능성은 남는다. Luna도 final-only 오류를
일부 fact-review 항목에 연결했으므로 항목별 정확성은 별도 OPEN이다.

부모 code call7개는 도구 탐색2, prepare1, fact 검증 절차1, 최초 final 등록1,
최초 final 검증 절차1, 정정본 등록1이었다. 최초 final 등록 응답에서 다음 검증 실행 호출까지
**13317ms**가 있었다. 이 간격은 관측 사실이지 제거할 수 있는 총시간이나 개선 보장은 아니다.

## 장부·복원·다음 작업

새 배정 native12/관리8(복원2)/내부 최대88, 실제 **4/8(복원2)/5**. 후속8 UNRUN.
완료 응답30, input661813/output13115=**674928 tokens**, thinking6245는 output부분집합.
누적 **1045(Claude626/Codex419)**. 두 프로필의 기존 선택을 정상 복원하고 후보를 비활성화했다.
배치 소유 ON 파일2만 이전 부재 상태로 돌리고 evidence/cache는 보존했다.
중간 OFF 제거 시험은 하지 않았다. Job 정리는 native interrupt/cancel 근거가 아니다.
원래 복합 양 host·정상·보류·재개와 전체192/516 등 필수 Go 조건은 미완료다.

다음은 Codex의 최종안 등록과 기존 dispatch/spawn/wait/close/read recipe 사이 부모 handoff를
줄이는 변경이다. 같은 원문·제안·fresh 독립 검토·실제 결과 조회·실패 중단·한도를 유지한다.
새 후보의 실제 완료로 반증하며, 인용·항목 연결 잔여 문제도 계속 열린 상태로 관리한다.
