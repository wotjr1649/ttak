# 승인된 전달 출처184 — Luna 경계 통과, Haiku 등록 순서 실패

후보 `0.2.0-rc.13+codex.20260913213925` / `ttak-delivery184`, runtime33파일.
**CLOSED/RESTORED, 전체 Go 목표 active / No-Go**다.

완료된 설명의 Stop 안내만 실제 `explanation_result.delivery.final_text`를 가리키도록
변경했다. legacy full-result 반환은 검토 packet의 literal 본문 경로로 구분했다.
보류 안내, 정확한 본문/SHA, 실제 영수증, 독립 검증, 교정1회와 실패 거부는 동일하다.
writing-for-agents에 따라 모델이 복사할 출처를 바로잡았다.

초기 집중52PASS/1FAIL→53PASS, 첫 전체848PASS/1FAIL(legacy 안내 전제)을 보존했다.
추가한 legacy packet 검사에서 공개 launch prompt와 실제 packet 본문/해시를 혼동한
테스트 오류 두 건도 각각141PASS/1FAIL로 보존했다. 최종 집중142PASS/0skip,
**Node82files849PASS/0skip, Python81/conformance PASS**, 공식 plugin·skill·marketplace,
helper12/27구문·local resume PASS다. 정상 양쪽 설치/활성화와33파일/11hook 대조를 마쳤다.

## 실제 판정

Luna probe는83397ms, 두 fresh verifier와 실제 결과 조회를 완료했다.
첫 final은 승인된2문장 앞에 시험 표지를 정확히 붙였고 Stop이 block했다.
이어 도구/검증을 반복하지 않고 승인 본문만 그대로 전달해 두 번째 Stop이 completed다.
fact와 최종 본문은 한 정수·읽기 반환·초기7·두 읽기의7과 보존되는7을 올바르게 설명한다.
전달 SHA `8cb30eb7a48cefdfa19df32a905946af4dc4b5d18df7ae6149048dc3ee28a242`.
감사 SHA `3bbba3f65e9f4bffb8de2bbc6720416428e3fa2dad7038e1006cc22f9e1edbeb`.
9완료응답/130807tokens다. 이 합성 경계 probe는 원래 비교 subject나 품질 개선이 아니다.

Haiku는58029ms exit0이지만 두 permission denial로 FAIL이다.
실제 fact child와3필드 결과 조회는 완료했다. 이후 final 등록 전에 Agent를 호출하며
packet challenge 대신 후보 digest를 `TTAK:` 뒤에 넣었다. 정상 Pre의 unknown packet
거부 뒤에도 final 등록을 시도해 다시 거부됐다. 실제 final verifier와 승인된 전달,
전달 교정 경계는 UNRUN이다. 상태는 fact returned/answered, final:null, final SHA:null,
attempt/state unavailable이며 Stop continue:false다.
실제 native 체인→조회→거부 재생이 저장된 attempt와 일치한다. 실패 보고에는 미승인
본문의 실질적 요약이 포함돼 실패 시 본문 보류의 품질 통과도 주장하지 않는다.
감사 SHA `cc0a301ac0c874c762700a0c314053b17d9aa5f2f08046e0d4dee95f82f4d15d`.
9완료응답/232810tokens다. 거부된 Agent는 child가 시작되지 않았으며 부모 응답 사용량은 포함했다.

## 정산과 다음 수정

배정 native6/관리8(원복2)/내부44, 실제 native4/관리8(원복2), 내부 Agent 시도4 중
실제 child3·시작 전 거부1이다. **18완료응답/363617tokens =356252입력+7365출력**,
thinking3395는 출력 부분집합이다. 관측된 미완료 응답은 없다.
누적 **1093 =Claude645 +Codex448**. 원래 simple 대조2행은 후속 UNRUN이며,
다른6 native상한은 처음부터 미배정이었다. 이전183 예약·미사용량을 재사용하지 않았다.

소유 process0, 원래 plugin 선택, 후보 비활성, 자체 ON2파일 원상부재와
current/frozen33파일 일치를 확인했다. 근거는 `.superpowers/release-loop-184/`다.
다음은 정상 Claude 결과 조회에 실제 단계별 다음 도구/인수를 제공하고 hook이 독립적으로
그 내용을 대조하는 수정이다. 후보 해시를 새 packet으로 오인하거나 등록을 건너뛰는
전이를 허용하지 않는다.184는 재개하지 않는다. 실패 본문 보류·recipe/cache·calibration·
복잡/새 사례/반복·실패/취소/재개·네 기능/혼합·192subjects/516requests는 계속 OPEN이다.
