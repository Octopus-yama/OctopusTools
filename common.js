/**
 * Octopus Tools - 共通管理スクリプト
 * ・バージョンおよび更新内容の一元管理（メイン＋各ツール計5系統）
 * ・グローバルナビゲーション自動生成
 */

const OCTOPUS_APP_INFO = {
    // 1. メイン（共通）バージョン情報
    version: "1.17",
    date: "2026-09-22",
    updateNote: "共通スタイルシート（common.css）の導入に伴う共通骨格デザインのハイブリッド化対応/Frameの改善",

    // 2. 各ツールの個別サブバージョン・更新内容
    tools: {
        index: {
            name: "TOP",
            subVersion: "10",
            updateNote: "共通スタイルシート（common.css）導入に伴う骨格CSSの共通化"
        },
        exif: {
            name: "EXIF Frame",
            subVersion: "129",
            updateNote: "修正ミスの改善"
        },
        mosaic: {
            name: "Mosaic & Blur",
            subVersion: "112",
            updateNote: "共通スタイルシート（common.css）導入に伴う骨格CSSの共通化"
        },
        cleaner: {
            name: "EXIF Cleaner",
            subVersion: "3",
            updateNote: "共通スタイルシート（common.css）導入に伴う骨格CSSの共通化"
        },
        viewedit: {
            name: "EXIF View & Edit",
            subVersion: "9",
            updateNote: "共通スタイルシート（common.css）導入に伴う骨格CSSの共通化"
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
    // 現在のページキーを判定（ファイル名またはURLから自動判別）
    function getCurrentPageKey() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes("exifviewedit")) return "viewedit";
        if (path.includes("exifcleaner")) return "cleaner";
        if (path.includes("exifframe")) return "exif";
        if (path.includes("mosaicblur")) return "mosaic";
        return "index";
    }

    document.addEventListener("DOMContentLoaded", () => {
        const currentKey = getCurrentPageKey();
        const toolInfo = OCTOPUS_APP_INFO.tools[currentKey];

        // 1. バージョン表示および詳細ツールチップの反映
        const versionEl = document.getElementById("version-display");
        if (versionEl) {
            versionEl.textContent = `v${OCTOPUS_APP_INFO.version}`;
            
            // マウスオーバー時にメイン更新内容と該当ツールの更新内容をツールチップ表示
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
    });
})();