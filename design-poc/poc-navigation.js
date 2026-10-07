/* Connect the standalone studies and the persistent frames in poc.e2e.html.
   A classic script deliberately shares the study's existing lexical state;
   no HTML is copied and nothing calls the backend. */
(() => {
  const files = {portfolio:'portfolio-overview.html',accounts:'accounts.html',transactions:'transactions.html',holding:'holding-detail.html'};
  const page = Object.keys(files).find(key => location.pathname.endsWith('/'+files[key]));
  if (!page) return;
  const query = new URLSearchParams(location.search);
  let bridgeAppearanceRevision=0;
  const embedded = parent !== window && query.get('embed') === '1';
  if (embedded) document.documentElement.classList.add('poc-embedded');
  const send = (type, payload={}) => {
    if (embedded) parent.postMessage({source:'portifo-study',page,type,...payload},location.protocol === 'file:' ? '*' : location.origin);
  };
  const stop = event => { event.preventDefault();event.stopImmediatePropagation(); };
  const route = (target, extra={}) => {
    if (embedded) send('navigate',{target,...extra});
    else {
      const url = new URL(files[target],location.href);
      url.searchParams.set('theme',state.theme);url.searchParams.set('font',state.fontScale);
      if(extra.origin)url.searchParams.set('origin',extra.origin);
      if(extra.accountId)url.searchParams.set('account',extra.accountId);
      if(extra.symbol)url.searchParams.set('symbol',extra.symbol);
      location.assign(url.href);
    }
  };
  function context(symbol) {
    if (page === 'portfolio') {
      const h = baseHoldings.find(h => h.symbol === symbol);
      if (!h) return null;
      // NVIDIA's existing multi-lot study matches the portfolio's actual costs.
      if(symbol === 'NVDA' && state.id === 'balanced') return null;
      return {id:'connected',symbol:h.symbol,name:h.name,exchange:symbol==='VTI'?'NYSE Arca':'NASDAQ',currency:'USD',price:h.price,change:state.id==='down'?-Math.abs(h.day)*1.4:h.day,accounts:accounts.map((name,i)=>({name,lots:[{date:'Mar 04, 2024',shares:h.shares[i],price:h.cost[i]/h.shares[i],age:'1y 7m'}],realized:null}))};
    }
    if(page === 'accounts') {
      const a = currentAccount(),h = a?.positions.find(h => h.symbol === symbol);
      if(!h)return null;
      return {id:'connected',symbol:h.symbol,name:h.name,exchange:['QQQ','VTI','URA'].includes(symbol)?'NYSE Arca':'NASDAQ',currency:h.currency,price:h.value/h.shares,change:null,accounts:[{name:a.name,lots:[{date:'Feb 04, 2025',shares:h.shares,price:(h.value-h.gain)/h.shares,age:'8m'}],realized:null}]};
    }
    return null;
  }
  function snapshot() {
    return {page,id:state.id,view:state.view||'list',theme:state.theme,font:state.fontScale,appearanceRevision:bridgeAppearanceRevision,
      accountId:page==='accounts'?state.accountId:null,
      symbol:page==='holding'?data().symbol:null,
      label:page==='accounts'&&state.view==='detail'?currentAccount()?.name:page==='holding'?data().symbol:null};
  }
  window.PortifoStudy = {
    meta:() => {
      const linked=page==='holding'&&window.connectedHolding;
      const states=scenarios.map(({id,label,note})=>({id,label,note}));
      if(linked)states.unshift({id:'connected',label:`${linked.symbol} · From ${state.origin}`,note:'The value, shares and cost match the source screen. Purchase rows are illustrative aggregate lots for this connected view, not reconstructed transaction history.'});
      return {...snapshot(),...(linked?{id:'connected'}:{}),scenarios:states};
    },
    appearance(theme,font,revision=bridgeAppearanceRevision) {
      bridgeAppearanceRevision=revision;
      state.theme=theme==='dark'?'dark':'light';
      if(typeof setFontScale === 'function')setFontScale(font);else state.fontScale=Math.max(100,Math.min(140,Number(font)||115));
      updateControls();
    },
    scenario(id) {
      if(!scenarios.some(s=>s.id===id))return;
      if(page==='accounts')selectScenario(id);
      else {
        if(document.querySelector('.sheet'))closeSheet();
        if(page==='holding'){window.connectedHolding=null;state.expanded.clear();state.range='1M';}
        if(page==='transactions'){state.scope='all';state.type='all';state.symbol='all';}
        if(page==='portfolio'){state.cashOpen=false;state.closedOpen=false;}
        state.id=id;render();
      }
    },
    open(options={}) {
      if(document.querySelector('.sheet'))closeSheet();
      if(page==='accounts') {
        if(options.accountId){state.id='balanced';state.view='list';render();showAccount(options.accountId);}
        if(options.create){if(state.view==='detail')goBack();openCreate(document.querySelector('#add-account'));}
      }
      if(page==='transactions') {
        state.id='mixed';state.symbol=options.symbol||'all';state.scope=options.scope??'all';state.type=options.type||'all';render();
      }
      if(page==='holding') {
        window.connectedHolding=options.context||null;state.id=options.scenario||'multi';
        state.origin=['Accounts','Transactions'].includes(options.origin)?options.origin:'Portfolio';
        const originSelect=document.querySelector('#origin');
        if(![...originSelect.options].some(o=>o.value===state.origin))originSelect.add(new Option(state.origin,state.origin));
        originSelect.value=state.origin;
        state.range='1M';state.expanded.clear();render();
        if(options.purchase)showLot(0,0);
        if(options.trade)openSheet(options.trade,document.querySelector(`[data-action="${options.trade==='sell'?'sell':'buy'}"]`));
      }
    },
    focus() {
      const target=document.querySelector('.sheet')||document.querySelector('#screen');
      target?.focus({preventScroll:true});
    }
  };
  // The shell cannot read file:// iframe windows. Keep the same study API
  // available through messages, accepting commands only from our own parent.
  if(embedded)window.addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==(location.protocol==='file:'?'null':location.origin))return;
    const message=event.data;
    if(!message||message.source!=='portifo-shell'||message.page!==page)return;
    if(!['meta','appearance','scenario','open','focus'].includes(message.method))return;
    window.PortifoStudy[message.method](...(Array.isArray(message.args)?message.args:[]));
    send('state',{value:window.PortifoStudy.meta(),requestId:message.requestId});
  });
  // Capture before each study's demo navigation to replace placeholders with
  // real destinations. Local chart, modal, purchase and cash interactions stay intact.
  document.addEventListener('click',event => {
    const el=event.target.closest('a,button');if(!el||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    if(el.dataset.pocLedger){stop(event);route('transactions',{symbol:data().symbol});return;}
    if(el.matches('a[href]')) {
      const url=new URL(el.href,location.href),target=Object.keys(files).find(key=>url.pathname.endsWith('/'+files[key]));
      if(!embedded&&page==='accounts'&&target==='holding'&&state.accountId){url.searchParams.set('account',state.accountId);el.href=url.href;}
      if(target && embedded) {
        stop(event);
        const symbol=target==='holding'?(el.dataset.holding||el.getAttribute('aria-label')?.split(',')[0]||'NVDA'):undefined;
        route(target,target==='holding'?{symbol,origin:page==='accounts'?'Accounts':'Portfolio',context:context(symbol)}:{});return;
      }
    }
    if(page==='portfolio' && el.dataset.tab==='activity'){stop(event);route('transactions');return;}
    if(embedded && page==='portfolio' && el.dataset.holding){stop(event);route('holding',{symbol:el.dataset.holding,origin:'Portfolio',context:context(el.dataset.holding)});return;}
    if(embedded && page==='accounts' && el.dataset.holding){stop(event);route('holding',{symbol:el.dataset.holding,origin:'Accounts',accountId:state.accountId,context:context(el.dataset.holding)});return;}
    if(page==='holding' && el.dataset.action==='back') {
      stop(event);
      if(embedded)send('back');else route(state.origin==='Accounts'?'accounts':'portfolio',{accountId:query.get('account')});
      return;
    }
    if(embedded && page==='holding' && el.dataset.history) {stop(event);route('transactions',{symbol:data().symbol});return;}
    if(page==='portfolio' && ['add','setup'].includes(el.dataset.action)) {stop(event);route('accounts',{create:true});return;}
    if(embedded && page==='transactions' && el.id==='add-transaction') {stop(event);send('trade-picker');return;}
    if(embedded && ((page==='portfolio'&&el.dataset.tab==='settings')||el.dataset.command==='settings')) {
      stop(event);send('settings');return;
    }
  },true);
  // Theme/size changes in a child are reflected by the shell and all other screens.
  let last='',scheduled=false;
  const notify = () => {
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      if(page==='holding'&&state.view==='holding'&&!data().unknown&&!document.querySelector('[data-poc-ledger]')) {
        const link=document.createElement('button');link.className='text-link connected-ledger-link';link.dataset.pocLedger='true';link.textContent=`View ${data().symbol} transactions →`;document.querySelector('#screen').append(link);
      }
      if(page==='portfolio'){const label=document.querySelector('[data-tab="activity"] span');if(label&&label.textContent!=='Transactions')label.textContent='Transactions';}
      const value=window.PortifoStudy.meta(),json=JSON.stringify(value);if(json!==last){last=json;send('state',{value});}
    });
  };
  if(embedded) {
    new MutationObserver(notify).observe(document.querySelector('#phone'),{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden']});
    notify();send('ready',{value:window.PortifoStudy.meta()});
  }
  const connectedLink=document.createElement('a');connectedLink.className='companion-link';connectedLink.href='poc.e2e.html';connectedLink.textContent='Connected walkthrough ↗';document.querySelector('.controls')?.append(connectedLink);
  // Standalone deep links also return to a real page instead of a navigation mock.
  if(!embedded && page==='accounts' && query.has('account'))window.PortifoStudy.open({accountId:Number(query.get('account'))});
  if(!embedded && page==='transactions') {
    if(query.get('theme')==='dark')state.theme='dark';
    if(query.has('font'))state.fontScale=Math.max(100,Math.min(140,Number(query.get('font'))||115));
    if(query.has('symbol'))state.symbol=query.get('symbol');render();
  }
})();
