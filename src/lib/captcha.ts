import { nanoid } from "nanoid";

// Store for captcha verification (in-memory, will reset on server restart)
const captchaStore = new Map<string, { code: string; expiresAt: number }>();
const CAPTCHA_EXPIRY = 5 * 60 * 1000; // 5 minutes
const CAPTCHA_LENGTH = 4;

// Generate random captcha code
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < CAPTCHA_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate SVG image for captcha
function generateSVG(code: string): string {
  const width = 120;
  const height = 40;
  const fontSize = 24;
  const chars = code.split("");
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  
  // Background
  svg += `<rect width="100%" height="100%" fill="#f0f0f0"/>`;
  
  // Noise lines
  for (let i = 0; i < 5; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    const color = `rgb(${Math.floor(Math.random() * 200)},${Math.floor(Math.random() * 200)},${Math.floor(Math.random() * 200)})`;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1"/>`;
  }
  
  // Noise dots
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const color = `rgb(${Math.floor(Math.random() * 200)},${Math.floor(Math.random() * 200)},${Math.floor(Math.random() * 200)})`;
    svg += `<circle cx="${x}" cy="${y}" r="1" fill="${color}"/>`;
  }
  
  // Text
  chars.forEach((char, index) => {
    const x = 20 + index * 25;
    const y = 28 + (Math.random() * 10 - 5);
    const rotate = (Math.random() * 30 - 15).toFixed(1);
    const color = `rgb(${Math.floor(Math.random() * 100)},${Math.floor(Math.random() * 100)},${Math.floor(Math.random() * 100)})`;
    svg += `<text x="${x}" y="${y}" font-family="Arial" font-size="${fontSize}" fill="${color}" transform="rotate(${rotate}, ${x}, ${y})">${char}</text>`;
  });
  
  svg += `</svg>`;
  return svg;
}

export interface CaptchaResult {
  captchaId: string;
  svg: string;
}

// Generate new captcha
export function generateCaptcha(): CaptchaResult {
  const captchaId = nanoid(16);
  const code = generateCode();
  const svg = generateSVG(code);
  
  captchaStore.set(captchaId, {
    code,
    expiresAt: Date.now() + CAPTCHA_EXPIRY,
  });
  
  // Clean up expired captchas
  cleanupExpiredCaptchas();
  
  return { captchaId, svg: Buffer.from(svg).toString("base64") };
}

// Verify captcha
export function verifyCaptcha(captchaId: string, inputCode: string): boolean {
  const captcha = captchaStore.get(captchaId);
  
  if (!captcha) {
    return false;
  }
  
  // Check expiry
  if (Date.now() > captcha.expiresAt) {
    captchaStore.delete(captchaId);
    return false;
  }
  
  // Verify code (case-insensitive)
  const isValid = captcha.code.toLowerCase() === inputCode.toLowerCase();
  
  // Delete captcha after verification (one-time use)
  captchaStore.delete(captchaId);
  
  return isValid;
}

// Clean up expired captchas
function cleanupExpiredCaptchas(): void {
  const now = Date.now();
  for (const [id, captcha] of Array.from(captchaStore.entries())) {
    if (now > captcha.expiresAt) {
      captchaStore.delete(id);
    }
  }
}
