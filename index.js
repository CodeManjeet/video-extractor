const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Extracts the master.m3u8 link from a given embed URL.
 * This function is optimized to run on hosting platforms like Render.
 * @param {string} embedUrl The URL of the page with the embedded video.
 * @returns {Promise<string>} A promise that resolves to the M3U8 link.
 */
async function getM3u8Link(embedUrl) {
    let browser = null;
    console.log("Starting browser for scraping...");

    try {
        // Updated Puppeteer launch options for Render environment
        browser = await puppeteer.launch({
            headless: "new", // Use the new headless mode to avoid warnings
            executablePath: process.env.CHROME_PATH || undefined, // Use CHROME_PATH from environment variables if available
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // Crucial for low-resource environments
                '--disable-gpu'
            ],
        });

        const page = await browser.newPage();

        // Promise to capture the M3U8 URL
        const m3u8Promise = new Promise((resolve, reject) => {
            page.on('request', request => {
                const url = request.url();
                if (url.includes('master.m3u8')) {
                    console.log("Master M3U8 URL Found:", url);
                    resolve(url);
                }
            });
            // Set a timeout to prevent the request from hanging indefinitely
            setTimeout(() => {
                reject(new Error("Timeout: Master M3U8 URL not found within 20 seconds."));
            }, 20000);
        });

        console.log(`Navigating to: ${embedUrl}`);
        // Go to the page and wait until the network is idle
        await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        console.log("Waiting for M3U8 URL...");
        const m3u8Url = await m3u8Promise;
        return m3u8Url;

    } catch (error) {
        console.error("Scraping error:", error.message);
        // Re-throw the error to be caught by the API endpoint handler
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log("Browser closed.");
        }
    }
}

// API Endpoint to trigger the scraping process
app.get('/extract', async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'URL parameter is missing. Use ?url=VIDEO_URL' });
    }

    try {
        console.log(`Processing URL: ${videoUrl}`);
        const m3u8Link = await getM3u8Link(videoUrl);
        
        // Success response
        res.status(200).json({
            success: true,
            source_url: videoUrl,
            master_link: m3u8Link
        });

    } catch (error) {
        // Error response
        res.status(500).json({
            success: false,
            error: 'Failed to extract M3U8 link.',
            details: error.message
        });
    }
});

// Root URL to show a welcome message
app.get('/', (req, res) => {
    res.send('Video Extractor API is running! Use the /extract?url=<your_video_embed_url> endpoint.');
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
