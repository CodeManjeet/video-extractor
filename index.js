const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000; // Render apne aap PORT set karega

// ✅ Puppeteer launch with bundled Chromium (no env needed)
async function getM3u8Link(embedUrl) {
    let browser = null;
    console.log("Starting browser...");

    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: puppeteer.executablePath(), // ✅ Bundled Chromium use karega
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
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
            setTimeout(() => {
                reject(new Error("Timeout: Master M3U8 URL not found within 20 seconds."));
            }, 20000);
        });

        console.log(`Navigating to: ${embedUrl}`);
        await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 20000 });

        console.log("Waiting for M3U8 URL...");
        const m3u8Url = await m3u8Promise;
        return m3u8Url;

    } catch (error) {
        console.error("Scraping error:", error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log("Browser closed.");
        }
    }
}

// ✅ API Endpoint
app.get('/extract', async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'URL parameter is missing. Use ?url=...' });
    }

    try {
        console.log(`Processing URL: ${videoUrl}`);
        const m3u8Link = await getM3u8Link(videoUrl);

        res.status(200).json({
            source_url: videoUrl,
            master_link: m3u8Link
        });

    } catch (error) {
        res.status(500).json({
            error: 'Failed to extract M3U8 link.',
            details: error.message
        });
    }
});

// ✅ Root Route
app.get('/', (req, res) => {
    res.send('✅ Video Extractor API is running! Use /extract?url=<video_embed_url> to get the M3U8 link.');
});

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
