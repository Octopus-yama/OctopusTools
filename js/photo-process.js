/**
 * Octopus Photo Process - ツール固有スクリプト
 * ・ブラウザ完結型写真加工・色調補正・フィルター適用
 * ・長辺2000px縮小プレビュー ＆ 保存時オリジナル解像度フルサイズレンダリング
 * ・iOS実機判定（body.is-ios付与）によるiOS専用余白制御（PC/Android影響ゼロ）
 * ・100dvh対応 ＆ visualViewport監視によるスマホツールバー伸縮時の完全同期
 * ・拡大率ポップオーバーのスマホ時body直下テレポート（iOS前面突き抜け保証）
 * ・キャンバス表示サイズ完全同期（syncCanvasSizeToStage）による原画比較ズレ防止
 * ・クリップボードからの画像直接読み込み（ボタン押下 ＆ Ctrl+Vペースト）
 * ・境界線スプリッタードラッグによる領域比率変更（PC左右 / スマホ上下）
 * ・全画面プレビューモード（⛶ 全画面表示 ＆ 復帰機能）
 * ・リサイズ入力からクロップ枠への双方向連動 ＆ 「自由」自動切り替え
 * ・クリップボードへの画像直接書き出し（PNG Blobコピー）
 * ・下部固定操作バー ＆ 画像スクロール/ピンチズーム・パン移動
 * ・拡大率プリセットポップオーバー（100%, 125%, 150%, 185%, 200% 等）
 * ・スプリット比較 5モード順次切替（左右・上下・反転）
 * ・HSL特定色調整の12色相拡張 ＆ 彩度/明度 全色縦並び展開
 * ・銀塩グレインノイズの2系統化（強さ・量 ＆ 粗さ・粒子サイズ）
 * ・オールドレンズ風フィルター（軟調フレア・アンバートーン・周辺減光連動）
 * ・JSON設定書き出しモーダル（日付のみのコンパクトファイル名対応）
 * ・ヒストリーポインタ管理（#0 デフォルト画像常時配置 ＆ 一括ジャンプ）
 * ・切り抜き（アスペクト比選択・ドラッグ操作枠・三分割グリッド）＆ リサイズ確定UI
 * ・piexifjs による元Exifの完全引き継ぎ（Orientation正位置・解像度補正）
 */

(function() {
    'use strict';

    // 1. 環境判定
    const isIOS = () => {
        const ua = navigator.userAgent.toLowerCase();
        return /iphone|ipod/.test(ua) || /ipad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    };

    // iOS実機判定時にbodyへクラスを自動付与（PCおよびAndroidには影響なし）
    if (isIOS()) {
        document.body.classList.add('is-ios');
    }

    // 12色相マスタ定義（30度刻み）
    const HSL_COLOR_DEFS = [
        { id: 'red', name: '赤色', center: 0, hex: '#e05252' },
        { id: 'orange', name: '橙色', center: 30, hex: '#e67e22' },
        { id: 'yellow', name: '黄色', center: 60, hex: '#d4ac0d' },
        { id: 'lime', name: '黄緑色', center: 90, hex: '#82c91e' },
        { id: 'green', name: '緑色', center: 120, hex: '#2ecc71' },
        { id: 'mint', name: '青緑色', center: 150, hex: '#1abc9c' },
        { id: 'cyan', name: 'シアン', center: 180, hex: '#17a2b8' },
        { id: 'sky', name: '空色', center: 210, hex: '#3498db' },
        { id: 'blue', name: '青色', center: 240, hex: '#2980b9' },
        { id: 'purple', name: '紫色', center: 270, hex: '#8e44ad' },
        { id: 'magenta', name: 'マゼンタ', center: 300, hex: '#e056fd' },
        { id: 'rose', name: '赤紫色', center: 330, hex: '#eb3b5a' }
    ];

    function createEmptyHslMap() {
        const map = {};
        HSL_COLOR_DEFS.forEach(c => { map[c.id] = 0; });
        return map;
    }

    // 2. 初期設定・状態管理（State）
    const DEFAULT_PARAMS = {
        rotation: 0,
        flipH: false,
        flipV: false,
        angle: 0,
        crop: null,
        resize: null,
        aspect: 'free',
        exposure: 0,
        brightness: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        gamma: 1.0,
        temperature: 0,
        tint: 0,
        saturation: 0,
        vibrance: 0,
        cyanRed: 0,
        magentaGreen: 0,
        yellowBlue: 0,
        colorSat: createEmptyHslMap(),
        colorLum: createEmptyHslMap(),
        overlayColor: '#d2a679',
        overlayBlend: 'soft-light',
        overlayOpacity: 0,
        preset: 'none',
        filterStrength: 100,
        grainStrength: 0,
        grainRoughness: 30,
        grain: 0,
        vignette: 0
    };

    let currentParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
    let sourceFile = null;
    let sourceDataUrl = null;
    let rawExifBytes = null;
    let originalImage = null;
    let previewBaseCanvas = null;

    // ヒストリー管理
    let historyList = [];
    let historyIndex = -1;
    const MAX_HISTORY = 20;

    // ズーム＆パン管理
    let currentZoom = 100;
    let panOffset = { x: 0, y: 0 };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let pinchStartDistance = 0;
    let pinchStartZoom = 100;
    let isFullscreenMode = false;

    // スプリット比較 5モード管理
    const SPLIT_MODES = [
        { id: 'none', label: '◫ 比較: OFF', orientation: 'vertical', desc: 'スプリット比較なし' },
        { id: 'h-before-after', label: '◫ 左[前] ⇆ 右[後]', orientation: 'vertical', desc: '左: 変更前 ⇆ 右: 変更後' },
        { id: 'h-after-before', label: '◫ 左[後] ⇆ 右[前]', orientation: 'vertical', desc: '左: 変更後 ⇆ 右: 変更前' },
        { id: 'v-before-after', label: '◫ 上[前] ⇅ 下[後]', orientation: 'horizontal', desc: '上: 変更前 ⇅ 下: 変更後' },
        { id: 'v-after-before', label: '◫ 上[後] ⇅ 下[前]', orientation: 'horizontal', desc: '上: 変更後 ⇅ 下: 変更前' }
    ];
    let currentSplitIndex = 0;
    let splitPosition = 50;
    let isDraggingSplit = false;

    // クロップ枠操作状態
    let isCropOverlayActive = false;
    let activeAspect = 'free';
    let cropRect = { x: 0, y: 0, w: 0, h: 0 };
    let isDraggingCrop = false;
    let activeHandle = null;
    let dragStartPointer = { x: 0, y: 0 };
    let dragStartRect = { x: 0, y: 0, w: 0, h: 0 };

    // DOM要素キャッシュ
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const btnPasteClipboard = document.getElementById('btn-paste-clipboard');
    const appWorkspace = document.getElementById('app-workspace');
    const stageArea = document.getElementById('stage-area');
    const panelArea = document.getElementById('panel-area');
    const workspaceResizer = document.getElementById('workspace-resizer');

    const stageCanvasArea = document.getElementById('stage-canvas-area');
    const canvasViewport = document.getElementById('canvas-viewport');
    const beforeCanvas = document.getElementById('before-canvas');
    const afterCanvas = document.getElementById('after-canvas');
    const splitBar = document.getElementById('split-bar');
    const splitHandle = document.getElementById('split-handle');
    const stageBottomBar = document.getElementById('stage-bottom-bar');

    const btnZoomToggle = document.getElementById('btn-zoom-toggle');
    const zoomPercentDisplay = document.getElementById('zoom-percent-display');
    const zoomPopover = document.getElementById('zoom-popover');
    const btnExitFullscreen = document.getElementById('btn-exit-fullscreen');

    const cropOverlay = document.getElementById('crop-overlay');
    const cropBox = document.getElementById('crop-box');
    const btnShowCrop = document.getElementById('btn-show-crop');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const btnApplyTransform = document.getElementById('btn-apply-transform');
    const aspectBtns = document.querySelectorAll('[data-aspect]');

    const resizeW = document.getElementById('resize-w');
    const resizeH = document.getElementById('resize-h');
    const resizeKeepRatio = document.getElementById('resize-keep-ratio');
    const resizeModeContainer = document.getElementById('resize-mode-container');

    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnHoldCompare = document.getElementById('btn-hold-compare');
    const btnToggleSplit = document.getElementById('btn-toggle-split');
    const btnClearPhoto = document.getElementById('btn-clear-photo');

    const btnResetAll = document.getElementById('btn-reset-all');
    const btnRestoreLast = document.getElementById('btn-restore-last');
    const btnSaveImage = document.getElementById('btn-save-image');
    const btnCopyClipboard = document.getElementById('btn-copy-clipboard');

    const exportFormat = document.getElementById('export-format');
    const exportQuality = document.getElementById('export-quality');
    const exportNamemode = document.getElementById('export-namemode');
    const exportCustomName = document.getElementById('export-custom-name');
    const exportExifChk = document.getElementById('export-exif-chk');
    const qualityControlContainer = document.getElementById('quality-control-container');

    const mainAppHeader = document.getElementById('main-app-header');
    const mainAppNav = document.getElementById('main-app-nav');
    const btnToggleHeader = document.getElementById('btn-toggle-header');
    const btnShowHeader = document.getElementById('btn-show-header');

    const historyListContainer = document.getElementById('history-list-container');
    const historyTotalCount = document.getElementById('history-total-count');

    const hslSatContainer = document.getElementById('hsl-sat-container');
    const hslLumContainer = document.getElementById('hsl-lum-container');
    const btnResetHslSat = document.getElementById('btn-reset-hsl-sat');
    const btnResetHslLum = document.getElementById('btn-reset-hsl-lum');

    const paramOverlayColor = document.getElementById('param-overlay-color');
    const paramOverlayBlend = document.getElementById('param-overlay-blend');

    const jsonExportModal = document.getElementById('json-export-modal');
    const modalJsonFilename = document.getElementById('modal-json-filename');
    const btnModalClose = document.getElementById('btn-modal-close');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirmExport = document.getElementById('btn-modal-confirm-export');

    // ==========================================
    // 3. キャンバス表示サイズの完全同期
    // ==========================================
    function syncCanvasSizeToStage() {
        if (!originalImage || !beforeCanvas || !afterCanvas || !canvasViewport || !stageCanvasArea) return;
        
        const cw = beforeCanvas.width;
        const ch = beforeCanvas.height;
        if (!cw || !ch) return;

        const stageW = stageCanvasArea.clientWidth - 24;
        const stageH = stageCanvasArea.clientHeight - 24;
        if (stageW <= 0 || stageH <= 0) return;

        const fitScale = Math.min(stageW / cw, stageH / ch);
        const dispW = Math.round(cw * fitScale);
        const dispH = Math.round(ch * fitScale);

        canvasViewport.style.width = `${dispW}px`;
        canvasViewport.style.height = `${dispH}px`;

        beforeCanvas.style.width = `${dispW}px`;
        beforeCanvas.style.height = `${dispH}px`;

        afterCanvas.style.width = `${dispW}px`;
        afterCanvas.style.height = `${dispH}px`;

        syncCropOverlayPosition();
    }

    if (typeof ResizeObserver !== 'undefined' && stageCanvasArea) {
        const stageResizeObserver = new ResizeObserver(() => {
            syncCanvasSizeToStage();
        });
        stageResizeObserver.observe(stageCanvasArea);
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            syncCanvasSizeToStage();
        });
    }

    // ==========================================
    // 4. ヘッダー非表示・全画面表示制御
    // ==========================================
    function setHeaderVisibility(visible) {
        if (!mainAppHeader || !mainAppNav || !btnShowHeader) return;
        if (visible) {
            mainAppHeader.classList.remove('is-hidden');
            mainAppNav.classList.remove('is-hidden');
            btnShowHeader.style.display = 'none';
        } else {
            mainAppHeader.classList.add('is-hidden');
            mainAppNav.classList.add('is-hidden');
            btnShowHeader.style.display = isFullscreenMode ? 'none' : 'block';
        }
        setTimeout(syncCanvasSizeToStage, 50);
    }

    if (btnToggleHeader) btnToggleHeader.addEventListener('click', () => setHeaderVisibility(false));
    if (btnShowHeader) btnShowHeader.addEventListener('click', () => setHeaderVisibility(true));

    function setFullscreenMode(enable) {
        isFullscreenMode = enable;
        document.body.classList.toggle('is-fullscreen-mode', enable);

        if (enable) {
            if (zoomPercentDisplay) zoomPercentDisplay.textContent = '⛶ 全画面';
        } else {
            if (zoomPercentDisplay) zoomPercentDisplay.textContent = `${currentZoom}%`;
        }

        setTimeout(() => {
            syncCanvasSizeToStage();
        }, 50);
    }

    if (btnExitFullscreen) {
        btnExitFullscreen.addEventListener('click', () => setFullscreenMode(false));
    }

    // ==========================================
    // 5. 領域比率変更スプリッター（可変リサイザー）
    // ==========================================
    if (workspaceResizer && appWorkspace && panelArea && stageArea) {
        let isResizingWorkspace = false;
        let startPos = 0;
        let startDimension = 0;

        workspaceResizer.addEventListener('pointerdown', (e) => {
            isResizingWorkspace = true;
            workspaceResizer.classList.add('is-dragging');
            workspaceResizer.setPointerCapture(e.pointerId);

            const isMobile = window.innerWidth <= 860;
            if (isMobile) {
                startPos = e.clientY;
                startDimension = stageArea.clientHeight;
            } else {
                startPos = e.clientX;
                startDimension = panelArea.clientWidth;
            }
            e.preventDefault();
        });

        window.addEventListener('pointermove', (e) => {
            if (!isResizingWorkspace) return;
            const isMobile = window.innerWidth <= 860;

            if (isMobile) {
                const deltaY = e.clientY - startPos;
                const newHeight = startDimension + deltaY;
                const totalH = appWorkspace.clientHeight;
                const minH = Math.round(totalH * 0.20);
                const maxH = Math.round(totalH * 0.75);

                if (newHeight >= minH && newHeight <= maxH) {
                    stageArea.style.height = `${newHeight}px`;
                    syncCanvasSizeToStage();
                }
            } else {
                const deltaX = startPos - e.clientX;
                const newWidth = startDimension + deltaX;
                const totalW = appWorkspace.clientWidth;
                const minPanelW = 260;
                const maxPanelW = Math.min(650, totalW - 300);

                if (newWidth >= minPanelW && newWidth <= maxPanelW) {
                    panelArea.style.width = `${newWidth}px`;
                    syncCanvasSizeToStage();
                }
            }
        });

        const stopWorkspaceResize = (e) => {
            if (isResizingWorkspace) {
                isResizingWorkspace = false;
                workspaceResizer.classList.remove('is-dragging');
                try { workspaceResizer.releasePointerCapture(e.pointerId); } catch (err) {}
                syncCanvasSizeToStage();
            }
        };
        window.addEventListener('pointerup', stopWorkspaceResize);
        window.addEventListener('pointercancel', stopWorkspaceResize);
    }

    // ==========================================
    // 6. 画像読み込み・クリア・クリップボード貼り付け制御
    // ==========================================
    if (dropArea && fileInput) {
        dropArea.addEventListener('click', (e) => {
            if (e.target.closest('#btn-paste-clipboard')) return;
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                loadSelectedFile(e.target.files[0]);
            }
        });

        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.classList.add('drag-over');
        });
        dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                loadSelectedFile(e.dataTransfer.files[0]);
            }
        });
    }

    async function pasteImageFromClipboard() {
        try {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                alert('お使いのブラウザはクリップボードからの直接読み取りに対応していません。\n「Ctrl+V」での貼り付けをお試しください。');
                return;
            }

            const items = await navigator.clipboard.read();
            let foundImage = false;

            for (const item of items) {
                const imgType = item.types.find(t => t.startsWith('image/'));
                if (imgType) {
                    const blob = await item.getType(imgType);
                    const ext = imgType.split('/')[1] || 'png';
                    const file = new File([blob], `clipboard_${Date.now()}.${ext}`, { type: imgType });
                    loadSelectedFile(file);
                    foundImage = true;
                    break;
                }
            }

            if (!foundImage) {
                alert('クリップボードに画像が見つかりませんでした。\n画像をコピーしてから再度お試しください。');
            }
        } catch (err) {
            console.warn('クリップボード読み取り失敗:', err);
            alert('クリップボードの読み取りに失敗しました。\nブラウザのアクセス許可をご確認ください。');
        }
    }

    if (btnPasteClipboard) {
        btnPasteClipboard.addEventListener('click', (e) => {
            e.stopPropagation();
            pasteImageFromClipboard();
        });
    }

    window.addEventListener('paste', (e) => {
        if (originalImage) return;
        const items = (e.clipboardData || window.clipboardData)?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                    loadSelectedFile(file);
                    e.preventDefault();
                    break;
                }
            }
        }
    });

    async function loadSelectedFile(file) {
        if (!file.type.startsWith('image/')) return;
        sourceFile = file;

        sourceDataUrl = await readFileAsDataURL(file);
        if (typeof piexif !== 'undefined' && (file.type === 'image/jpeg' || /\.(jpe?g)$/i.test(file.name))) {
            try {
                rawExifBytes = piexif.load(sourceDataUrl);
            } catch (e) {
                rawExifBytes = null;
            }
        }

        const img = new Image();
        img.onload = () => {
            originalImage = img;
            createPreviewBaseCanvas();
            dropArea.style.display = 'none';
            canvasViewport.style.display = 'block';
            stageBottomBar.style.display = 'flex';
            btnSaveImage.disabled = false;

            historyList = [];
            historyIndex = -1;
            currentParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
            syncParamsToUI();
            updateHistoryUI();
            resetZoomAndPan();
            renderPreview();
            hideCropOverlay();
            updateResizeInputsFromImage();
            syncCanvasSizeToStage();
        };
        img.src = URL.createObjectURL(file);
    }

    function clearLoadedPhoto() {
        if (!originalImage) return;
        if (!confirm('現在の写真を閉じて、別の写真を選択しますか？\n（未保存の加工内容は破棄されます）')) return;

        sourceFile = null;
        sourceDataUrl = null;
        rawExifBytes = null;
        originalImage = null;
        previewBaseCanvas = null;

        historyList = [];
        historyIndex = -1;
        currentParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
        syncParamsToUI();

        hideCropOverlay();
        setFullscreenMode(false);
        resetZoomAndPan();
        canvasViewport.style.display = 'none';
        stageBottomBar.style.display = 'none';
        dropArea.style.display = 'flex';
        btnSaveImage.disabled = true;
        if (fileInput) fileInput.value = '';

        updateHistoryUI();
    }

    if (btnClearPhoto) btnClearPhoto.addEventListener('click', clearLoadedPhoto);

    function createPreviewBaseCanvas() {
        if (!originalImage) return;
        const maxPreviewSize = 2000;
        let w = originalImage.naturalWidth;
        let h = originalImage.naturalHeight;

        if (w > maxPreviewSize || h > maxPreviewSize) {
            if (w > h) {
                h = Math.round((h * maxPreviewSize) / w);
                w = maxPreviewSize;
            } else {
                w = Math.round((w * maxPreviewSize) / h);
                h = maxPreviewSize;
            }
        }

        previewBaseCanvas = document.createElement('canvas');
        previewBaseCanvas.width = w;
        previewBaseCanvas.height = h;
        const ctx = previewBaseCanvas.getContext('2d');
        ctx.drawImage(originalImage, 0, 0, w, h);
    }

    // ==========================================
    // 7. ズーム・パン移動＆拡大率ポップオーバー制御
    // ==========================================
    function setZoom(val, keepPan = true) {
        let zoom = Math.max(50, Math.min(400, Math.round(val)));
        currentZoom = zoom;
        if (!keepPan || zoom <= 100) {
            panOffset = { x: 0, y: 0 };
        }
        applyViewportTransform();
        if (zoomPercentDisplay && !isFullscreenMode) {
            zoomPercentDisplay.textContent = `${zoom}%`;
        }

        document.querySelectorAll('.zoom-opt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.zoom === String(zoom));
        });
    }

    function resetZoomAndPan() {
        currentZoom = 100;
        panOffset = { x: 0, y: 0 };
        applyViewportTransform();
        if (zoomPercentDisplay && !isFullscreenMode) {
            zoomPercentDisplay.textContent = '100%';
        }
        document.querySelectorAll('.zoom-opt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.zoom === '100');
        });
    }

    function applyViewportTransform() {
        if (!canvasViewport) return;
        canvasViewport.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${currentZoom / 100})`;
        if (stageCanvasArea) {
            stageCanvasArea.classList.toggle('is-panning', currentZoom > 100);
        }
    }

    // スマホ時はポップオーバーをbody直下にテレポートしてiOSの潜り込みを100%防止
    function syncZoomPopoverParent() {
        if (!zoomPopover) return;
        const isMobile = window.innerWidth <= 860;
        const container = document.querySelector('.zoom-dropdown-container');
        if (isMobile) {
            if (zoomPopover.parentElement !== document.body) {
                document.body.appendChild(zoomPopover);
            }
        } else {
            if (container && zoomPopover.parentElement !== container) {
                container.appendChild(zoomPopover);
            }
        }
    }

    if (btnZoomToggle && zoomPopover) {
        btnZoomToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            syncZoomPopoverParent();
            zoomPopover.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!zoomPopover.contains(e.target) && e.target !== btnZoomToggle) {
                zoomPopover.classList.remove('open');
            }
        });

        window.addEventListener('resize', () => {
            syncZoomPopoverParent();
        });

        document.querySelectorAll('.zoom-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const zVal = btn.dataset.zoom;
                if (zVal === 'fullscreen') {
                    setFullscreenMode(true);
                } else if (zVal === 'fit') {
                    if (isFullscreenMode) setFullscreenMode(false);
                    resetZoomAndPan();
                } else {
                    if (isFullscreenMode) setFullscreenMode(false);
                    setZoom(parseInt(zVal, 10), false);
                }
                zoomPopover.classList.remove('open');
            });
        });
    }

    if (stageCanvasArea) {
        stageCanvasArea.addEventListener('wheel', (e) => {
            if (!originalImage) return;
            e.preventDefault();
            const step = e.deltaY < 0 ? 12 : -12;
            setZoom(currentZoom + step, true);
        }, { passive: false });

        stageCanvasArea.addEventListener('pointerdown', (e) => {
            if (!originalImage || isCropOverlayActive || isDraggingSplit) return;
            if (e.target.closest('.split-handle') || e.target.closest('.split-bar')) return;

            isPanning = true;
            panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
            stageCanvasArea.setPointerCapture(e.pointerId);
        });

        stageCanvasArea.addEventListener('pointermove', (e) => {
            if (!isPanning) return;
            panOffset.x = Math.round(e.clientX - panStart.x);
            panOffset.y = Math.round(e.clientY - panStart.y);
            applyViewportTransform();
        });

        const stopPan = (e) => {
            if (isPanning) {
                isPanning = false;
                try { stageCanvasArea.releasePointerCapture(e.pointerId); } catch (err) {}
            }
        };
        stageCanvasArea.addEventListener('pointerup', stopPan);
        stageCanvasArea.addEventListener('pointercancel', stopPan);

        stageCanvasArea.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                pinchStartDistance = Math.hypot(dx, dy);
                pinchStartZoom = currentZoom;
            }
        }, { passive: true });

        stageCanvasArea.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && pinchStartDistance > 0) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const currentDist = Math.hypot(dx, dy);
                const scale = currentDist / pinchStartDistance;
                setZoom(pinchStartZoom * scale, true);
            }
        }, { passive: true });

        stageCanvasArea.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                pinchStartDistance = 0;
            }
        }, { passive: true });
    }

    // ==========================================
    // 8. 高速 HSL ⇄ RGB 変換
    // ==========================================
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60;
        }
        return [h, s, l];
    }

    function hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            const hNorm = h / 360;
            r = hue2rgb(p, q, hNorm + 1/3);
            g = hue2rgb(p, q, hNorm);
            b = hue2rgb(p, q, hNorm - 1/3);
        }
        return [r * 255, g * 255, b * 255];
    }

    // ==========================================
    // 9. 画像処理パイプライン（Core Renderer）
    // ==========================================
    function renderPipeline(sourceCv, targetCv, params) {
        if (!sourceCv || !targetCv) return;

        const isFlippedAngle = params.rotation % 180 !== 0;
        let srcW = isFlippedAngle ? sourceCv.height : sourceCv.width;
        let srcH = isFlippedAngle ? sourceCv.width : sourceCv.height;

        const rotatedCv = document.createElement('canvas');
        rotatedCv.width = srcW;
        rotatedCv.height = srcH;
        const rCtx = rotatedCv.getContext('2d');
        rCtx.save();
        rCtx.translate(srcW / 2, srcH / 2);
        rCtx.rotate((params.rotation * Math.PI) / 180);
        if (params.angle !== 0) {
            rCtx.rotate((params.angle * Math.PI) / 180);
        }
        rCtx.scale(params.flipH ? -1 : 1, params.flipV ? -1 : 1);
        rCtx.drawImage(sourceCv, -sourceCv.width / 2, -sourceCv.height / 2);
        rCtx.restore();

        let croppedCv = rotatedCv;
        if (params.crop) {
            const cx = Math.max(0, Math.round(rotatedCv.width * params.crop.x));
            const cy = Math.max(0, Math.round(rotatedCv.height * params.crop.y));
            const cw = Math.min(rotatedCv.width - cx, Math.round(rotatedCv.width * params.crop.w));
            const ch = Math.min(rotatedCv.height - cy, Math.round(rotatedCv.height * params.crop.h));

            if (cw > 0 && ch > 0) {
                croppedCv = document.createElement('canvas');
                croppedCv.width = cw;
                croppedCv.height = ch;
                const cCtx = croppedCv.getContext('2d');
                cCtx.drawImage(rotatedCv, cx, cy, cw, ch, 0, 0, cw, ch);
            }
        }

        let resizedCv = croppedCv;
        if (params.resize && params.resize.w > 0 && params.resize.h > 0) {
            const rw = params.resize.w;
            const rh = params.resize.h;
            if (rw !== croppedCv.width || rh !== croppedCv.height) {
                resizedCv = document.createElement('canvas');
                resizedCv.width = rw;
                resizedCv.height = rh;
                const resCtx = resizedCv.getContext('2d');

                if (params.resize.mode === 'fill') {
                    const scale = Math.max(rw / croppedCv.width, rh / croppedCv.height);
                    const sw = rw / scale;
                    const sh = rh / scale;
                    const sx = (croppedCv.width - sw) / 2;
                    const sy = (croppedCv.height - sh) / 2;
                    resCtx.drawImage(croppedCv, sx, sy, sw, sh, 0, 0, rw, rh);
                } else {
                    resCtx.drawImage(croppedCv, 0, 0, rw, rh);
                }
            }
        }

        targetCv.width = resizedCv.width;
        targetCv.height = resizedCv.height;
        const ctx = targetCv.getContext('2d');
        ctx.drawImage(resizedCv, 0, 0);

        const imgData = ctx.getImageData(0, 0, targetCv.width, targetCv.height);
        const data = imgData.data;
        const len = data.length;

        const expMult = Math.pow(2, params.exposure);
        const brightAdd = (params.brightness / 100) * 255;
        const contrastFactor = (259 * (params.contrast + 255)) / (255 * (259 - params.contrast));
        const gammaCorrection = 1 / params.gamma;

        const tempR = params.temperature > 0 ? params.temperature * 0.8 : 0;
        const tempB = params.temperature < 0 ? -params.temperature * 0.8 : 0;
        const tintG = params.tint < 0 ? -params.tint * 0.7 : 0;
        const tintM = params.tint > 0 ? params.tint * 0.7 : 0;

        const crR = params.cyanRed;
        const mgG = params.magentaGreen;
        const ybB = params.yellowBlue;

        const satMult = (params.saturation + 100) / 100;
        const vibFactor = params.vibrance / 100;

        const isMono = params.preset.startsWith('mono');
        const isSepia = params.preset === 'sepia';
        const isVintage = params.preset === 'vintage';
        const isCross = params.preset === 'cross';
        const isFilm = params.preset === 'film';
        const isOldLens = params.preset === 'oldlens';
        const hasPreset = params.preset !== 'none';
        const filterRatio = (params.filterStrength !== undefined ? params.filterStrength : 100) / 100;

        const hasSelectiveColor = Object.values(params.colorSat).some(v => v !== 0) || Object.values(params.colorLum).some(v => v !== 0);

        for (let i = 0; i < len; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            r = r * expMult + brightAdd;
            g = g * expMult + brightAdd;
            b = b * expMult + brightAdd;

            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            b = contrastFactor * (b - 128) + 128;

            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (params.highlights !== 0 && lum > 128) {
                const hFactor = ((lum - 128) / 127) * (params.highlights / 100) * 40;
                r += hFactor; g += hFactor; b += hFactor;
            }
            if (params.shadows !== 0 && lum < 128) {
                const sFactor = ((128 - lum) / 128) * (params.shadows / 100) * 40;
                r += sFactor; g += sFactor; b += sFactor;
            }

            if (gammaCorrection !== 1.0) {
                r = 255 * Math.pow(Math.max(0, r) / 255, gammaCorrection);
                g = 255 * Math.pow(Math.max(0, g) / 255, gammaCorrection);
                b = 255 * Math.pow(Math.max(0, b) / 255, gammaCorrection);
            }

            r += tempR + (tintM * 0.5) + crR;
            g += tintG - (tintM * 0.5) + mgG;
            b += tempB + ybB;

            const maxVal = Math.max(r, g, b);
            const minVal = Math.min(r, g, b);
            const currentSat = maxVal === 0 ? 0 : (maxVal - minVal) / maxVal;

            if (vibFactor !== 0) {
                const vAdd = (1 - currentSat) * vibFactor * 50;
                r += (r - lum) * (vAdd / 100);
                g += (g - lum) * (vAdd / 100);
                b += (b - lum) * (vAdd / 100);
            }

            if (satMult !== 1.0) {
                r = lum + (r - lum) * satMult;
                g = lum + (g - lum) * satMult;
                b = lum + (b - lum) * satMult;
            }

            if (hasSelectiveColor) {
                r = Math.min(255, Math.max(0, r));
                g = Math.min(255, Math.max(0, g));
                b = Math.min(255, Math.max(0, b));

                let [h, s, l] = rgbToHsl(r, g, b);
                if (s > 0.03) {
                    let deltaS = 0;
                    let deltaL = 0;
                    for (let c = 0; c < HSL_COLOR_DEFS.length; c++) {
                        const def = HSL_COLOR_DEFS[c];
                        const cSat = params.colorSat[def.id] || 0;
                        const cLum = params.colorLum[def.id] || 0;
                        if (cSat === 0 && cLum === 0) continue;

                        let diff = Math.abs(h - def.center);
                        if (diff > 180) diff = 360 - diff;
                        if (diff < 35) {
                            const weight = (1 - diff / 35) * Math.min(1, s / 0.1);
                            deltaS += (cSat / 100) * weight;
                            deltaL += (cLum / 100) * 0.4 * weight;
                        }
                    }
                    if (deltaS !== 0 || deltaL !== 0) {
                        s = Math.max(0, Math.min(1, s + deltaS * (deltaS > 0 ? (1 - s) : s)));
                        l = Math.max(0, Math.min(1, l + deltaL));
                        const [nr, ng, nb] = hslToRgb(h, s, l);
                        r = nr; g = ng; b = nb;
                    }
                }
            }

            if (hasPreset && filterRatio > 0) {
                let pr = r;
                let pg = g;
                let pb = b;

                if (isMono) {
                    let gray = lum;
                    if (params.preset === 'mono-high') gray = gray > 128 ? gray * 1.15 : gray * 0.85;
                    else if (params.preset === 'mono-soft') gray = gray * 0.95 + 15;
                    pr = pg = pb = gray;
                } else if (isSepia) {
                    pr = lum * 1.15; pg = lum * 0.95; pb = lum * 0.75;
                } else if (isVintage) {
                    pr = pr * 1.05 + 10; pb = pb * 0.9 - 5;
                } else if (isCross) {
                    pr = pr * 1.1; pg = pg * 0.95; pb = pb * 1.15;
                } else if (isFilm) {
                    pr = pr < 128 ? (pr * pr) / 128 : 255 - ((255 - pr) * (255 - pr)) / 128;
                    pg = pg < 128 ? (pg * pg) / 128 : 255 - ((255 - pg) * (255 - pg)) / 128;
                    pb = pb < 128 ? (pb * pb) / 128 : 255 - ((255 - pb) * (255 - pb)) / 128;
                } else if (isOldLens) {
                    pr = pr * 0.94 + 18;
                    pg = pg * 0.92 + 14;
                    pb = pb * 0.84 + 6;
                }

                r = r * (1 - filterRatio) + pr * filterRatio;
                g = g * (1 - filterRatio) + pg * filterRatio;
                b = b * (1 - filterRatio) + pb * filterRatio;
            }

            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }

        ctx.putImageData(imgData, 0, 0);

        if (params.overlayOpacity > 0) {
            ctx.save();
            ctx.globalCompositeOperation = params.overlayBlend;
            ctx.globalAlpha = params.overlayOpacity / 100;
            ctx.fillStyle = params.overlayColor;
            ctx.fillRect(0, 0, targetCv.width, targetCv.height);
            ctx.restore();
        }

        let effectiveVignette = params.vignette;
        if (params.preset === 'oldlens' && filterRatio > 0) {
            effectiveVignette = params.vignette === 0 
                ? Math.round(32 * filterRatio) 
                : Math.min(100, params.vignette + Math.round(20 * filterRatio));
        }

        if (effectiveVignette !== 0) {
            ctx.save();
            const radius = Math.hypot(targetCv.width, targetCv.height) / 2;
            const grad = ctx.createRadialGradient(
                targetCv.width / 2, targetCv.height / 2, radius * 0.35,
                targetCv.width / 2, targetCv.height / 2, radius
            );

            const isDarkVignette = effectiveVignette > 0;
            const intensity = (Math.abs(effectiveVignette) / 100) * 0.85;
            const rgbStr = isDarkVignette ? '0,0,0' : '255,255,255';

            grad.addColorStop(0, `rgba(${rgbStr}, 0)`);
            grad.addColorStop(1, `rgba(${rgbStr}, ${intensity})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, targetCv.width, targetCv.height);
            ctx.restore();
        }

        const grainStrength = params.grainStrength !== undefined ? params.grainStrength : (params.grain || 0);
        const grainRoughness = params.grainRoughness !== undefined ? params.grainRoughness : 30;

        if (grainStrength > 0) {
            ctx.save();
            const particleScale = 1.0 + (grainRoughness / 100) * 4.0;
            const patSize = 256;
            const smallW = Math.max(16, Math.round(patSize / particleScale));
            const smallH = Math.max(16, Math.round(patSize / particleScale));

            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = smallW;
            smallCanvas.height = smallH;
            const sCtx = smallCanvas.getContext('2d');
            const sImgData = sCtx.createImageData(smallW, smallH);
            const sData = sImgData.data;

            const alphaBase = (grainStrength / 100) * 0.4;

            for (let j = 0; j < sData.length; j += 4) {
                const noise = Math.random() - 0.5;
                const isBright = noise > 0;
                sData[j] = isBright ? 255 : 0;
                sData[j + 1] = isBright ? 255 : 0;
                sData[j + 2] = isBright ? 255 : 0;
                sData[j + 3] = Math.abs(noise) * 2 * alphaBase * 255;
            }
            sCtx.putImageData(sImgData, 0, 0);

            const grainCanvas = document.createElement('canvas');
            grainCanvas.width = patSize;
            grainCanvas.height = patSize;
            const gCtx = grainCanvas.getContext('2d');
            gCtx.imageSmoothingEnabled = true;
            gCtx.drawImage(smallCanvas, 0, 0, patSize, patSize);

            ctx.fillStyle = ctx.createPattern(grainCanvas, 'repeat');
            ctx.fillRect(0, 0, targetCv.width, targetCv.height);
            ctx.restore();
        }
    }

    function renderPreview() {
        if (!previewBaseCanvas) return;

        const noAdjustParams = Object.assign({}, DEFAULT_PARAMS, {
            rotation: currentParams.rotation,
            flipH: currentParams.flipH,
            flipV: currentParams.flipV,
            angle: currentParams.angle,
            crop: currentParams.crop,
            resize: currentParams.resize
        });
        renderPipeline(previewBaseCanvas, beforeCanvas, noAdjustParams);
        renderPipeline(previewBaseCanvas, afterCanvas, currentParams);

        syncCanvasSizeToStage();
        updateSplitClipping();
        syncCropOverlayPosition();
    }

    // ==========================================
    // 10. スプリット比較 5モード順次切替＆制御
    // ==========================================
    function updateSplitClipping() {
        const mode = SPLIT_MODES[currentSplitIndex];
        if (btnToggleSplit) {
            btnToggleSplit.textContent = mode.label;
            btnToggleSplit.title = mode.desc;
            btnToggleSplit.classList.toggle('active', mode.id !== 'none');
        }

        if (!splitBar || !afterCanvas) return;

        if (mode.id === 'none') {
            splitBar.style.display = 'none';
            afterCanvas.style.clipPath = 'none';
            afterCanvas.style.opacity = '1';
            return;
        }

        splitBar.style.display = 'block';

        if (mode.orientation === 'vertical') {
            splitBar.className = 'split-bar vertical';
            splitBar.style.top = '0';
            splitBar.style.bottom = '0';
            splitBar.style.height = '100%';
            splitBar.style.width = '2px';
            splitBar.style.left = `${splitPosition}%`;
            splitBar.style.right = 'auto';
            if (splitHandle) splitHandle.textContent = '◀▶';

            if (mode.id === 'h-before-after') {
                afterCanvas.style.clipPath = `inset(0 0 0 ${splitPosition}%)`;
            } else {
                afterCanvas.style.clipPath = `inset(0 ${100 - splitPosition}% 0 0)`;
            }
        } else {
            splitBar.className = 'split-bar horizontal';
            splitBar.style.left = '0';
            splitBar.style.right = '0';
            splitBar.style.width = '100%';
            splitBar.style.height = '2px';
            splitBar.style.top = `${splitPosition}%`;
            splitBar.style.bottom = 'auto';
            if (splitHandle) splitHandle.textContent = '▲▼';

            if (mode.id === 'v-before-after') {
                afterCanvas.style.clipPath = `inset(${splitPosition}% 0 0 0)`;
            } else {
                afterCanvas.style.clipPath = `inset(0 0 ${100 - splitPosition}% 0)`;
            }
        }
    }

    if (btnToggleSplit) {
        btnToggleSplit.addEventListener('click', () => {
            currentSplitIndex = (currentSplitIndex + 1) % SPLIT_MODES.length;
            updateSplitClipping();
        });
    }

    if (btnHoldCompare) {
        const showBefore = () => { afterCanvas.style.opacity = '0'; };
        const showAfter = () => { afterCanvas.style.opacity = '1'; };

        btnHoldCompare.addEventListener('mousedown', showBefore);
        window.addEventListener('mouseup', showAfter);
        btnHoldCompare.addEventListener('touchstart', (e) => { e.preventDefault(); showBefore(); }, { passive: false });
        window.addEventListener('touchend', showAfter);
    }

    if (splitBar) {
        splitBar.addEventListener('mousedown', (e) => {
            isDraggingSplit = true;
            e.preventDefault();
            e.stopPropagation();
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDraggingSplit || !canvasViewport) return;
            const rect = canvasViewport.getBoundingClientRect();
            const mode = SPLIT_MODES[currentSplitIndex];

            if (mode.orientation === 'vertical') {
                let x = e.clientX - rect.left;
                let percent = (x / rect.width) * 100;
                splitPosition = Math.min(99, Math.max(1, percent));
            } else {
                let y = e.clientY - rect.top;
                let percent = (y / rect.height) * 100;
                splitPosition = Math.min(99, Math.max(1, percent));
            }
            updateSplitClipping();
        });
        window.addEventListener('mouseup', () => { isDraggingSplit = false; });
    }

    // ==========================================
    // 11. 切り抜き枠（クロップオーバーレイ）＆リサイズ双方向連動
    // ==========================================
    function showCropOverlay(aspect = 'free') {
        if (!afterCanvas || !cropOverlay || !cropBox) return;
        activeAspect = aspect;
        isCropOverlayActive = true;
        cropOverlay.style.display = 'block';

        aspectBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.aspect === aspect);
        });

        syncCropOverlayPosition();

        const ow = cropOverlay.clientWidth;
        const oh = cropOverlay.clientHeight;
        let boxW = ow * 0.8;
        let boxH = oh * 0.8;

        if (aspect !== 'free') {
            const [aw, ah] = aspect.split(':').map(Number);
            const targetRatio = aw / ah;
            if (boxW / boxH > targetRatio) {
                boxW = boxH * targetRatio;
            } else {
                boxH = boxW / targetRatio;
            }
        }

        cropRect.w = Math.round(boxW);
        cropRect.h = Math.round(boxH);
        cropRect.x = Math.round((ow - cropRect.w) / 2);
        cropRect.y = Math.round((oh - cropRect.h) / 2);

        updateCropBoxDOM();
        updateResizeInputsFromCrop();
    }

    function hideCropOverlay() {
        isCropOverlayActive = false;
        if (cropOverlay) cropOverlay.style.display = 'none';
        aspectBtns.forEach(btn => btn.classList.remove('active'));
    }

    function syncCropOverlayPosition() {
        if (!cropOverlay || !afterCanvas) return;
        cropOverlay.style.left = `0px`;
        cropOverlay.style.top = `0px`;
        cropOverlay.style.width = `100%`;
        cropOverlay.style.height = `100%`;
    }

    function updateCropBoxDOM() {
        if (!cropBox) return;
        cropBox.style.left = `${cropRect.x}px`;
        cropBox.style.top = `${cropRect.y}px`;
        cropBox.style.width = `${cropRect.w}px`;
        cropBox.style.height = `${cropRect.h}px`;
    }

    function updateResizeInputsFromCrop() {
        if (!afterCanvas || cropOverlay.clientWidth === 0) return;
        const scaleX = afterCanvas.width / cropOverlay.clientWidth;
        const scaleY = afterCanvas.height / cropOverlay.clientHeight;
        const pixelW = Math.round(cropRect.w * scaleX);
        const pixelH = Math.round(cropRect.h * scaleY);
        if (resizeW) resizeW.value = pixelW;
        if (resizeH) resizeH.value = pixelH;
    }

    function updateResizeInputsFromImage() {
        if (!afterCanvas) return;
        if (resizeW) resizeW.value = afterCanvas.width;
        if (resizeH) resizeH.value = afterCanvas.height;
    }

    function syncCropFromResizeInputs() {
        if (!isCropOverlayActive || !afterCanvas || cropOverlay.clientWidth === 0) return;

        const scaleX = afterCanvas.width / cropOverlay.clientWidth;
        const scaleY = afterCanvas.height / cropOverlay.clientHeight;
        const reqW = parseFloat(resizeW.value) || 0;
        const reqH = parseFloat(resizeH.value) || 0;

        if (reqW <= 0 || reqH <= 0) return;

        let targetBoxW = Math.round(reqW / scaleX);
        let targetBoxH = Math.round(reqH / scaleY);

        const maxW = cropOverlay.clientWidth;
        const maxH = cropOverlay.clientHeight;

        targetBoxW = Math.max(30, Math.min(maxW, targetBoxW));
        targetBoxH = Math.max(30, Math.min(maxH, targetBoxH));

        const centerX = cropRect.x + cropRect.w / 2;
        const centerY = cropRect.y + cropRect.h / 2;

        cropRect.w = targetBoxW;
        cropRect.h = targetBoxH;
        cropRect.x = Math.max(0, Math.min(maxW - cropRect.w, Math.round(centerX - cropRect.w / 2)));
        cropRect.y = Math.max(0, Math.min(maxH - cropRect.h, Math.round(centerY - cropRect.h / 2)));

        updateCropBoxDOM();

        activeAspect = 'free';
        aspectBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.aspect === 'free');
        });
    }

    aspectBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            showCropOverlay(btn.dataset.aspect);
        });
    });

    if (btnShowCrop) {
        btnShowCrop.addEventListener('click', () => {
            showCropOverlay(activeAspect || 'free');
        });
    }

    if (btnCancelCrop) {
        btnCancelCrop.addEventListener('click', hideCropOverlay);
    }

    if (cropBox) {
        cropBox.addEventListener('pointerdown', (e) => {
            const handleEl = e.target.closest('.crop-handle');
            activeHandle = handleEl ? handleEl.dataset.handle : null;
            isDraggingCrop = true;
            dragStartPointer = { x: e.clientX, y: e.clientY };
            dragStartRect = Object.assign({}, cropRect);
            cropBox.setPointerCapture(e.pointerId);
            e.stopPropagation();
            e.preventDefault();
        });

        cropBox.addEventListener('pointermove', (e) => {
            if (!isDraggingCrop) return;
            const dx = e.clientX - dragStartPointer.x;
            const dy = e.clientY - dragStartPointer.y;
            const maxW = cropOverlay.clientWidth;
            const maxH = cropOverlay.clientHeight;

            if (!activeHandle) {
                let nx = dragStartRect.x + dx;
                let ny = dragStartRect.y + dy;
                nx = Math.max(0, Math.min(maxW - cropRect.w, nx));
                ny = Math.max(0, Math.min(maxH - cropRect.h, ny));
                cropRect.x = nx;
                cropRect.y = ny;
            } else {
                let nw = dragStartRect.w;
                let nh = dragStartRect.h;
                let nx = dragStartRect.x;
                let ny = dragStartRect.y;

                if (activeHandle === 'br') {
                    nw = Math.max(40, Math.min(maxW - nx, dragStartRect.w + dx));
                    nh = Math.max(40, Math.min(maxH - ny, dragStartRect.h + dy));
                    if (activeAspect !== 'free') {
                        const [aw, ah] = activeAspect.split(':').map(Number);
                        nh = Math.round(nw * (ah / aw));
                    }
                } else if (activeHandle === 'bl') {
                    nw = Math.max(40, dragStartRect.w - dx);
                    nx = dragStartRect.x + (dragStartRect.w - nw);
                    nh = Math.max(40, Math.min(maxH - ny, dragStartRect.h + dy));
                    if (activeAspect !== 'free') {
                        const [aw, ah] = activeAspect.split(':').map(Number);
                        nh = Math.round(nw * (ah / aw));
                    }
                } else if (activeHandle === 'tr') {
                    nw = Math.max(40, Math.min(maxW - nx, dragStartRect.w + dx));
                    nh = Math.max(40, dragStartRect.h - dy);
                    ny = dragStartRect.y + (dragStartRect.h - nh);
                    if (activeAspect !== 'free') {
                        const [aw, ah] = activeAspect.split(':').map(Number);
                        nh = Math.round(nw * (ah / aw));
                        ny = dragStartRect.y + (dragStartRect.h - nh);
                    }
                } else if (activeHandle === 'tl') {
                    nw = Math.max(40, dragStartRect.w - dx);
                    nx = dragStartRect.x + (dragStartRect.w - nw);
                    nh = Math.max(40, dragStartRect.h - dy);
                    ny = dragStartRect.y + (dragStartRect.h - nh);
                    if (activeAspect !== 'free') {
                        const [aw, ah] = activeAspect.split(':').map(Number);
                        nh = Math.round(nw * (ah / aw));
                        ny = dragStartRect.y + (dragStartRect.h - nh);
                    }
                }

                if (nx >= 0 && ny >= 0 && nx + nw <= maxW && ny + nh <= maxH) {
                    cropRect.x = nx;
                    cropRect.y = ny;
                    cropRect.w = nw;
                    cropRect.h = nh;
                }
            }

            updateCropBoxDOM();
            updateResizeInputsFromCrop();
        });

        const stopCropDrag = (e) => {
            if (isDraggingCrop) {
                isDraggingCrop = false;
                activeHandle = null;
                try { cropBox.releasePointerCapture(e.pointerId); } catch (err) {}
            }
        };
        cropBox.addEventListener('pointerup', stopCropDrag);
        cropBox.addEventListener('pointercancel', stopCropDrag);
    }

    if (resizeW && resizeH && resizeKeepRatio) {
        resizeKeepRatio.addEventListener('change', (e) => {
            if (resizeModeContainer) {
                resizeModeContainer.style.display = e.target.checked ? 'none' : 'flex';
            }
        });

        resizeW.addEventListener('input', () => {
            if (resizeKeepRatio.checked && afterCanvas && afterCanvas.width > 0) {
                const ratio = afterCanvas.height / afterCanvas.width;
                const newW = parseFloat(resizeW.value) || 0;
                if (newW > 0) resizeH.value = Math.round(newW * ratio);
            }
            syncCropFromResizeInputs();
        });

        resizeH.addEventListener('input', () => {
            if (resizeKeepRatio.checked && afterCanvas && afterCanvas.height > 0) {
                const ratio = afterCanvas.width / afterCanvas.height;
                const newH = parseFloat(resizeH.value) || 0;
                if (newH > 0) resizeW.value = Math.round(newH * ratio);
            }
            syncCropFromResizeInputs();
        });
    }

    if (btnApplyTransform) {
        btnApplyTransform.addEventListener('click', () => {
            if (!afterCanvas) return;

            let hasCropChange = false;
            let hasResizeChange = false;

            if (isCropOverlayActive && cropOverlay.clientWidth > 0) {
                const ow = cropOverlay.clientWidth;
                const oh = cropOverlay.clientHeight;
                const relX = cropRect.x / ow;
                const relY = cropRect.y / oh;
                const relW = cropRect.w / ow;
                const relH = cropRect.h / oh;

                currentParams.crop = { x: relX, y: relY, w: relW, h: relH };
                hasCropChange = true;
                hideCropOverlay();
            }

            const reqW = parseInt(resizeW.value, 10);
            const reqH = parseInt(resizeH.value, 10);
            const mode = document.querySelector('input[name="resize-mode"]:checked')?.value || 'fill';

            if (reqW > 0 && reqH > 0 && (reqW !== afterCanvas.width || reqH !== afterCanvas.height)) {
                currentParams.resize = { w: reqW, h: reqH, mode };
                hasResizeChange = true;
            }

            if (hasCropChange || hasResizeChange) {
                renderPreview();
                syncCanvasSizeToStage();
                updateResizeInputsFromImage();
                let label = '切り抜き・リサイズ';
                if (hasCropChange && !hasResizeChange) label = '切り抜き (トリミング)';
                if (!hasCropChange && hasResizeChange) label = 'サイズ変更 (リサイズ)';
                pushHistoryState(label);
            }
        });
    }

    // ==========================================
    // 12. HSL 12色相 彩度・明度 UI動的生成＆バインド
    // ==========================================
    function buildHslControls() {
        if (!hslSatContainer || !hslLumContainer) return;
        hslSatContainer.innerHTML = '';
        hslLumContainer.innerHTML = '';

        HSL_COLOR_DEFS.forEach(c => {
            const satRow = document.createElement('div');
            satRow.className = 'hsl-slider-group';
            satRow.innerHTML = `
                <div class="hsl-header">
                    <span class="hsl-color-title">
                        <span class="hsl-swatch" style="background-color:${c.hex};"></span>
                        ${c.name}の彩度
                    </span>
                    <span class="control-value" id="val-sat-${c.id}">0</span>
                </div>
                <div class="slider-row">
                    <input type="range" id="param-sat-${c.id}" min="-100" max="100" step="1" value="0">
                    <button type="button" class="reset-val-btn" data-hsl-type="sat" data-color="${c.id}">↺</button>
                </div>
            `;
            hslSatContainer.appendChild(satRow);

            const satInput = satRow.querySelector(`#param-sat-${c.id}`);
            const satVal = satRow.querySelector(`#val-sat-${c.id}`);
            satInput.addEventListener('input', () => {
                const v = parseFloat(satInput.value);
                currentParams.colorSat[c.id] = v;
                satVal.textContent = v > 0 ? `+${v}` : v;
                renderPreview();
            });
            satInput.addEventListener('change', () => {
                pushHistoryState(`${c.name} 彩度調整`);
            });

            const lumRow = document.createElement('div');
            lumRow.className = 'hsl-slider-group';
            lumRow.innerHTML = `
                <div class="hsl-header">
                    <span class="hsl-color-title">
                        <span class="hsl-swatch" style="background-color:${c.hex};"></span>
                        ${c.name}の明度
                    </span>
                    <span class="control-value" id="val-lum-${c.id}">0</span>
                </div>
                <div class="slider-row">
                    <input type="range" id="param-lum-${c.id}" min="-100" max="100" step="1" value="0">
                    <button type="button" class="reset-val-btn" data-hsl-type="lum" data-color="${c.id}">↺</button>
                </div>
            `;
            hslLumContainer.appendChild(lumRow);

            const lumInput = lumRow.querySelector(`#param-lum-${c.id}`);
            const lumVal = lumRow.querySelector(`#val-lum-${c.id}`);
            lumInput.addEventListener('input', () => {
                const v = parseFloat(lumInput.value);
                currentParams.colorLum[c.id] = v;
                lumVal.textContent = v > 0 ? `+${v}` : v;
                renderPreview();
            });
            lumInput.addEventListener('change', () => {
                pushHistoryState(`${c.name} 明度調整`);
            });
        });

        document.querySelectorAll('.reset-val-btn[data-hsl-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.hslType;
                const cId = btn.dataset.color;
                const colorDef = HSL_COLOR_DEFS.find(c => c.id === cId);
                if (type === 'sat') {
                    currentParams.colorSat[cId] = 0;
                    const input = document.getElementById(`param-sat-${cId}`);
                    const valEl = document.getElementById(`val-sat-${cId}`);
                    if (input) input.value = 0;
                    if (valEl) valEl.textContent = '0';
                    renderPreview();
                    pushHistoryState(`${colorDef?.name || cId} 彩度リセット`);
                } else {
                    currentParams.colorLum[cId] = 0;
                    const input = document.getElementById(`param-lum-${cId}`);
                    const valEl = document.getElementById(`val-lum-${cId}`);
                    if (input) input.value = 0;
                    if (valEl) valEl.textContent = '0';
                    renderPreview();
                    pushHistoryState(`${colorDef?.name || cId} 明度リセット`);
                }
            });
        });
    }

    if (btnResetHslSat) {
        btnResetHslSat.addEventListener('click', () => {
            HSL_COLOR_DEFS.forEach(c => {
                currentParams.colorSat[c.id] = 0;
                const input = document.getElementById(`param-sat-${c.id}`);
                const valEl = document.getElementById(`val-sat-${c.id}`);
                if (input) input.value = 0;
                if (valEl) valEl.textContent = '0';
            });
            renderPreview();
            pushHistoryState('HSL彩度 全色リセット');
        });
    }
    if (btnResetHslLum) {
        btnResetHslLum.addEventListener('click', () => {
            HSL_COLOR_DEFS.forEach(c => {
                currentParams.colorLum[c.id] = 0;
                const input = document.getElementById(`param-lum-${c.id}`);
                const valEl = document.getElementById(`val-lum-${c.id}`);
                if (input) input.value = 0;
                if (valEl) valEl.textContent = '0';
            });
            renderPreview();
            pushHistoryState('HSL明度 全色リセット');
        });
    }

    buildHslControls();

    // ==========================================
    // 13. 操作履歴（ヒストリー管理）
    // ==========================================
    function pushHistoryState(actionLabel = 'パラメータ変更') {
        if (historyIndex < historyList.length - 1) {
            historyList = historyList.slice(0, historyIndex + 1);
        }

        historyList.push({
            name: actionLabel,
            params: JSON.parse(JSON.stringify(currentParams))
        });

        if (historyList.length > MAX_HISTORY) {
            historyList.shift();
        } else {
            historyIndex++;
        }

        updateUndoRedoUI();
        updateHistoryUI();
        localStorage.setItem('photoprocess_last_params', JSON.stringify(currentParams));
    }

    function performUndo() {
        if (historyIndex <= -1) return;
        jumpToHistory(historyIndex - 1);
    }

    function performRedo() {
        if (historyIndex >= historyList.length - 1) return;
        jumpToHistory(historyIndex + 1);
    }

    function jumpToHistory(targetIndex) {
        if (targetIndex < -1 || targetIndex >= historyList.length) return;
        historyIndex = targetIndex;

        if (historyIndex === -1) {
            currentParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
        } else {
            currentParams = JSON.parse(JSON.stringify(historyList[historyIndex].params));
        }

        hideCropOverlay();
        syncParamsToUI();
        renderPreview();
        updateResizeInputsFromImage();
        syncCanvasSizeToStage();
        updateUndoRedoUI();
        updateHistoryUI();
    }

    function updateUndoRedoUI() {
        if (btnUndo) btnUndo.disabled = (historyIndex <= -1);
        if (btnRedo) btnRedo.disabled = (historyIndex >= historyList.length - 1);
    }

    function updateHistoryUI() {
        if (!historyListContainer) return;
        historyListContainer.innerHTML = '';
        if (historyTotalCount) historyTotalCount.textContent = `${historyList.length + 1}ステップ`;

        const defaultItem = document.createElement('div');
        const isDefaultCurrent = (historyIndex === -1);
        defaultItem.className = `history-item is-default${isDefaultCurrent ? ' is-current' : ''}`;
        defaultItem.innerHTML = `<span>#0 デフォルト画像</span>`;
        defaultItem.addEventListener('click', () => jumpToHistory(-1));
        historyListContainer.appendChild(defaultItem);

        historyList.forEach((entry, idx) => {
            const item = document.createElement('div');
            const isCurrent = (idx === historyIndex);
            item.className = `history-item${isCurrent ? ' is-current' : ''}`;
            item.innerHTML = `<span>#${idx + 1} ${escapeHtml(entry.name)}</span>`;
            item.addEventListener('click', () => jumpToHistory(idx));
            historyListContainer.appendChild(item);
        });
    }

    if (btnUndo) btnUndo.addEventListener('click', performUndo);
    if (btnRedo) btnRedo.addEventListener('click', performRedo);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isFullscreenMode) {
                setFullscreenMode(false);
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) performRedo();
            else performUndo();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            performRedo();
        }
    });

    // ==========================================
    // 14. UIバインディング＆イベント制御
    // ==========================================
    document.querySelectorAll('.panel-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isCropOverlayActive) {
                hideCropOverlay();
            }

            document.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const pane = document.getElementById(btn.dataset.tab);
            if (pane) pane.classList.add('active');

            if (panelArea) {
                panelArea.classList.toggle('is-export-active', btn.dataset.tab === 'tab-export');
            }
        });
    });

    const sliderKeys = [
        'exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'gamma',
        'temperature', 'tint', 'saturation', 'vibrance',
        'cyanRed', 'magentaGreen', 'yellowBlue', 'angle',
        'filter-strength', 'grain-strength', 'grain-roughness', 'vignette', 'overlay-opacity'
    ];

    const sliderLabels = {
        exposure: '露光量調整', brightness: '明るさ調整', contrast: 'コントラスト調整',
        highlights: 'ハイライト調整', shadows: 'シャドウ調整', gamma: 'ガンマ補正',
        temperature: '色温度調整', tint: '色合い調整', saturation: '彩度調整',
        vibrance: '自然な鮮やかさ', cyanRed: 'シアン/レッド', magentaGreen: 'マゼンタ/グリーン',
        yellowBlue: 'イエロー/ブルー', angle: '角度微補正', 'filter-strength': 'フィルター強度',
        'grain-strength': 'グレイン強さ調整', 'grain-roughness': 'グレイン粗さ調整',
        vignette: '周辺減光 (白 ⇄ 黒ビネット)', 'overlay-opacity': 'カラーオーバーレイ'
    };

    sliderKeys.forEach(key => {
        const input = document.getElementById(`param-${key}`);
        const valEl = document.getElementById(`val-${key}`);
        if (!input) return;

        const updateVal = () => {
            const val = parseFloat(input.value);
            if (valEl) {
                if (key === 'exposure') valEl.textContent = val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
                else if (key === 'gamma') valEl.textContent = val.toFixed(2);
                else if (key === 'angle') valEl.textContent = `${val.toFixed(1)}°`;
                else if (key === 'vignette') {
                    if (val > 0) valEl.textContent = `+${val} (黒)`;
                    else if (val < 0) valEl.textContent = `${val} (白)`;
                    else valEl.textContent = '0';
                }
                else if (key === 'grain-roughness') valEl.textContent = `${val}`;
                else if (key.includes('opacity') || key.includes('strength')) valEl.textContent = `${val}%`;
                else valEl.textContent = val > 0 ? `+${val}` : val;
            }

            if (key === 'filter-strength') currentParams.filterStrength = val;
            else if (key === 'overlay-opacity') currentParams.overlayOpacity = val;
            else if (key === 'grain-strength') {
                currentParams.grainStrength = val;
                currentParams.grain = val;
            }
            else if (key === 'grain-roughness') currentParams.grainRoughness = val;
            else currentParams[key] = val;

            renderPreview();
        };

        input.addEventListener('input', updateVal);
        input.addEventListener('change', () => {
            pushHistoryState(sliderLabels[key] || `${key} 調整`);
        });
    });

    if (paramOverlayColor) {
        paramOverlayColor.addEventListener('input', (e) => {
            currentParams.overlayColor = e.target.value;
            renderPreview();
        });
        paramOverlayColor.addEventListener('change', () => {
            pushHistoryState('カラーフィルター色変更');
        });
    }

    if (paramOverlayBlend) {
        paramOverlayBlend.addEventListener('change', (e) => {
            currentParams.overlayBlend = e.target.value;
            renderPreview();
            pushHistoryState('ブレンドモード変更');
        });
    }

    document.querySelectorAll('.reset-val-btn:not([data-hsl-type])').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (!input) return;
            if (targetId === 'param-gamma') input.value = 1.0;
            else if (targetId === 'param-grain-roughness') input.value = 30;
            else if (targetId.includes('strength') && targetId !== 'param-grain-strength') input.value = 100;
            else input.value = 0;

            input.dispatchEvent(new Event('input'));
            pushHistoryState(`${targetId.replace('param-', '')} をリセット`);
        });
    });

    document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentParams.preset = btn.dataset.preset;
            renderPreview();
            pushHistoryState(`プリセット: ${btn.textContent.trim()}`);
        });
    });

    document.getElementById('btn-rot-left')?.addEventListener('click', () => {
        currentParams.rotation = (currentParams.rotation - 90 + 360) % 360;
        renderPreview();
        pushHistoryState('左90°回転');
    });
    document.getElementById('btn-rot-right')?.addEventListener('click', () => {
        currentParams.rotation = (currentParams.rotation + 90) % 360;
        renderPreview();
        pushHistoryState('右90°回転');
    });
    document.getElementById('btn-flip-h')?.addEventListener('click', () => {
        currentParams.flipH = !currentParams.flipH;
        renderPreview();
        pushHistoryState('水平反転');
    });
    document.getElementById('btn-flip-v')?.addEventListener('click', () => {
        currentParams.flipV = !currentParams.flipV;
        renderPreview();
        pushHistoryState('垂直反転');
    });

    if (btnResetAll) {
        btnResetAll.addEventListener('click', () => {
            if (confirm('すべての編集内容を初期状態に戻しますか？')) {
                jumpToHistory(-1);
            }
        });
    }

    if (btnRestoreLast) {
        btnRestoreLast.addEventListener('click', () => {
            const saved = localStorage.getItem('photoprocess_last_params');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    Object.keys(DEFAULT_PARAMS).forEach(k => {
                        if (!['rotation', 'flipH', 'flipV', 'angle', 'crop', 'resize'].includes(k) && parsed[k] !== undefined) {
                            currentParams[k] = parsed[k];
                        }
                    });
                    syncParamsToUI();
                    renderPreview();
                    pushHistoryState('前回設定を復帰');
                } catch (e) {
                    alert('前回の設定データの読み込みに失敗しました。');
                }
            } else {
                alert('復帰できる前回の設定が保存されていません。');
            }
        });
    }

    function syncParamsToUI() {
        sliderKeys.forEach(key => {
            const input = document.getElementById(`param-${key}`);
            if (!input) return;
            if (key === 'filter-strength') input.value = currentParams.filterStrength;
            else if (key === 'overlay-opacity') input.value = currentParams.overlayOpacity;
            else if (key === 'grain-strength') input.value = currentParams.grainStrength !== undefined ? currentParams.grainStrength : (currentParams.grain || 0);
            else if (key === 'grain-roughness') input.value = currentParams.grainRoughness !== undefined ? currentParams.grainRoughness : 30;
            else input.value = currentParams[key];
            input.dispatchEvent(new Event('input'));
        });
        document.querySelectorAll('[data-preset]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === currentParams.preset);
        });

        if (paramOverlayColor) paramOverlayColor.value = currentParams.overlayColor;
        if (paramOverlayBlend) paramOverlayBlend.value = currentParams.overlayBlend;

        HSL_COLOR_DEFS.forEach(c => {
            const sIn = document.getElementById(`param-sat-${c.id}`);
            const sVal = document.getElementById(`val-sat-${c.id}`);
            const lIn = document.getElementById(`param-lum-${c.id}`);
            const lVal = document.getElementById(`val-lum-${c.id}`);
            const curS = currentParams.colorSat[c.id] || 0;
            const curL = currentParams.colorLum[c.id] || 0;
            if (sIn) sIn.value = curS;
            if (sVal) sVal.textContent = curS > 0 ? `+${curS}` : curS;
            if (lIn) lIn.value = curL;
            if (lVal) lVal.textContent = curL > 0 ? `+${curL}` : curL;
        });
    }

    // ==========================================
    // 15. クリップボード直接書き出し
    // ==========================================
    if (btnCopyClipboard) {
        btnCopyClipboard.addEventListener('click', async () => {
            if (!originalImage) {
                alert('写真が読み込まれていません。');
                return;
            }

            const oldText = btnCopyClipboard.textContent;
            btnCopyClipboard.disabled = true;
            btnCopyClipboard.textContent = 'コピー中...';

            try {
                const fullCanvas = document.createElement('canvas');
                fullCanvas.width = originalImage.naturalWidth;
                fullCanvas.height = originalImage.naturalHeight;
                const fCtx = fullCanvas.getContext('2d');
                fCtx.drawImage(originalImage, 0, 0);

                const exportCanvas = document.createElement('canvas');
                renderPipeline(fullCanvas, exportCanvas, currentParams);

                const blob = await new Promise(resolve => exportCanvas.toBlob(resolve, 'image/png'));
                if (!blob) throw new Error('画像の生成に失敗しました');

                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);

                btnCopyClipboard.textContent = '✔ クリップボードにコピー完了！';
                setTimeout(() => {
                    btnCopyClipboard.textContent = oldText;
                    btnCopyClipboard.disabled = false;
                }, 2000);
            } catch (err) {
                console.warn('クリップボードコピー失敗:', err);
                alert('クリップボードへのコピーに失敗しました。\nブラウザの権限設定をご確認ください。');
                btnCopyClipboard.textContent = oldText;
                btnCopyClipboard.disabled = false;
            }
        });
    }

    // ==========================================
    // 16. JSONエクスポート / インポート
    // ==========================================
    function formatDefaultJsonFilename() {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const y = now.getFullYear();
        const m = pad(now.getMonth() + 1);
        const d = pad(now.getDate());
        return `photoprocess_settings_${y}${m}${d}.json`;
    }

    document.getElementById('btn-export-json')?.addEventListener('click', () => {
        if (!jsonExportModal || !modalJsonFilename) return;
        modalJsonFilename.value = formatDefaultJsonFilename();
        jsonExportModal.classList.add('open');
        modalJsonFilename.focus();
    });

    const closeJsonModal = () => {
        if (jsonExportModal) jsonExportModal.classList.remove('open');
    };

    if (btnModalClose) btnModalClose.addEventListener('click', closeJsonModal);
    if (btnModalCancel) btnModalCancel.addEventListener('click', closeJsonModal);

    if (jsonExportModal) {
        jsonExportModal.addEventListener('click', (e) => {
            if (e.target === jsonExportModal) closeJsonModal();
        });
    }

    if (btnModalConfirmExport) {
        btnModalConfirmExport.addEventListener('click', () => {
            let fname = (modalJsonFilename?.value || '').trim();
            if (!fname) fname = formatDefaultJsonFilename();
            if (!fname.toLowerCase().endsWith('.json')) fname += '.json';

            const exportObj = {
                app: "OctopusPhotoProcess",
                schemaVersion: 1,
                exportedAt: new Date().toISOString(),
                settings: currentParams
            };
            const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fname;
            a.click();
            closeJsonModal();
        });
    }

    const jsonFileInput = document.getElementById('json-file-input');
    document.getElementById('btn-import-json')?.addEventListener('click', () => {
        if (jsonFileInput) jsonFileInput.click();
    });

    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = JSON.parse(evt.target.result);
                    const migratedSettings = migrateSettings(data);
                    currentParams = Object.assign({}, DEFAULT_PARAMS, migratedSettings);
                    syncParamsToUI();
                    renderPreview();
                    pushHistoryState('JSON設定インポート');
                    alert('設定JSONを正常にインポートしました！');
                } catch (err) {
                    alert('無効な設定JSONファイルです: ' + err.message);
                }
            };
            reader.readAsText(file);
            jsonFileInput.value = '';
        });
    }

    function migrateSettings(rawJson) {
        if (!rawJson || typeof rawJson !== 'object') throw new Error('JSONデータが不正です');
        const version = rawJson.schemaVersion || 0;
        let settings = rawJson.settings || rawJson;

        if (!settings.colorSat) settings.colorSat = createEmptyHslMap();
        if (!settings.colorLum) settings.colorLum = createEmptyHslMap();
        HSL_COLOR_DEFS.forEach(c => {
            if (settings.colorSat[c.id] === undefined) settings.colorSat[c.id] = 0;
            if (settings.colorLum[c.id] === undefined) settings.colorLum[c.id] = 0;
        });

        if (settings.grainStrength === undefined) settings.grainStrength = settings.grain || 0;
        if (settings.grainRoughness === undefined) settings.grainRoughness = 30;

        if (version < 1) settings = Object.assign({}, DEFAULT_PARAMS, settings);
        return settings;
    }

    // ==========================================
    // 17. 保存・エクスポートパイプライン
    // ==========================================
    if (exportFormat && qualityControlContainer) {
        exportFormat.addEventListener('change', (e) => {
            qualityControlContainer.style.display = e.target.value === 'jpeg' ? 'block' : 'none';
        });
    }

    if (exportQuality) {
        const qVal = document.getElementById('val-quality');
        exportQuality.addEventListener('input', (e) => {
            if (qVal) qVal.textContent = `${e.target.value}%`;
        });
    }

    if (exportNamemode && exportCustomName) {
        exportNamemode.addEventListener('change', (e) => {
            exportCustomName.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });
    }

    if (btnSaveImage) {
        btnSaveImage.addEventListener('click', async () => {
            if (!originalImage) return;

            btnSaveImage.disabled = true;
            btnSaveImage.textContent = '保存処理中...';

            try {
                const fullCanvas = document.createElement('canvas');
                fullCanvas.width = originalImage.naturalWidth;
                fullCanvas.height = originalImage.naturalHeight;
                const fCtx = fullCanvas.getContext('2d');
                fCtx.drawImage(originalImage, 0, 0);

                const exportCanvas = document.createElement('canvas');
                renderPipeline(fullCanvas, exportCanvas, currentParams);

                const format = exportFormat ? exportFormat.value : 'jpeg';
                const quality = exportQuality ? parseFloat(exportQuality.value) / 100 : 0.95;
                const mimeType = `image/${format}`;

                let outDataUrl = exportCanvas.toDataURL(mimeType, quality);

                if (format === 'jpeg' && exportExifChk && exportExifChk.checked && rawExifBytes && typeof piexif !== 'undefined') {
                    try {
                        if (rawExifBytes["0th"]) rawExifBytes["0th"][piexif.ImageIFD.Orientation] = 1;
                        if (rawExifBytes["Exif"]) {
                            rawExifBytes["Exif"][piexif.ExifIFD.PixelXDimension] = exportCanvas.width;
                            rawExifBytes["Exif"][piexif.ExifIFD.PixelYDimension] = exportCanvas.height;
                        }
                        const dumpedExif = piexif.dump(rawExifBytes);
                        outDataUrl = piexif.insert(dumpedExif, outDataUrl);
                    } catch (exifErr) {
                        console.warn('Exif書き戻しエラー:', exifErr);
                    }
                }

                const outFilename = getOutputFilename(sourceFile.name, exportNamemode?.value, format);
                const outBlob = dataURLtoBlob(outDataUrl);

                if (isIOS()) {
                    const fileObj = new File([outBlob], outFilename, { type: mimeType });
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [fileObj] })) {
                        await navigator.share({ files: [fileObj], title: outFilename });
                    } else {
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(outBlob);
                        a.download = outFilename;
                        a.click();
                    }
                } else {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(outBlob);
                    a.download = outFilename;
                    a.click();
                }
            } catch (err) {
                console.error('保存処理エラー:', err);
                alert('画像の保存中にエラーが発生しました。');
            } finally {
                btnSaveImage.disabled = false;
                btnSaveImage.textContent = '保存する';
            }
        });
    }

    function getOutputFilename(origName, mode, format) {
        const dotIdx = origName.lastIndexOf('.');
        const baseName = dotIdx === -1 ? origName : origName.substring(0, dotIdx);
        const ext = format === 'jpeg' ? 'jpg' : format;

        if (mode === 'suffix') return `${baseName}_process.${ext}`;
        if (mode === 'keep') return `${baseName}.${ext}`;
        if (mode === 'custom') {
            const customVal = exportCustomName?.value.trim();
            if (customVal) return customVal.endsWith(`.${ext}`) ? customVal : `${customVal}.${ext}`;
        }
        return `process_${baseName}.${ext}`;
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = e => resolve(e.target.result);
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    }

    function dataURLtoBlob(dataurl) {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new Blob([u8arr], { type: mime });
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    window.addEventListener('resize', () => {
        if (isCropOverlayActive) syncCropOverlayPosition();
    });
})();