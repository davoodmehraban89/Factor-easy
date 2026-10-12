const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';

async function setup(page){
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof finoraApplyTheme==='function'&&!!document.getElementById('finora-theme-r2-css'));
  await page.evaluate(()=>{
    const fixture=document.createElement('section');
    fixture.id='f0-dark-contract-fixture';
    fixture.innerHTML=`
      <section class="accordion-item" id="f0-theme-accordion">
        <div class="accordion-header">تنظیمات حسابداری</div>
        <div class="accordion-body">جزئیات حسابداری</div>
      </section>
      <button type="button" class="btn btn-secondary" id="f0-theme-secondary">انصراف</button>
      <label for="f0-theme-field" id="f0-theme-label">شرح سند</label>
      <input id="f0-theme-field" class="form-control" placeholder="توضیحات" value="اطلاعات آزمایشی">
      <aside class="module-panel" id="f0-theme-shell">
        <div class="module-panel-head"><h3>ماژول‌ها</h3></div>
        <button type="button" class="module-link" id="f0-theme-nav">حسابداری</button>
      </aside>`;
    document.body.appendChild(fixture);
    // Keep the requested theme stable if the application's delayed boot runs.
    // This is a browser fixture only; no persisted user setting is modified.
    window.__f0TestTheme='dark';
    const originalSettings=window.getMySettings;
    window.getMySettings=()=>({...((typeof originalSettings==='function'&&originalSettings())||{}),ui_theme:window.__f0TestTheme});
    finoraApplyTheme();
  });
}

async function sample(page){
  return await page.evaluate(()=>{
    const color=s=>String(s).match(/[\d.]+/g)?.slice(0,3).map(Number)||[];
    const lum=s=>{
      const cs=color(s);if(cs.length!==3)return null;
      return cs.map(v=>{const x=v/255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4})
        .reduce((acc,v,i)=>acc+v*[.2126,.7152,.0722][i],0);
    };
    const get=id=>{
      const c=getComputedStyle(document.getElementById(id));
      const a=lum(c.color),b=lum(c.backgroundColor);
      return {fg:c.color,bg:c.backgroundColor,contrast:a===null||b===null?0:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05),backgroundLuminance:b};
    };
    return {
      accordion:get('f0-theme-accordion'),
      button:get('f0-theme-secondary'),
      input:get('f0-theme-field'),
      label:get('f0-theme-label'),
      shell:get('f0-theme-shell'),
      nav:get('f0-theme-nav'),
      rootDark:document.body.classList.contains('finora-theme-dark')
    };
  });
}

test('F0-06 dark mode maintains readable accounting panels, controls and shell',async({page})=>{
  await setup(page);
  const s=await sample(page);
  expect(s.rootDark).toBe(true);
  for(const part of ['accordion','button','input','shell'])
    expect(s[part].contrast,part+' '+JSON.stringify(s[part])).toBeGreaterThanOrEqual(4.5);
  for(const part of ['accordion','button','input','shell'])
    expect(s[part].backgroundLuminance,part+' dark surface').toBeLessThan(0.18);
  // The shell's transparent navigation controls inherit their own dark parent.
  expect(s.nav.fg).not.toBe('rgb(51, 65, 85)');
});

test('F0-06 light mode remains legible after switching out of dark mode',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{window.__f0TestTheme='light';finoraApplyTheme()});
  // Buttons animate their background for 200ms; assert steady-state contrast,
  // not an intermediate frame during CSS transition.
  await expect.poll(async()=>(await sample(page)).button.contrast,{timeout:3000}).toBeGreaterThanOrEqual(4.5);
  const s=await sample(page);
  expect(s.rootDark).toBe(false);
  expect(s.accordion.contrast).toBeGreaterThanOrEqual(4.5);
  expect(s.button.contrast).toBeGreaterThanOrEqual(4.5);
  expect(s.input.contrast).toBeGreaterThanOrEqual(4.5);
  expect(s.accordion.backgroundLuminance).toBeGreaterThan(0.5);
  expect(s.button.backgroundLuminance).toBeGreaterThan(0.5);
});
