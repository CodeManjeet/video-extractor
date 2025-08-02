const express = require('express');
const puppeteer = require('puppeteer-core'); // Changed to puppeteer-core
const chromium = require('@sparticuz/chromium'); // Add this package

const app = express();
const PORT = process.env.PORT || 3000;

// Yeh humara main scraper function hai
async function getM3u8Link(embedUrl) {
    let browser = null;
    console.log("Starting browser...");
    try {
        // Use Chromium's executable path from environment or local fallback
        const executablePath = process.env.IS_RENDER 
            ? await chromium.executablePath()
            : '/usr/bin/chromium-browser'; // Render's default path

        // Optimized launch options
        browser = await puppeteer.launch({
            headless: true,
            executablePath,
            args: [
                ...chromium.args,
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--single-process'
            ],
            ignoreDefaultArgs: ['--disable-extensions'],
        });

        const page = await browser.newPage();
        await page.setRequestInterception(true); // Enable request interception

        const m3u8Promise = new Promise((resolve, reject) => {
            page.on('request', request => {
                const url = request.url();
                if (url.includes('master.m3u8')) {
                    console.log("Master M3U8 URL Found:", url);
                    resolve(url);
                    request.abort(); // Stop further processing
                } else {
                    request.continue();
                }
            });

            setTimeout(() => {
                reject(new Error("Timeout: Master M3U8 URL not found within 20 seconds."));
            }, 20000);
        });

        console.log(`Navigating to: ${embedUrl}`);
        await page.goto(embedUrl, { 
            waitUntil: 'domcontentloaded', // Faster than networkidle2
            timeout: 15000 
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

// ... rest of the code remains same ...
