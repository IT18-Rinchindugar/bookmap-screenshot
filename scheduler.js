const { execFile } = require("child_process");
const path = require("path");

const SCRIPT = path.join(__dirname, "capture.js");

function isWeekend() {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

function msUntilNextHour() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
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
  const ms = msUntilNextHour();
  const next = new Date(Date.now() + ms);
  console.log(`Next run at: ${next.toLocaleString()}`);
  setTimeout(runCapture, ms);
}

console.log("Scheduler started. Runs every hour, Mon–Fri only.");
console.log("Press Ctrl+C to stop.");

// Run once immediately, then schedule hourly
runCapture();
