# source별 issue 영역178 — 정상 최초 조회 관측, 교정 검증 시간 초과

후보 `0.2.0-rc.13+codex.20260913184556` / `ttak-domains178`, runtime34파일.
**CLOSED/RESTORED, 전체 Go 목표 active / No-Go**다. 같은 후보의 후속9행은 UNRUN이다.

## 변경과 로컬 근거

최종 검토의 public 입력을 final/request의 `issues`와 actual fact의 `fact_issues`로
분리했다. 인덱스는 해당 영역 안에서만 유효하며 기존 canonical 세 그룹/단일 issue
목록으로 값과 연결을 보존해 변환한다. 정확히 같은 cross-source issue만 합치며,
같은 영역 중복·미참조·범위 밖 인덱스·혼합 형식은 거부한다.
아홉 검사와 전체16개·본문/근거 한도, strict legacy parser를 유지한다.
177의 실제 native quote/target guard와 hook 파일은 byte 단위로 그대로다.

집중59PASS, Node79파일832PASS/0skip, Python79, conformance PASS.
helper12검사/29구문·skill/marketplace·로컬 resume도 PASS다.
generic plugin validator의 기존 per-host MCP 경로 비호환은 UNRUN이며 해결 과제로 남는다.

## 정상 native에서 실제로 관측한 범위

Codex `03-codex-calibration`은 원래 request와 잘못된 최초 제안을 정확히 유지했다.
독립 fact는 읽기 두 번과 최종값을7로 판정했다. 최초 final은 잘못된 변경 구절을
그대로 인용해 `issues[0]`로 제출하고, final/request 검사에만 연결했다.
`fact_issues:[]`와 fact 세 검사 pass를 실제로 사용했다. 기존 정상 reader가
native 제출·반환·인용 대상을 대조한 뒤 결과 조회를 허용했고 `correct_final`을 반환했다.
첫 두 child는 각각 실제 제출/반환/조회·wait/close를 마쳤다.

수정본 등록·dispatch·새 child 시작 및 prompt 전달까지 관측했으나 **120016ms timeout**이다.
셋째 child의 코드·MCP 제출·Pre/Post·결과·반환·wait/close는 없었다.
부모 최종 전달·Stop도 UNRUN이다. retained attempt는 pending, FINAL1 launched,
submitted:false, submission/reply/verdict:null이다. 시간 초과의 Job 종료는 native 취소 시험을
통과했다는 뜻이 아니다.

부모는 recipe도 일부 다시 작성했다. 첫 final의 delivery 비교와 두 final의 next_step
존재 검사를 생략했고, correction은 complete-only 비교로 바꿨다. 실제 receipt와 result
binding 검사는 유지했으나 **전체 recipe 준수를 입증한 것은 아니다**.

## 지연과 정산

첫 도구 탐색은 한 번이며15개 metadata/35615바이트를 반환했다. 동일 기록에서
prepare만 선택하면5742바이트다. metadata→entry17052ms, fact 조회→final15955ms,
first-final 조회→correction16299ms다. 완료된 두 waiting call은24927/29798ms로
30초 미만이며 code-mode yield/wait는 관측되지 않았다. 아직 지연 개선 주장은 없다.

새 배정 native12/관리8(원복2)/내부88 중 실제 **native3/관리8(원복2)/내부3**,
완료 응답9(부모4+fact3+first-final2), **145707 tokens =141339입력+4368출력**이다.
thinking1524는 출력의 부분집합이다. 부모 checkpoint57377에 없는 완료 응답25308을
native 원장에서 대조해 부모 총82685로 정산했다. 셋째 완료 응답0기록은 사용량0을
뜻하지 않으며 in-flight 사용량 불확실성을 유지한다.

누적 **1072 = Claude635 + Codex437**. 모든 소유 Job의 process0, 양쪽 원래 선택 복원,
후보 비활성 및 원래 없던 자체 ON 파일2개 제거, 현재/frozen34파일 해시 일치를 확인했다.
후보/cache·과거 실패·원본102/103과 전체192subjects/516requests 장부는 보존했다.

근거는 `.superpowers/release-loop-178/`의 `batch-closed.json`,
`rows/03-codex-calibration/failure-audit.json` 및 process/inspection/collected 기록이다.
실패 감사 SHA-256:
`ceaebd8268616022a08902d8b6fbbc31f8d593fe1a9f638683460e1d832597ef`.
감사기 첫 시도는 native metadata의 제품 설명 뒤940바이트 선언부를 예상하지 못해 실패했다.
원 감사기를 보존하고 정확한 제품 prefix+검토한 선언부 hash를 비교하는 새 감사기로 확인했다.
실제 모델 코드는 실행하지 않고 literal 제출과 정확한 두 줄 existence guard만 정적으로 읽었다.

다음 수정은 초기 도구 탐색 범위를 줄이는 것이다. 모든 native 검사/recipe, 모델,
120초/정리5초를 유지하고 새 후보 정상 실행으로 효과를 판별한다.
원래 H/Q, 네 기능/혼합, 양 호스트/반복/새 사례, 실제 실패·취소·재개 및192/516의
필수 근거는 여전히 부족하다. 이번 최초 조회 성공은 목표 완료가 아니다.
