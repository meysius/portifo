// Run in poc.e2e.html over either file:// or HTTP:
// agent-browser eval --stdin < design-poc/check-e2e-bridge.js
(async () => {
  let checks=0;const failures=[],original={...state};
  const assert=(ok,label)=>{checks++;if(!ok)failures.push(label);};
  const wait=async predicate=>{
    const start=performance.now();
    while(!predicate()){
      if(performance.now()-start>3000)throw new Error('Timed out waiting for the study bridge');
      await new Promise(resolve=>setTimeout(resolve,10));
    }
  };
  // Confirm actual child replies, not just the shell's optimistic metadata.
  const request=(page,method,args=[])=>new Promise((resolve,reject)=>{
    const requestId=crypto.randomUUID();
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',receive);};
    const receive=event=>{
      if(event.source!==frames.get(page).contentWindow||event.data?.source!=='portifo-study'||event.data.type!=='state'||event.data.requestId!==requestId)return;
      cleanup();resolve(event.data.value);
    };
    const timer=setTimeout(()=>{cleanup();reject(new Error(`${page}: no reply to ${method}`));},3000);
    window.addEventListener('message',receive);command(page,method,args,requestId);
  });
  try {
    await wait(()=>Object.keys(pages).every(page=>!!api(page)));
    assert(document.querySelector('#loading').hidden,'Loading clears for local files and HTTP');
    for(const page of Object.keys(pages)){
      const meta=await request(page,'meta');
      assert(meta.page===page&&meta.scenarios.length>0,`${page}: metadata is available through messages`);
    }
    for(const theme of ['dark','light']){
      appearance(theme,theme==='dark'?140:115);
      for(const page of Object.keys(pages)){
        const meta=await request(page,'meta');
        assert(meta.theme===theme&&meta.font===state.font,`${page}: shared appearance reaches the child`);
      }
    }
    navigate('portfolio');
    await request('portfolio','scenario',['empty']);
    await wait(()=>document.querySelector('[data-scenario="empty"]')?.classList.contains('active'));
    assert(api('portfolio').meta().id==='empty','Scenario changes update shell controls');
    await request('portfolio','scenario',['balanced']);
    navigate('accounts',{accountId:3});
    await wait(()=>api('accounts').meta().accountId===3);
    assert(api('accounts').meta().view==='detail','Account journey opens the requested account');
    navigate('holding',{origin:'Accounts'});
    await wait(()=>api('holding').meta().symbol==='NVDA');
    assert(state.returnPage==='accounts','Holding remembers its return destination');
    back();await wait(()=>state.page==='accounts');
    assert(api('accounts').meta().accountId===3,'Back preserves account detail');
    navigate('transactions',{symbol:'NVDA'});
    const ledger=await request('transactions','meta');
    assert(ledger.page==='transactions','Ledger navigation works through the bridge');
    settings();
    assert(document.querySelector('#viewport').inert,'Settings locks the study viewport');
    closeModal(false);
    assert(!document.querySelector('#viewport').inert,'Closing settings unlocks the viewport');
    assert([...frames.values()].filter(frame=>!frame.hidden).length===1,'Only the current study is visible');
  } catch(error){failures.push(String(error.stack||error));}
  finally {
    closeModal(false);
    for(const [page,id] of [['portfolio','balanced'],['accounts','balanced'],['holding','multi'],['transactions','mixed']]){
      if(api(page))await request(page,'scenario',[id]);
    }
    appearance(original.theme,original.font);state.returnPage=original.returnPage;show(original.page);
    history.replaceState({portifo:true,page:original.page,returnPage:original.returnPage},'',`#${original.page}`);
  }
  return {checks,failures,pass:failures.length===0,protocol:location.protocol};
})()
