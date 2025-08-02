const express = require('express');
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 3000;

async function getM3u8Link(embedUrl) {
    let browser = null;
    console.log("Starting headless Chromium (Render-Optimized)...");

    try {
        // ✅ Use chrome-aws-lambda's executablePath (Render-friendly)
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        const m3u8Promise = new Promise((resolve, reject) => {
            page.on('request', request => {
                const url = request.url();
                if (url.includes('master.m3u8')) {
                    console.log("✅ Master M3U8 URL Found:", url);
                    resolve(url);
                }
            });
            setTimeout(() => reject(new Error("Timeout: Master M3U8 URL not found within 20s.")), 20000);
        });

        console.log(`Navigating to: ${embedUrl}`);
        await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 20000 });

        const m3u8Url = await m3u8Promise;
        return m3u8Url;

    } catch (error) {
        console.error("Scraping error:", error.message);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

// ✅ API Endpoint
app.get('/extract', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'URL parameter is missing. Use ?url=...' });

    try {
        const m3u8Link = await getM3u8Link(videoUrl);
        res.json({ source_url: videoUrl, master_link: m3u8Link });
    } catch (error) {
        res.status(500).json({ error: 'Failed to extract M3U8 link.', details: error.message });
    }
});

// ✅ Root Route
app.get('/', (req, res) => res.send('✅ Video Extractor API is running! Use /extract?url=<video_embed_url> to get the M3U8 link.'));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
