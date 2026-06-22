# YouTube Live Screenshot Capture

Captures a screenshot of a YouTube live stream every hour on weekdays (Mon–Fri). Skips weekends automatically. Filenames use **UTC+7** time.

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

### One-off capture
```bash
npm run capture
```

### Hourly scheduler (runs forever, skips weekends)
```bash
npm run scheduler
```

## Output

Screenshots are saved to:
```
screenshots/
  YYYY-MM-DD/
    gc_bookmap_HH-MM-SS.png
```

Date and time in the filename are **UTC+7**.

## Keep running in background

**Windows — using pm2:**
```bash
npm install -g pm2
pm2 start scheduler.js --name youtube-capture
pm2 startup
pm2 save
```

**macOS/Linux:**
```bash
nohup node scheduler.js > capture.log 2>&1 &
```

## Config

| Variable | Location | Default |
|---|---|---|
| YouTube URL | `capture.js` line 5 | `YOUTUBE_URL` |
| Timezone offset | `capture.js` line 81 | UTC+7 |
