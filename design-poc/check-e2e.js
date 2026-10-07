// Run in poc.e2e.html: agent-browser eval --stdin < design-poc/check-e2e.js
(async () => {
  let checks=0;const failures=[];
  const assert=(ok,label)=>{checks++;if(!ok)failures.push(label);};
  const wait=async predicate=>{
    const start=performance.now();while(!predicate()){if(performance.now()-start>3000)throw new Error('Timed out waiting for a connected screen');await new Promise(resolve=>setTimeout(resolve,10));}
  };
  const doc=page=>frames.get(page).contentDocument;
  const child=page=>frames.get(page).contentWindow;
  const click=(page,selector)=>{const el=doc(page).querySelector(selector);if(!el)throw new Error(`${page}: missing ${selector}`);el.click();};
  const original={...state};
  let accountRecords,accountNext;
  try {
    await wait(()=>[...frames.keys()].every(page=>!!api(page)));
    accountRecords=child('accounts').eval('structuredClone(records)');accountNext=child('accounts').eval('nextId');
    assert(frames.size===4,'All four original studies are mounted');
    appearance('light',115);navigate('portfolio');api('portfolio').scenario('balanced');
    await wait(()=>doc('portfolio').querySelector('a[href^="holding-detail"]'));
    const frameUrls=[...frames.values()].map(frame=>frame.src);
    click('portfolio','a[href^="holding-detail"]');await wait(()=>state.page==='holding');
    assert(doc('holding').querySelector('.hero-value').textContent==='$34,770.00','Portfolio to NVIDIA preserves the position value');
    assert(doc('holding').querySelector('.back').textContent==='Portfolio','Holding knows its Portfolio origin');
    assert(!doc('holding').querySelector('.desk-header').getClientRects().length,'Only one workbench is shown');
    click('holding','[data-account="0"]');click('holding','[data-lot="0:0"]');
    assert(api('holding').meta().view==='transaction','A purchase opens inside holding detail');
    click('holding','[data-action="holding"]');click('holding','[data-action="back"]');await wait(()=>state.page==='portfolio');
    assert(!doc('portfolio').querySelector('.sheet'),'Back returns to the real portfolio, not a mock page');
    click('portfolio','[data-holding="AAPL"]');await wait(()=>state.page==='holding');
    assert(api('holding').meta().symbol==='AAPL','Other portfolio holdings open their own detail, not NVIDIA');
    assert(doc('holding').querySelector('.hero-value').textContent==='$24,318.00','Apple position value remains consistent');
    click('holding','[data-action="back"]');await wait(()=>state.page==='portfolio');
    click('portfolio','#tab-bar a[href^="accounts"]');await wait(()=>state.page==='accounts');
    api('accounts').scenario('balanced');click('accounts','[data-account="3"]');click('accounts','[data-holding="URA"]');await wait(()=>state.page==='holding');
    assert(api('holding').meta().symbol==='URA','Account holding routes to the selected symbol');
    assert(doc('holding').querySelector('.hero-value').textContent==='$15,048.00','Account-scoped holding keeps its original value');
    assert(doc('holding').querySelector('.account-name').textContent==='Meysam’s Margin','Holding stays scoped to the selected account');
    assert(doc('holding').querySelector('.back').textContent==='Accounts','Account-origin Back label is correct');
    assert(!doc('holding').querySelector('.today-return'),'Unknown daily quote change is not invented');
    click('holding','[data-action="back"]');await wait(()=>state.page==='accounts');
    assert(api('accounts').meta().accountId===3 && api('accounts').meta().view==='detail','Back restores the exact account detail');
    click('accounts','[data-command="back"]');click('accounts','#add-account');
    const input=doc('accounts').querySelector('#account-name');input.value='E2E test account';input.dispatchEvent(new Event('input',{bubbles:true}));doc('accounts').querySelector('#account-form').requestSubmit();
    const created=child('accounts').eval('records.balanced.at(-1).id');
    assert(!!doc('accounts').querySelector(`[data-account="${created}"]`),'Account creation works in the connected preview');
    click('accounts','#tab-bar a[href^="transactions"]');await wait(()=>state.page==='transactions');
    api('transactions').open({symbol:'NVDA'});
    assert(doc('transactions').querySelectorAll('[data-transaction]').length===2,'NVIDIA transaction filter is applied');
    click('transactions','[data-transaction="1"]');assert(!!doc('transactions').querySelector('[role="dialog"]'),'Recorded transaction opens its detail');click('transactions','[data-command="close"]');
    click('transactions','#tab-bar a[href^="accounts"]');await wait(()=>state.page==='accounts');
    assert(!!doc('accounts').querySelector(`[data-account="${created}"]`),'Account edits survive switching tabs');
    click('accounts','#tab-bar a[href^="transactions"]');await wait(()=>state.page==='transactions');
    assert(doc('transactions').querySelectorAll('[data-transaction]').length===2,'Ledger filters survive switching tabs');
    assert([...frames.values()].every((frame,index)=>frame.src===frameUrls[index]),'Cross-screen navigation never reloads an iframe');
    click('transactions','[data-command="settings"]');await wait(()=>!!document.querySelector('.sheet'));
    document.querySelector('[data-modal-theme="dark"]').click();
    const font=document.querySelector('#mobile-font');font.value='140';font.dispatchEvent(new Event('input',{bubbles:true}));
    assert([...frames.keys()].every(page=>api(page).meta().theme==='dark' && api(page).meta().font===140),'Appearance is shared across all four studies');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    assert(!document.querySelector('.sheet')&&!document.querySelector('#viewport').inert,'Settings closes and unlocks the prototype');
    click('transactions','#add-transaction');await wait(()=>!!document.querySelector('#trade-form'));document.querySelector('#trade-type').value='sell';document.querySelector('#trade-form').requestSubmit();await wait(()=>state.page==='holding');
    assert(doc('holding').querySelector('#sheet-title').textContent==='Sell NVDA','Ledger entry point opens the existing sale flow');
    assert(doc('holding').querySelector('.back').textContent==='Transactions','Trade flow retains its Transactions origin');
    click('holding','[data-action="close"]');click('holding','[data-action="back"]');await wait(()=>state.page==='transactions');
    assert(state.page==='transactions','Trade Back returns to the ledger');
    navigate('holding',{origin:'Portfolio'});await wait(()=>!!doc('holding').querySelector('[data-poc-ledger]'));
    click('holding','[data-poc-ledger]');await wait(()=>state.page==='transactions');
    assert(doc('transactions').querySelectorAll('[data-transaction]').length===2,'Holding-to-ledger link applies its symbol filter');
    for(const theme of ['light','dark'])for(const font of [100,115,140])for(const page of Object.keys(pages)) {
      appearance(theme,font);show(page);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      assert(document.documentElement.scrollWidth<=innerWidth,`${page}/${theme}/${font}: shell does not overflow`);
      const screen=doc(page).querySelector('#screen');assert(screen.scrollWidth<=screen.clientWidth,`${page}/${theme}/${font}: child screen does not overflow`);
      assert([...frames.values()].filter(frame=>!frame.hidden).length===1,`${page}/${theme}/${font}: exactly one screen is visible`);
      assert([...frames.values()].filter(frame=>frame.hidden).every(frame=>frame.inert),`${page}/${theme}/${font}: inactive screens are not keyboard targets`);
    }
  } catch(error) { failures.push(String(error.stack||error)); }
  finally {
    closeModal(false);
    if(accountRecords){child('accounts').savedRecords=accountRecords;child('accounts').savedNext=accountNext;child('accounts').eval('Object.assign(records,window.savedRecords);nextId=window.savedNext;delete window.savedRecords;delete window.savedNext;selectScenario("balanced");');}
    for(const [page,id] of [['portfolio','balanced'],['holding','multi'],['transactions','mixed']])api(page)?.scenario(id);
    appearance(original.theme,original.font);state.returnPage=original.returnPage;show(original.page);
    history.replaceState({portifo:true,page:original.page,returnPage:original.returnPage},'',`#${original.page}`);
  }
  return {checks,failures,pass:failures.length===0,viewport:[innerWidth,innerHeight]};
})()
