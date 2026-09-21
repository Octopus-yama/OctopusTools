/**
 * Octopus Tools - 共通管理スクリプト
 * ・バージョンおよび更新内容の一元管理（メイン＋各ツール計4系統）
 * ・グローバルナビゲーション自動生成
 */

const OCTOPUS_APP_INFO = {
    // 1. メイン（共通）バージョン情報
    version: "1.11",
    date: "2026-09-21",
    updateNote: "「Octopus EXIF Frame」にPC向けワイド表示機能を追加",

    // 2. 各ツールの個別サブバージョン・更新内容（計4ツール）
    tools: {
        index: {
            name: "TOP",
            subVersion: "6",
            updateNote: "「Octopus EXIF Cleaner」へのリンク・ツールカードを追加"
        },
        exif: {
            name: "EXIF Frame",
            subVersion: "126",
            updateNote: "PC環境向けに画面幅を最大2000pxに拡張できる「ワイド表示」ボタンを追加"
        },
        mosaic: {
            name: "Mosaic & Blur",
            subVersion: "110",
            updateNote: "黒塗りの不透明度調整および強度プリセット（80/90/100%）対応"
        },
        cleaner: {
            name: "EXIF Cleaner",
            subVersion: "1",
            updateNote: "新規リリース：Exifメタデータ（GPS・日時・シリアル等）の選択削除・一括処理対応"
        }
    }
};

// 共通ナビゲーション項目定義
const OCTOPUS_NAV_ITEMS = [
    { id: "index", name: "TOP", url: "index.html", icon: "🐙" },
    { id: "exif", name: "EXIF Frame", url: "ExifFrame.html", icon: "📷" },
    { id: "mosaic", name: "Mosaic & Blur", url: "MosaicBlur.html", icon: "🧩" },
    { id: "cleaner", name: "EXIF Cleaner", url: "ExifCleaner.html", icon: "🧹" }
];

(function() {
    // 現在のページキーを判定（ファイル名またはURLから自動判別）
    function getCurrentPageKey() {
        const path = window.location.pathname.toLowerCase();
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