/**
 * Octopus Tools - 共通管理スクリプト
 * ・バージョンおよび更新内容の一元管理（メイン＋各ツール計5系統）
 * ・グローバルナビゲーション自動生成
 * ・ダークモード（テーマ）切り替え＆永続化
 * ・PCワイド表示切り替え＆永続化
 * ・アコーディオン開閉制御
 */

const OCTOPUS_APP_INFO = {
    // 1. メイン（共通）バージョン情報（v1.24を維持）
    version: "1.24",
    date: "2026-09-22",
    updateNote: "「EXIF View & Edit」に露出プログラム〜露出モードの簡易モード追加、および閲覧専用セルの選択・移動・コピー操作対応を実装",

    // 2. 各ツールの個別サブバージョン・更新内容
    tools: {
        index: {
            name: "TOP",
            subVersion: "12",
            updateNote: "インラインスクリプトを完全撤廃し、HTMLの軽量・スリム化を完了"
        },
        exif: {
            name: "EXIF Frame",
            subVersion: "131",
            updateNote: "固有スクリプトを「js/exif-frame.js」へ完全外出し・即時関数カプセル化"
        },
        mosaic: {
            name: "Mosaic & Blur",
            subVersion: "114",
            updateNote: "固有スクリプトを「js/mosaic-blur.js」へ完全外出し・即時関数カプセル化"
        },
        cleaner: {
            name: "EXIF Cleaner",
            subVersion: "5",
            updateNote: "固有スクリプトを「js/exif-cleaner.js」へ完全外出し・即時関数カプセル化"
        },
        viewedit: {
            name: "EXIF View & Edit",
            subVersion: "23",
            updateNote: "簡易モードにおける露出関連6項目（露出プログラム〜露出モード）の表示位置を「画像タイトル」の次へ移動"
        }
    }
};

// 共通ナビゲーション項目定義
const OCTOPUS_NAV_ITEMS = [
    { id: "index", name: "TOP", url: "index.html", icon: "🐙" },
    { id: "exif", name: "EXIF Frame", url: "ExifFrame.html", icon: "📷" },
    { id: "mosaic", name: "Mosaic & Blur", url: "MosaicBlur.html", icon: "🧩" },
    { id: "cleaner", name: "EXIF Cleaner", url: "ExifCleaner.html", icon: "🧹" },
    { id: "viewedit", name: "EXIF View & Edit", url: "ExifViewEdit.html", icon: "📝" }
];

(function() {
    // --------------------------------------------------
    // A. ページ判定（ファイル名またはURLから自動判別）
    // --------------------------------------------------
    function getCurrentPageKey() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes("exifviewedit")) return "viewedit";
        if (path.includes("exifcleaner")) return "cleaner";
        if (path.includes("exifframe")) return "exif";
        if (path.includes("mosaicblur")) return "mosaic";
        return "index";
    }

    // --------------------------------------------------
    // B. テーマ（ダークモード）制御
    // --------------------------------------------------
    let isDark = localStorage.getItem('theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    function initThemeToggle() {
        const themeBtn = document.getElementById('theme-btn');
        if (!themeBtn) return;
        themeBtn.textContent = isDark ? '☀️' : '🌙';

        themeBtn.addEventListener('click', () => {
            isDark = !isDark;
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            themeBtn.textContent = isDark ? '☀️' : '🌙';
        });
    }

    // --------------------------------------------------
    // C. PCワイド表示制御
    // --------------------------------------------------
    function initWideModeToggle(pageKey) {
        const mainContainer = document.getElementById('main-container');
        const wideToggleBtn = document.getElementById('wide-toggle-btn');
        if (!mainContainer || !wideToggleBtn) return;

        const legacyKeyMap = {
            viewedit: 'viewedit_wide_mode',
            cleaner: 'cleaner_wide_mode',
            mosaic: 'mosaic_wide_mode',
            exif: 'exif_wide_mode'
        };
        const legacyKey = legacyKeyMap[pageKey];
        let isWideMode = (localStorage.getItem('octopus_wide_mode') ?? (legacyKey ? localStorage.getItem(legacyKey) : null)) === 'true';

        const applyWideMode = (notify = false) => {
            if (isWideMode) {
                mainContainer.classList.add('wide-mode');
                wideToggleBtn.textContent = '⤡ 標準幅に戻す';
            } else {
                mainContainer.classList.remove('wide-mode');
                wideToggleBtn.textContent = '⤢ ワイド表示';
            }
            if (notify) {
                window.dispatchEvent(new CustomEvent('octopus:widemode', { detail: { isWideMode } }));
            }
        };

        applyWideMode(false);

        wideToggleBtn.addEventListener('click', () => {
            isWideMode = !isWideMode;
            localStorage.setItem('octopus_wide_mode', isWideMode ? 'true' : 'false');
            applyWideMode(true);
        });
    }

    // --------------------------------------------------
    // D. 共通アコーディオン開閉制御
    // --------------------------------------------------
    window.toggleAccordion = function(contentId, headerEl) {
        const content = document.getElementById(contentId);
        if (!content) return;
        content.classList.toggle('open');
        const span = headerEl ? headerEl.querySelector('span') : null;
        if (span) {
            span.textContent = content.classList.contains('open') ? '▲' : '▼';
        }
    };

    // --------------------------------------------------
    // E. DOMContentLoaded 初期化処理
    // --------------------------------------------------
    document.addEventListener("DOMContentLoaded", () => {
        const currentKey = getCurrentPageKey();
        const toolInfo = OCTOPUS_APP_INFO.tools[currentKey];

        // 1. バージョン表示および詳細ツールチップの反映
        const versionEl = document.getElementById("version-display");
        if (versionEl) {
            versionEl.textContent = `v${OCTOPUS_APP_INFO.version}`;
            if (toolInfo) {
                versionEl.title = 
                    `【全体 v${OCTOPUS_APP_INFO.version} (${OCTOPUS_APP_INFO.date})】\n` +
                    `・${OCTOPUS_APP_INFO.updateNote}\n\n` +
                    `【${toolInfo.name} Build: ${toolInfo.subVersion}】\n` +
                    `・${toolInfo.updateNote}`;
            }
        }

        // 2. 共通グローバルナビゲーションの自動生成
        const navContainer = document.getElementById("global-nav");
        if (navContainer) {
            navContainer.className = "global-nav";
            navContainer.setAttribute("aria-label", "ツール切り替え");
            navContainer.innerHTML = OCTOPUS_NAV_ITEMS.map(item => {
                const isActive = item.id === currentKey ? " active" : "";
                return `<a href="${item.url}" class="nav-item${isActive}"><span>${item.icon}</span> ${item.name}</a>`;
            }).join("");
        }

        // 3. テーマ切り替えボタンの初期化
        initThemeToggle();

        // 4. ワイド表示切り替えの初期化
        initWideModeToggle(currentKey);
    });
})();