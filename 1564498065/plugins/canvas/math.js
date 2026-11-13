/**
 * ╔══════════════════════════════════════════════╗
 * ║         ᴍᴀᴛʜ — lyniX's MD                  ║
 * ║  Render rumus LaTeX jadi gambar              ║
 * ╚══════════════════════════════════════════════╝
 * TARUH DI: plugins/canvas/math.js
 */

import te from "../../src/lib/ichigo-error.js";
import { createCanvas, loadImage } from "../../src/lib/ichigo-canvas-lazy.js";

const pluginConfig = {
    name: "math",
    alias: ["latex", "rumus"],
    category: "canvas",
    description: "Render rumus matematika (LaTeX) jadi gambar",
    usage: ".math <latex>",
    example: ".math E = mc^2 | \\frac{a}{b}",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true,
};

function latexToReadable(latex) {
    return latex
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
        .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
        .replace(/\\sqrt/g, '√')
        .replace(/\\sum/g, 'Σ')
        .replace(/\\int/g, '∫')
        .replace(/\\infty/g, '∞')
        .replace(/\\pi/g, 'π')
        .replace(/\\alpha/g, 'α')
        .replace(/\\beta/g, 'β')
        .replace(/\\gamma/g, 'γ')
        .replace(/\\delta/g, 'δ')
        .replace(/\\theta/g, 'θ')
        .replace(/\\lambda/g, 'λ')
        .replace(/\\mu/g, 'μ')
        .replace(/\\sigma/g, 'σ')
        .replace(/\\omega/g, 'ω')
        .replace(/\\pm/g, '±')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\leq/g, '≤')
        .replace(/\\geq/g, '≥')
        .replace(/\\neq/g, '≠')
        .replace(/\\approx/g, '≈')
        .replace(/\\cdot/g, '·')
        .replace(/\\left\(/g, '(')
        .replace(/\\right\)/g, ')')
        .replace(/\\left\[/g, '[')
        .replace(/\\right\]/g, ']')
        .replace(/\^{([^}]+)}/g, '^($1)')
        .replace(/_{([^}]+)}/g, '_($1)')
        .replace(/\^(\S)/g, '^$1')
        .replace(/_(\S)/g, '_$1')
        .replace(/\\\\/g, '')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}]/g, '')
        .trim();
}

function renderOne(latex) {
    const readable   = latexToReadable(latex);
    const fontSize   = 52;
    const padding    = 48;
    const maxWidth   = 880;
    const lineHeight = fontSize * 1.6;

    const measure = createCanvas(1, 1);
    const mctx    = measure.getContext("2d");
    mctx.font     = `bold ${fontSize}px sans-serif`;

    const chars  = readable.split("");
    const lines  = [];
    let curr     = "";

    for (const ch of chars) {
        const test = curr + ch;
        if (mctx.measureText(test).width > maxWidth - padding * 2) {
            if (curr) lines.push(curr);
            curr = ch;
        } else {
            curr = test;
        }
    }
    if (curr) lines.push(curr);
    if (lines.length === 0) lines.push(readable || latex);

    const canvasW = maxWidth;
    const canvasH = padding * 2 + lines.length * lineHeight + 20;

    const canvas = createCanvas(canvasW, canvasH);
    const ctx    = canvas.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
    grad.addColorStop(0, "#0f0f1a");
    grad.addColorStop(1, "#1a0f2e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    const accent = ctx.createLinearGradient(0, 0, 0, canvasH);
    accent.addColorStop(0, "#9b59b6");
    accent.addColorStop(1, "#3498db");
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 7, canvasH);

    ctx.fillStyle    = "#f0f0f0";
    ctx.font         = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.shadowColor  = "#9b59b6";
    ctx.shadowBlur   = 8;

    lines.forEach((line, i) => {
        const x = padding + 10;
        const y = padding + i * lineHeight + lineHeight / 2;
        ctx.fillText(line, x, y);
    });

    ctx.shadowBlur   = 0;
    ctx.fillStyle    = "#555577";
    ctx.font         = `18px monospace`;
    ctx.textBaseline = "bottom";
    const rawText    = latex.length > 80 ? latex.substring(0, 77) + "..." : latex;
    ctx.fillText(rawText, padding + 10, canvasH - 10);

    return canvas.toBuffer("image/png");
}

async function handler(m, { sock }) {
    const input = m.text?.trim();

    if (!input) {
        return m.reply(
            `📐 *RENDER MATEMATIKA*\n\n` +
            `*Contoh:*\n` +
            `• ${m.prefix}math E = mc^2\n` +
            `• ${m.prefix}math \\frac{a}{b}\n` +
            `• ${m.prefix}math x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\n` +
            `• ${m.prefix}math \\sum_{i=1}^{n} i\n\n` +
            `> Pisah beberapa rumus dengan |`
        );
    }

    await m.react("🕕");

    try {
        const expressions = input
            .split("|")
            .map(v => v.trim())
            .filter(v => v.length > 0);

        if (expressions.length === 1) {
            const buf = renderOne(expressions[0]);
            await sock.sendMessage(m.chat, {
                image: buf,
                caption: `📐 *Rumus Matematika*\n\`${expressions[0]}\``,
                mimetype: "image/png",
            }, { quoted: m });
        } else {
            
            const buffers = expressions.map(e => renderOne(e));
            const imgs    = await Promise.all(buffers.map(b => loadImage(b)));
            const gap     = 16;
            const totalH  = imgs.reduce((acc, img) => acc + img.height + gap, 0);
            const maxW    = Math.max(...imgs.map(img => img.width));

            const combined = createCanvas(maxW, totalH);
            const ctx      = combined.getContext("2d");

            ctx.fillStyle = "#0f0f1a";
            ctx.fillRect(0, 0, maxW, totalH);

            let y = 0;
            for (const img of imgs) {
                ctx.drawImage(img, 0, y);
                y += img.height + gap;
            }

            const finalBuf = combined.toBuffer("image/png");
            await sock.sendMessage(m.chat, {
                image: finalBuf,
                caption: `📐 *Rumus Matematika* (${expressions.length} ekspresi)\n` +
                         expressions.map((e, i) => `${i + 1}. \`${e}\``).join("\n"),
                mimetype: "image/png",
            }, { quoted: m });
        }

        await m.react("✅");

    } catch (error) {
        console.error("[MATH ERROR]", error.message);
        await m.react("☢");
        await m.reply(te(m.prefix, m.command, m.pushName));
    }
}

export { pluginConfig as config, handler };