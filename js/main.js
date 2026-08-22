document.addEventListener('DOMContentLoaded', () => {
  // 漢堡選單
  const toggle = document.querySelector('.nav-toggle');
  const navbar = document.querySelector('.navbar');
  if (toggle) toggle.addEventListener('click', () => {
    navbar.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(navbar.classList.contains('open')));
  });
  // 點面板外關閉。面板只佔右側，左邊仍是可見的頁面內容——點那裡的直覺
  // 就是「收起選單」，沒有這條的話使用者得回頭去按 X。
  // 用 closest 判斷來源：點在面板或漢堡上不關（漢堡自己會 toggle）。
  document.addEventListener('click', e => {
    if (!navbar || !navbar.classList.contains('open')) return;
    if (e.target.closest('.nav-links') || e.target.closest('.nav-toggle')) return;
    navbar.classList.remove('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  });

  // 手機下拉（<1024 點擊展開）。手風琴互斥：同時只開一個。
  // 不只是為了俐落——兩個下拉一起展開會把選單撐過一個螢幕，捲軸就回來了。
  document.querySelectorAll('.dropdown > a').forEach(a =>
    a.addEventListener('click', e => {
      if (window.innerWidth < 1024) { e.preventDefault();
        document.querySelectorAll('.dropdown').forEach(d => {
          if (d !== a.parentElement) d.classList.remove('open');
        });
        a.parentElement.classList.toggle('open'); }
    }));

  // 跑馬燈：原生水平捲動 + rAF 自動推進。
  // 用原生捲動而非 CSS transform，手機才能「用手滑」（含慣性）；自動推進
  // 以 px/秒 表示，速度與內容多寡脫鉤，不像 30s 一圈那樣多加幾張就變慢。
  // markup 是同一組內容重複兩份，因此捲到「總寬一半」就等於回到起點，
  // 直接減去半寬即可無縫接回——用實測像素而非 -50%，沒有換算誤差。
  document.querySelectorAll('.marquee').forEach(m => {
    const inner = m.querySelector('.marquee-inner');
    if (!inner) return;
    const SPEED = 75;                 // px/秒（原本 1386px/30s ≒ 46px/秒）
    const RESUME = 1200;              // 手放開後多久恢復自動捲動
    let pos = 0;
    let last = null;
    let holdUntil = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const wrap = () => {
      const half = inner.scrollWidth / 2;
      if (half <= 0) return half;
      if (pos >= half) pos -= half;
      else if (pos < 0) pos += half;
      return half;
    };
    const step = t => {
      const dt = last === null ? 0 : (t - last) / 1000;
      last = t;
      const moving = !reduce.matches && t >= holdUntil;
      if (moving) {
        pos += SPEED * dt;
        if (wrap() > 0) m.scrollLeft = pos;
      } else {
        pos = m.scrollLeft;           // 手動捲動期間持續同步，放開才不會跳
        const half = wrap();
        if (half > 0 && pos !== m.scrollLeft) m.scrollLeft = pos;
      }
      requestAnimationFrame(step);
    };
    const hold = ms => { holdUntil = performance.now() + ms; };
    // 手指按著、滑鼠移入、用滾輪橫捲時都不要跟使用者搶捲軸
    m.addEventListener('touchstart', () => hold(1e9), { passive: true });
    m.addEventListener('touchend', () => hold(RESUME), { passive: true });
    m.addEventListener('mouseenter', () => hold(1e9));
    m.addEventListener('mouseleave', () => hold(0));
    m.addEventListener('wheel', () => hold(RESUME), { passive: true });
    requestAnimationFrame(step);
  });

  // 主視覺輪播：靜態圖 <-> 操作示範影片。
  // 切換點刻意不用固定秒數：圖片停 IMG_MS，影片則等 ended 事件，綁的是影片
  // 自己的長度，換一支長度不同的影片也不必改參數，更不會播到一半被切走。
  // 影片 preload="none"，切到第二張才開始下載，首屏 LCP 仍是那張 JPG。
  document.querySelectorAll('[data-hero]').forEach(h => {
    const track = h.querySelector('.hero-track');
    const slides = [...h.querySelectorAll('.hero-slide')];
    const dots = [...h.querySelectorAll('.hero-dots button')];
    const video = h.querySelector('video');
    if (!track || slides.length < 2) return;
    const IMG_MS = 5000;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let i = 0;
    let timer = null;
    // 使用者自己點過圓點或滑過之後就停止自動輪播，把控制權交出去。
    // 這同時取代原本的 hover 暫停——hero 佔頁面頂端一大塊，游標很容易
    // 就停在上面，hover 暫停會讓自動輪播「永遠不跑」，影片因此完全不會
    // 出現（實測滑鼠停著 9 秒仍在第 1 張）。被動訪客一定看得到影片，
    // 主動操作的人則完全掌控，兩邊都成立。
    let userTook = false;

    const clear = () => { clearTimeout(timer); timer = null; };
    const schedule = () => {
      if (reduce.matches || userTook) return;
      clear();
      timer = setTimeout(() => go(i + 1), IMG_MS);
    };
    // manual = 使用者自己點圓點或滑動。prefers-reduced-motion 要停掉的是
    // 「自動」發生的動態，不是使用者主動要求的播放——開了減少動態效果的
    // 訪客若連手動點都播不了，等於這支影片對他完全不存在。
    const go = (n, manual) => {
      i = (n + slides.length) % slides.length;
      track.style.transform = `translateX(-${i * 100}%)`;
      h.classList.toggle('on-video', !!video && slides[i].contains(video));
      dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
      clear();
      if (video && slides[i].contains(video)) {
        video.currentTime = 0;
        if (manual || !reduce.matches) {
          // 自動播放被擋掉（iOS 低耗電模式等）時退回計時切換，不要卡在
          // 影片這張。preload="metadata" 保證此時至少有首帧可看，不是空白。
          video.play().catch(schedule);
        }
      } else {
        if (video) video.pause();
        schedule();
      }
    };

    // 首屏過後預熱影片。preload 維持 "none"（實測 "metadata" 會讓 Chrome
    // 直接抓滿整支 806KB，等於廢掉 LCP 保護）；改在 load 事件之後主動
    // load() 一次，首屏不受影響，而 5 秒後切到影片時已經有影格可顯示——
    // 這樣即使 play() 被擋（iOS 低耗電模式），看到的是畫面而不是一片空白。
    if (video) {
      const warm = () => {
        if (video.preload === 'none') { video.preload = 'metadata'; video.load(); }
      };
      if (document.readyState === 'complete') setTimeout(warm, 300);
      else window.addEventListener('load', () => setTimeout(warm, 300), { once: true });
    }

    if (video) video.addEventListener('ended', () => { if (!userTook) go(0); });
    dots.forEach((d, k) => d.addEventListener('click', () => { userTook = true; go(k, true); }));

    let sx = null;
    let sy = null;
    let axis = null;
    h.addEventListener('touchstart', e => {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; axis = null;
    }, { passive: true });
    h.addEventListener('touchmove', e => {
      if (sx === null) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (axis === null && Math.abs(dx) + Math.abs(dy) > 10) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (axis === 'x' && e.cancelable) e.preventDefault();
    }, { passive: false });
    h.addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (axis === 'x' && Math.abs(dx) > 40) { userTook = true; go(i + (dx < 0 ? 1 : -1), true); }
      sx = null;
    });

    schedule();
  });

  // AI 渲染風格切換器：點縮圖籤切換舞台圖；載入後每 3.5 秒自動示範一輪，
  // 使用者第一次點擊即停止自動播（控制權交還使用者，不再搶回）——與 hero
  // 輪播同一套規則，站上兩處行為一致。
  // 這裡不能用 `if (!wrap) return;`：整份檔案是 DOMContentLoaded 的回呼，
  // return 會離開整個回呼，讓後面的燈箱、輪播、FAQ、分頁全部不註冊。
  // 切換器只存在於首頁，於是其餘六頁的互動一次死光（2026-08-22 修）。
  const aiWrap = document.querySelector('[data-od-id="ai-style-switcher"]');
  if (aiWrap) {
    const views = aiWrap.querySelectorAll('.ai-view');
    const chips = [...aiWrap.querySelectorAll('.ai-chip')];
    const label = aiWrap.querySelector('.ai-stage-label');
    const show = s => {
      views.forEach(v => v.classList.toggle('active', v.dataset.style === s));
      chips.forEach(c => {
        const on = c.dataset.style === s;
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', String(on));
        if (on) label.textContent = c.querySelector('span').textContent;
      });
    };
    let idx = 0;
    let auto = setInterval(() => {
      idx = (idx + 1) % chips.length;
      show(chips[idx].dataset.style);
    }, 3500);
    chips.forEach(c => c.addEventListener('click', () => {
      if (auto) { clearInterval(auto); auto = null; }
      idx = chips.indexOf(c);
      show(c.dataset.style);
    }));
  }

  // 燈箱（事件委派）
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = '<button class="lightbox-close" aria-label="關閉">×</button><img alt="">';
  document.body.appendChild(overlay);
  document.body.addEventListener('click', e => {
    const t = e.target.closest('[data-lightbox]');
    if (t) {
      if (t.tagName === 'A') e.preventDefault();
      overlay.querySelector('img').src = t.dataset.lightboxSrc || t.src;
      overlay.classList.add('show');
    }
  });
  const closeLb = () => overlay.classList.remove('show');
  overlay.addEventListener('click', closeLb);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLb(); });

  // 卡片無聲預覽（2026-08-22）。實測 hover 到出現畫面只要 1–4ms，而同一張卡
  // 改載 YouTube iframe 光是文件就要 445–777ms——訪客感覺到的等待完全由我們
  // 決定，因此 400ms 純粹是防抖：滑鼠掃過整排時不讓六張輪流閃一遍。
  //
  // 只有帶 data-preview 的卡片啟用。從 data-yt-id 推路徑看似更省事，但那要求
  // 「檔案存在」靠猜，猜錯就是每次 hover 一個 404。屬性寫在 HTML 裡，
  // 等於把「這張卡有預覽片」變成可 grep、code review 看得見的事實。
  const HOVER_MS = 400;
  const noMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const previews = [...document.querySelectorAll('.yt-facade[data-preview]')];
  let activePv = null, pvTimer = null;

  const pvStop = (f) => {
    if (!f) return;
    const v = f.querySelector('video');
    // 點擊後 innerHTML 被換成 iframe，video 已不存在——不檢查會在這裡拋錯
    if (v) { v.pause(); v.currentTime = 0; }
    f.classList.remove('playing');
    if (activePv === f) activePv = null;
  };

  const pvPlay = (f) => {
    if (noMotion.matches || activePv === f) return;
    const v = f.querySelector('video');
    if (!v) return;
    pvStop(activePv);
    // preload="none"：src 到這一刻才指派，沒觸發的訪客一個 byte 都不下載
    if (!v.getAttribute('src')) v.setAttribute('src', f.dataset.preview);
    activePv = f;
    f.classList.add('playing');
    v.play().catch(() => pvStop(f));
  };

  // <video> 由這裡補上，HTML 只需要 data-preview 一個屬性——接素材時要記的
  // 事情越少越好。在初始化時就插入（而非播放時），元素才有機會以 opacity:0
  // 存在一輪，.playing 的淡入才會真的 transition 而不是瞬間跳出。
  // 沒有 src，因此不產生任何網路請求。
  const pvEnsureVideo = (f) => {
    let v = f.querySelector('video');
    if (v) return v;
    v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.loop = true;
    v.preload = 'none';
    v.setAttribute('aria-hidden', 'true');
    f.insertBefore(v, f.querySelector('.yt-play'));
    return v;
  };

  if (previews.length) {
    previews.forEach(pvEnsureVideo);
    previews.forEach(f => {
      f.addEventListener('mouseenter', () => {
        clearTimeout(pvTimer);
        pvTimer = setTimeout(() => pvPlay(f), HOVER_MS);
      });
      f.addEventListener('mouseleave', () => {
        clearTimeout(pvTimer);
        pvStop(f);
      });
    });

    // 觸控裝置沒有 hover：改用「進入畫面中央」觸發。rootMargin 把觸發區
    // 限縮成中央那一段，再取交集比例最高的那張——同時只播一支在手機比桌機
    // 更要緊，五支影片同時解碼是電池與行動數據的雙重浪費。
    if (matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => { if (!e.isIntersecting) pvStop(e.target); });
        const top = entries.filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (top) pvPlay(top.target);
      }, { threshold: [0, .6], rootMargin: '-25% 0px -25% 0px' });
      previews.forEach(f => io.observe(f));
    }
  }

  // YouTube facade
  document.querySelectorAll('.yt-facade').forEach(el =>
    el.addEventListener('click', () => {
      // 先停預覽再換 innerHTML：不停的話 activePv 會指向一個已離開文件的節點，
      // 下一次 hover 的 pvStop(activePv) 就對著幽靈操作。
      pvStop(el);
      const id = el.dataset.ytId;
      el.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1"
        allow="autoplay; encrypted-media" allowfullscreen
        style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe>`;
    }, { once: true }));

  // FAQ 手風琴。aria-expanded 與視覺箭頭是同一狀態的兩個出口：
  // 箭頭給眼睛、aria 給螢幕閱讀器，缺一個就有一群使用者不知道現在是開是關。
  document.querySelectorAll('.faq-q').forEach(q => {
    q.setAttribute('aria-expanded', 'false');
    q.addEventListener('click', () => {
      const open = q.closest('.faq-item').classList.toggle('open');
      q.setAttribute('aria-expanded', String(open));
    });
  });

  // 輪播
  // 翻頁數學是「一頁 = track 的 100% 寬」，頁數取自 DOM 的 .carousel-page 數。
  // 掛 data-single-mobile="<item選擇器>" 的輪播在 <1024px 會把每個 item 重組成
  // 獨立一頁（手機一頁一張），回到桌機時還原初始 markup。頁數因此會變，
  // pages/dots 都得跟著重算，故抽成 setup() 可重入。
  // 重組用 DOM 手術是安全的：燈箱是 document.body 上的事件委派（見上方），
  // 節點搬移或重建都不會掉監聽。
  document.querySelectorAll('[data-carousel]').forEach(c => {
    const track = c.querySelector('.carousel-track');
    const dots = c.querySelector('.carousel-dots');
    let i = 0;
    let pages = 0;
    const count = c.querySelector('.carousel-count');   // 頁數多的輪播在手機以「n / N」取代圓點
    const render = () => {
      track.style.transform = `translateX(-${i * 100}%)`;
      dots.querySelectorAll('span').forEach((d, n) => d.classList.toggle('active', n === i));
      if (count) count.textContent = `${i + 1} / ${pages}`;
    };
    const setup = () => {
      pages = c.querySelectorAll('.carousel-page').length;
      i = 0;
      dots.innerHTML = '';
      for (let n = 0; n < pages; n++) dots.appendChild(document.createElement('span'));
      render();
    };
    // 箭頭是選配：沒有箭頭的輪播（例如只要圓點的）不該讓整支 JS 死在這裡——
    // 這裡一丟 TypeError，後面的燈箱、FAQ、分頁全部不會註冊。
    const prev = c.querySelector('.carousel-prev');
    const next = c.querySelector('.carousel-next');
    if (prev) prev.addEventListener('click', () => { i = (i - 1 + pages) % pages; render(); });
    if (next) next.addEventListener('click', () => { i = (i + 1) % pages; render(); });

    // 觸控滑動。只在「確定是橫向」時才 preventDefault——先比較 dx/dy 鎖定
    // 方向，否則會把使用者的垂直捲頁一起吃掉，那比沒有滑動更糟。
    // 監聽掛在 track 上：手機重組頁面只換 innerHTML，track 本身不會被替換，
    // 監聽器因此不會掉。門檻 40px，避免點擊被誤判成滑動。
    let sx = null;
    let sy = null;
    let axis = null;
    track.addEventListener('touchstart', e => {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; axis = null;
    }, { passive: true });
    track.addEventListener('touchmove', e => {
      if (sx === null) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (axis === null && Math.abs(dx) + Math.abs(dy) > 10) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (axis === 'x' && e.cancelable) e.preventDefault();
    }, { passive: false });
    track.addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (axis === 'x' && Math.abs(dx) > 40) {
        i = (i + (dx < 0 ? 1 : -1) + pages) % pages;
        render();
      }
      sx = null;
    });

    const itemSel = c.dataset.singleMobile;
    if (itemSel) {
      const desktopHTML = track.innerHTML;   // 桌機版 markup 快照，還原時用
      const mq = window.matchMedia('(max-width: 1023px)');
      const apply = () => {
        if (mq.matches) {
          const items = [...track.querySelectorAll(itemSel)];
          track.innerHTML = '';
          items.forEach(it => {
            const pg = document.createElement('div');
            pg.className = 'carousel-page';
            pg.appendChild(it);          // 搬移原節點，已載入的圖不重抓
            track.appendChild(pg);
          });
        } else {
          track.innerHTML = desktopHTML;
        }
        setup();
      };
      mq.addEventListener('change', apply);
      apply();
    } else {
      setup();
    }
  });

  // 分頁（素材庫/新知共用）
  document.querySelectorAll('[data-page-group]').forEach(g => {
    const panels = g.querySelectorAll('.page-panel');
    const links = g.querySelectorAll('.pagination a');
    let cur = 1;
    let first = true;
    const show = n => {
      const next = Math.min(Math.max(1, n), panels.length);
      if (next === cur && !first) return;
      cur = next;
      panels.forEach(p => p.style.display = (+p.dataset.page === cur) ? '' : 'none');
      links.forEach(a => a.classList.toggle('active', a.dataset.goto === String(cur)));
      if (first) { first = false; } else { g.scrollIntoView({ behavior: 'smooth' }); }
    };
    links.forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      show(a.dataset.goto === 'next' ? cur + 1 : +a.dataset.goto);
    }));
    show(1);
  });
});
