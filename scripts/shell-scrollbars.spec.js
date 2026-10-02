const {test,expect}=require('@playwright/test');
test('desktop shell keeps three independent right-edge vertical scroll owners',async({page})=>{
 await page.setViewportSize({width:1536,height:864});
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
 const r=await page.evaluate(()=>{
   const rail=document.getElementById('module-rail'),panel=document.getElementById('module-panel-links'),work=document.querySelector('.main-surface');
   const cs=x=>getComputedStyle(x);
   const railChild=rail.firstElementChild,panelChild=panel.firstElementChild,workChild=work.firstElementChild;
   return {
    bodyOverflowY:cs(document.body).overflowY,
    rail:{overflowY:cs(rail).overflowY,direction:cs(rail).direction,childDirection:railChild?cs(railChild).direction:null},
    panel:{overflowY:cs(panel).overflowY,direction:cs(panel).direction,childDirection:panelChild?cs(panelChild).direction:null},
    work:{overflowY:cs(work).overflowY,direction:cs(work).direction,childDirection:workChild?cs(workChild).direction:null,height:cs(work).height}
   };
 });
 expect(r.bodyOverflowY).toBe('hidden');
 for(const x of [r.rail,r.panel,r.work]){expect(x.overflowY).toBe('auto');expect(x.direction).toBe('ltr');expect(x.childDirection).toBe('rtl')}
 expect(parseFloat(r.work.height)).toBeGreaterThan(800);
});
