import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { writeFileSync } from 'fs';

const ACCENT = '00D4AA';
const DARK = '1a1a1a';

function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text, bold: true, size: 32, font: 'Arial' })] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 160 }, children: [new TextRun({ text, bold: true, size: 26, font: 'Arial', color: ACCENT })] }); }
function h3(text) { return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, bold: true, size: 22, font: 'Arial' })] }); }
function p(text) { return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 21, font: 'Arial' })] }); }
function bullet(text, bold) {
  const children = [];
  if (bold) { const [b, ...rest] = text.split(': '); children.push(new TextRun({ text: b + ': ', bold: true, size: 21, font: 'Arial' }), new TextRun({ text: rest.join(': '), size: 21, font: 'Arial' })); }
  else { children.push(new TextRun({ text, size: 21, font: 'Arial' })); }
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children });
}
function makeTable(headers, rows) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map(h => new TableCell({ borders, shading: { fill: 'F0F0F0' }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, font: 'Arial' })] })] })) }),
      ...rows.map(row => new TableRow({ children: row.map(cell => new TableCell({ borders, children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 20, font: 'Arial' })] })] })) }))
    ]
  });
}

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      // Title Page
      new Paragraph({ spacing: { before: 2000 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PACT Protocol', bold: true, size: 52, font: 'Arial', color: ACCENT })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'Protocol for Agent Content Transfer', size: 28, font: 'Arial', color: '666666' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Project Report', size: 24, font: 'Arial' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: '의생명융합공학부 (Department of Biomedical Convergence Engineering)', size: 20, font: 'Arial', color: '888888' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: '2026-03-17', size: 20, font: 'Arial', color: '888888' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Version 1.0', size: 20, font: 'Arial', color: ACCENT })] }),

      // 1. Overview
      h1('1. 프로젝트 개요 (Project Overview)'),
      p('PACT (Protocol for Agent Content Transfer)는 AI 에이전트에게 구조화된, 토큰 효율적인 콘텐츠를 제공하는 개방형 프로토콜입니다. 웹사이트가 HTML을 통해 사람에게 콘텐츠를 제공하듯, PACT는 AI 에이전트에게 최적화된 구조화 데이터를 직접 전달합니다.'),
      p('AI 에이전트가 기존 HTML 페이지를 스크래핑할 경우, 네비게이션, 광고, CSS, JavaScript 등으로 인해 실제 데이터의 약 2%만이 유용한 정보이며 98%는 낭비됩니다. PACT는 이 문제를 해결하여 HTML 대비 57배의 토큰 효율을 달성합니다.'),
      h3('핵심 수치'),
      makeTable(['항목', '수치'], [
        ['토큰 효율', 'HTML 대비 57배'],
        ['SDK 패키지', '8개 (TypeScript) + Python SDK'],
        ['적합도 등급', '4단계 (L1~L4)'],
        ['표준 도메인', '12개'],
        ['테스트', 'Node.js 43개 + Python 84개 = 127개 전체 통과'],
      ]),
      h3('5-Layer Architecture'),
      makeTable(['Layer', '이름', '목적'], [
        ['0', 'Discovery', '/.well-known/pact.json으로 자동 발견'],
        ['1', 'Schema', 'pact:domain/type@version 스키마 식별'],
        ['2', 'Data', '구조화된 JSON 응답 (키 압축 + 테이블 레이아웃)'],
        ['3', 'Media', '이미지/비디오 URL 포인터 (선택적 다운로드)'],
        ['4', 'Actions', '구매/예약/구독 등 트랜잭션 액션'],
      ]),

      // 2. Technical
      h1('2. 기술 구현 (Technical Implementation)'),
      p('프로젝트는 npm workspaces 기반 모노레포로 구성되며, TypeScript ESM, Node.js 22 환경에서 개발되었습니다.'),
      h3('패키지 구성'),
      makeTable(['패키지', '설명'], [
        ['@pact-protocol/core', 'Schema registry, key compression, envelope, discovery 핵심 라이브러리'],
        ['@pact-protocol/validator', 'JSON 검증, 적합도 등급 판정, CLI'],
        ['@pact-protocol/server', 'Express 미들웨어, 콘텐츠 협상, 속도 제한'],
        ['@pact-protocol/client', 'AI 에이전트 SDK, 자동 디스커버리, 캐시 TTL'],
        ['@pact-protocol/mcp-bridge', 'MCP (Model Context Protocol) 서버 브릿지'],
        ['@pact-protocol/next-plugin', 'Next.js 프레임워크 통합 플러그인'],
        ['@pact-protocol/llmstxt2pact', 'llms.txt → PACT 변환기'],
        ['@pact-protocol/schema2pact', 'Schema.org → PACT 스키마 변환기'],
      ]),
      bullet('Python SDK: pact-python — 84개 테스트 통과', true),
      bullet('Shopify Plugin: plugins/shopify/pact-proxy.js — GraphQL 변수 기반 보안 쿼리', true),

      // 3. Security
      h1('3. 보안 수정 사항 (Security Fixes)'),
      p('5개 에이전트 병렬 보안 감사를 통해 5개 Critical + 3개 Major 이슈를 발견하고 전부 수정하였습니다.'),
      h3('Critical Issues'),
      makeTable(['#', '이슈', '수정 내용', '파일'], [
        ['C-1', '스펙-코드 불일치', 'mapping/fields → keys 구조로 스펙 통일', 'spec/pact-v1.0.md'],
        ['C-2', '비표준 도메인', '12개 표준 도메인으로 확장', 'spec/pact-v1.0.md'],
        ['C-3', 'GraphQL 인젝션', 'GraphQL 변수 사용 + fetchProductById', 'plugins/shopify/pact-proxy.js'],
        ['C-4', 'SSRF 취약점', 'URL 프로토콜 검증 (http/https만 허용)', 'client.ts, server.ts'],
        ['C-5', 'Prototype Pollution', 'isSafeKey() 가드 (__proto__ 차단)', 'key-compressor.ts'],
      ]),
      h3('Major Issues'),
      makeTable(['#', '이슈', '수정 내용'], [
        ['M-1', '배치 성능', 'Map 1회 빌드 후 N개 아이템 재사용'],
        ['M-3', '캐시 무한', 'Discovery 캐시 TTL 추가 (기본 5분)'],
        ['M-4', '에러 응답 포맷', 'PactErrorResponse 타입 + res.pactError() 헬퍼'],
      ]),

      // 4. Website
      h1('4. 웹사이트 (Website)'),
      p('프리미엄 다크 테마 웹사이트를 구축하였습니다. 총 4개 페이지 × 2개 언어(영어/한국어) = 8개 HTML 파일.'),
      h3('페이지 구성'),
      makeTable(['페이지', '영어', '한국어', '기능'], [
        ['메인', 'index.html', 'ko.html', '히어로, 아키텍처, 비교, 바이오메디컬, 도메인 카드'],
        ['문서', 'docs/index.html', 'docs/ko.html', '스펙 요약, 사이드바 네비게이션, 스크롤 스파이'],
        ['플레이그라운드', 'playground/index.html', 'playground/ko.html', 'JSON 실시간 검증, 적합도 판정, 예제'],
        ['점수', 'score/index.html', 'score/ko.html', '도메인 AI 준비도 점수, 수동 검사'],
      ]),
      h3('디자인 특징'),
      bullet('글래스모피즘 네비게이션 바 (backdrop-filter: blur)', false),
      bullet('3색 그래디언트 애니메이션 (teal #00d4aa + purple #7c5cfc + pink #ff6b9d)', false),
      bullet('파티클 캔버스 (분자/네트워크 시각화, 마우스 인터랙션)', false),
      bullet('macOS 스타일 터미널 데모 (임상시험 데이터 실시간 시연)', false),
      bullet('스크롤 애니메이션 (IntersectionObserver 기반 fade-in)', false),
      bullet('카운트업 숫자 애니메이션, 호버 글로우 효과', false),

      // 5. Demo
      h1('5. 데모 사이트 (Demo Site)'),
      p('ClinicalTrials.gov의 구조에서 영감을 받아, 한국 병원 기반 가상 임상시험 데이터 8건으로 PACT vs HTML 실시간 비교 서버를 구축하였습니다.'),
      p('참고: 데모 데이터는 합성 데이터이며, ClinicalTrials.gov (clinicaltrials.gov)의 구조를 참고하여 작성되었습니다.'),
      h3('포함된 임상시험 데이터'),
      makeTable(['NCT ID', '제목', '기관', '상태'], [
        ['NCT06012345', 'Phase III 당뇨병 예방 임상시험', '서울대학교병원', '모집 중'],
        ['NCT06023456', 'AI 유도 유방암 스크리닝', '삼성서울병원', '모집 중'],
        ['NCT06034567', 'mRNA 췌장암 백신', 'Moderna + 연세 세브란스', '진행 중'],
        ['NCT06045678', '웨어러블 ECG 부정맥 감지', '아산병원', '모집 중'],
        ['NCT06056789', '줄기세포 척수손상 치료', '고려대 안암병원', '모집 중'],
        ['NCT06067890', '디지털 치료제 불면증 (CBT-I)', 'KAIST + Somnia Health', '완료'],
        ['NCT06078901', 'CAR-T 세포치료 B세포 림프종', '국립암센터', '진행 중'],
        ['NCT06089012', '장내 미생물 비만 조절', '서울대 분당병원', '모집 중'],
      ]),
      h3('비교 결과'),
      makeTable(['형식', '토큰 수', '비율'], [
        ['HTML 페이지', '~2,500 토큰', '기준'],
        ['PACT 응답 (객체)', '~170 토큰', '15x 절감'],
        ['PACT 응답 (테이블)', '~120 토큰', '21x 절감'],
        ['실제 ClinicalTrials.gov API', '~45,000 토큰 (5건)', '참고'],
      ]),

      // 6. Biomedical
      h1('6. 의생명 활용 (Biomedical Applications)'),
      p('PACT 프로토콜은 의생명융합공학 분야에서 특히 높은 활용 가치를 가집니다. AI 에이전트가 의료 데이터를 정확하고 효율적으로 소비해야 하는 다양한 시나리오에 적용 가능합니다.'),
      bullet('임상시험 레지스트리: AI 의료 어시스턴트가 환자 조건에 맞는 임상시험을 자동 검색', true),
      bullet('약물 상호작용 DB: AI 약사가 처방 약물 간 상호작용을 실시간 확인', true),
      bullet('의료기기 카탈로그: 구조화된 스펙으로 AI가 적합한 기기를 추천', true),
      bullet('유전체 변이 포털: 14만건+ 변이 데이터를 테이블 모드로 토큰 효율적 전송', true),
      bullet('병원 API 게이트웨이: AI 트리아지 에이전트가 진료 예약/검사 결과 접근', true),
      bullet('FHIR-to-PACT 브릿지: 기존 FHIR 서버 위에 PACT 레이어로 AI 최적화', true),

      // 7. Tests
      h1('7. 테스트 결과 (Test Results)'),
      makeTable(['테스트 항목', '결과', '세부'], [
        ['TypeScript 빌드', '9/9 PASS', '모든 패키지 컴파일 성공'],
        ['Node.js E2E', '43/43 PASS', '스키마, 압축, 서버, 클라이언트, 보안 테스트 포함'],
        ['Python 테스트', '84/84 PASS', 'pact-python SDK 전체'],
        ['보안 감사', 'ALL PASS', '5개 파일 감사, 새 취약점 없음'],
      ]),

      // 8. Competitive
      h1('8. 경쟁 분석 (Competitive Analysis)'),
      makeTable(['기술', 'PACT와의 차이'], [
        ['REST API', '자동 발견 없음, 사이트마다 형식 다름, 토큰 최적화 없음'],
        ['Schema.org', 'HTML 마크업일 뿐, 직접 데이터 전송이 아님'],
        ['FHIR', '의료 전용, AI 토큰 최적화 미고려, 복잡한 구조'],
        ['MCP', '도구 제공 프로토콜 — PACT는 콘텐츠 전달 (다른 레이어)'],
        ['A2A', '에이전트 간 통신 — PACT는 사이트→에이전트 (다른 레이어)'],
        ['GraphQL', '개발자가 쿼리 작성 필요, 범용 스키마 없음'],
      ]),
      h3('채택 리스크'),
      bullet('pact.io 이름 충돌: Contract testing 프레임워크 Pact와 혼동 가능', true),
      bullet('빅테크 후원 부재: sitemap.xml(Google) 같은 킬러 수요자 아직 없음', true),
      bullet('치킨-에그 문제: 사이트가 안 만들면 에이전트가 안 쓰고, 에이전트가 안 쓰면 사이트가 안 만듦', true),

      // 9. Future
      h1('9. 향후 계획 (Future Plans)'),
      bullet('W3C/AAIF 표준 제출을 위한 거버넌스 모델 수립', false),
      bullet('WordPress/Shopify 플러그인 자동 생성으로 풀뿌리 채택', false),
      bullet('주요 AI 회사(Anthropic, OpenAI)와 파트너십으로 네이티브 지원', false),
      bullet('FHIR-to-PACT 브릿지 개발 (의생명 분야 킬러 앱)', false),
      bullet('pact:health/* 도메인 스키마 확장 (DICOM, HL7, LOINC 매핑)', false),
      bullet('Agent Identity 표준 (v1.1) — 에이전트 신원 검증 메커니즘', false),
    ]
  }]
});

const buffer = await Packer.toBuffer(doc);
writeFileSync('/home/yoo122333/project/pact-protocol/docs/PACT_Project_Report.docx', buffer);
console.log('Report generated: docs/PACT_Project_Report.docx');
console.log('Size:', Math.round(buffer.length / 1024) + ' KB');
