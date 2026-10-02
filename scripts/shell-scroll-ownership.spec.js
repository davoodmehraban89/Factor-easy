const {test,expect}=require('@playwright/test');

test('desktop shell keeps three independent right-edge vertical scroll owners',async({page})=>{
  await page.setViewportSize({width:1536,height:420});
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
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
      documentScrollable:document.scrollingElement.scrollHeight>document.scrollingElement.clientHeight
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
});

test('mobile keeps normal RTL document flow',async({page})=>{
  await page.setViewportSize({width:390,height:700});
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  const state=await page.evaluate(()=>{const workspace=document.querySelector('.main-surface');return{direction:getComputedStyle(workspace).direction,overflow:getComputedStyle(workspace).overflowY}});
  expect(state.direction).toBe('rtl');
  expect(state.overflow).toBe('visible');
});
