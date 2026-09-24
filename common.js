/**
 * Octopus Tools - 共通管理スクリプト
 * ・バージョンおよび更新内容の一元管理（メイン＋各ツール計7系統）
 * ・グローバルナビゲーション自動生成
 * ・ダークモード（テーマ）切り替え＆永続化
 * ・PCワイド表示切り替え＆永続化
 * ・アコーディオン開閉制御
 */
 
const OCTOPUS_APP_INFO = {
    // 1. メイン（共通）バージョン情報（v1.47へ更新）
    version: "1.47",
    date: "2026-09-24",
    updateNote: "バージョンの更新／前ver：「EXIF View & Edit」のExifバイナリ保存エンジンを刷新（最新タグ・独自データの完全保持、型エラーによる保存クラッシュ根絶、一括DL進捗判定強化）",

    // 2. 各ツールの個別サブバージョン・更新内容
    tools: {
        index: {
            name: "TOP",
            subVersion: "16",
            updateNote: "Newの追加・並び替え／前ver：「Octopus EXIF Analyzer」のツールカード（概要・アイコン・リンク）をTOPページに正式追加"
        },
        exif: {
            name: "EXIF Frame",
            subVersion: "132",
            updateNote: "ドロップエリアへのクリップボード画像貼り付けボタン設置（EXIF注意喚起付記）およびCtrl+V貼り付け対応"
        },
        mosaic: {
            name: "Mosaic & Blur",
            subVersion: "116",
            updateNote: "「画像をクリップボードにコピー」ボタンを追加（ファイル保存を介さない直接コピーに対応）"
        },
        cleaner: {
            name: "EXIF Cleaner",
            subVersion: "5",
            updateNote: "固有スクリプトを「js/exif-cleaner.js」へ完全外出し・即時関数カプセル化"
        },
        viewedit: {
            name: "EXIF View & Edit",
            subVersion: "24",
            updateNote: "Exif保存時の動的型補完による最新タグ・メーカー独自データの完全保持（欠落ゼロ化）、undefinedキークラッシュ根絶、日本語文字列の安全パック、一括DLエラー判定の正確化"
        },
        photoprocess: {
            name: "Photo Process",
            subVersion: "9",
            updateNote: "スライダー操作時のrAF描画間引きと、重処理実行時の操作保護オーバーレイ（GPUスピナー付き）を実装"
        },
        analyzer: {
            name: "EXIF Analyzer",
            subVersion: "14",
            updateNote: "ファイルドロップエリアへ大量投入時の所要時間注記を追加し、フォルダ走査時の即時進捗表示フィードバックを強化"
        }
    }
};

// 共通ナビゲーション項目定義（EXIF Analyzerを含む全7系統）
const OCTOPUS_NAV_ITEMS = [
    { id: "index", name: "TOP", url: "index.html", icon: "🐙" },
    { id: "exif", name: "EXIF Frame", url: "ExifFrame.html", icon: "📷" },
    { id: "viewedit", name: "EXIF View & Edit", url: "ExifViewEdit.html", icon: "📝" },
    { id: "analyzer", name: "EXIF Analyzer", url: "ExifAnalyzer.html", icon: "📊" },
    { id: "mosaic", name: "Mosaic & Blur", url: "MosaicBlur.html", icon: "🧩" },
    { id: "photoprocess", name: "Photo Process", url: "PhotoProcess.html", icon: "🎨" },
    { id: "cleaner", name: "EXIF Cleaner", url: "ExifCleaner.html", icon: "🧹" }

];

(function() {
    // --------------------------------------------------
    // A. ページ判定（ファイル名またはURLから自動判別）
    // --------------------------------------------------
    function getCurrentPageKey() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes("exifanalyzer")) return "analyzer";
        if (path.includes("photoprocess")) return "photoprocess";
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
            window.dispatchEvent(new CustomEvent('octopus:themechange', { detail: { isDark } }));
        });
    }

    // --------------------------------------------------
    // C. PCワイド表示制御
    // --------------------------------------------------
    function initWideModeToggle(pageKey) {
        const mainContainer = document.getElementById('main-container');
        const wideToggleBtn = document.getElementById('wide-toggle-btn');
        if (!mainContainer || !wideToggleBtn) return;

        let isWideMode = localStorage.getItem('octopus_wide_mode') === 'true';

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