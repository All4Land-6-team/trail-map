import test from 'node:test';
import assert from 'node:assert/strict';
import { parseParkControl, loadParkControl } from '../src/api/parkControls.ts';
const response = () => ({success:true, data:{courseId:1,mountainKey:'bukhansan',coverage:'OFFICE_REGION',availability:'AVAILABLE',office:{
 sourceRecordId:'0019',name:'북한산사무소',status:'PARTIAL',collectionState:'READY',stale:false,
 sourceAsOf:'2026-10-18T14:06:00Z',checkedAt:'2026-11-03T10:00:00Z',detailFetchedAt:null,
 reason:'산사태',restrictedSection:'구천계곡',restrictionPeriodText:null,contentText:'안내',contact:null,
 sourceUrl:'https://www.knps.or.kr/front/portal/safe/acsCtrDtl.do?rstId=0019',assets:[]}}});
test('코스와 산이 다른 응답을 거부한다', () => {
 assert.equal(parseParkControl(response(),1,'bukhansan').office.status,'PARTIAL');
 assert.throws(()=>parseParkControl(response(),2,'bukhansan'));
 assert.throws(()=>parseParkControl(response(),1,'dobongsan'));
 const r=response();r.data.availability='UNSUPPORTED';r.data.mountainKey=null;r.data.office=null;
 assert.equal(parseParkControl(r,1,'bukhansan').availability,'UNSUPPORTED');
});
test('미수집, 오래된 자료, 오류를 정상으로 대체하지 않는다', () => {
 const r=response();r.data.office.stale=true;r.data.office.collectionState='ERROR';
 assert.equal(parseParkControl(r,1,'bukhansan').office.collectionState,'ERROR');
 r.data.availability='MISSING';r.data.office=null;
 assert.equal(parseParkControl(r,1,'bukhansan').availability,'MISSING');
});
test('안전하지 않은 링크와 잘못된 날짜를 거부한다', () => {
 const r=response();r.data.office.sourceUrl='javascript:alert(1)';assert.throws(()=>parseParkControl(r,1,'bukhansan'));
 const d=response();d.data.office.checkedAt='not a date';assert.throws(()=>parseParkControl(d,1,'bukhansan'));
});
test('저장된 데이터만 API로 조회하며 실패를 전달한다', async t => {
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async(url,options)=>{assert.match(url,/courses\/1\/access-control$/);assert.equal(options.cache,'no-store');return Response.json(response());};
 assert.equal((await loadParkControl(1,'bukhansan',new AbortController().signal)).office.reason,'산사태');
 globalThis.fetch=async()=>new Response('',{status:500});
 await assert.rejects(loadParkControl(1,'bukhansan',new AbortController().signal));
});

test('부분통제 카드와 정상 요약을 사무소 상태에 맞게 렌더링한다', async () => {
 const { createServer } = await import('vite');
 const { createElement } = await import('react');
 const { renderToStaticMarkup } = await import('react-dom/server');
 const server = await createServer({server:{middlewareMode:true,watch:null,hmr:false},appType:'custom'});
 try {
   const { CourseControl } = await server.ssrLoadModule('/src/pages/CourseDetailPage/components/CourseControl.tsx');
   const r = response();
   const render = () => renderToStaticMarkup(createElement(CourseControl, {state:{status:'success',data:r.data}}));
   r.data.office.assets = [{kind:'INLINE', name:'구간 지도', sourceUrl:'https://www.knps.or.kr/image', imageUrl:'https://example.com/saved.png'},
     {kind:'ATTACHMENT', name:'3.구천계곡 부분통제.jpg', sourceUrl:'https://www.knps.or.kr/file', imageUrl:'https://example.com/file.jpg'}];
   assert.match(render(), /구천계곡/); assert.match(render(), /src="https:\/\/example.com\/saved.png"/);
   r.data.office.assets.push({kind:'ATTACHMENT',name:'공고.pdf',sourceUrl:'https://www.knps.or.kr/notice',imageUrl:null});
   assert.doesNotMatch(render(), /첨부파일|부분통제\.jpg|공고\.pdf|www\.knps\.or\.kr\/(file|notice)/);
   assert.doesNotMatch(render(), /이미지를 불러오지 못했어요/);
   assert.doesNotMatch(render(), /다시 조회/);
   assert.doesNotMatch(renderToStaticMarkup(createElement(CourseControl, {state:{status:'error',message:'실패'}})), /다시 조회|<button/);
   r.data.office.status = 'NORMAL'; assert.doesNotMatch(render(), /구천계곡|saved.png/);
   r.data.office.stale = true; assert.match(render(), /마지막 수집 당시/);
   r.data.availability = 'MISSING'; r.data.office = null; assert.match(render(), /아직 수집하지 않았어요/);
   r.data.availability = 'UNSUPPORTED'; assert.match(render(), /지원하지 않아요/);
 } finally { await server.close(); }
});
