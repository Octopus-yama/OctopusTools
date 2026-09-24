/**
 * Octopus Tools - カメラ＆スマートフォン センサーサイズ判定データベース
 * ・iPhone各世代（Pro系 / 標準・Plus・Air系 / 旧世代 / SE）完全個別判定
 * ・Galaxy, Pixel, Xperia等 主要Androidモジュール別判定
 */

window.OCTOPUS_SENSOR_DB = {
    smartphones: [
        // --- 1. Apple iPhone 14 / 15 / 16 / 17 Pro 系 (メイン24mm相当 / 1/1.28型) ---
        {
            modelPattern: /iPhone (1[4-7]) Pro/i,
            name: "iPhone Pro Series",
            resolveModule: function(lensModel, focalLength) {
                const s = (lensModel || "").toLowerCase();
                const fl = focalLength || 0;
                // 超広角: 2.22mm前後 -> 13mm
                if (/ultra wide/.test(s) || fl < 3.0) return { type: "超広角 (13mm相当)", factor: 5.86 };
                // 望遠 5x (Pro Max等): 15.66mm前後 -> 120mm
                if (/telephoto/.test(s) || fl >= 13.0) return { type: "望遠 5x (120mm相当)", factor: 7.66 };
                // 望遠 3x: 9.0mm前後 -> 77mm
                if (/telephoto/.test(s) || fl >= 8.0) return { type: "望遠 3x (77mm相当)", factor: 8.55 };
                // メイン広角: 6.765mm〜6.86mm -> 24mm
                return { type: "メイン広角 (24mm相当 / 1/1.28型)", factor: 3.55 };
            }
        },

        // --- 2. Apple iPhone 15 / 16 / 17 標準 / Plus / Air 系 (メイン26mm相当 / 1/1.56型) ---
        {
            modelPattern: /iPhone (1[5-7])\b|iPhone (1[5-7]) (Plus|Air)/i,
            name: "iPhone Standard / Plus / Air",
            resolveModule: function(lensModel, focalLength) {
                const s = (lensModel || "").toLowerCase();
                const fl = focalLength || 0;
                // 超広角: 2.22mm前後 -> 13mm
                if (/ultra wide/.test(s) || fl < 3.2) return { type: "超広角 (13mm相当)", factor: 5.86 };
                // メイン広角: 5.96mm前後 -> 26mm (5.96 * 4.362 = 26mm)
                return { type: "メイン広角 (26mm相当 / 1/1.56型)", factor: 4.362 };
            }
        },

        // --- 3. Apple iPhone 12 / 13 Pro 系 (メイン26mm相当 / 1/1.65型) ---
        {
            modelPattern: /iPhone 1[23] Pro/i,
            name: "iPhone 12/13 Pro Series",
            resolveModule: function(lensModel, focalLength) {
                const s = (lensModel || "").toLowerCase();
                const fl = focalLength || 0;
                if (/ultra wide/.test(s) || fl < 2.5) return { type: "超広角 (13mm相当)", factor: 8.28 };
                if (/telephoto/.test(s) || fl >= 6.5) return { type: "望遠 (52mm/65mm/77mm相当)", factor: 8.66 };
                return { type: "メイン広角 (26mm相当 / 1/1.65型)", factor: 4.56 };
            }
        },

        // --- 4. Apple iPhone 12 / 13 / 14 標準 / Mini / Plus 系 ---
        {
            modelPattern: /iPhone (1[234]\b|1[23] Mini|14 Plus)/i,
            name: "iPhone 12/13/14 Standard / Mini",
            resolveModule: function(lensModel, focalLength) {
                const s = (lensModel || "").toLowerCase();
                const fl = focalLength || 0;
                if (/ultra wide/.test(s) || fl < 2.5) return { type: "超広角 (13mm相当)", factor: 8.44 };
                return { type: "メイン広角 (26mm相当 / 1/1.9型)", factor: 5.10 };
            }
        },

        // --- 5. Apple iPhone 11 系 ---
        {
            modelPattern: /iPhone 11/i,
            name: "iPhone 11 Series",
            resolveModule: function(lensModel, focalLength) {
                const s = (lensModel || "").toLowerCase();
                const fl = focalLength || 0;
                if (/ultra wide/.test(s) || fl < 2.5) return { type: "超広角 (13mm相当)", factor: 8.44 };
                if (/telephoto/.test(s) || fl >= 5.5) return { type: "望遠 2x (52mm相当)", factor: 8.66 };
                return { type: "メイン広角 (26mm相当 / 1/2.55型)", factor: 6.12 };
            }
        },

        // --- 6. Apple iPhone SE 系 ---
        {
            modelPattern: /iPhone SE/i,
            name: "iPhone SE Series",
            resolveModule: function() {
                return { type: "メイン広角 (28mm相当 / 1/3型)", factor: 7.02 };
            }
        },

        // --- 7. Samsung Galaxy Z Fold シリーズ (Fold4〜Fold8) ---
        {
            modelPattern: /Fold[4-9]|SM-F9[3-6]/i,
            name: "Samsung Galaxy Z Fold Series",
            resolveModule: function(lensModel, focalLength) {
                const s = (lensModel || "").toLowerCase();
                const fl = focalLength || 0;
                if (/ultra wide/.test(s) || fl < 3.0) return { type: "超広角 (12mm相当)", factor: 5.45 };
                if (/telephoto/.test(s) || fl >= 6.5) return { type: "望遠 3x (67mm相当)", factor: 9.57 };
                return { type: "メイン広角 (24mm相当 / 1/1.56型)", factor: 4.44 };
            }
        },

        // --- 8. Samsung Galaxy S Ultra シリーズ (S21U〜S25U) ---
        {
            modelPattern: /Galaxy S2[1-5] Ultra|SM-S9[0-9]8/i,
            name: "Samsung Galaxy S Ultra Series",
            resolveModule: function(lensModel, focalLength) {
                const s = (lensModel || "").toLowerCase();
                const fl = focalLength || 0;
                if (/ultra wide/.test(s) || fl < 3.0) return { type: "超広角 (13mm相当)", factor: 5.91 };
                if (/telephoto/.test(s) || fl >= 14.0) return { type: "ペリスコープ望遠 5x/10x", factor: 10.2 };
                if (/telephoto/.test(s) || fl >= 7.5) return { type: "望遠 3x (67mm相当)", factor: 8.48 };
                return { type: "メイン広角 (24mm相当 / 1/1.3型)", factor: 3.75 };
            }
        },

        // --- 9. Samsung Galaxy S 標準 / Plus シリーズ ---
        {
            modelPattern: /Galaxy S2[0-5]\b|SM-G98|SM-G99|SM-S9[0-9][16]/i,
            name: "Samsung Galaxy S Series (Standard/Plus)",
            resolveModule: function(lensModel, focalLength) {
                const s = (lensModel || "").toLowerCase();
                const fl = focalLength || 0;
                if (/ultra wide/.test(s) || fl < 3.0) return { type: "超広角 (13mm相当)", factor: 5.91 };
                if (/telephoto/.test(s) || fl >= 6.5) return { type: "望遠 3x (67mm相当)", factor: 9.57 };
                return { type: "メイン広角 (24mm相当 / 1/1.56型)", factor: 4.44 };
            }
        },

        // --- 10. Google Pixel Pro 系 (Pixel 6〜9 Pro) ---
        {
            modelPattern: /Pixel [6-9] Pro/i,
            name: "Google Pixel Pro Series",
            resolveModule: function(lensModel, focalLength) {
                const fl = focalLength || 0;
                if (fl < 3.0) return { type: "超広角 (12mm相当)", factor: 6.15 };
                if (fl >= 10.0) return { type: "望遠 5x (115-120mm相当)", factor: 6.25 };
                return { type: "メイン広角 (25mm相当 / 1/1.31型)", factor: 3.67 };
            }
        },

        // --- 11. Google Pixel 標準 / a 系 (Pixel 6〜9, 6a〜8a) ---
        {
            modelPattern: /Pixel [6-9]\b|Pixel [6-9]a/i,
            name: "Google Pixel Standard / a Series",
            resolveModule: function(lensModel, focalLength) {
                const fl = focalLength || 0;
                if (fl < 3.5) return { type: "超広角 (14mm相当)", factor: 6.00 };
                return { type: "メイン広角 (25mm相当)", factor: 3.67 };
            }
        },

        // --- 12. その他・汎用スマートフォン ---
        {
            modelPattern: /iPhone|Galaxy|Pixel|Xperia|AQUOS|Xiaomi|Redmi|POCO|OPPO|CPH\d{4}/i,
            name: "汎用スマートフォン",
            resolveModule: function(lensModel, focalLength) {
                const s = (lensModel || "").toLowerCase();
                const fl = focalLength || 0;
                if (/ultra wide/.test(s) || fl < 3.0) return { type: "超広角", factor: 5.86 };
                if (/telephoto|tele/.test(s) || fl >= 8.0) return { type: "望遠", factor: 8.00 };
                return { type: "メイン広角", factor: 4.36 };
            }
        }
    ],

    standaloneCameras: [
        { pattern: /TG-[1-7]\b|TOUGH\b/i, factor: 5.6, name: "OM SYSTEM Tough TG Series (1/2.3型)" },
        { pattern: /IXY\b|POWERSHOT SX|POWERSHOT D/i, factor: 5.6, name: "Canon IXY / PowerShot SX (1/2.3型)" },
        { pattern: /COOLPIX [SWA]\d|COOLPIX B\d/i, factor: 5.6, name: "Nikon COOLPIX S/W/B (1/2.3型)" },
        { pattern: /PENTAX Q\b|PENTAX Q10|\bWG-[0-9]/i, factor: 5.6, name: "PENTAX Q / WG Series (1/2.3型)" },
        { pattern: /LUMIX DMC-TZ|LUMIX DC-TZ|DMC-FT|DC-FT/i, factor: 5.6, name: "Panasonic TZ / FT (1/2.3型)" },
        { pattern: /POWERSHOT G1[56]|POWERSHOT S9[05]|POWERSHOT S1[012]0/i, factor: 4.55, name: "Canon PowerShot G16/S120等 (1/1.7型)" },
        { pattern: /XZ-[12]\b|STYLUS 1/i, factor: 4.55, name: "OLYMPUS XZ-2 / Stylus 1 (1/1.7型)" },
        { pattern: /COOLPIX P7[0178]00/i, factor: 4.55, name: "Nikon COOLPIX P7800 (1/1.7型)" },
        { pattern: /PENTAX Q7|PENTAX Q-S1/i, factor: 4.55, name: "PENTAX Q7 / Q-S1 (1/1.7型)" },
        { pattern: /RX100|ZV-1\b|ZV-1M2|ZV-1F|DSC-RX10/i, factor: 2.7, name: "SONY RX100 / ZV-1 (1.0型)" },
        { pattern: /POWERSHOT G[3579] X/i, factor: 2.7, name: "Canon PowerShot G7X等 (1.0型)" },
        { pattern: /NIKON 1\b|COOLPIX P1000/i, factor: 2.7, name: "Nikon 1 Series (1.0型)" },
        { pattern: /LUMIX DMC-TX|LUMIX DC-TX|DMC-LX9|DMC-LX10|DMC-FZ1000|DC-FZ1000/i, factor: 2.7, name: "LUMIX TX1/LX9 (1.0型)" },
        { pattern: /LX100/i, factor: 2.2, name: "Panasonic LUMIX LX100 (4/3型マルチアスペクト)" },
        { pattern: /OM-1|OM-5|E-M|E-P\b|E-PL|PEN-F|PEN\b/i, factor: 2.0, name: "OM SYSTEM / OLYMPUS (MFT)" },
        { pattern: /DC-G|DMC-G|DC-GH|DMC-GH|DC-GX|DMC-GX|LUMIX G/i, factor: 2.0, name: "Panasonic LUMIX G (MFT)" },
        { pattern: /EOS R7|EOS R10|EOS R50|EOS R100/i, factor: 1.6, name: "Canon EOS R APS-C" },
        { pattern: /EOS M\b|EOS M\d|EOS KISS|EOS 7D|EOS [1-9]0D|EOS [1-9]\d{2}D/i, factor: 1.6, name: "Canon EOS Kiss/M/80D (APS-C)" },
        { pattern: /ILCE-6|ZV-E10|NEX-[3567]/i, factor: 1.5, name: "SONY α6000 / ZV-E10 (APS-C)" },
        { pattern: /NIKON Z 50|NIKON Z FC|NIKON Z 30|D500\b|D7[125]00|D5[356]00|D3[345]00/i, factor: 1.5, name: "Nikon Z fc / Z 50 (APS-C)" },
        { pattern: /X-T|X-S|X-H|X-PRO|X-E|X-A|X100|X70\b/i, factor: 1.5, name: "FUJIFILM X Series (APS-C)" },
        { pattern: /GR III|GR II|RICOH GR\b/i, factor: 1.5, name: "RICOH GR Series (APS-C)" },
        { pattern: /PENTAX K-[357]|PENTAX K-70|PENTAX KF|PENTAX KP|PENTAX K-50|PENTAX K-S/i, factor: 1.5, name: "PENTAX K Series (APS-C)" },
        { pattern: /LEICA CL\b|LEICA TL|LEICA T\b/i, factor: 1.5, name: "Leica CL / TL (APS-C)" },
        { pattern: /DP.*QUATTRO|SD.*QUATTRO|SD1\b/i, factor: 1.5, name: "SIGMA dp/sd Quattro (APS-C)" },
        { pattern: /ILCE-7|ILCE-9|ILCE-1|ZV-E1\b|FX3\b|FX6\b|DSC-RX1/i, factor: 1.0, name: "SONY α7/α9/α1 (Full-Frame)" },
        { pattern: /EOS R[13568]\b|EOS R\b|EOS RP\b|EOS 5D|EOS 6D|EOS 1D/i, factor: 1.0, name: "Canon EOS R / 5D (Full-Frame)" },
        { pattern: /NIKON Z [5-9]|NIKON Z F\b|D8[015]0|D7[58]0|D6[01]0|DF\b|D[3-6]\b/i, factor: 1.0, name: "Nikon Z / D (Full-Frame)" },
        { pattern: /DC-S|LUMIX S/i, factor: 1.0, name: "Panasonic LUMIX S (Full-Frame)" },
        { pattern: /LEICA M|LEICA Q|LEICA SL/i, factor: 1.0, name: "Leica M / Q / SL (Full-Frame)" },
        { pattern: /SIGMA FP/i, factor: 1.0, name: "SIGMA fp Series (Full-Frame)" },
        { pattern: /PENTAX K-1/i, factor: 1.0, name: "PENTAX K-1 Series (Full-Frame)" }
    ]
};