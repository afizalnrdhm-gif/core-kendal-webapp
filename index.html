<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Monitoring System CORE Kendal</title>
<link rel="manifest" href="manifest.json">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="theme-color" content="#0B3D62">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<script src="https://accounts.google.com/gsi/client" async defer></script>
<style>
  :root{
    --ink:#16222E; --ink-soft:#4C6272;
    --bg:#EAF1F6; --surface:#FFFFFF; --surface-alt:#F1F7FB; --line:#D3E3EC;
    --navy:#0B3D62; --navy-light:#0F4E7C; --navy-lighter:#3FA9E0;
    --gold:#C88A2E; --gold-soft:#F3E3C8;
    --good:#3E7D5C; --bad:#A13A3F;
    --mono: 'JetBrains Mono', ui-monospace, "SF Mono", Consolas, monospace;
    --sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;}

  /* ---------- Login screen ---------- */
  .login-wrap{
    min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:radial-gradient(circle at 30% 20%, #123F63 0%, #0B3D62 40%, #071F33 100%);
    padding:20px;
  }
  .login-card{
    background:var(--surface); border-radius:18px; padding:38px 32px;
    max-width:340px; width:100%; text-align:center;
    box-shadow:0 24px 70px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06);
    border-top:3px solid var(--gold);
  }
  .login-card img{width:64px;height:64px;border-radius:14px;margin-bottom:16px;box-shadow:0 6px 18px rgba(11,61,98,0.25);}
  .login-card h1{font-size:17px;margin:0 0 4px;color:var(--ink);}
  .login-card p{font-size:12.5px;color:var(--ink-soft);margin:0 0 22px;}
  #gsiButton{display:flex; justify-content:center;}
  .login-error{margin-top:16px;font-size:12.5px;color:var(--bad);}

  /* ---------- Header ---------- */
  .topbar{background:linear-gradient(180deg,var(--navy) 0%,#0A2F4D 100%);color:#EAF0F4;padding:18px 20px 16px;border-bottom:2px solid var(--gold);}
  .topbar-inner{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;max-width:1280px;margin:0 auto;}
  .topbar h1{margin:0;font-size:18px;font-weight:600;}
  .topbar .sub{color:#A9BFD1;font-size:12px;margin-top:3px;}

  /* ---------- Sidebar layout ---------- */
  .app-shell{display:flex;min-height:100vh;}
  .sidebar{
    width:230px;flex:none;
    background:linear-gradient(180deg,var(--navy) 0%,#0A2F4D 100%);
    color:#EAF0F4;
    display:flex;flex-direction:column;
    position:sticky;top:0;height:100vh;
    border-right:2px solid var(--gold);
  }
  .sidebar-brand{display:flex;align-items:center;gap:10px;padding:20px 18px;border-bottom:1px solid rgba(255,255,255,0.12);}
  .sidebar-brand img{width:36px;height:36px;border-radius:9px;flex:none;box-shadow:0 4px 12px rgba(0,0,0,0.25);}
  .sb-title{font-weight:700;font-size:14px;}
  .sb-sub{font-size:10.5px;color:#9FC3DC;}
  .sidebar-nav{padding:14px 0;flex:1;}
  .nav-item{
    display:flex;align-items:center;gap:10px;width:100%;text-align:left;
    padding:11px 18px;background:none;border:none;border-left:3px solid transparent;
    color:#A9BFD1;font-size:13.5px;cursor:pointer;font-family:var(--sans);
    transition:background .15s ease, color .15s ease, opacity .3s ease, max-height .3s ease, padding .3s ease;
    max-height:44px;opacity:1;overflow:hidden;
  }
  .nav-item.nav-hidden{max-height:0;opacity:0;padding-top:0;padding-bottom:0;pointer-events:none;}
  .nav-icon{flex:none;opacity:0.85;}
  .nav-item.active .nav-icon{opacity:1;}
  .nav-item:hover{background:rgba(255,255,255,0.06);color:#EAF0F4;}
  .nav-item.active{background:rgba(255,255,255,0.1);color:#fff;border-left-color:var(--gold);font-weight:600;}
  .sidebar-footer{padding:14px 18px 18px;border-top:1px solid rgba(255,255,255,0.12);font-size:12px;color:#A9BFD1;}
  .sidebar-footer #whoBox{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;}
  .sidebar-footer .who-email{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;}
  .sidebar-footer .badge{align-self:flex-start;margin-left:0;}
  .sidebar-footer .logout-btn{width:100%;text-align:center;}

  .main-area{flex:1;min-width:0;}
  .mobile-topbar{display:none;}

  .sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);opacity:0;pointer-events:none;transition:opacity .2s ease;z-index:29;}
  .sidebar-overlay.show{opacity:1;pointer-events:auto;}

  @media (max-width: 900px){
    .sidebar{
      position:fixed;top:0;left:0;bottom:0;z-index:30;
      transform:translateX(-100%);transition:transform .25s ease;
      width:250px;
    }
    .sidebar.show{transform:translateX(0);}
    .mobile-topbar{
      display:flex;align-items:center;gap:14px;
      background:linear-gradient(180deg,var(--navy) 0%,#0A2F4D 100%);color:#EAF0F4;
      padding:14px 16px;border-bottom:2px solid var(--gold);
      position:sticky;top:0;z-index:10;
    }
    .mobile-topbar button{background:none;border:none;color:#EAF0F4;font-size:20px;cursor:pointer;padding:0;line-height:1;}
    .mobile-topbar span{font-weight:600;font-size:14.5px;}
  }
  .who{text-align:right;font-size:12px;color:#A9BFD1;line-height:1.6;}
  .who b{color:#EAF0F4;font-weight:600;}
  .badge{display:inline-block;background:rgba(255,255,255,0.14);color:#EAF0F4;font-size:10.5px;padding:2px 8px;border-radius:20px;margin-left:6px;}
  .logout-btn{margin-top:6px;font-size:11.5px;color:#A9BFD1;background:transparent;border:1px solid rgba(255,255,255,0.25);padding:5px 12px;border-radius:20px;cursor:pointer;}
  .logout-btn:hover{color:#EAF0F4;border-color:rgba(255,255,255,0.5);}

  .wrap{max-width:1280px;margin:0 auto;padding:18px 18px 60px;}
  .wrap.fade-in{animation:fadeIn .3s ease;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
  @keyframes splashPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.72;transform:scale(0.93);}}

  .state-box{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:40px 20px;text-align:center;color:var(--ink-soft);font-size:13.5px;}
  .state-box.error{color:#8C2F2F;background:#FCF3F2;border-color:#F2D6D3;}
  .state-box.error .err-icon{font-size:26px;margin-bottom:10px;}
  .spinner{width:26px;height:26px;border:3px solid var(--line);border-top-color:var(--navy-lighter);border-radius:50%;margin:0 auto 14px;animation:spin .8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}

  .skeleton-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px;}
  .skel{border-radius:12px;height:78px;background:linear-gradient(90deg, var(--surface-alt) 25%, #E4EDF3 37%, var(--surface-alt) 63%);background-size:400% 100%;animation:shimmer 1.4s ease infinite;}
  .skel.tall{height:150px;}
  @keyframes shimmer{0%{background-position:100% 0;}100%{background-position:0 0;}}

  .panel-title{font-size:12px;text-transform:uppercase;letter-spacing:0.6px;color:var(--ink-soft);margin:0 0 10px 2px;font-weight:600;}

  .grand-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px;}
  .grand-card{background:linear-gradient(155deg,var(--navy) 0%,#0A2F4D 100%);color:#EAF0F4;border-radius:12px;padding:18px 20px;box-shadow:0 6px 20px rgba(11,61,98,0.18);position:relative;overflow:hidden;transition:transform .18s ease, box-shadow .18s ease;}
  .grand-card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(11,61,98,0.26);}
  .grand-card::after{content:'';position:absolute;top:-30%;right:-15%;width:140px;height:140px;background:radial-gradient(circle,rgba(200,138,46,0.18) 0%,transparent 70%);}
  .grand-card .lbl{font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#9FC3DC;}
  .grand-card .val{font-family:var(--mono);font-size:23px;font-weight:700;margin-top:5px;letter-spacing:-0.3px;}

  .bucket-bar{display:flex;height:32px;border-radius:8px;overflow:hidden;box-shadow:0 1px 2px rgba(20,30,40,0.12);margin-bottom:8px;cursor:pointer;}
  .bucket-seg{height:100%;transition:opacity .15s ease;}
  .bucket-seg.dim{opacity:0.32;}
  .bucket-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:22px;}
  .bucket-chip{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-soft);cursor:pointer;padding:3px 6px;border-radius:5px;user-select:none;}
  .bucket-chip.active{background:var(--surface);box-shadow:0 0 0 1px var(--line);color:var(--ink);font-weight:600;}
  .swatch{width:9px;height:9px;border-radius:2px;display:inline-block;flex:none;}
  .bucket-chip .n{font-family:var(--mono);color:var(--ink-soft);}

  .co-row, .role-row, .status-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:20px;}
  .status-card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px;cursor:pointer;transition:box-shadow .18s ease, transform .18s ease;position:relative;overflow:hidden;}
  .status-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--gold);transform:scaleX(0);transition:transform .18s ease;transform-origin:left;}
  .status-card:hover{box-shadow:0 6px 16px rgba(20,30,40,0.1);transform:translateY(-1px);}
  .status-card:hover::before, .status-card.active::before{transform:scaleX(1);}
  .status-card.active{border-color:var(--navy-lighter);box-shadow:0 0 0 1px var(--navy-lighter);}
  .status-card .bhead{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;}
  .status-card .bname{font-weight:700;font-size:13.5px;}
  .status-card .btotal{font-family:var(--mono);font-size:11.5px;color:var(--ink-soft);}
  .status-card .srow{display:flex;justify-content:space-between;align-items:center;font-size:11.5px;padding:4px 0;border-top:1px dashed var(--line);}
  .status-card .srow .slabel{display:flex;align-items:center;gap:5px;color:var(--ink-soft);}
  .status-card .srow .sval{font-family:var(--mono);font-weight:600;color:var(--ink);text-align:right;}
  .status-card .dot{width:7px;height:7px;border-radius:50%;display:inline-block;}
  .dot.good{background:var(--good);}
  .dot.bad{background:var(--bad);}
  .co-card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px;cursor:pointer;transition:box-shadow .18s ease, transform .18s ease;}
  .co-card:hover{box-shadow:0 6px 16px rgba(20,30,40,0.1);transform:translateY(-1px);}
  .co-card.active{border-color:var(--navy-lighter);box-shadow:0 0 0 1px var(--navy-lighter);}
  .co-card .name{font-weight:600;font-size:13px;}
  .co-card .role{font-size:11px;color:var(--ink-soft);}
  .co-card .stats{display:flex;justify-content:space-between;margin-top:8px;font-size:11.5px;color:var(--ink-soft);}
  .co-card .stats b{display:block;font-family:var(--mono);font-size:13.5px;color:var(--ink);font-weight:600;}

  .controls{display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap;}
  .search-box{flex:1;min-width:200px;position:relative;}
  .search-box input{width:100%;padding:9px 12px 9px 32px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--surface);color:var(--ink);font-family:var(--sans);}
  .search-box input:focus{outline:none;border-color:var(--navy-lighter);}
  .search-box svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:0.45;}
  .filter-select{font-size:12.5px;color:var(--ink);background:var(--surface);border:1px solid var(--line);padding:8px 10px;border-radius:7px;font-family:var(--sans);}
  .multi-select{position:relative;display:inline-block;}
  .multi-select-btn{
    -webkit-appearance:none;appearance:none;
    cursor:pointer;text-align:left;min-width:130px;
    display:flex;align-items:center;justify-content:space-between;gap:8px;
    font-weight:400;color:var(--ink);font-family:var(--sans);
    background:var(--surface);border:1px solid var(--line);outline:none;
  }
  .multi-select-btn:focus, .multi-select-btn:active{
    background:var(--surface);border-color:var(--navy-lighter);
    box-shadow:0 0 0 3px rgba(58,102,144,0.12);
  }
  .multi-select-btn::after{content:'▾';font-size:10px;color:var(--ink-soft);}
  .multi-select-panel{display:none;position:absolute;top:calc(100% + 6px);left:0;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 28px rgba(20,30,40,0.16);padding:12px;z-index:15;min-width:220px;}
  .multi-select-panel.show{display:block;}
  .ms-panel-title{font-size:10.5px;text-transform:uppercase;letter-spacing:0.4px;color:var(--ink-soft);margin:0 0 8px;font-weight:600;}
  .ms-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px 10px;}
  .ms-option{display:flex;align-items:center;gap:6px;font-size:12.5px;padding:5px 4px;border-radius:5px;cursor:pointer;color:var(--ink);}
  .ms-option:hover{background:var(--surface-alt);}
  .ms-option input{cursor:pointer;accent-color:var(--navy);width:14px;height:14px;flex:none;}
  .ms-panel-footer{display:flex;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid var(--line);}
  .ms-link-btn{background:none;border:none;color:var(--navy-lighter);font-size:11.5px;font-weight:600;cursor:pointer;padding:0;}
  .ms-link-btn:hover{text-decoration:underline;}

  .pill-toggle{display:inline-flex;background:var(--surface-alt);border-radius:20px;padding:3px;border:1px solid var(--line);}
  .pill-toggle button{border:none;background:none;padding:7px 18px;border-radius:16px;font-size:12.5px;font-weight:600;color:var(--ink-soft);cursor:pointer;font-family:var(--sans);transition:background .15s ease,color .15s ease;}
  .pill-toggle button.active{background:var(--navy);color:#fff;}

  .rk-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;}
  .rk-header h1{font-size:17px;margin:0;color:var(--ink);font-weight:700;}
  .rk-date{font-size:12px;color:var(--ink-soft);font-family:var(--mono);}

  .rk-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;}
  @media (max-width:900px){ .rk-grid{grid-template-columns:1fr;} }

  .bar-list{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:4px 14px;}
  .bar-row{padding:8px 0;border-bottom:1px solid var(--line);}
  .bar-row:last-child{border-bottom:none;}
  .bar-row.emphasis{background:linear-gradient(90deg,var(--gold-soft),transparent);margin:0 -14px;padding:8px 14px;border-radius:6px;border-bottom:none;}
  .bar-row-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px;}
  .bar-row-label{font-weight:600;font-size:12px;color:var(--ink);}
  .bar-row-meta{font-size:10.5px;color:var(--ink-soft);font-family:var(--mono);white-space:nowrap;}
  .bar-row-right{display:flex;align-items:baseline;gap:8px;flex:none;}
  .bar-row-amount{font-family:var(--mono);font-size:11px;color:var(--ink);}
  .bar-row-pct{font-family:var(--mono);font-weight:700;font-size:12px;color:var(--navy);min-width:48px;text-align:right;}
  .bar-track{height:5px;border-radius:3px;background:var(--surface-alt);overflow:hidden;}
  .bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--navy-lighter),var(--navy));transition:width .5s ease;}
  .bar-fill.gold{background:linear-gradient(90deg,var(--gold),#8a5f1f);}

  .rk-report-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:22px 24px;}
  .rk-report-header{text-align:center;padding-bottom:14px;margin-bottom:16px;border-bottom:2px solid var(--gold);}
  .rk-report-title{font-size:16px;font-weight:800;color:var(--navy);letter-spacing:0.3px;}
  .rk-report-date{font-size:11.5px;color:var(--ink-soft);margin-top:3px;font-family:var(--mono);}
  .rk-hero-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}
  .rk-hero-card{background:#0B3D62;border-radius:9px;padding:10px 14px;text-align:center;}
  .rk-hero-card .lbl{font-size:10px;color:#9FC3DC;margin:0;text-transform:uppercase;letter-spacing:0.3px;}
  .rk-hero-card .val{font-size:17px;font-weight:700;color:#fff;margin-top:2px;font-family:var(--mono);}

  .rk-compact .ins-section{margin-bottom:14px;}
  .rk-compact .ins-section h2{margin-bottom:6px;font-size:11px;}
  .rk-compact .bar-list{padding:2px 12px;}
  .rk-compact .bar-row{padding:6px 0;}
  .rk-compact .bar-row.emphasis{padding:6px 12px;margin:0 -12px;}
  .rk-compact .bar-row-top{margin-bottom:4px;}
  .rk-compact .bar-row-label{font-size:11.5px;}
  .rk-compact .bar-row-meta{font-size:10px;}
  .rk-compact .bar-row-amount{font-size:11px;}
  .rk-compact .bar-row-pct{font-size:12px;min-width:48px;}
  .rk-compact .bar-track{height:5px;}

  .bigcust-card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:10px;}
  .bigcust-card:last-child{margin-bottom:0;}
  .bigcust-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--line);}
  .bigcust-head .bname{font-weight:700;font-size:12.5px;color:var(--ink);}
  .bigcust-head .btotal{font-size:11px;color:var(--ink-soft);font-family:var(--mono);}
  .bigcust-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;}
  .bigcust-stat{font-size:11px;}
  .bigcust-stat .dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;}
  .bigcust-stat .dot.good{background:var(--good);}
  .bigcust-stat .dot.bad{background:var(--bad);}
  .bigcust-stat b{display:block;font-family:var(--mono);font-size:12.5px;margin-top:2px;}
  .bigcust-co-list{background:var(--surface-alt);border-radius:7px;padding:7px 10px;}
  .bigcust-co-row{display:flex;justify-content:space-between;font-size:10.5px;padding:2px 0;}
  .bigcust-co-row .n{color:var(--ink-soft);}
  .bigcust-detail-list{margin-top:8px;border-top:1px dashed var(--line);padding-top:8px;}
  .bigcust-detail-row{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;padding:3px 0;}
  .bigcust-detail-name{flex:1;color:var(--ink);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .bigcust-detail-co{color:var(--ink-soft);flex:none;}
  .bigcust-detail-sipok{font-family:var(--mono);flex:none;color:var(--bad);}
  .bigcust-detail-more{font-size:10px;color:var(--ink-soft);text-align:center;padding-top:4px;font-style:italic;}

  .update-banner{
    position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
    background:var(--navy);color:#fff;padding:12px 14px 12px 18px;border-radius:12px;
    display:flex;align-items:center;gap:14px;box-shadow:0 10px 30px rgba(0,0,0,0.3);
    z-index:50;font-size:13px;animation:fadeIn .3s ease;max-width:92vw;
  }
  .update-banner button{border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:var(--sans);}
  .update-banner #updateBannerBtn{background:var(--gold);color:#1a1204;}
  .update-banner #updateBannerClose{background:none;color:#B8CBDA;padding:4px 6px;}

  .filter-drawer{position:relative;display:inline-block;}
  .filter-trigger-btn{display:flex;align-items:center;gap:7px;}
  .filter-badge{background:var(--navy);color:#fff;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:20px;display:inline-flex;align-items:center;}
  .filter-drawer-panel{
    display:none;position:absolute;top:calc(100% + 6px);right:0;
    background:var(--surface);border:1px solid var(--line);border-radius:12px;
    box-shadow:0 14px 32px rgba(20,30,40,0.18);
    padding:16px;z-index:16;width:300px;max-height:75vh;overflow-y:auto;
  }
  .filter-drawer-panel.show{display:block;}
  .fd-header{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--line);}
  .fd-field{margin-bottom:14px;}
  .fd-field:last-child{margin-bottom:0;}

  @media (max-width:680px){
    .filter-drawer-panel{
      position:fixed;
      left:14px; right:14px; bottom:14px; top:auto;
      width:auto; max-height:75vh;
      box-shadow:0 -8px 30px rgba(0,0,0,0.25);
      z-index:40;
    }
  }

  @media (max-width:680px){
    .multi-select-panel{
      position:fixed;
      left:14px; right:14px; bottom:14px; top:auto;
      width:auto; min-width:0;
      max-height:60vh;
      box-shadow:0 -8px 30px rgba(0,0,0,0.25);
      z-index:40;
    }
    .ms-grid{grid-template-columns:repeat(3,1fr);}
  }
  .btn{font-size:12.5px;color:var(--navy);background:var(--surface);border:1px solid var(--line);padding:8px 13px;border-radius:7px;cursor:pointer;white-space:nowrap;}
  .btn.primary{background:var(--navy);color:#fff;border-color:var(--navy);}
  .count-note{font-size:12px;color:var(--ink-soft);margin:0 0 10px 2px;}
  .count-note b{color:var(--ink);}
  .active-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}
  .chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:4px 6px 4px 11px;font-size:11.5px;color:var(--ink-soft);}
  .chip b{color:var(--ink);font-weight:600;}
  .chip-x{cursor:pointer;color:var(--ink-soft);font-weight:700;padding:1px 6px;border-radius:50%;line-height:1;}
  .chip-x:hover{color:#fff;background:var(--bad);}

  .tabs{display:flex;gap:6px;margin-bottom:14px;}
  .tab-btn{font-size:12.5px;padding:8px 14px;border-radius:7px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer;}
  .tab-btn.active{background:var(--navy);color:#fff;border-color:var(--navy);font-weight:600;}
  .tab-btn .n{font-family:var(--mono);}

  .table-scroll{background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:auto;}
  table{border-collapse:collapse;width:100%;font-size:13px;min-width:900px;}
  thead th{position:sticky;top:0;background:var(--surface-alt);text-align:left;padding:9px 11px;font-size:11px;text-transform:uppercase;color:var(--ink-soft);border-bottom:1px solid var(--line);cursor:pointer;white-space:nowrap;}
  tbody td{padding:9px 11px;border-bottom:1px solid var(--line);white-space:nowrap;}
  tbody tr{cursor:pointer;}
  tbody tr:hover td{background:#F5F8F9;}
  tbody tr:nth-child(even) td{background:var(--surface-alt);}
  .num{font-family:var(--mono);text-align:right;}
  .mono{font-family:var(--mono);}
  .bucket-flow{display:flex;align-items:center;gap:5px;font-size:11px;}
  .bpill{display:inline-block;padding:2px 7px;border-radius:20px;font-size:10.5px;font-weight:600;color:#fff;font-family:var(--mono);}
  .status-pill{font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;}
  .status-belum{background:#F7E4E1;color:var(--bad);}
  .status-sudah{background:#E1EFE6;color:var(--good);}
  .status-lunas{background:#E2E9F2;color:var(--navy);}
  .nbq-pill{font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap;}
  .nbq-AUTO_APPROVAL{background:#E1EFE6;color:var(--good);}
  .nbq-NORMAL{background:#E2E9F2;color:var(--navy);}
  .nbq-PRE_APPROVAL{background:#FBEBD6;color:#B8621B;}
  .nbq-APPEAL{background:#F7E4E1;color:var(--bad);}
  .empty-row td{text-align:center;padding:36px;color:var(--ink-soft);}

  /* ---------- Insentif ---------- */
  .ins-section{margin-bottom:26px;}
  .ins-section h2{font-size:13px;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-soft);margin:0 0 12px;border-bottom:1px solid var(--line);padding-bottom:8px;}
  .ins-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;}
  .ins-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px 20px;box-shadow:0 2px 8px rgba(20,30,40,0.05);}
  .ins-card .ihead{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;}
  .ins-card .iname{font-weight:700;font-size:14.5px;}
  .ins-card .irole{font-size:11px;color:var(--ink-soft);}
  .kategori-pill{font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap;}
  .kat-UNACCEPTABLE{background:#F7E4E1;color:var(--bad);}
  .kat-NEED_IMPROVEMENT{background:#FBEBD6;color:#B8621B;}
  .kat-ON_TARGET{background:#E2E9F2;color:var(--navy);}
  .kat-EXCEED_TARGET{background:#E1EFE6;color:var(--good);}
  .kat-EXCEPTIONAL{background:var(--gold-soft);color:var(--gold);}
  .ins-metric{display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-top:1px dashed var(--line);}
  .ins-metric .mlabel{color:var(--ink-soft);}
  .ins-metric .mval{font-family:var(--mono);font-weight:600;}
  .ins-nilai{font-family:var(--mono);font-size:22px;font-weight:700;color:var(--navy);margin:10px 0 4px;}
  .ins-insentif{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--good);}
  .ins-total-card{background:linear-gradient(155deg,var(--navy) 0%,#0A2F4D 100%);border-color:var(--navy);}
  .ins-total-card .iname{color:#fff;}
  .ins-total-card .irole{color:#BFD2E0;}
  .ins-total-card .ins-metric{border-top-color:rgba(255,255,255,0.18);}
  .ins-total-card .ins-metric .mlabel{color:#BFD2E0;}
  .ins-total-card .ins-metric .mval{color:#EAF0F4;}
  .ins-total-card .ins-nilai{color:#fff;}
  .ins-total-card .ins-insentif{color:#8FE0B4;}
  .ins-total-label{font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#BFD2E0;margin-top:14px;}
  .ins-total-val{font-family:var(--mono);font-size:26px;font-weight:700;color:#fff;margin-top:2px;}
  .ins-gap{margin-top:12px;padding:10px 12px;background:var(--surface-alt);border-radius:8px;font-size:12px;color:var(--ink-soft);}
  .ins-gap b{color:var(--ink);}
  .ins-rekom{margin-top:10px;}
  .ins-rekom-item{display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-top:1px solid var(--line);}
  .ins-rekom-item .rname{color:var(--ink);}
  .ins-rekom-item .rval{font-family:var(--mono);color:var(--ink-soft);white-space:nowrap;margin-left:8px;}
  .sim-intro{background:var(--surface-alt);border:1px solid var(--line);border-radius:10px;padding:12px 16px;font-size:12.5px;color:var(--ink-soft);margin-bottom:18px;line-height:1.5;}
  .sim-co-select{margin-bottom:18px;}
  .sim-kontrak-list{display:flex;flex-direction:column;gap:8px;margin-top:10px;}
  .sim-kontrak-item{display:flex;flex-wrap:wrap;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 14px;}
  .sim-kontrak-item:hover{border-color:var(--navy);}
  .sim-kontrak-info{flex:1;min-width:180px;}
  .sim-proyeksi-group{display:flex;gap:6px;flex-shrink:0;margin-left:auto;}
  .sim-proyeksi-btn{font-size:11.5px;font-weight:600;padding:6px 11px;border-radius:8px;border:1px solid var(--line);background:var(--surface-alt);color:var(--ink-soft);cursor:pointer;white-space:nowrap;transition:all .12s;}
  .sim-proyeksi-btn:hover{border-color:var(--navy);color:var(--navy);}
  .sim-proyeksi-stay.active{background:#FBEBD6;border-color:#B8621B;color:#B8621B;}
  .sim-proyeksi-btc.active{background:#E1EFE6;border-color:var(--good);color:var(--good);}
  .sim-kontrak-name{font-weight:600;font-size:13px;}
  .sim-kontrak-kontrak{font-family:var(--mono);font-weight:400;font-size:11px;color:var(--ink-soft);margin-left:6px;}
  .sim-kriteria-badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;text-transform:uppercase;letter-spacing:0.3px;margin-left:6px;vertical-align:middle;}
  .sim-kriteria-STAY{background:#FBEBD6;color:#B8621B;}
  .sim-kriteria-FLOW{background:#F7E4E1;color:var(--bad);}
  .sim-kriteria-ROLLBACK{background:#E1EFE6;color:var(--good);}
  .sim-kontrak-meta{font-size:11.5px;color:var(--ink-soft);margin-top:2px;}
  .sim-kontrak-sipok{font-family:var(--mono);font-size:12.5px;font-weight:600;white-space:nowrap;}
  .sim-target-badge{font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;margin-left:8px;vertical-align:middle;text-transform:none;letter-spacing:0;}
  .sim-target-ok{background:#E1EFE6;color:var(--good);}
  .sim-target-bad{background:#F7E4E1;color:var(--bad);}
  .view-toggle-note{font-size:11.5px;color:var(--ink-soft);margin-bottom:14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;}
  .view-toggle-note:hover{color:var(--navy);}

  .overlay{position:fixed;inset:0;background:rgba(15,25,35,0.35);opacity:0;pointer-events:none;transition:opacity .18s ease;z-index:20;}
  .overlay.show{opacity:1;pointer-events:auto;}
  .side-panel{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:92vw;background:var(--surface);box-shadow:-6px 0 24px rgba(15,25,35,0.18);transform:translateX(100%);transition:transform .22s ease;z-index:21;overflow-y:auto;}
  .side-panel.show{transform:translateX(0);}
  .panel-head{background:var(--navy);color:#EAF0F4;padding:18px 20px;position:sticky;top:0;}
  .panel-head .pk{font-size:10.5px;text-transform:uppercase;color:#A9BFD1;margin-bottom:4px;}
  .panel-head h2{margin:0;font-size:16px;font-weight:600;}
  .panel-head .kontrak{font-family:var(--mono);font-size:12px;color:#BFD2E0;margin-top:4px;}
  .panel-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.12);border:none;color:#EAF0F4;width:24px;height:24px;border-radius:6px;cursor:pointer;}
  .panel-body{padding:16px 20px 40px;}
  .field-group{margin-bottom:18px;}
  .field-group h3{font-size:10.5px;text-transform:uppercase;color:var(--ink-soft);margin:0 0 8px;border-bottom:1px solid var(--line);padding-bottom:5px;}
  .field-row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:12.5px;}
  .field-row .k{color:var(--ink-soft);flex:none;width:44%;}
  .field-row .v{text-align:right;font-weight:500;word-break:break-word;}
  .edit-label{display:block;font-size:11px;color:var(--ink-soft);margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;}
  .edit-input, .edit-textarea{width:100%;border:1px solid var(--line);border-radius:7px;padding:8px 10px;font-size:13px;font-family:var(--sans);color:var(--ink);background:var(--surface-alt);box-sizing:border-box;}
  .edit-input:focus, .edit-textarea:focus{outline:none;border-color:var(--navy-lighter);background:var(--surface);}
  .edit-textarea{min-height:70px;resize:vertical;}

  @media (max-width:680px){
    .topbar{padding:14px 16px 13px;}
    .topbar h1{font-size:15.5px;line-height:1.3;}
    .topbar .sub{font-size:11px;}
    .topbar-inner{flex-direction:column;align-items:stretch;gap:10px;}
    .who{
      display:flex;align-items:center;gap:6px;
      text-align:left;width:100%;
    }
    .who #whoBox{display:flex;align-items:center;gap:6px;min-width:0;flex:1;overflow:hidden;}
    .who-email{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
    .badge{flex:none;}
    #insentifBtn{margin-right:0 !important;font-size:10.5px;padding:5px 9px;}
    .logout-btn{margin-top:0;flex:none;}
    table, thead, tbody, th, td, tr{display:block;}
    thead tr{display:none;}
    table{min-width:0;}
    tbody tr{margin:10px;border:1px solid var(--line);border-radius:10px;overflow:hidden;}
    tbody td{display:flex;justify-content:space-between;align-items:center;text-align:right;padding:8px 12px;border-bottom:1px solid var(--line);white-space:normal;}
    tbody td:last-child{border-bottom:none;}
    tbody td::before{content:attr(data-label);font-weight:600;color:var(--ink-soft);text-align:left;margin-right:10px;font-size:11px;text-transform:uppercase;}
    .table-scroll{overflow:visible;background:transparent;border:none;}
  }
</style>
</head>
<body>

<div id="splashScreen" style="position:fixed;inset:0;z-index:999;background:linear-gradient(180deg,#0B3D62 0%,#071F33 100%);display:flex;align-items:center;justify-content:center;transition:opacity .4s ease;">
  <img src="icon-192.png" alt="" style="width:68px;height:68px;border-radius:15px;animation:splashPulse 1.4s ease-in-out infinite;">
</div>

<div id="loginScreen" class="login-wrap">
  <div class="login-card">
    <img src="icon-192.png" alt="CORE Kendal">
    <h1>Monitoring System CORE Kendal</h1>
    <p>Login pakai akun Google yang terdaftar untuk melihat data kontrak collection.</p>
    <div id="gsiButton"></div>
    <div class="login-error" id="loginError"></div>
  </div>
</div>

<div id="appScreen" style="display:none;">
  <div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <img src="icon-192.png" alt="CORE Kendal">
        <div>
          <div class="sb-title">CORE Kendal</div>
          <div class="sb-sub">Monitoring System</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <button class="nav-item nav-hidden" data-view="ringkasan" id="navRingkasan">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
          <span>Dashboard</span>
        </button>
        <button class="nav-item active" data-view="dashboard" id="navDashboard">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="14"/></svg>
          <span>Beban Awal</span>
        </button>
        <button class="nav-item" data-view="nbq" id="navNBQ">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
          <span>NBQ</span>
        </button>
        <button class="nav-item nav-hidden" data-view="feever" id="navFEEver">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4-4 4"/><path d="M21 7H9a4 4 0 0 0-4 4v1"/><path d="M7 21l-4-4 4-4"/><path d="M3 17h12a4 4 0 0 0 4-4v-1"/></svg>
          <span>FE Ever</span>
        </button>
        <button class="nav-item nav-hidden" data-view="tglbayar" id="navTglBayar">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg>
          <span>Tanggal Bayar Bulan Lalu</span>
        </button>
        <button class="nav-item" data-view="insentif" id="navInsentif">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9.3c0-1 1-1.7 3-1.7s3 .7 3 1.7-1.1 1.4-3 1.7-3 .7-3 1.7 1.2 1.8 3 1.8 3-.7 3-1.8"/><line x1="12" y1="6" x2="12" y2="7.1"/><line x1="12" y1="16.9" x2="12" y2="18"/></svg>
          <span>Insentif</span>
        </button>
        <button class="nav-item nav-hidden" data-view="dekscall" id="navDekscall">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.34 1.9.63 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.29 1.85.5 2.81.63A2 2 0 0 1 22 16.92z"/></svg>
          <span>Dekscall</span>
        </button>
        <button class="nav-item" data-view="simulasirapor" id="navSimulasiRapor">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.1-2.8-2.8L7 14"/><circle cx="18.7" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>
          <span>Simulasi Rapor</span>
        </button>
        <button class="nav-item" data-view="simulasi" id="navSimulasi">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="10" y2="11"/><line x1="13" y1="11" x2="15" y2="11"/><line x1="8" y1="15" x2="10" y2="15"/><line x1="13" y1="15" x2="15" y2="15"/></svg>
          <span>Simulasi Penawaran</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <div id="whoBox">Memuat akun…</div>
        <button class="logout-btn" id="logoutBtn">Keluar</button>
      </div>
    </aside>
    <div class="main-area">
      <div class="mobile-topbar">
        <button id="menuToggle" aria-label="Menu">☰</button>
        <span id="mobilePageTitle">Beban Awal</span>
      </div>
      <div class="wrap" id="wrap">
        <div class="state-box" id="stateBox"><div class="spinner"></div>Memuat data dari sheet…</div>
      </div>
    </div>
  </div>
</div>

<div class="sidebar-overlay" id="sidebarOverlay"></div>

<div class="overlay" id="overlay"></div>
<div class="side-panel" id="sidePanel">
  <div class="panel-head">
    <button class="panel-close" id="panelClose">✕</button>
    <div class="pk" id="panelCO"></div>
    <h2 id="panelName"></h2>
    <div class="kontrak" id="panelKontrak"></div>
    <a href="#" target="_blank" rel="noopener" id="panelWaBtn" style="display:none;margin-top:10px;align-items:center;gap:6px;background:#25D366;color:#fff;font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:20px;text-decoration:none;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9s-4.44-9.9-9.91-9.9zm0 18.1a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 1 1 6.97 3.85z"/></svg>
      Chat WhatsApp
    </a>
  </div>
  <div class="panel-body" id="panelBody"></div>
</div>

<script>
const GOOGLE_CLIENT_ID = '579330745631-av2lgoobdsv4mnflu91rfgablc0ug2lr.apps.googleusercontent.com';

const BUCKET_ORDER = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210','P211_240'];
const BUCKET_COLOR = {
  'NOOD':'#3E7D5C','P001_030':'#B08A2E','P031_060':'#C4802E','P061_090':'#BC642F',
  'P091_120':'#AE4C36','P121_150':'#9C3C41','P151_180':'#87304C','P181_210':'#6C2851',
  'P211_240':'#4F1F4F','NA':'#8A9096'
};
const CO_META = {
  'ACHMAD RAHUL HIDAYAT': {short:'Rahul', role:'Front End'},
  'MOHAMAD IZZA ULIL WAFA': {short:'Izza', role:'Front End'},
  'SIGIT KURNIAWAN': {short:'Sigit', role:'Mid Range'}
};
const FIELD_GROUPS = [
  { title:'Identitas & Alamat', fields:['KELURAHAN','KECAMATAN','ALAMAT','NO HP','WHATSAPP'] },
  { title:'Kontrak & Unit', fields:['TYPE BARANG','NOPOL','TYPE UNIT','GROUP PRODUCT','FLEET/NON FLEET','KRITERIA ACCT'] },
  { title:'Keuangan', fields:['SIPOK','ANGSURAN','ANGS KE','TENOR','JATUH TEMPO','TANGGAL BAYAR BULAN LALU'] },
  { title:'Tim & Status', fields:['CO FE','CO TAMBAHAN','CMO','EMAIL CO','FLAG TARGET BULAN INI','BUCKET EVER','PEKERJAAN KONSUMEN'] },
];

let DATA = [];
let ESCALATIONS = [];
let ROLE_INFO = null;
let IS_ADMIN = false;
let IS_DESKCALL = false;
let USER_EMAIL = '';
let ID_TOKEN = null;
let state = { search:'', co:'ALL', bucket:'ALL', kriteria:'ALL', tipe:'ALL', kecamatan:'ALL', ever:'ALL', janjiList:[], sortKey:'JATUH TEMPO', sortDir:1, tab:'own' };

function fmtBucket(b){ return (b||'-').replace('_','-'); }
function fmtRupiah(n){ if(typeof n !== 'number') return '-'; return 'Rp' + Math.round(n).toLocaleString('id-ID'); }
function fmtDate(s){ if(!s) return '-'; const d = new Date(s); if(isNaN(d)) return s; return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
function statusClass(s){ if(!s) return ''; const u=s.toUpperCase(); if(u.includes('LUNAS')) return 'status-lunas'; if(u.includes('SUDAH')) return 'status-sudah'; return 'status-belum'; }

// ---------- LOGIN (Google Identity Services) ----------
window.onload = function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: true
  });
  google.accounts.id.renderButton(document.getElementById('gsiButton'), { theme:'outline', size:'large', text:'signin_with', shape:'pill' });
  google.accounts.id.prompt();

  setTimeout(function () {
    const splash = document.getElementById('splashScreen');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 400);
    }
  }, 250);
};

let LAST_KNOWN_MODIFIED = null;

function startUpdateWatcher(){
  checkForUpdate(true); // simpan baseline dulu, jangan langsung munculin banner
  setInterval(() => checkForUpdate(false), 2 * 60 * 1000); // cek tiap 2 menit
}

function checkForUpdate(isBaseline){
  fetch('/api/check-update', { headers: { Authorization: 'Bearer ' + ID_TOKEN } })
    .then(r => r.json().then(body => ({ ok: r.ok, body })))
    .then(({ok, body}) => {
      if(!ok || !body.modifiedTime) return;
      if(isBaseline || !LAST_KNOWN_MODIFIED){
        LAST_KNOWN_MODIFIED = body.modifiedTime;
        return;
      }
      if(body.modifiedTime !== LAST_KNOWN_MODIFIED){
        showUpdateBanner();
      }
    })
    .catch(() => {}); // gagal cek update nggak perlu ganggu user, diam-diam aja
}

function showUpdateBanner(){
  if(document.getElementById('updateBanner')) return; // sudah tampil, jangan dobel
  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.className = 'update-banner';
  banner.innerHTML = `
    <span>🔄 Data spreadsheet baru saja diperbarui</span>
    <button id="updateBannerBtn">Muat Ulang</button>
    <button id="updateBannerClose" aria-label="Tutup">✕</button>
  `;
  document.body.appendChild(banner);
  document.getElementById('updateBannerBtn').addEventListener('click', () => {
    LAST_KNOWN_MODIFIED = null;
    banner.remove();
    if(VIEW_MODE === 'ringkasan') loadRingkasan();
    else if(VIEW_MODE === 'dashboard') loadData();
    else if(VIEW_MODE === 'nbq' || VIEW_MODE === 'feever' || VIEW_MODE === 'tglbayar') loadData();
    else if(VIEW_MODE === 'insentif') loadInsentif();
    else if(VIEW_MODE === 'simulasirapor') loadSimulasiRapor(SIMULASI_RAPOR_DATA ? SIMULASI_RAPOR_DATA.namaCO : null);
  });
  document.getElementById('updateBannerClose').addEventListener('click', () => {
    LAST_KNOWN_MODIFIED = null; // reset biar nggak nge-banner ulang terus untuk perubahan yang sama
    banner.remove();
  });
}

let hasInitializedApp = false;
let hasLoggedInOnce = false;
function handleCredentialResponse(response) {
  ID_TOKEN = response.credential;
  if (!hasLoggedInOnce) {
    hasLoggedInOnce = true;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    loadData();
    startSilentSessionRefresh();
    startUpdateWatcher();
  }
  // Kalau ini refresh diam-diam (bukan login pertama), cukup update ID_TOKEN tanpa ganggu tampilan.
}

function startSilentSessionRefresh(){
  setInterval(() => {
    google.accounts.id.prompt();
  }, 45 * 60 * 1000); // setiap 45 menit, biar token selalu segar tanpa perlu login manual
}

function doLogout() {
  google.accounts.id.disableAutoSelect();
  ID_TOKEN = null;
  hasLoggedInOnce = false;
  DATA = []; ESCALATIONS = []; ROLE_INFO = null;
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}
document.getElementById('logoutBtn').addEventListener('click', doLogout);
document.getElementById('navRingkasan').addEventListener('click', () => switchView('ringkasan'));
document.getElementById('navDashboard').addEventListener('click', () => switchView('dashboard'));
document.getElementById('navNBQ').addEventListener('click', () => switchView('nbq'));
document.getElementById('navFEEver').addEventListener('click', () => switchView('feever'));
document.getElementById('navTglBayar').addEventListener('click', () => switchView('tglbayar'));
document.getElementById('navInsentif').addEventListener('click', () => switchView('insentif'));
document.getElementById('navSimulasiRapor').addEventListener('click', () => switchView('simulasirapor'));
document.getElementById('navDekscall').addEventListener('click', () => switchView('dekscall'));
document.getElementById('navSimulasi').addEventListener('click', () => switchView('simulasi'));
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('show');
  document.getElementById('sidebarOverlay').classList.add('show');
});
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebarDrawer);
function closeSidebarDrawer(){
  document.getElementById('sidebar').classList.remove('show');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ---------- DATA LOADING ----------
function loadData(){
  document.getElementById('wrap').innerHTML = `
    <div class="skeleton-row">
      <div class="skel"></div><div class="skel"></div>
    </div>
    <div class="skeleton-row">
      <div class="skel"></div><div class="skel"></div><div class="skel"></div>
    </div>
    <div class="skel tall"></div>
  `;
  fetch('/api/data', { headers: { Authorization: 'Bearer ' + ID_TOKEN } })
    .then(r => r.json().then(body => ({ ok: r.ok, body })))
    .then(({ok, body}) => {
      if(!ok){ onLoadError(body); return; }
      onDataLoaded(body);
    })
    .catch(err => onLoadError({error: err.message}));
}

function onLoadError(err){
  document.getElementById('wrap').innerHTML =
    '<div class="state-box error"><div class="err-icon">⚠</div>' + (err.error || 'Terjadi kesalahan.') + '<br><br>' +
    '<button class="btn" onclick="loadData()">Coba lagi</button></div>';
}

function onDataLoaded(res){
  DATA = res.records; IS_ADMIN = res.isAdmin; USER_EMAIL = res.email;
  ESCALATIONS = res.escalations || []; ROLE_INFO = res.roleInfo || null;
  IS_DESKCALL = !!(ROLE_INFO && ROLE_INFO.role === 'DESKCALL');
  state.tab = 'own';

  if(!IS_ADMIN && !IS_DESKCALL && ROLE_INFO){
    const allowedBuckets = getBucketOptions();
    DATA = DATA.filter(r => allowedBuckets.includes(r['BUCKET AWAL']));
  }

  document.getElementById('whoBox').innerHTML =
    '<span class="who-email">Masuk sebagai <b>' + (USER_EMAIL || '-') + '</b></span>' +
    '<span class="badge">' + (IS_ADMIN ? 'ADMIN' : (IS_DESKCALL ? 'DESKCALL' : 'CO')) + '</span>';

  const isMR = ROLE_INFO && ROLE_INFO.role === 'MR';
  const navRingkasan = document.getElementById('navRingkasan');
  navRingkasan.classList.toggle('nav-hidden', !IS_ADMIN);
  const navNBQ = document.getElementById('navNBQ');
  const navFEEver = document.getElementById('navFEEver');
  const navInsentif = document.getElementById('navInsentif');
  const navSimulasiRapor = document.getElementById('navSimulasiRapor');
  const navDekscall = document.getElementById('navDekscall');
  if(isMR){
    navNBQ.classList.add('nav-hidden');
    navFEEver.classList.remove('nav-hidden');
  } else {
    navNBQ.classList.remove('nav-hidden');
    navFEEver.classList.toggle('nav-hidden', !IS_ADMIN);
  }
  // DESKCALL: cuma boleh lihat Beban Awal (semua PIC), Dekscall, dan Simulasi Penawaran.
  navDekscall.classList.toggle('nav-hidden', !IS_DESKCALL);
  if(IS_DESKCALL){
    navNBQ.classList.add('nav-hidden');
    navFEEver.classList.add('nav-hidden');
    navInsentif.classList.add('nav-hidden');
    navSimulasiRapor.classList.add('nav-hidden');
    navRingkasan.classList.add('nav-hidden');
  }

  // Tanggal Bayar Bulan Lalu: FE, MR, Admin, dan DESKCALL boleh lihat (lingkupnya beda-beda per role).
  const navTglBayar = document.getElementById('navTglBayar');
  const canSeeTglBayar = IS_ADMIN || IS_DESKCALL || (ROLE_INFO && (ROLE_INFO.role === 'FE' || ROLE_INFO.role === 'MR'));
  navTglBayar.classList.toggle('nav-hidden', !canSeeTglBayar);

  if(!hasInitializedApp){
    hasInitializedApp = true;
    if(IS_ADMIN){
      VIEW_MODE = 'ringkasan';
      document.getElementById('navRingkasan').classList.add('active');
      document.getElementById('navDashboard').classList.remove('active');
      document.getElementById('mobilePageTitle').textContent = 'Dashboard';
      loadRingkasan();
    } else {
      buildLayout();
      render();
    }
  } else {
    // Refresh biasa (bukan load pertama) — render ulang halaman yang lagi aktif, jangan pindah halaman
    if(VIEW_MODE === 'dashboard'){ buildLayout(); render(); }
    else if(VIEW_MODE === 'nbq'){ buildNBQLayout(); renderNBQ(); }
    else if(VIEW_MODE === 'feever'){ buildFEEverLayout(); renderFEEver(); }
    else if(VIEW_MODE === 'tglbayar'){ buildTglBayarLayout(); renderTglBayarTable(); }
  }
}

function isSudahBayar_(status){
  const u = (status||'').toString().toUpperCase();
  return u.includes('LUNAS') || u.includes('SUDAH');
}

function bucketStatusStat_(records, bucket){
  const rows = records.filter(r => r['BUCKET AWAL'] === bucket);
  const sudah = rows.filter(r => isSudahBayar_(r['STATUS BAYAR']));
  const belum = rows.filter(r => !isSudahBayar_(r['STATUS BAYAR']));
  const sum = arr => arr.reduce((s,r)=> s + (typeof r['SIPOK']==='number' ? r['SIPOK'] : 0), 0);
  return {
    total: { count: rows.length, sipok: sum(rows) },
    sudah: { count: sudah.length, sipok: sum(sudah) },
    belum: { count: belum.length, sipok: sum(belum) }
  };
}

function everStat_(records, bucket){
  const rows = records.filter(r => r['BUCKET AWAL'] === bucket && r['STATUS EVER']);
  const sudah = rows.filter(r => r['STATUS EVER'] === 'SUDAH EVER');
  const belum = rows.filter(r => r['STATUS EVER'] === 'BELUM EVER');
  const sum = arr => arr.reduce((s,r)=> s + (typeof r['SIPOK']==='number' ? r['SIPOK'] : 0), 0);
  return { sudah: { count: sudah.length, sipok: sum(sudah) }, belum: { count: belum.length, sipok: sum(belum) } };
}

function renderStatusCards(containerId, records, buckets){
  const box = document.getElementById(containerId);
  if(!box) return;
  box.innerHTML = buckets.map(b => {
    const s = bucketStatusStat_(records, b);
    const showEver = (b === 'P001_030' || b === 'P031_060');
    const e = showEver ? everStat_(records, b) : null;
    return `
    <div class="status-card ${state.bucket===b && state.tab==='own' ? 'active':''}" data-bucket="${b}">
      <div class="bhead">
        <span class="bname">${fmtBucket(b)}</span>
        <span class="btotal">${s.total.count} kontrak · ${fmtRupiah(s.total.sipok)}</span>
      </div>
      <div class="srow"><span class="slabel"><span class="dot good"></span>Sudah Bayar</span><span class="sval">${s.sudah.count} · ${fmtRupiah(s.sudah.sipok)}</span></div>
      <div class="srow"><span class="slabel"><span class="dot bad"></span>Belum Bayar</span><span class="sval">${s.belum.count} · ${fmtRupiah(s.belum.sipok)}</span></div>
      ${showEver ? `
      <div class="srow"><span class="slabel"><span class="dot bad"></span>Sudah Ever</span><span class="sval">${e.sudah.count} · ${fmtRupiah(e.sudah.sipok)}</span></div>
      <div class="srow"><span class="slabel"><span class="dot good"></span>Belum Ever</span><span class="sval">${e.belum.count} · ${fmtRupiah(e.belum.sipok)}</span></div>` : ''}
    </div>`;
  }).join('');
  box.querySelectorAll('.status-card').forEach(card => {
    card.onclick = () => { state.tab='own'; const b=card.getAttribute('data-bucket'); state.bucket = state.bucket===b?'ALL':b; render(); };
  });
}

const MONITOR_BUCKETS = ['NOOD','P001_030','P031_060'];

function bebanAwal_(records, bucket){
  const rows = records.filter(r => r['BUCKET AWAL'] === bucket);
  const sipok = rows.reduce((s,r) => s + (typeof r['SIPOK']==='number' ? r['SIPOK'] : 0), 0);
  return { count: rows.length, sipok: sipok };
}

function getBucketOptions(){
  if(IS_ADMIN || !ROLE_INFO) return BUCKET_ORDER;
  const set = new Set();
  (ROLE_INFO.asalFlow || []).forEach(b => { if(b) set.add(b); });
  (ROLE_INFO.penyelesaian || []).forEach(b => { if(b) set.add(b); });
  return BUCKET_ORDER.filter(b => set.has(b));
}

function buildLayout(){
  const isMR = ROLE_INFO && ROLE_INFO.role === 'MR';
  const isFE = ROLE_INFO && ROLE_INFO.role === 'FE';

  let html = '';

  if(IS_ADMIN || IS_DESKCALL){
    html += `<div class="panel-title">Total Beban Awal (Semua PIC)</div>
      <div class="grand-row" id="grandRow"></div>
      <div class="panel-title">Monitoring Realisasi per Bucket</div>
      <div class="status-row" id="statusRowAdmin"></div>`;
  }

  if(isFE || isMR){
    html += `<div class="panel-title">Beban Awal & Realisasi Kamu</div>
      <div class="status-row" id="statusRowRole"></div>`;
  }

  html += `
    <div class="panel-title">Sebaran bucket (klik untuk filter)</div>
    <div class="bucket-bar" id="bucketBar"></div>
    <div class="bucket-legend" id="bucketLegend"></div>
    <div class="co-row" id="coRow" style="${IS_ADMIN ? '' : 'display:none;'}"></div>
  `;

  html += `
    <div class="controls">
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4C6272" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="searchInput" type="text" placeholder="Cari nama konsumen, no kontrak, atau nopol…">
      </div>
      <div class="filter-drawer" id="filterDrawer">
        <button type="button" class="btn filter-trigger-btn" id="filterTriggerBtn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filter <span class="filter-badge" id="filterBadge" style="display:none;">0</span>
        </button>
        <div class="filter-drawer-panel" id="filterDrawerPanel">
          <div class="fd-header"><span>Filter</span></div>
          <div class="fd-field">
            <label class="edit-label">Bucket Awal</label>
            <select class="filter-select" id="bucketSelect" style="width:100%;">
              <option value="ALL">Semua Bucket Awal</option>
              ${getBucketOptions().map(b => `<option value="${b}">${fmtBucket(b)}</option>`).join('')}
            </select>
          </div>
          <div class="fd-field">
            <label class="edit-label">Kriteria Acct</label>
            <select class="filter-select" id="kriteriaSelect" style="width:100%;">
              <option value="ALL">Semua Kriteria Acct</option>
              <option value="FLOW">FLOW</option>
              <option value="STAY">STAY</option>
              <option value="LUNAS">LUNAS</option>
              <option value="BTC">BTC</option>
            </select>
          </div>
          <div class="fd-field">
            <label class="edit-label">Kendaraan</label>
            <select class="filter-select" id="tipeSelect" style="width:100%;">
              <option value="ALL">Semua Kendaraan</option>
              <option value="MOTOR">Motor</option>
              <option value="MOBIL">Mobil</option>
            </select>
          </div>
          <div class="fd-field">
            <label class="edit-label">Kecamatan</label>
            <select class="filter-select" id="kecamatanSelect" style="width:100%;">
              <option value="ALL">Semua Kecamatan</option>
              ${[...new Set(DATA.map(r=>r['KECAMATAN']).filter(Boolean))].sort().map(k => `<option value="${k}">${k}</option>`).join('')}
            </select>
          </div>
          <div class="fd-field">
            <label class="edit-label">Status Ever</label>
            <select class="filter-select" id="everSelect" style="width:100%;">
              <option value="ALL">Semua Status Ever</option>
              <option value="SUDAH EVER">Sudah Ever</option>
              <option value="BELUM EVER">Belum Ever</option>
            </select>
          </div>
          <div class="fd-field">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <label class="edit-label" style="margin:0;">Janji Bayar</label>
              <div style="display:flex;gap:10px;">
                <button type="button" class="ms-link-btn" id="janjiSelectAllBtn">Pilih semua</button>
                <button type="button" class="ms-link-btn" id="janjiClearBtn">Bersihkan</button>
              </div>
            </div>
            <div class="ms-grid" id="janjiGrid"></div>
          </div>
        </div>
      </div>
      <button class="btn" id="resetBtn">Reset filter</button>
      <button class="btn primary" id="refreshBtn">↻ Muat ulang</button>
    </div>
    <div class="count-note" id="countNote"></div>
    <div class="active-chips" id="activeChips" style="display:none;"></div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th data-key="CO ALL" id="thCO">CO</th>
            <th data-key="NO KONTRAK">No Kontrak</th>
            <th data-key="NAMA KONSUMEN">Nama Konsumen</th>
            <th>Bucket</th>
            <th data-key="STATUS BAYAR">Status</th>
            <th data-key="SIPOK" class="num">Sisa Piutang</th>
            <th data-key="ANGSURAN" class="num">Angsuran</th>
            <th data-key="DPD" class="num">DPD</th>
            <th data-key="STATUS EVER">Status Ever</th>
            <th data-key="JATUH TEMPO">Jatuh Tempo</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
  `;

  document.getElementById('wrap').innerHTML = html;

  document.querySelectorAll('thead th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-key');
      if(state.sortKey === key) state.sortDir *= -1; else { state.sortKey = key; state.sortDir = 1; }
      renderTable();
    });
  });
  document.getElementById('searchInput').addEventListener('input', e => { state.search = e.target.value; renderTable(); });
  document.getElementById('resetBtn').addEventListener('click', () => {
    const keepTab = state.tab;
    state = { search:'', co:'ALL', bucket:'ALL', kriteria:'ALL', tipe:'ALL', kecamatan:'ALL', ever:'ALL', janjiList:[], sortKey:'JATUH TEMPO', sortDir:1, tab:keepTab };
    buildLayout();
    render();
  });
  document.getElementById('refreshBtn').addEventListener('click', loadData);
  document.getElementById('bucketSelect').addEventListener('change', e => { state.bucket = e.target.value; render(); });
  document.getElementById('kriteriaSelect').addEventListener('change', e => { state.kriteria = e.target.value; renderTable(); });
  document.getElementById('tipeSelect').addEventListener('change', e => { state.tipe = e.target.value; renderTable(); });
  document.getElementById('kecamatanSelect').addEventListener('change', e => { state.kecamatan = e.target.value; renderTable(); });
  document.getElementById('everSelect').addEventListener('change', e => { state.ever = e.target.value; renderTable(); });

  const janjiValues = [...new Set(DATA.map(r=>(r['JANJI BAYAR']||'').toString().trim()).filter(Boolean))].sort();
  const janjiGrid = document.getElementById('janjiGrid');
  janjiGrid.innerHTML = janjiValues.map(v => `<label class="ms-option"><input type="checkbox" value="${v}"> ${v}</label>`).join('') || '<div style="font-size:12px;color:var(--ink-soft);padding:4px;">Belum ada data</div>';
  janjiGrid.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.checked = state.janjiList.includes(cb.value);
    cb.addEventListener('change', () => {
      if(cb.checked) state.janjiList.push(cb.value);
      else state.janjiList = state.janjiList.filter(v => v!==cb.value);
      updateFilterBadge();
      renderTable();
    });
  });
  document.getElementById('janjiSelectAllBtn').addEventListener('click', () => {
    state.janjiList = janjiValues.slice();
    janjiGrid.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
    updateFilterBadge();
    renderTable();
  });
  document.getElementById('janjiClearBtn').addEventListener('click', () => {
    state.janjiList = [];
    janjiGrid.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
    updateFilterBadge();
    renderTable();
  });

  const filterTriggerBtn = document.getElementById('filterTriggerBtn');
  const filterDrawerPanel = document.getElementById('filterDrawerPanel');
  filterTriggerBtn.addEventListener('click', (e) => { e.stopPropagation(); filterDrawerPanel.classList.toggle('show'); });
  document.addEventListener('click', (e) => {
    if(!document.getElementById('filterDrawer').contains(e.target)) filterDrawerPanel.classList.remove('show');
  });
  ['bucketSelect','kriteriaSelect','tipeSelect','kecamatanSelect','everSelect'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateFilterBadge);
  });
  updateFilterBadge();
}

function updateFilterBadge(){
  const badge = document.getElementById('filterBadge');
  if(!badge) return;
  let n = 0;
  if(state.bucket!=='ALL') n++;
  if(state.kriteria!=='ALL') n++;
  if(state.tipe!=='ALL') n++;
  if(state.kecamatan!=='ALL') n++;
  if(state.ever!=='ALL') n++;
  if(state.janjiList.length>0) n++;
  if(n>0){ badge.style.display='inline-flex'; badge.textContent=n; } else { badge.style.display='none'; }
}

let VIEW_MODE = 'dashboard';
let INSENTIF_DATA = null;

const VIEW_TITLES = { ringkasan: 'Dashboard', dashboard: 'Beban Awal', nbq: 'NBQ', feever: 'FE Ever', tglbayar: 'Tanggal Bayar Bulan Lalu', insentif: 'Insentif', dekscall: 'Dekscall', simulasi: 'Simulasi Penawaran', simulasirapor: 'Simulasi Rapor' };

function triggerFadeIn(){
  const el = document.getElementById('wrap');
  if(!el) return;
  el.classList.remove('fade-in');
  void el.offsetWidth;
  el.classList.add('fade-in');
}

function switchView(view){
  if(view === VIEW_MODE){ closeSidebarDrawer(); return; }
  VIEW_MODE = view;
  document.getElementById('navRingkasan').classList.toggle('active', view === 'ringkasan');
  document.getElementById('navDashboard').classList.toggle('active', view === 'dashboard');
  document.getElementById('navNBQ').classList.toggle('active', view === 'nbq');
  document.getElementById('navFEEver').classList.toggle('active', view === 'feever');
  document.getElementById('navTglBayar').classList.toggle('active', view === 'tglbayar');
  document.getElementById('navInsentif').classList.toggle('active', view === 'insentif');
  document.getElementById('navSimulasiRapor').classList.toggle('active', view === 'simulasirapor');
  document.getElementById('navDekscall').classList.toggle('active', view === 'dekscall');
  document.getElementById('navSimulasi').classList.toggle('active', view === 'simulasi');
  document.getElementById('mobilePageTitle').textContent = VIEW_TITLES[view] || '';
  closeSidebarDrawer();

  if(view === 'dekscall'){
    buildDekscallLayout();
    renderDekscall();
    triggerFadeIn();
  } else if(view === 'simulasi'){
    buildSimulasiLayout();
    triggerFadeIn();
  } else if(view === 'ringkasan'){
    if(RINGKASAN_DATA){ renderRingkasanView(); triggerFadeIn(); } else { loadRingkasan(); }
  } else if(view === 'dashboard'){
    buildLayout();
    render();
    triggerFadeIn();
  } else if(view === 'nbq'){
    buildNBQLayout();
    renderNBQ();
    triggerFadeIn();
  } else if(view === 'feever'){
    buildFEEverLayout();
    renderFEEver();
    triggerFadeIn();
  } else if(view === 'tglbayar'){
    buildTglBayarLayout();
    renderTglBayarTable();
    triggerFadeIn();
  } else if(view === 'insentif'){
    if(INSENTIF_DATA){ renderInsentifView(); triggerFadeIn(); } else { loadInsentif(); }
  } else if(view === 'simulasirapor'){
    if(SIMULASI_RAPOR_DATA){ renderSimulasiRapor(); triggerFadeIn(); } else { loadSimulasiRapor(); }
  }
}

function fmtPct(n){ return (typeof n==='number' ? n.toFixed(2) : '0.00') + '%'; }
function katClass(k){ return 'kat-' + (k||'').replace(/\s+/g,'_'); }

function loadInsentif(){
  document.getElementById('wrap').innerHTML = `<div class="skeleton-row"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div><div class="skel tall"></div>`;
  fetch('/api/insentif', { headers: { Authorization: 'Bearer ' + ID_TOKEN } })
    .then(r => r.json().then(body => ({ ok: r.ok, body })))
    .then(({ok, body}) => {
      if(!ok){ document.getElementById('wrap').innerHTML = '<div class="state-box error"><div class="err-icon">⚠</div>'+(body.error||'Gagal memuat data insentif.')+'<br><br><button class="btn" onclick="loadInsentif()">Coba lagi</button></div>'; return; }
      INSENTIF_DATA = body;
      renderInsentifView();
      triggerFadeIn();
    })
    .catch(err => { document.getElementById('wrap').innerHTML = '<div class="state-box error"><div class="err-icon">⚠</div>'+err.message+'<br><br><button class="btn" onclick="loadInsentif()">Coba lagi</button></div>'; });
}

function achievementCard(h, extraLabel, extraKey){
  return `
  <div class="ins-card">
    <div class="ihead">
      <div><div class="iname">${h.namaCO}</div><div class="irole">${h.role}</div></div>
      <span class="kategori-pill ${katClass(h.kategori)}">${h.kategori}</span>
    </div>
    <div class="ins-nilai">${h.totalNilai.toFixed(2)} <span style="font-size:12px;color:var(--ink-soft);font-weight:500;">/ 5.00</span></div>
    <div class="ins-insentif">${fmtRupiah(h.insentif)}</div>
    <div class="ins-metric"><span class="mlabel">Balance</span><span class="mval">${fmtPct(h.balancePct)}</span></div>
    <div class="ins-metric"><span class="mlabel">Flow Ever (${h.flowEverEscaped}/${h.totalAwal})</span><span class="mval">${fmtPct(h.flowEverPct)}</span></div>
    <div class="ins-metric"><span class="mlabel">${extraLabel}</span><span class="mval">${fmtPct(h[extraKey])}</span></div>
  </div>`;
}

function penyelesaianCard(p){
  const gapHtml = p.gapPct !== null
    ? `<div class="ins-gap">🎯 Butuh naik <b>${p.gapPct.toFixed(2)}%</b> lagi ke tier berikutnya<br>(± <b>${fmtRupiah(p.gapRupiah)}</b> SIPOK yang perlu diselesaikan)</div>`
    : `<div class="ins-gap">🏆 Sudah di tier tertinggi minggu ini</div>`;
  const rekomHtml = p.rekomendasi && p.rekomendasi.length
    ? `<div class="ins-rekom">
        <div style="font-size:11px;text-transform:uppercase;color:var(--ink-soft);margin-bottom:4px;">Rekomendasi dikejar (SIPOK terbesar)</div>
        ${p.rekomendasi.map(r => `<div class="ins-rekom-item"><span class="rname">${r.namaKonsumen}</span><span class="rval">${fmtRupiah(r.sipok)} (+${r.pengaruhPct.toFixed(2)}%)</span></div>`).join('')}
      </div>` : '';
  return `
  <div class="ins-card">
    <div class="ihead">
      <div><div class="iname">${p.namaCO}</div><div class="irole">${p.role} · Minggu ${p.minggu}</div></div>
    </div>
    <div class="ins-nilai">${fmtPct(p.pct)}</div>
    <div class="ins-insentif">${fmtRupiah(p.nilai)}</div>
    ${gapHtml}
    ${rekomHtml}
  </div>`;
}

function totalInsentifCard(t){
  return `
  <div class="ins-card ins-total-card">
    <div class="ihead">
      <div><div class="iname">${t.namaCO}</div><div class="irole">${t.role} · Minggu ${t.minggu}</div></div>
    </div>
    <div class="ins-metric"><span class="mlabel">Insentif Rapor</span><span class="mval">${fmtRupiah(t.insentifRapor)}</span></div>
    <div class="ins-metric"><span class="mlabel">Insentif Penyelesaian (W1-W${t.minggu})</span><span class="mval">${fmtRupiah(t.insentifWeekly)}</span></div>
    <div class="ins-total-label">Total Insentif</div>
    <div class="ins-total-val">${fmtRupiah(t.total)}</div>
  </div>`;
}

function renderInsentifView(){
  const d = INSENTIF_DATA;
  if(!d) return;
  let html = `<div class="view-toggle-note" onclick="switchView('dashboard')">← Kembali ke Dashboard</div>`;

  if(d.isAdmin){
    html += `<div class="ins-section"><h2>Achievement Harian — Front End (FE)</h2><div class="ins-row">${d.achievement.FE.map(h=>achievementCard(h,'Flow No OD','flowNoODPct')).join('')}</div></div>`;
    html += `<div class="ins-section"><h2>Achievement Harian — Mid Range (MR)</h2><div class="ins-row">${d.achievement.MR.map(h=>achievementCard(h,'Flow 1-30','flowPct')).join('')}</div></div>`;
    if(d.achievement.BCH){
      html += `<div class="ins-section"><h2>Achievement Harian — Branch Collection Head (BCH)</h2><div class="ins-row">${achievementCard(d.achievement.BCH,'Flow Forward 31-60','flowForwardPct')}</div></div>`;
    }
    html += `<div class="ins-section"><h2>Insentif Penyelesaian — Minggu ${d.minggu}</h2><div class="ins-row">${d.penyelesaian.map(p=>penyelesaianCard(p)).join('')}</div></div>`;
    if(d.totalInsentif && d.totalInsentif.length){
      html += `<div class="ins-section"><h2>Total Insentif Bulan Ini</h2><div class="ins-row">${d.totalInsentif.map(t=>totalInsentifCard(t)).join('')}</div></div>`;
    }
  } else {
    if(d.achievement){
      const extra = d.achievement.role==='FE' ? ['Flow No OD','flowNoODPct'] : d.achievement.role==='MR' ? ['Flow 1-30','flowPct'] : ['Flow Forward 31-60','flowForwardPct'];
      html += `<div class="ins-section"><h2>Achievement Harian Kamu</h2><div class="ins-row">${achievementCard(d.achievement, extra[0], extra[1])}</div></div>`;
    }
    if(d.penyelesaian){
      html += `<div class="ins-section"><h2>Insentif Penyelesaian — Minggu ${d.minggu}</h2><div class="ins-row">${penyelesaianCard(d.penyelesaian)}</div></div>`;
    }
    if(d.totalInsentif){
      html += `<div class="ins-section"><h2>Total Insentif Kamu Bulan Ini</h2><div class="ins-row">${totalInsentifCard(d.totalInsentif)}</div></div>`;
    }
    if(!d.achievement && !d.penyelesaian){
      html += `<div class="state-box">Data insentif kamu belum ditemukan. Hubungi admin kalau ini seharusnya ada datanya.</div>`;
    }
  }

  document.getElementById('wrap').innerHTML = html;
}

// ============================================================
// SIMULASI RAPOR — "kalau kontrak2 yang masih belum bayar ini dianggap berhasil
// ketagih & lunas/BTC (keluar dari buku piutang), apakah nilai rapor harian jadi ON TARGET?"
// Semua orang bisa simulasi data diri sendiri; admin bisa pilih CO siapa saja.
// ============================================================
let SIMULASI_RAPOR_DATA = null;
let SIMULASI_RAPOR_RESULT = null;
// proyeksi: Map noKontrak -> 'stay' (bayar sebagian, berhenti di bucket target) | 'btc' (lunas total, keluar dari buku)
let simulasiRaporState = { search:'', proyeksi: new Map() };

function loadSimulasiRapor(namaCO){
  document.getElementById('wrap').innerHTML = `<div class="skeleton-row"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div><div class="skel tall"></div>`;
  const qs = namaCO ? ('?namaCO=' + encodeURIComponent(namaCO)) : '';
  fetch('/api/simulasi-rapor' + qs, { headers: { Authorization: 'Bearer ' + ID_TOKEN } })
    .then(r => r.json().then(body => ({ ok: r.ok, body })))
    .then(({ok, body}) => {
      if(!ok){ document.getElementById('wrap').innerHTML = '<div class="state-box error"><div class="err-icon">⚠</div>'+(body.error||'Gagal memuat simulasi rapor.')+'<br><br><button class="btn" onclick="loadSimulasiRapor()">Coba lagi</button></div>'; return; }
      if(body.error){ document.getElementById('wrap').innerHTML = '<div class="state-box">'+body.error+'</div>'; return; }
      SIMULASI_RAPOR_DATA = body;
      SIMULASI_RAPOR_RESULT = null;
      simulasiRaporState = { search:'', proyeksi: new Map() };
      renderSimulasiRapor();
      triggerFadeIn();
    })
    .catch(err => { document.getElementById('wrap').innerHTML = '<div class="state-box error"><div class="err-icon">⚠</div>'+err.message+'<br><br><button class="btn" onclick="loadSimulasiRapor()">Coba lagi</button></div>'; });
}

function runSimulasiRapor(){
  const btn = document.getElementById('simRunBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Menghitung…'; }
  fetch('/api/simulasi-rapor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ID_TOKEN },
    body: JSON.stringify({ namaCO: SIMULASI_RAPOR_DATA.namaCO, proyeksi: Object.fromEntries(simulasiRaporState.proyeksi) })
  })
    .then(r => r.json().then(body => ({ ok: r.ok, body })))
    .then(({ok, body}) => {
      if(!ok || body.error){ alert((body && body.error) || 'Gagal menjalankan simulasi.'); if(btn){ btn.disabled=false; btn.textContent='🔄 Jalankan Simulasi'; } return; }
      SIMULASI_RAPOR_RESULT = body;
      renderSimulasiRapor();
    })
    .catch(err => { alert(err.message); if(btn){ btn.disabled=false; btn.textContent='🔄 Jalankan Simulasi'; } });
}

function simMetricLabel_(role){
  if(role==='FE') return ['Flow No OD','flowNoODPct'];
  if(role==='MR') return ['Flow 1-30','flowPct'];
  return ['Flow Forward 31-60','flowForwardPct'];
}

function simResultCard_(title, h, highlight){
  const extra = simMetricLabel_(h.role);
  return `
  <div class="ins-card ${highlight ? 'ins-total-card' : ''}">
    <div class="ihead">
      <div><div class="iname">${title}</div><div class="irole">${h.role}</div></div>
      <span class="kategori-pill ${katClass(h.kategori)}">${h.kategori}</span>
    </div>
    <div class="ins-nilai">${h.totalNilai.toFixed(2)} <span style="font-size:12px;color:${highlight?'#BFD2E0':'var(--ink-soft)'};font-weight:500;">/ 5.00</span></div>
    <div class="ins-insentif">${fmtRupiah(h.insentif)}</div>
    <div class="ins-metric"><span class="mlabel">Balance</span><span class="mval">${fmtPct(h.balancePct)}</span></div>
    <div class="ins-metric"><span class="mlabel">Flow Ever</span><span class="mval">${fmtPct(h.flowEverPct)}</span></div>
    <div class="ins-metric"><span class="mlabel">${extra[0]}</span><span class="mval">${fmtPct(h[extra[1]])}</span></div>
  </div>`;
}

function getSimulasiKontrakFiltered_(){
  const list = (SIMULASI_RAPOR_DATA && SIMULASI_RAPOR_DATA.kontrakList) || [];
  if(!simulasiRaporState.search.trim()) return list;
  const q = simulasiRaporState.search.trim().toLowerCase();
  return list.filter(k => (k.namaKonsumen||'').toLowerCase().includes(q) || (k.noKontrak||'').toLowerCase().includes(q));
}

function renderSimulasiRapor(){
  const d = SIMULASI_RAPOR_DATA;
  if(!d) return;
  let html = `<div class="view-toggle-note" onclick="switchView('dashboard')">← Kembali ke Dashboard</div>`;

  html += `<div class="sim-intro">
    Daftar di bawah nampilin kontrak dengan Kriteria Acct <b>STAY / FLOW / ROLLBACK</b> di bucket yang jadi parameter rapor
    ${d.isAdmin ? d.namaCO : 'kamu'} (kontrak yang Kriteria Acct-nya udah <b>BTC / LUNAS</b> otomatis gak ditampilkan lagi, karena udah beres duluan).
    Tiap kontrak punya 2 tombol proyeksi, pilih salah satu kalau ada potensi berubah — biarkan <b>"Kondisi Sekarang"</b> kalau
    kontraknya diperkirakan tetap seperti data live sekarang:<br>
    • <b>Proyeksi Stay</b> — dipakai kalau kontrak <u>flow</u> tapi ada potensi bayar (walau cuma sebagian), sehingga proyeksinya
    berhenti flow dan <b>tetap masuk hitungan Balance</b> di bucket itu (piutangnya belum lunas, cuma berhenti nyicil ke bucket berikutnya).<br>
    • <b>Proyeksi BTC/Lunas</b> — dipakai kalau kontrak diperkirakan <u>lunas total</u> (baik yang lagi stay maupun flow), sehingga
    kontrak itu keluar sepenuhnya dari buku piutang yang dipantau (keluar dari Balance, Flow Ever, maupun Flow NOOD/1-30/Forward sekaligus).<br>
    Lalu lihat apakah nilai Rapor Harian ${d.isAdmin ? '<b>'+d.namaCO+'</b>' : 'kamu'} jadi ON TARGET atau tidak.
  </div>`;

  if(d.isAdmin && d.coList && d.coList.length){
    html += `<div class="sim-co-select">
      <label class="edit-label">Simulasikan untuk CO</label>
      <select class="filter-select" id="simCoSelect" style="width:100%;max-width:360px;">
        ${d.coList.map(c => `<option value="${c.namaCO}" ${c.namaCO===d.namaCO?'selected':''}>${c.namaCO} (${c.role})</option>`).join('')}
      </select>
    </div>`;
  }

  html += `<div class="ins-section"><h2>Rapor Saat Ini (Live)</h2><div class="ins-row">${simResultCard_('Kondisi Sekarang', d.original, false)}</div></div>`;

  html += `<div class="panel-title">Pilih proyeksi tiap kontrak (Stay / BTC-Lunas)</div>`;
  if(!d.kontrakList || !d.kontrakList.length){
    html += `<div class="state-box">Gak ada kontrak dengan Kriteria Acct STAY/FLOW/ROLLBACK di bucket parameter rapor saat ini, jadi belum ada yang bisa disimulasikan. 🎉</div>`;
  } else {
    html += `
    <div class="controls">
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4C6272" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="simSearchInput" type="text" placeholder="Cari nama konsumen atau no kontrak…" value="${simulasiRaporState.search}">
      </div>
      <button class="btn" id="simClearBtn">Bersihkan pilihan</button>
      <button class="btn primary" id="simRunBtn">🔄 Jalankan Simulasi</button>
    </div>
    <div class="count-note">${simulasiRaporState.proyeksi.size} kontrak diproyeksikan berubah dari ${d.kontrakList.length} yang berpengaruh</div>
    <div class="sim-kontrak-list" id="simKontrakList"></div>`;
  }

  if(SIMULASI_RAPOR_RESULT){
    const r = SIMULASI_RAPOR_RESULT;
    const badge = r.tercapaiSimulasi
      ? '<span class="sim-target-badge sim-target-ok">✅ ON TARGET</span>'
      : '<span class="sim-target-badge sim-target-bad">⚠️ Di bawah ON TARGET</span>';
    html += `<div class="ins-section"><h2>Hasil Simulasi (${r.jumlahKontrakDipilih} kontrak diproyeksikan berubah) ${badge}</h2>
      <div class="ins-row">
        ${simResultCard_('Sebelum (Live)', r.original, false)}
        ${simResultCard_('Simulasi', r.simulasi, true)}
      </div>
      <div class="ins-gap" style="margin-top:14px;">
        Selisih nilai: <b>${r.delta.totalNilai>=0?'+':''}${r.delta.totalNilai.toFixed(2)}</b> ·
        Selisih insentif rapor: <b>${r.delta.insentif>=0?'+':''}${fmtRupiah(r.delta.insentif)}</b>
      </div>
    </div>`;
  }

  document.getElementById('wrap').innerHTML = html;

  const coSelect = document.getElementById('simCoSelect');
  if(coSelect){ coSelect.addEventListener('change', e => loadSimulasiRapor(e.target.value)); }

  if(d.kontrakList && d.kontrakList.length){
    renderSimKontrakList_();
    document.getElementById('simSearchInput').addEventListener('input', e => { simulasiRaporState.search = e.target.value; renderSimKontrakList_(); });
    document.getElementById('simClearBtn').addEventListener('click', () => { simulasiRaporState.proyeksi.clear(); SIMULASI_RAPOR_RESULT = null; renderSimulasiRapor(); });
    document.getElementById('simRunBtn').addEventListener('click', runSimulasiRapor);
  }
}

function renderSimKontrakList_(){
  const box = document.getElementById('simKontrakList');
  if(!box) return;
  const rows = getSimulasiKontrakFiltered_();
  box.innerHTML = rows.map(k => {
    const current = simulasiRaporState.proyeksi.get(k.noKontrak) || '';
    // kontrak yang KRITERIA ACCT-nya udah STAY: tombol "Proyeksi Stay" gak relevan lagi
    // (dia emang udah berhenti flow, gak ada bedanya sama kondisi sekarang) — cukup tawarin BTC/Lunas.
    const showStayBtn = k.kriteriaAcct !== 'STAY';
    return `
    <div class="sim-kontrak-item">
      <div class="sim-kontrak-info">
        <div class="sim-kontrak-name">${k.namaKonsumen||'-'} <span class="sim-kontrak-kontrak">${k.noKontrak}</span>${k.kriteriaAcct ? ' <span class="sim-kriteria-badge sim-kriteria-'+k.kriteriaAcct+'">'+k.kriteriaAcct+'</span>' : ''}</div>
        <div class="sim-kontrak-meta">Bucket Awal ${fmtBucket(k.bucketAwal)} → Sekarang ${fmtBucket(k.bucketUpdateKA||k.bucketUpdateMaster)}${k.flowEver && k.flowEver!==k.bucketUpdateKA ? ' · Flow Ever '+fmtBucket(k.flowEver) : ''}</div>
      </div>
      <div class="sim-kontrak-sipok">${fmtRupiah(k.sisaPiutang)}</div>
      <div class="sim-proyeksi-group">
        ${showStayBtn ? `<button type="button" class="sim-proyeksi-btn sim-proyeksi-stay ${current==='stay'?'active':''}" data-nokontrak="${k.noKontrak}" data-val="stay">${current==='stay'?'✓ ':''}Proyeksi Stay</button>` : ''}
        <button type="button" class="sim-proyeksi-btn sim-proyeksi-btc ${current==='btc'?'active':''}" data-nokontrak="${k.noKontrak}" data-val="btc">${current==='btc'?'✓ ':''}Proyeksi BTC/Lunas</button>
      </div>
    </div>`;
  }).join('');
  box.querySelectorAll('.sim-proyeksi-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const nk = btn.getAttribute('data-nokontrak');
      const val = btn.getAttribute('data-val');
      const cur = simulasiRaporState.proyeksi.get(nk) || '';
      if(cur === val){ simulasiRaporState.proyeksi.delete(nk); } else { simulasiRaporState.proyeksi.set(nk, val); }
      renderSimKontrakList_();
      const note = document.querySelector('.count-note');
      if(note) note.textContent = simulasiRaporState.proyeksi.size + ' kontrak diproyeksikan berubah dari ' + (SIMULASI_RAPOR_DATA.kontrakList.length) + ' yang berpengaruh';
    });
  });
}

// ============================================================
// FE EVER (Limpahan dari 1-30, OD > 31) — khusus MR & Admin
// ============================================================
let feeverState = { search:'', sortKey:'JATUH TEMPO', sortDir:1 };

function buildFEEverLayout(){
  const stat = { count: ESCALATIONS.length, sipok: ESCALATIONS.reduce((s,r)=> s + (typeof r['SIPOK']==='number' ? r['SIPOK'] : 0), 0) };

  document.getElementById('wrap').innerHTML = `
    <div class="panel-title">Limpahan dari Bucket 1-30 (OD &gt; 31)</div>
    <div class="grand-row" style="margin-bottom:22px;">
      <div class="grand-card"><div class="lbl">Jumlah Kontrak</div><div class="val" id="feeverValKontrak">0</div></div>
      <div class="grand-card"><div class="lbl">Total Sisa Piutang</div><div class="val" id="feeverValSipok">Rp0</div></div>
    </div>
    <div class="controls">
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4C6272" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="feeverSearchInput" type="text" placeholder="Cari nama konsumen, no kontrak, atau nopol…">
      </div>
      <button class="btn" id="feeverResetBtn">Reset filter</button>
      <button class="btn primary" id="feeverRefreshBtn">↻ Muat ulang</button>
    </div>
    <div class="count-note" id="feeverCountNote"></div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th data-key="CO ALL">CO Asal</th>
            <th data-key="NO KONTRAK">No Kontrak</th>
            <th data-key="NAMA KONSUMEN">Nama Konsumen</th>
            <th>Bucket</th>
            <th data-key="STATUS BAYAR">Status</th>
            <th data-key="SIPOK" class="num">Sisa Piutang</th>
            <th data-key="DPD" class="num">DPD</th>
            <th data-key="JATUH TEMPO">Jatuh Tempo</th>
          </tr>
        </thead>
        <tbody id="feeverTbody"></tbody>
      </table>
    </div>
  `;

  animateCount(document.getElementById('feeverValKontrak'), stat.count, false);
  animateCount(document.getElementById('feeverValSipok'), stat.sipok, true);

  document.querySelectorAll('#wrap thead th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-key');
      if(feeverState.sortKey === key) feeverState.sortDir *= -1; else { feeverState.sortKey = key; feeverState.sortDir = 1; }
      renderFEEverTable();
    });
  });
  document.getElementById('feeverSearchInput').addEventListener('input', e => { feeverState.search = e.target.value; renderFEEverTable(); });
  document.getElementById('feeverResetBtn').addEventListener('click', () => {
    feeverState = { search:'', sortKey:'JATUH TEMPO', sortDir:1 };
    document.getElementById('feeverSearchInput').value = '';
    renderFEEverTable();
  });
  document.getElementById('feeverRefreshBtn').addEventListener('click', loadData);
}

function renderFEEver(){
  if(ESCALATIONS.length === 0){
    document.getElementById('wrap').innerHTML = '<div class="state-box">Tidak ada kontrak limpahan saat ini. 🎉</div>';
    return;
  }
  renderFEEverTable();
}

function getFEEverFiltered(){
  let rows = ESCALATIONS;
  if(feeverState.search.trim()){
    const q = feeverState.search.trim().toLowerCase();
    rows = rows.filter(r => (r['NAMA KONSUMEN']||'').toLowerCase().includes(q) || (r['NO KONTRAK']||'').toLowerCase().includes(q) || (r['NOPOL']||'').toLowerCase().includes(q));
  }
  if(feeverState.sortKey){
    rows = rows.slice().sort((a,b) => {
      let va=a[feeverState.sortKey], vb=b[feeverState.sortKey];
      if(typeof va==='number' && typeof vb==='number') return (va-vb)*feeverState.sortDir;
      va=(va||'').toString().toLowerCase(); vb=(vb||'').toString().toLowerCase();
      return va.localeCompare(vb)*feeverState.sortDir;
    });
  }
  return rows;
}

function renderFEEverTable(){
  const rows = getFEEverFiltered();
  document.getElementById('feeverCountNote').innerHTML = `Menampilkan <b>${rows.length}</b> dari <b>${ESCALATIONS.length}</b> kontrak`;
  const tbody = document.getElementById('feeverTbody');
  if(rows.length===0){ tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Tidak ada kontrak yang cocok.</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const meta = CO_META[r['CO ALL']] || {short:r['CO ALL']||'-'};
    return `<tr data-kontrak="${r['NO KONTRAK']}">
      <td data-label="CO Asal" class="mono">${meta.short}</td>
      <td data-label="No Kontrak" class="mono">${r['NO KONTRAK']||'-'}</td>
      <td data-label="Nama">${r['NAMA KONSUMEN']||'-'}</td>
      <td data-label="Bucket"><div class="bucket-flow"><span class="bpill" style="background:${BUCKET_COLOR[r['BUCKET AWAL']]||'#999'}">${fmtBucket(r['BUCKET AWAL'])}</span> → <span class="bpill" style="background:${BUCKET_COLOR[r['BUCKET UPDATE']]||'#999'}">${fmtBucket(r['BUCKET UPDATE'])}</span></div></td>
      <td data-label="Status"><span class="status-pill ${statusClass(r['STATUS BAYAR'])}">${r['STATUS BAYAR']||'-'}</span></td>
      <td data-label="Sisa Piutang" class="num">${fmtRupiah(r['SIPOK'])}</td>
      <td data-label="DPD" class="num">${r['DPD'] ?? '-'}</td>
      <td data-label="Jatuh Tempo" class="mono">${fmtDate(r['JATUH TEMPO'])}</td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('tr[data-kontrak]').forEach(tr => tr.onclick = () => openPanel(tr.getAttribute('data-kontrak')));
}

// ============================================================
// DEKSCALL — khusus role DESKCALL: NOOD yang FLOW & belum realisasi
// ============================================================
let dekscallState = { search:'', sortKey:'JATUH TEMPO', sortDir:1 };

function getDekscallBase(){
  return DATA.filter(r =>
    r['BUCKET AWAL'] === 'NOOD' &&
    (r['KRITERIA ACCT']||'').toString().trim().toUpperCase() === 'FLOW' &&
    r['BUCKET UPDATE'] === 'P001_030'
  );
}

function buildDekscallLayout(){
  const base = getDekscallBase();
  const stat = { count: base.length, sipok: base.reduce((s,r)=> s + (typeof r['SIPOK']==='number' ? r['SIPOK'] : 0), 0) };

  document.getElementById('wrap').innerHTML = `
    <div class="panel-title">NOOD Belum Realisasi (Flow ke P001_030)</div>
    <div class="grand-row" style="margin-bottom:22px;">
      <div class="grand-card"><div class="lbl">Jumlah Kontrak</div><div class="val" id="dekscallValKontrak">0</div></div>
      <div class="grand-card"><div class="lbl">Total Sisa Piutang</div><div class="val" id="dekscallValSipok">Rp0</div></div>
    </div>
    <div class="controls">
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4C6272" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="dekscallSearchInput" type="text" placeholder="Cari nama konsumen, no kontrak, atau nopol…">
      </div>
      <button class="btn" id="dekscallResetBtn">Reset filter</button>
      <button class="btn primary" id="dekscallRefreshBtn">↻ Muat ulang</button>
    </div>
    <div class="count-note" id="dekscallCountNote"></div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th data-key="CO ALL">CO</th>
            <th data-key="NO KONTRAK">No Kontrak</th>
            <th data-key="NAMA KONSUMEN">Nama Konsumen</th>
            <th data-key="STATUS BAYAR">Status</th>
            <th data-key="SIPOK" class="num">Sisa Piutang</th>
            <th data-key="DPD" class="num">DPD</th>
            <th data-key="JATUH TEMPO">Jatuh Tempo</th>
          </tr>
        </thead>
        <tbody id="dekscallTbody"></tbody>
      </table>
    </div>
  `;

  animateCount(document.getElementById('dekscallValKontrak'), stat.count, false);
  animateCount(document.getElementById('dekscallValSipok'), stat.sipok, true);

  document.querySelectorAll('#wrap thead th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-key');
      if(dekscallState.sortKey === key) dekscallState.sortDir *= -1; else { dekscallState.sortKey = key; dekscallState.sortDir = 1; }
      renderDekscallTable();
    });
  });
  document.getElementById('dekscallSearchInput').addEventListener('input', e => { dekscallState.search = e.target.value; renderDekscallTable(); });
  document.getElementById('dekscallResetBtn').addEventListener('click', () => {
    dekscallState = { search:'', sortKey:'JATUH TEMPO', sortDir:1 };
    document.getElementById('dekscallSearchInput').value = '';
    renderDekscallTable();
  });
  document.getElementById('dekscallRefreshBtn').addEventListener('click', loadData);
}

function renderDekscall(){
  if(getDekscallBase().length === 0){
    document.getElementById('wrap').innerHTML = '<div class="state-box">Tidak ada kontrak NOOD yang belum realisasi saat ini. 🎉</div>';
    return;
  }
  renderDekscallTable();
}

function renderDekscallTable(){
  let rows = getDekscallBase();
  if(dekscallState.search.trim()){
    const q = dekscallState.search.trim().toLowerCase();
    rows = rows.filter(r => (r['NAMA KONSUMEN']||'').toLowerCase().includes(q) || (r['NO KONTRAK']||'').toLowerCase().includes(q) || (r['NOPOL']||'').toLowerCase().includes(q));
  }
  if(dekscallState.sortKey){
    rows = rows.slice().sort((a,b) => {
      let va=a[dekscallState.sortKey], vb=b[dekscallState.sortKey];
      if(typeof va==='number' && typeof vb==='number') return (va-vb)*dekscallState.sortDir;
      va=(va||'').toString().toLowerCase(); vb=(vb||'').toString().toLowerCase();
      return va.localeCompare(vb)*dekscallState.sortDir;
    });
  }
  const base = getDekscallBase();
  document.getElementById('dekscallCountNote').innerHTML = `Menampilkan <b>${rows.length}</b> dari <b>${base.length}</b> kontrak`;
  const tbody = document.getElementById('dekscallTbody');
  if(rows.length===0){ tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Tidak ada kontrak yang cocok.</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const meta = CO_META[r['CO ALL']] || {short:r['CO ALL']||'-'};
    return `<tr data-kontrak="${r['NO KONTRAK']}">
      <td data-label="CO" class="mono">${meta.short}</td>
      <td data-label="No Kontrak" class="mono">${r['NO KONTRAK']||'-'}</td>
      <td data-label="Nama">${r['NAMA KONSUMEN']||'-'}</td>
      <td data-label="Status"><span class="status-pill ${statusClass(r['STATUS BAYAR'])}">${r['STATUS BAYAR']||'-'}</span></td>
      <td data-label="Sisa Piutang" class="num">${fmtRupiah(r['SIPOK'])}</td>
      <td data-label="DPD" class="num">${r['DPD'] ?? '-'}</td>
      <td data-label="Jatuh Tempo" class="mono">${fmtDate(r['JATUH TEMPO'])}</td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('tr[data-kontrak]').forEach(tr => tr.onclick = () => openPanel(tr.getAttribute('data-kontrak')));
}

// ============================================================
// TANGGAL BAYAR BULAN LALU — kontrak NOOD/1-30/31-60 (FLOW) yang
// tanggal "TANGGAL BAYAR BULAN LALU"-nya jatuh di tanggal yang sama
// dengan hari ini, buat pantau konsumen yang biasa bayar di tanggal ini.
// FE: NOOD+1-30 kontrak sendiri, non fleet.
// MR: 31-60 kontrak sendiri (non fleet) + 1-30 yang "Sudah Ever" (persis populasi FE Ever).
// Admin/DESKCALL: semua bucket, semua CO, fleet ikut.
// ============================================================
let tglBayarState = { search:'', sortKey:'TANGGAL BAYAR BULAN LALU', sortDir:1 };
const TGLBAYAR_BUCKETS = ['NOOD','P001_030','P031_060'];

function tglBayarIsFlow_(r){
  return (r['KRITERIA ACCT']||'').toString().trim().toUpperCase() === 'FLOW';
}
function tglBayarIsFleet_(r){
  return (r['FLEET/NON FLEET']||'').toString().trim().toUpperCase() === 'FLEET';
}
function tglBayarSameDayAsToday_(dateStr){
  if(!dateStr || typeof dateStr !== 'string') return false;
  const parts = dateStr.split('-');
  if(parts.length !== 3) return false;
  const day = parseInt(parts[2], 10);
  return !isNaN(day) && day === new Date().getDate();
}

function getTglBayarBase(){
  const cocok = r => tglBayarIsFlow_(r) && tglBayarSameDayAsToday_(r['TANGGAL BAYAR BULAN LALU']);

  if(IS_ADMIN || IS_DESKCALL){
    // Semua bucket, semua CO, fleet ikut kehitung.
    return DATA.filter(r => cocok(r) && TGLBAYAR_BUCKETS.includes(r['BUCKET AWAL']));
  }

  const isMR = ROLE_INFO && ROLE_INFO.role === 'MR';
  const isFE = ROLE_INFO && ROLE_INFO.role === 'FE';

  if(isMR){
    const own3160 = DATA.filter(r => cocok(r) && !tglBayarIsFleet_(r) && r['BUCKET AWAL'] === 'P031_060');
    const everMatched = (ESCALATIONS||[]).filter(r => cocok(r) && !tglBayarIsFleet_(r));
    return own3160.concat(everMatched);
  }

  if(isFE){
    return DATA.filter(r => cocok(r) && !tglBayarIsFleet_(r) && (r['BUCKET AWAL']==='NOOD' || r['BUCKET AWAL']==='P001_030'));
  }

  return [];
}

function buildTglBayarLayout(){
  const base = getTglBayarBase();
  const stat = { count: base.length, sipok: base.reduce((s,r)=> s + (typeof r['SIPOK']==='number' ? r['SIPOK'] : 0), 0) };
  const todayDate = new Date().getDate();

  document.getElementById('wrap').innerHTML = `
    <div class="panel-title">Tanggal Bayar Bulan Lalu — Jatuh di Tanggal ${todayDate} Bulan Ini</div>
    <div class="grand-row" style="margin-bottom:22px;">
      <div class="grand-card"><div class="lbl">Jumlah Kontrak</div><div class="val" id="tglBayarValKontrak">0</div></div>
      <div class="grand-card"><div class="lbl">Total Sisa Piutang</div><div class="val" id="tglBayarValSipok">Rp0</div></div>
    </div>
    <div class="controls">
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4C6272" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="tglBayarSearchInput" type="text" placeholder="Cari nama konsumen, no kontrak, atau nopol…">
      </div>
      <button class="btn" id="tglBayarResetBtn">Reset filter</button>
      <button class="btn primary" id="tglBayarRefreshBtn">↻ Muat ulang</button>
    </div>
    <div class="count-note" id="tglBayarCountNote"></div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th data-key="CO ALL">CO</th>
            <th data-key="NO KONTRAK">No Kontrak</th>
            <th data-key="NAMA KONSUMEN">Nama Konsumen</th>
            <th>Bucket</th>
            <th data-key="STATUS BAYAR">Status</th>
            <th data-key="SIPOK" class="num">Sisa Piutang</th>
            <th data-key="DPD" class="num">DPD</th>
            <th data-key="TANGGAL BAYAR BULAN LALU">Tgl Bayar Bulan Lalu</th>
          </tr>
        </thead>
        <tbody id="tglBayarTbody"></tbody>
      </table>
    </div>
  `;

  animateCount(document.getElementById('tglBayarValKontrak'), stat.count, false);
  animateCount(document.getElementById('tglBayarValSipok'), stat.sipok, true);

  document.querySelectorAll('#wrap thead th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-key');
      if(tglBayarState.sortKey === key) tglBayarState.sortDir *= -1; else { tglBayarState.sortKey = key; tglBayarState.sortDir = 1; }
      renderTglBayarTable();
    });
  });
  document.getElementById('tglBayarSearchInput').addEventListener('input', e => { tglBayarState.search = e.target.value; renderTglBayarTable(); });
  document.getElementById('tglBayarResetBtn').addEventListener('click', () => {
    tglBayarState = { search:'', sortKey:'TANGGAL BAYAR BULAN LALU', sortDir:1 };
    document.getElementById('tglBayarSearchInput').value = '';
    renderTglBayarTable();
  });
  document.getElementById('tglBayarRefreshBtn').addEventListener('click', loadData);
}

function renderTglBayarTable(){
  let rows = getTglBayarBase();
  const total = rows.length;
  if(tglBayarState.search.trim()){
    const q = tglBayarState.search.trim().toLowerCase();
    rows = rows.filter(r => (r['NAMA KONSUMEN']||'').toLowerCase().includes(q) || (r['NO KONTRAK']||'').toLowerCase().includes(q) || (r['NOPOL']||'').toLowerCase().includes(q));
  }
  if(tglBayarState.sortKey){
    rows = rows.slice().sort((a,b) => {
      let va=a[tglBayarState.sortKey], vb=b[tglBayarState.sortKey];
      if(typeof va==='number' && typeof vb==='number') return (va-vb)*tglBayarState.sortDir;
      va=(va||'').toString().toLowerCase(); vb=(vb||'').toString().toLowerCase();
      return va.localeCompare(vb)*tglBayarState.sortDir;
    });
  }
  document.getElementById('tglBayarCountNote').innerHTML = `Menampilkan <b>${rows.length}</b> dari <b>${total}</b> kontrak`;
  const tbody = document.getElementById('tglBayarTbody');
  if(rows.length===0){ tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Tidak ada kontrak yang cocok.</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const meta = CO_META[r['CO ALL']] || {short:r['CO ALL']||'-'};
    return `<tr data-kontrak="${r['NO KONTRAK']}">
      <td data-label="CO" class="mono">${meta.short}</td>
      <td data-label="No Kontrak" class="mono">${r['NO KONTRAK']||'-'}</td>
      <td data-label="Nama">${r['NAMA KONSUMEN']||'-'}</td>
      <td data-label="Bucket"><span class="bpill" style="background:${BUCKET_COLOR[r['BUCKET AWAL']]||'#999'}">${fmtBucket(r['BUCKET AWAL'])}</span></td>
      <td data-label="Status"><span class="status-pill ${statusClass(r['STATUS BAYAR'])}">${r['STATUS BAYAR']||'-'}</span></td>
      <td data-label="Sisa Piutang" class="num">${fmtRupiah(r['SIPOK'])}</td>
      <td data-label="DPD" class="num">${r['DPD'] ?? '-'}</td>
      <td data-label="Tgl Bayar Bulan Lalu" class="mono">${fmtDate(r['TANGGAL BAYAR BULAN LALU'])}</td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('tr[data-kontrak]').forEach(tr => tr.onclick = () => openPanel(tr.getAttribute('data-kontrak')));
}

// ============================================================
// SIMULASI PENAWARAN — Kalkulator MotorKu (semua role)
// Diporting dari QuickTools_MotorKu_2026_v8_13_0.xlsx sheet "Quick Tools"
// =====================================================