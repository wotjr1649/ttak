# Claude 조회 인계185 — 로컬 통과, native 영수증 형식에서 실패

후보 `0.2.0-rc.13+codex.20260913221251` / `ttak-handoff185`, runtime33파일.
**CLOSED/RESTORED, 전체 Go 목표 active / No-Go**다.

정상 Claude 결과 조회에 단계별 next_step을 자동 제공했다. fact 뒤에는 final 등록
도구/인수를 제시하고 등록 응답의 Agent를 실행하도록 구분한다. MCP cache와 hook의
실제 상태가 각각 이를 재계산한다. 공개3필드·모든 도구 schema/기존 native recipe,
Codex 경로와 보류/assessment, 영수증/원문/revision/미등록 packet 거부는 유지한다.
writing-for-agents에 따라 분기 안내를 해당 결과를 읽는 지점에 두었다.

집중30PASS/5FAIL→36PASS, 전달 통합44PASS, 최종 **Node856/Python81/conformance PASS**,
공식 plugin·skill/marketplace·helper12/26구문·local resume PASS다.
초기 집중34/1의 상태 전제 오류와 전체852/4의 fact 조회 생략 fixture 실패를 보존했다.
최종 fixture는 실제 조회를 수행하고, revision 검사는 이미 받은 응답으로, 만료 검사는
미소모 cache로 수행해 다른 거부 원인에 가려지지 않게 했다.

정상 양쪽 설치/활성화·33파일/11hook 대조 후 Haiku probe는39479ms exit0이지만 FAIL이다.
실제 fact child는3문장 결과를 제출하고 그 짧은 영수증을 언어 없는 단일 코드 블록으로
감싸 반환했다. 블록 내부 JSON은 제출된 receipt_text와 정확히 같다.
현재 parser는 bare JSON 또는 json-labelled fence만 읽으므로 SubagentStop에서 실패했다.
상태는 fact launched/submitted:true, spawn_confirmed:false, reply_sha256:null이다.
부모 결과 조회도 거부돼 새 next_step과 final verifier/승인된 전달은 모두 UNRUN이다.
저장 attempt/state는 unavailable, final:null/final SHA:null, Stop continue:false다.
감사 SHA `90f428f346f2dd76258c79e8cf06f14544d0ce1bc27c1d75fced47c1ac81196c`.

새 배정 native6/관리8(원복2)/내부44, 실제 **native3/관리8(원복2)/child1**,
**7완료응답/163913tokens =161133입력+2780출력**, thinking1750은 출력 부분집합이다.
누적 **1096 =Claude647 +Codex449**. 남은 Codex probe/양쪽 simple3행은 UNRUN,
다른6회는 처음부터 미배정이다. 관측된 미완료 응답은 없다.
소유 process0·원래 plugin 선택·후보 비활성·자체 ON2파일 원상부재와 current/frozen33파일
일치를 확인했다. 근거는 `.superpowers/release-loop-185/`다.

다음은 단일 compact receipt의 표현 형식 호환성을 검토한다. 추가 문장/다중블록이나
변조된 receipt를 추출해 통과시키지 않으며, 필드·challenge·실제 제출 hash·미조회 상태·
후보/본문 결합과 한도는 유지한다.185 실패는 재개하지 않는다. 새 인계의 정상 native
입증과 모든 기존 H/Q·실패/취소/재개·네 기능/혼합·192subjects/516requests는 계속 OPEN이다.
