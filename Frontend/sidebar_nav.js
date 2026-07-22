(function(){
  'use strict';
  if(window.__mnSidebarInit)return;
  window.__mnSidebarInit=true;

  var NAV_ITEMS=[
    {href:'dashboard.html',label:'Dashboard',icon:'home'},
    {href:'canvas.html',label:'Journal',icon:'feather'},
    {href:'sentiment.html',label:'Sentiment',icon:'pulse'},
    {href:'history.html',label:'History',icon:'clock'},
    {href:'vocab.html',label:'Insights',icon:'bars'},
    {href:'analysis.html',label:'Analysis',icon:'activity'},
    {href:'research_insights.html',label:'Research',icon:'flask'},
    {href:'nook-ai.html',label:'Nook AI',icon:'spark'},
    {href:'privacy_center.html',label:'Privacy',icon:'shield'}
  ];

  var ICONS={
    home:'<path d="M4 11.2 12 4l8 7.2"/><path d="M6 9.6V19a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1V9.6"/>',
    feather:'<path d="M20.24 3.76a6 6 0 0 0-8.49 0L4.5 11a8 8 0 0 0-2 8.5 8 8 0 0 0 8.5-2l7.24-7.25a6 6 0 0 0 2-6.5Z"/><path d="M11 16 4 9"/><path d="M8.5 13.5 3 19"/>',
    pulse:'<path d="M3 12h4l2 8 4-16 2 8h6"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2.2"/>',
    bars:'<path d="M4 20V11"/><path d="M12 20V4"/><path d="M20 20v-6"/>',
    activity:'<path d="M3 12h4l2.2-7.5L13 18l2-6h6"/>',
    flask:'<path d="M9.5 2.5h5"/><path d="M10.2 2.5v6.8L4.7 19a1.6 1.6 0 0 0 1.4 2.5h11.8a1.6 1.6 0 0 0 1.4-2.5l-5.5-9.7V2.5"/>',
    spark:'<path d="M12 2.5v3.6"/><path d="M12 17.9v3.6"/><path d="M4.5 5 7 7.4"/><path d="M17 16.6l2.5 2.4"/><path d="M2.5 12h3.6"/><path d="M17.9 12h3.6"/><path d="M4.5 19l2.5-2.4"/><path d="M17 7.4 19.5 5"/>',
    shield:'<path d="M12 2.8 19 5.7v5.3c0 5-3.2 8.6-7 9.7-3.8-1.1-7-4.7-7-9.7V5.7Z"/>',
    signout:'<path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9"/><path d="M15.5 16.5 20 12l-4.5-4.5"/><path d="M20 12H9"/>',
    collapse:'<path d="M14.5 5 8 12l6.5 7"/>',
    menu:'<path d="M3.5 6.5h17"/><path d="M3.5 12h17"/><path d="M3.5 17.5h17"/>',
    close:'<path d="M5.5 5.5 18.5 18.5"/><path d="M18.5 5.5 5.5 18.5"/>'
  };

  function svgIcon(name,cls){
    var body=ICONS[name]||'';
    return '<svg class="mn-icon'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+body+'</svg>';
  }

  function getPageName(){
    var path=window.location.pathname.split('/').pop();
    return path&&path.length?path:'dashboard.html';
  }

  function readCollapsed(){
    try{return window.localStorage.getItem('mn_sidebar_collapsed')==='true';}catch(e){return false;}
  }
  function writeCollapsed(val){
    try{window.localStorage.setItem('mn_sidebar_collapsed',val?'true':'false');}catch(e){}
  }

  function trapFocus(container,onEscape){
    if(window.MindNookA11y&&window.MindNookA11y.trapFocus){
      return window.MindNookA11y.trapFocus(container,{onEscape:onEscape});
    }
    var selector='a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
    var previously=document.activeElement;
    function handleKeydown(e){
      if(e.key==='Escape'&&onEscape){e.preventDefault();onEscape();return;}
      if(e.key!=='Tab')return;
      var focusable=Array.prototype.slice.call(container.querySelectorAll(selector));
      if(!focusable.length)return;
      var first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
    container.addEventListener('keydown',handleKeydown);
    var focusable=container.querySelectorAll(selector);
    if(focusable.length)focusable[0].focus();
    return function release(){
      container.removeEventListener('keydown',handleKeydown);
      if(previously&&typeof previously.focus==='function'&&document.body.contains(previously))previously.focus();
    };
  }

  function bindActivation(el,handler){
    if(window.MindNookA11y&&window.MindNookA11y.bindActivation){
      window.MindNookA11y.bindActivation(el,handler);
      return;
    }
    el.addEventListener('click',handler);
    el.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault();handler(e);}
    });
  }

  function buildSidebarHTML(page,collapsed){
    var items=NAV_ITEMS.map(function(item){
      var active=item.href===page;
      return '<li class="mn-nav-item">'+
        '<a href="'+item.href+'" class="mn-nav-link'+(active?' active':'')+'"'+(active?' aria-current="page"':'')+' data-tooltip="'+item.label+'">'+
        svgIcon(item.icon)+
        '<span class="mn-nav-label">'+item.label+'</span>'+
        '</a></li>';
    }).join('');

    return ''+
      '<div class="mn-sidebar-brand">'+
        '<a href="dashboard.html" class="mn-brand-link" aria-label="MindNook, go to Dashboard">'+
          '<span class="mn-brand-dot" aria-hidden="true"></span>'+
          '<span class="mn-brand-text">MindNook</span>'+
        '</a>'+
      '</div>'+
      '<nav class="mn-sidebar-nav" aria-label="Primary navigation">'+
        '<ul class="mn-nav-list" role="list">'+items+'</ul>'+
      '</nav>'+
      '<div class="mn-sidebar-footer">'+
        '<div class="mn-user-badge">'+
          '<span class="mn-user-avatar" id="navAvatar">?</span>'+
          '<span class="mn-nav-label mn-user-label">Account</span>'+
        '</div>'+
        '<button type="button" class="mn-nav-link mn-signout-btn" id="mnSignOutBtn" data-tooltip="Sign out">'+
          svgIcon('signout')+
          '<span class="mn-nav-label">Sign out</span>'+
        '</button>'+
        '<button type="button" class="mn-collapse-btn" id="mnCollapseBtn" data-tooltip="Expand sidebar" aria-expanded="'+(!collapsed)+'" aria-controls="mnSidebar">'+
          svgIcon('collapse','mn-collapse-icon')+
          '<span class="mn-nav-label">Collapse</span>'+
        '</button>'+
      '</div>';
  }

  function init(){
    if(!document.body)return;
    var page=getPageName();
    var collapsed=readCollapsed();

    var aside=document.createElement('aside');
    aside.className='mn-sidebar'+(collapsed?' collapsed':'');
    aside.id='mnSidebar';
    aside.innerHTML=buildSidebarHTML(page,collapsed);
    document.body.insertBefore(aside,document.body.firstChild);

    var trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='mn-mobile-trigger';
    trigger.id='mnMobileTrigger';
    trigger.setAttribute('aria-label','Open navigation menu');
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-controls','mnSidebar');
    trigger.innerHTML=svgIcon('menu','mn-trigger-icon');
    document.body.insertBefore(trigger,aside.nextSibling);

    var backdrop=document.createElement('div');
    backdrop.className='mn-backdrop';
    backdrop.id='mnBackdrop';
    document.body.insertBefore(backdrop,trigger.nextSibling);

    document.body.classList.add('mn-has-sidebar');
    if(collapsed)document.body.classList.add('mn-sidebar-collapsed');

    var collapseBtn=document.getElementById('mnCollapseBtn');
    var signOutBtn=document.getElementById('mnSignOutBtn');
    var releaseMobileFocus=null;

    function isMobile(){
      return window.matchMedia('(max-width:900px)').matches;
    }

    function setCollapsed(val){
      collapsed=val;
      aside.classList.toggle('collapsed',collapsed);
      document.body.classList.toggle('mn-sidebar-collapsed',collapsed);
      collapseBtn.setAttribute('aria-expanded',String(!collapsed));
      collapseBtn.setAttribute('data-tooltip',collapsed?'Expand sidebar':'Collapse sidebar');
      writeCollapsed(collapsed);
    }

    function openMobile(){
      aside.classList.add('mobile-open');
      backdrop.classList.add('visible');
      trigger.setAttribute('aria-expanded','true');
      trigger.innerHTML=svgIcon('close','mn-trigger-icon');
      document.documentElement.classList.add('mn-sidebar-lock');
      releaseMobileFocus=trapFocus(aside,closeMobile);
    }

    function closeMobile(){
      aside.classList.remove('mobile-open');
      backdrop.classList.remove('visible');
      trigger.setAttribute('aria-expanded','false');
      trigger.innerHTML=svgIcon('menu','mn-trigger-icon');
      document.documentElement.classList.remove('mn-sidebar-lock');
      if(releaseMobileFocus){releaseMobileFocus();releaseMobileFocus=null;}
    }

    function toggleMobile(){
      if(aside.classList.contains('mobile-open'))closeMobile();else openMobile();
    }

    bindActivation(trigger,toggleMobile);
    bindActivation(collapseBtn,function(){
      if(isMobile())return;
      setCollapsed(!collapsed);
    });
    bindActivation(signOutBtn,function(){
      if(typeof window.signOut==='function'){window.signOut();}
    });

    backdrop.addEventListener('click',closeMobile);
    aside.addEventListener('click',function(e){
      if(e.target.closest('a.mn-nav-link')&&isMobile())closeMobile();
    });

    window.addEventListener('resize',function(){
      if(!isMobile()&&aside.classList.contains('mobile-open'))closeMobile();
    });

    window.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&aside.classList.contains('mobile-open'))closeMobile();
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  }else{
    init();
  }
})();