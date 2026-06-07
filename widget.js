(function(){
  // localStorageからAPIキーを読み込む
  const LS_KEY = 'kuro_api_key';
  function loadKey(){
    try{ return localStorage.getItem(LS_KEY)||localStorage.getItem('cKey')||''; }catch(e){ return ''; }
  }
  function saveKey(k){
    try{ localStorage.setItem(LS_KEY,k); localStorage.setItem('cKey',k); }catch(e){}
  }

  // APIキーを入力欄に設定
  function initKey(){
    const el = document.getElementById('askKey');
    if(!el) return;
    const saved = loadKey();
    if(saved){
      el.value = saved;
      const st = document.getElementById('askKeySaved');
      if(st) st.style.display = 'block';
    }
    el.addEventListener('input', function(){
      if(el.value.trim()){ saveKey(el.value.trim()); }
    });
  }

  // 追加質問を送信
  async function runAsk(){
    const q = document.getElementById('askTA').value.trim();
    const k = document.getElementById('askKey').value.trim();
    if(!q){ alert('質問を入力してください'); return; }
    if(!k){ alert('Claude APIキーを入力してください'); return; }
    saveKey(k);
    const btn = document.getElementById('askSubmit');
    btn.disabled = true; btn.textContent = '調査中...';
    const res = document.getElementById('askResult');
    res.style.display = 'block'; res.textContent = '🔍 調査中...';

    const QUERY = window._kuroQuery || '';
    const CONTEXT = window._kuroContext || '';
    const prompt = '以下の調査レポートを踏まえて、追加の質問に答えてください。\n\n【調査テーマ】\n' + QUERY + '\n\n【レポート概要】\n' + CONTEXT + '\n\n【追加質問】\n' + q + '\n\n具体的な数値・企業名・出典を含めて詳しく回答してください。';

    try{
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': k,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      };
      const messages = [{role:'user', content: prompt}];
      for(let i=0; i<15; i++){
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers,
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 3000,
            tools: [{type:'web_search_20250305', name:'web_search', max_uses:5}],
            messages
          })
        });
        const d = await r.json();
        if(!r.ok) throw new Error(d.error?.message || 'Error ' + r.status);
        const getText = c => (Array.isArray(c)?c:[c]).filter(x=>x&&x.type==='text').map(x=>x.text).join('');
        if(d.stop_reason === 'end_turn'){ res.textContent = getText(d.content) || '（回答なし）'; break; }
        if(d.stop_reason === 'tool_use'){
          messages.push({role:'assistant', content: d.content});
          const uses = d.content.filter(c=>c.type==='tool_use');
          res.textContent = '🔍 検索中: ' + uses.map(u=>u.input?.query||'').join(', ');
          messages.push({role:'user', content: uses.map(u=>({
            type:'tool_result', tool_use_id: u.id,
            content:[{type:'text', text:'Search completed.'}]
          }))});
          continue;
        }
        res.textContent = getText(d.content) || '（回答なし）'; break;
      }
    }catch(e){ res.textContent = 'エラー: ' + e.message; }
    btn.disabled = false; btn.textContent = '送信して調査';
  }

  // ボタンにイベントをバインド（iOS対応）
  function bindBtn(id, fn){
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('click', fn);
    el.addEventListener('touchend', function(e){ e.preventDefault(); fn(); }, {passive:false});
  }

  // 初期化
  function init(){
    initKey();
    bindBtn('askSubmit', runAsk);
    bindBtn('askClose', function(){ document.getElementById('askOverlay').classList.remove('open'); });
    bindBtn('askFab', function(){ document.getElementById('askOverlay').classList.add('open'); });
    // オーバーレイ背景クリックで閉じる
    const overlay = document.getElementById('askOverlay');
    if(overlay) overlay.addEventListener('click', function(e){ if(e.target===this) this.classList.remove('open'); });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
