const { execFile } = require("child_process");
const path = require("path");

const SCRIPT = path.join(__dirname, "capture.js");
const INTERVAL_MINUTES = Number(process.argv[2]) || 30;

function isWeekend() {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

function msUntilNext(intervalMinutes) {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes((Math.floor(now.getMinutes() / intervalMinutes) + 1) * intervalMinutes);
  return next - now;
}

function runCapture() {
  const now = new Date().toISOString();

  if (isWeekend()) {
    console.log(`[${now}] Weekend — skipping capture.`);
    scheduleNext();
    return;
  }

  console.log(`[${now}] Starting capture...`);
  execFile(process.execPath, [SCRIPT], { cwd: __dirname }, (err, stdout, stderr) => {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    if (err) console.error(`Capture error (code ${err.code}):`, err.message);
    else console.log(`[${new Date().toISOString()}] Capture done.`);
    scheduleNext();
  });
}

function scheduleNext() {
  const ms = msUntilNext(INTERVAL_MINUTES);
  const next = new Date(Date.now() + ms);
  console.log(`Next run at: ${next.toLocaleString()}`);
  setTimeout(runCapture, ms);
}

console.log(`Scheduler started. Runs every ${INTERVAL_MINUTES} minutes, Mon–Fri only.`);
console.log("Press Ctrl+C to stop.");

// Run once immediately, then schedule every 30 minutes
runCapture();
