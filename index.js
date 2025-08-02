const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium-min');

const app = express();
const PORT = process.env.PORT || 3000;

// Main scraping function
async function getM3u8Link(embedUrl) {
    let browser = null;
    console.log("Starting browser...");
    try {
        // Get Chromium executable path
        const executablePath = await chromium.executablePath();
        console.log(`Using Chromium at: ${executablePath}`);

        // Configure browser launch options
        browser = await puppeteer.launch({
            headless: chromium.headless,
            executablePath,
            args: [
                ...chromium.args,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--single-process'
            ],
            ignoreDefaultArgs: ['--disable-extensions'],
        });

        const page = await browser.newPage();
        await page.setRequestInterception(true); // Enable request interception

        // Set up promise to capture m3u8 URL
        const m3u8Promise = new Promise((resolve, reject) => {
            page.on('request', request => {
                const url = request.url();
                if (url.includes('.m3u8')) {
                    console.log("M3U8 URL Found:", url);
                    resolve(url);
                    request.abort(); // Stop further processing
                } else {
                    request.continue();
                }
            });

            // Set timeout for m3u8 detection
            setTimeout(() => {
                reject(new Error("Timeout: M3U8 URL not found within 25 seconds."));
            }, 25000);
        });

        console.log(`Navigating to: ${embedUrl}`);
        await page.goto(embedUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 20000 
        });

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

// API Endpoint
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

// Root endpoint
app.get('/', (req, res) => {
    res.send('Video Extractor API is running! Use /extract?url=<video_embed_url> to get the M3U8 link.');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
