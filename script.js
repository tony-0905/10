/* ════════════════════════════════════════════════════════════════
   翼灵物联网工作室 · 交互脚本
   胶囊导航指示器 / 滚动浮现 / 数字滚动 / 双卡翻转轮播 / 3D 倾斜
   ════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const $  = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];

  /* ── 1. 导航：滚动加深 + 滑动指示器 ─────────────────────────── */
  const nav      = $("#nav");
  const navLinks = $("#navLinks");
  const navThumb = $("#navThumb");
  const links    = $$(".nav-link", navLinks);

  function moveThumb(el) {
    if (!el) return;
    navThumb.style.width = el.offsetWidth + "px";
    navThumb.style.transform = `translateX(${el.offsetLeft}px)`;
  }

  function setActiveLink(id) {
    const target = links.find(a => a.getAttribute("href") === "#" + id);
    if (!target || target.classList.contains("is-active")) return;
    links.forEach(a => a.classList.remove("is-active"));
    target.classList.add("is-active");
    moveThumb(target);
    /* 移动端：让激活项滚动到可视区域 */
    navLinks.scrollTo({
      left: target.offsetLeft - navLinks.offsetWidth / 2 + target.offsetWidth / 2,
      behavior: "smooth"
    });
  }

  /* 初始定位 */
  const initNav = () => { moveThumb($(".nav-link.is-active") || links[0]); };
  initNav();
  window.addEventListener("resize", initNav);

  const toTopBtn = $("#toTop");
  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 24);
    toTopBtn.classList.toggle("show", window.scrollY > 640);
  }, { passive: true });

  toTopBtn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );

  /* ── 2. 滚动监听：当前区块高亮 ─────────────────────────────── */
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) setActiveLink(e.target.id);
    });
  }, { rootMargin: "-42% 0px -52% 0px" });

  $$("main section[id]").forEach(s => spy.observe(s));

  /* ── 3. 滚动浮现 ────────────────────────────────────────────── */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        revealIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

  $$(".reveal").forEach(el => revealIO.observe(el));

  /* ── 4. 数字滚动 ───────────────────────────────────────────── */
  function animateCount(el) {
    const target  = parseInt(el.dataset.count, 10) || 0;
    const duration = 1400;
    const start   = performance.now();
    const ease    = t => 1 - Math.pow(1 - t, 4); /* easeOutQuart */

    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(ease(p) * target);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        $$("[data-count]", e.target).forEach(animateCount);
        if (e.target.dataset.count) animateCount(e.target);
        countIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });

  $$(".hero-stats").forEach(el => countIO.observe(el));

  /* ── 5. 团队风采：单卡左右切换轮播 ────────────────────────────
     · 9 张图片循环，一个展示位
     · 自动模式：每 5 秒向左切一张（旧图左滑出、新图右滑入）
     · 点击左/右箭头或卡片：立即切换，暂停自动 15 秒
  ──────────────────────────────────────────────────────────────── */
  const PHOTOS = Array.from({ length: 9 }, (_, i) =>
    `images/photos/photo-${String(i + 1).padStart(2, "0")}.webp`);

  const AUTO_INTERVAL = 5000;     /* 自动轮播间隔 */
  const HOLD_AFTER_CLICK = 15000; /* 点击后暂停时长 */

  const card = $("[data-flip]");
  if (card) {
    const viewport = $(".flip-viewport", card);
    const cap = $("figcaption span", card);
    let pos = 0;        /* 当前展示的图片下标 */
    let timer = null;

    const pad = i => String(i + 1).padStart(2, "0");

    async function show(idx, dir) {
      if (card.dataset.busy) return;
      card.dataset.busy = "1";
      const oldImg = $(".flip-img", card);
      const nextPos = (idx + PHOTOS.length) % PHOTOS.length;
      const newImg = document.createElement("img");
      newImg.className = "flip-img " + (dir === -1 ? "is-in-rev" : "is-in");
      newImg.alt = `团队照片 ${pad(nextPos)}`;
      let loadTimeout;
      try {
        newImg.src = PHOTOS[nextPos];
        await Promise.race([
          newImg.decode(),
          new Promise((_, reject) => {
            loadTimeout = setTimeout(() => reject(new Error("Image load timeout")), 15000);
          })
        ]);
        clearTimeout(loadTimeout);
        viewport.appendChild(newImg);
        pos = nextPos;
        if (cap) cap.textContent = `团队合影 · ${pad(pos)}`;
        await new Promise(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            newImg.classList.remove("is-in", "is-in-rev");
            if (oldImg) oldImg.classList.add(dir === -1 ? "is-out-rev" : "is-out");
            setTimeout(resolve, 700);
          }));
        });
        if (oldImg) oldImg.remove();
      } catch {
        // 加载失败时保留原图和图注，允许下次重试。
        newImg.remove();
      } finally {
        clearTimeout(loadTimeout);
        delete card.dataset.busy;
      }
    }

    function scheduleAuto(delay = AUTO_INTERVAL) {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await show(pos + 1, 1);
        scheduleAuto();
      }, delay);
    }

    async function manualShow(dir) {
      if (card.dataset.busy) return;
      clearTimeout(timer);
      await show(pos + dir, dir);
      scheduleAuto(HOLD_AFTER_CLICK);
    }

    /* 左右箭头：上一张 / 下一张；点卡片本体 → 下一张 */
    const prev = $(".flip-prev", card);
    const next = $(".flip-next", card);
    if (prev) prev.addEventListener("click", e => {
      e.stopPropagation();
      manualShow(-1);
    });
    if (next) next.addEventListener("click", e => {
      e.stopPropagation();
      manualShow(1);
    });
    card.addEventListener("click", e => {
      if (e.target.closest(".flip-arrow")) return;
      manualShow(1);
    });

    scheduleAuto();
  }

  /* 纳新群号与二维码复制 */
  const copyStatus = $("#copyStatus");
  let statusTimer;
  function announceCopy(message) {
    clearTimeout(statusTimer);
    copyStatus.textContent = message;
    statusTimer = setTimeout(() => { copyStatus.textContent = ""; }, 6000);
  }

  $("#copyGroup").addEventListener("click", async e => {
    const button = e.currentTarget;
    button.disabled = true;
    try {
      await navigator.clipboard.writeText($("#groupNumber").textContent.trim());
      announceCopy("群号已复制");
    } catch {
      announceCopy("复制失败，请长按群号手动复制");
    } finally {
      button.disabled = false;
    }
  });

  const qrDialog = $("#qrDialog");
  $("#openQr").addEventListener("click", () => qrDialog.showModal());
  $("#closeQr").addEventListener("click", () => qrDialog.close());
  qrDialog.addEventListener("click", e => {
    if (e.target !== qrDialog) return;
    const bounds = qrDialog.getBoundingClientRect();
    if (e.clientX < bounds.left || e.clientX > bounds.right ||
        e.clientY < bounds.top || e.clientY > bounds.bottom) qrDialog.close();
  });

  /* ── 7. 技术方向卡片 3D 倾斜（仅桌面精确指针） ─────────────── */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$(".dir-card").forEach(card => {
      card.addEventListener("pointermove", e => {
        const r  = card.getBoundingClientRect();
        const x  = (e.clientX - r.left) / r.width  - 0.5;
        const y  = (e.clientY - r.top)  / r.height - 0.5;
        card.style.setProperty("--ry", (x * 4).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-y * 4).toFixed(2) + "deg");
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

})();
