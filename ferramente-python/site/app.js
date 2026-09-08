const hostEl = document.querySelector("#host");
const portEl = document.querySelector("#port");
const targetIpEl = document.querySelector("#target-ip");
const targetPortEl = document.querySelector("#target-port");
const expectedOutputEl = document.querySelector("#expected-output");

const host = window.location.hostname || "127.0.0.1";
const port = window.location.port || "80";

hostEl.textContent = host;
portEl.textContent = port;
targetIpEl.textContent = host;
targetPortEl.textContent = port;
expectedOutputEl.textContent = `Company COPS is scanning target ${host} on port ${port}...
Port ${port} is open.`;

const canvas = document.querySelector("#network-visual");
const ctx = canvas.getContext("2d");
let tick = 0;

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawNode(x, y, label, active = false) {
  ctx.beginPath();
  ctx.arc(x, y, active ? 34 : 28, 0, Math.PI * 2);
  ctx.fillStyle = active ? "#0f7b63" : "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = active ? "#0b5f4c" : "#a9b8af";
  ctx.stroke();

  ctx.fillStyle = active ? "#ffffff" : "#16201c";
  ctx.font = "700 13px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
}

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  const left = Math.max(72, width * 0.18);
  const right = Math.min(width - 72, width * 0.82);
  const centerY = height * 0.5;
  const mid = width * 0.5;

  ctx.lineWidth = 4;
  ctx.strokeStyle = "#b7c9bf";
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(left + 34, centerY);
  ctx.lineTo(right - 34, centerY);
  ctx.stroke();
  ctx.setLineDash([]);

  const progress = (Math.sin(tick / 35) + 1) / 2;
  const packetX = left + 56 + (right - left - 112) * progress;

  ctx.beginPath();
  ctx.roundRect(packetX - 28, centerY - 16, 56, 32, 8);
  ctx.fillStyle = "#f2b544";
  ctx.fill();
  ctx.strokeStyle = "#b77912";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#5b6a62";
  ctx.font = "600 12px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText("TCP", packetX, centerY + 4);

  drawNode(left, centerY, "SCRIPT");
  drawNode(mid, centerY - 84, "127.0.0.1");
  drawNode(right, centerY, "SITE", true);

  ctx.strokeStyle = "#d8e0db";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mid, centerY - 56);
  ctx.lineTo(mid, centerY - 12);
  ctx.stroke();

  tick += 1;
  window.requestAnimationFrame(draw);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
draw();
