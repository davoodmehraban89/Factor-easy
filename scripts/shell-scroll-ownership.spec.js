const {test,expect}=require('@playwright/test');

test('desktop shell keeps three independent right-edge vertical scroll owners',async({page})=>{
  await page.setViewportSize({width:1536,height:420});
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  const uiSrc=await page.locator('script[src^="js/ui.js"]').getAttribute('src');
  expect(uiSrc).toBe('js/ui.js?v=20261002-shell-scroll-ownership-v2');
  const result=await page.evaluate(()=>{
    const rail=document.getElementById('module-rail');
    const panel=document.getElementById('module-panel-links');
    const workspace=document.querySelector('.main-surface');
    const filler=(host,height)=>{const el=document.createElement('div');el.style.height=height+'px';el.style.minHeight=height+'px';el.textContent='scroll-test';host.appendChild(el);return el};
    const railF=filler(rail,900),panelF=filler(panel,900),workF=filler(workspace,1300);
    const snapshot=()=>({
      rail:rail.scrollTop,panel:panel.scrollTop,workspace:workspace.scrollTop,
      railDir:getComputedStyle(rail).direction,panelDir:getComputedStyle(panel).direction,workspaceDir:getComputedStyle(workspace).direction,
      railChildDir:getComputedStyle(rail.querySelector('.module-tab')).direction,
      panelChildDir:getComputedStyle(panelF).direction,workspaceChildDir:getComputedStyle(workspace.querySelector('.workspace-context')).direction,
      railOverflow:getComputedStyle(rail).overflowY,panelOverflow:getComputedStyle(panel).overflowY,workspaceOverflow:getComputedStyle(workspace).overflowY,
      bodyOverflow:getComputedStyle(document.body).overflowY,rootOverflow:getComputedStyle(document.documentElement).overflowY,
      documentScrollable:document.scrollingElement.scrollHeight>document.scrollingElement.clientHeight,
      railRect:rail.getBoundingClientRect().toJSON(),panelRect:panel.getBoundingClientRect().toJSON(),workspaceRect:workspace.getBoundingClientRect().toJSON(),
      viewportWidth:innerWidth
    });
    rail.scrollTop=120;const afterRail=snapshot();
    panel.scrollTop=140;const afterPanel=snapshot();
    workspace.scrollTop=160;const afterWorkspace=snapshot();
    railF.remove();panelF.remove();workF.remove();
    return{afterRail,afterPanel,afterWorkspace};
  });
  expect(result.afterRail.rail).toBeGreaterThan(0);
  expect(result.afterRail.panel).toBe(0);expect(result.afterRail.workspace).toBe(0);
  expect(result.afterPanel.rail).toBe(result.afterRail.rail);expect(result.afterPanel.panel).toBeGreaterThan(0);expect(result.afterPanel.workspace).toBe(0);
  expect(result.afterWorkspace.rail).toBe(result.afterRail.rail);expect(result.afterWorkspace.panel).toBe(result.afterPanel.panel);expect(result.afterWorkspace.workspace).toBeGreaterThan(0);
  for(const key of ['railDir','panelDir','workspaceDir'])expect(result.afterWorkspace[key]).toBe('ltr');
  for(const key of ['railChildDir','panelChildDir','workspaceChildDir'])expect(result.afterWorkspace[key]).toBe('rtl');
  for(const key of ['railOverflow','panelOverflow','workspaceOverflow'])expect(['auto','scroll']).toContain(result.afterWorkspace[key]);
  expect(result.afterWorkspace.bodyOverflow).toBe('hidden');
  expect(result.afterWorkspace.rootOverflow).toBe('hidden');
  expect(result.afterWorkspace.documentScrollable).toBe(false);
  const g=result.afterWorkspace;
  expect(Math.abs(g.railRect.right-g.viewportWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(g.panelRect.right-g.railRect.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(g.workspaceRect.right-g.panelRect.left)).toBeLessThanOrEqual(1);
  expect(g.workspaceRect.left).toBe(0);
});

test('physical right-edge wheel zones control the adjacent owner only',async({page})=>{
  await page.setViewportSize({width:1536,height:420});
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    const filler=(host,height)=>{const el=document.createElement('div');el.dataset.scrollHitTest='1';el.style.height=height+'px';el.style.minHeight=height+'px';host.appendChild(el)};
    filler(document.getElementById('module-rail'),1100);filler(document.getElementById('module-panel-links'),1100);filler(document.querySelector('.main-surface'),1600);
  });
  const geom=await page.evaluate(()=>{const rail=document.getElementById('module-rail').getBoundingClientRect(),panel=document.getElementById('module-panel-links').getBoundingClientRect(),work=document.querySelector('.main-surface').getBoundingClientRect();return{rail,panel,work}});
  const tops=async()=>page.evaluate(()=>({rail:document.getElementById('module-rail').scrollTop,panel:document.getElementById('module-panel-links').scrollTop,work:document.querySelector('.main-surface').scrollTop}));
  await page.mouse.move(geom.rail.right-8,Math.max(120,geom.rail.top+80));await page.mouse.wheel(0,220);await page.waitForTimeout(50);let s=await tops();expect(s.rail).toBeGreaterThan(0);expect(s.panel).toBe(0);expect(s.work).toBe(0);
  await page.mouse.move(geom.panel.right-8,Math.max(120,geom.panel.top+80));await page.mouse.wheel(0,220);await page.waitForTimeout(50);s=await tops();expect(s.panel).toBeGreaterThan(0);expect(s.work).toBe(0);
  await page.mouse.move(geom.work.right-8,Math.max(120,geom.work.top+80));await page.mouse.wheel(0,220);await page.waitForTimeout(50);s=await tops();expect(s.work).toBeGreaterThan(0);
});

test('mobile keeps normal RTL document flow',async({page})=>{
  await page.setViewportSize({width:390,height:700});
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  const state=await page.evaluate(()=>{const workspace=document.querySelector('.main-surface');return{direction:getComputedStyle(workspace).direction,overflow:getComputedStyle(workspace).overflowY}});
  expect(state.direction).toBe('rtl');
  expect(['auto','visible']).toContain(state.overflow);
});
