require("dotenv").config();
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-southeast-1" });

async function uploadToS3(filePath, s3Key) {
  const bucket = process.env.AWS_BUCKET;
  if (!bucket) { console.log("AWS_BUCKET not set, skipping S3 upload."); return; }
  const body = fs.readFileSync(filePath);
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: s3Key, Body: body, ContentType: "image/png" }));
  console.log(`Uploaded to s3://${bucket}/${s3Key}`);
}

const YOUTUBE_URL = "https://www.youtube.com/watch?v=_Y_EwBS8Xkw";
const AD_WAIT_MAX_MS = 60_000;

async function skipOrWaitAds(page) {
  const start = Date.now();

  while (Date.now() - start < AD_WAIT_MAX_MS) {
    const isAd = await page.locator(".ad-showing").count() > 0;
    if (!isAd) break;

    const skipBtn = page.locator(
      ".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern"
    );
    const canSkip = await skipBtn.count() > 0;
    if (canSkip) {
      try {
        await skipBtn.first().click({ timeout: 2000 });
        console.log("Clicked skip ad button");
        await page.waitForTimeout(1500);
      } catch {
        // Button disappeared, loop again
      }
    } else {
      console.log("Non-skippable ad playing, waiting...");
      await page.waitForTimeout(3000);
    }
  }
}

async function setHighestQuality(page) {
  try {
    const player = page.locator("#movie_player");

    // Hover the player to make controls appear
    await player.hover();
    await page.waitForTimeout(500);

    // Click the Settings (gear) button
    await page.locator(".ytp-settings-button").click({ timeout: 5000 });
    await page.waitForTimeout(600);

    // Click "Quality" menu item
    await page.locator('.ytp-menuitem:has-text("Quality")').click({ timeout: 5000 });
    await page.waitForTimeout(600);

    // Get all quality options and pick the best one (highest number)
    const options = page.locator(".ytp-menuitem");
    const count = await options.count();

    // Quality labels look like "1080p", "720p", "1080p60", etc.
    // They appear in descending order — pick the first numeric one (best quality)
    let picked = false;
    for (let i = 0; i < count; i++) {
      const label = await options.nth(i).textContent();
      if (label && /^\d{3,4}p/.test(label.trim())) {
        console.log(`Setting quality to: ${label.trim()}`);
        await options.nth(i).click();
        picked = true;
        break;
      }
    }

    if (!picked) {
      console.log("Could not find quality option, using default");
      // Dismiss menu by pressing Escape
      await page.keyboard.press("Escape");
    }

    // Let the player rebuffer at the new quality
    await page.waitForTimeout(4000);
  } catch (err) {
    console.log("Quality selection failed, continuing:", err.message);
  }
}

async function captureYoutube() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // UTC+7
  const dateDir = now.toISOString().slice(0, 10);
  const timeStamp = now.toISOString().slice(11, 19).replace(/:/g, "-");

  const screenshotsDir = path.join(__dirname, "screenshots", dateDir);
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });

  // Remove the webdriver property that YouTube uses to detect headless browsers
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();

  try {
    console.log(`Navigating to ${YOUTUBE_URL} ...`);
    await page.goto(YOUTUBE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Dismiss cookie / consent dialog if present
    try {
      await page.locator('button:has-text("Accept all")').click({ timeout: 3000 });
      await page.waitForTimeout(1000);
    } catch {
      // No dialog
    }

    // If YouTube shows an error page, reload once and try again
    const hasError = await page.locator("yt-error-screen, .yt-playability-error-supported-renderers").count() > 0;
    if (hasError) {
      console.log("YouTube error detected, reloading...");
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
    }

    // Wait for the player to appear
    await page.locator("#movie_player").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3000);

    // Handle ads
    await skipOrWaitAds(page);

    // Set highest available quality
    await setHighestQuality(page);

    // Live streams have duration=Infinity so we wait for readyState >= 1 (metadata loaded)
    // then add a buffer for a full frame to be painted
    await page.waitForFunction(
      () => { const v = document.querySelector("video"); return v && v.readyState >= 1; },
      { timeout: 20000 }
    ).catch(() => {});
    await page.waitForTimeout(5000);

    // Screenshot just the raw video element — clean frame, no UI chrome
    const video = page.locator("video").first();
    const filename = path.join(screenshotsDir, `gc_bookmap_${timeStamp}.png`);
    await video.screenshot({ path: filename });
    console.log(`Saved: ${filename}`);
    await uploadToS3(filename, `${dateDir}/gc_bookmap_${timeStamp}.png`);
  } finally {
    await browser.close();
  }
}

async function captureWithRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await captureYoutube();
      return;
    } catch (err) {
      console.error(`Attempt ${attempt}/${maxAttempts} failed:`, err.message);
      if (attempt < maxAttempts) {
        const wait = attempt * 15000;
        console.log(`Retrying in ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  console.error("All attempts failed.");
  process.exit(1);
}

captureWithRetry();
