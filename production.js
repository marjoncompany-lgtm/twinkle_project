export function makeSafeFilename(input) {
  const leaf = String(input ?? '').split(/[\\/]/).pop() || 'twinkle-output';
  return leaf.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+\./g, '.').replace(/^-+|-+$/g, '').slice(0, 120) || 'twinkle-output';
}

function timestamp(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}

export function buildSrt(lines, durationSeconds = 10) {
  const captions = (Array.isArray(lines) ? lines : String(lines ?? '').split(/\r?\n/))
    .map(line => String(line).trim()).filter(Boolean);
  if (!captions.length) throw new Error('Add at least one lyric or caption line before exporting.');
  const segment = Math.max(0.5, Number(durationSeconds) / captions.length);
  return captions.map((line, index) => `${index + 1}\n${timestamp(index * segment)} --> ${timestamp((index + 1) * segment)}\n${line}`)
    .join('\n\n');
}

export function createWavBuffer({ durationSeconds = 10, sampleRate = 22050, frequency = 196 } = {}) {
  const duration = Math.max(1, Math.min(210, Number(durationSeconds) || 10));
  const rate = Math.max(8000, Math.min(44100, Number(sampleRate) || 22050));
  const sampleCount = Math.floor(duration * rate);
  const pcm = Buffer.alloc(sampleCount * 2);
  for (let i = 0; i < sampleCount; i++) {
    const t = i / rate;
    const beat = (t % 0.48387) < 0.07 ? 0.20 : 0.04;
    const envelope = Math.min(1, t * 3, (duration - t) * 3);
    const chord = Math.sin(2 * Math.PI * frequency * t) * 0.42
      + Math.sin(2 * Math.PI * frequency * 1.1892 * t) * 0.22
      + Math.sin(2 * Math.PI * frequency * 1.4983 * t) * 0.16;
    const value = Math.max(-1, Math.min(1, (chord + beat * Math.sin(2 * Math.PI * 55 * t)) * envelope));
    pcm.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function browserWavBlob({ durationSeconds = 12, sampleRate = 22050 } = {}) {
  const rate = sampleRate;
  const count = Math.floor(durationSeconds * rate);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const env = Math.min(1, t * 2, (durationSeconds - t) * 2);
    const beat = (t % 0.484) < 0.06 ? 0.18 : 0;
    const wave = (Math.sin(2 * Math.PI * 196 * t) * 0.45 + Math.sin(2 * Math.PI * 233 * t) * 0.24 + beat) * env;
    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(wave * 32767))), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = makeSafeFilename(filename);
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function getLinesFromPrompt() {
  const entered = window.prompt('Enter lyrics/captions, one line per scene:', 'Twinkle, light the night\nDreams take flight\nMake something beautiful');
  if (entered === null) return [];
  return entered.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 100);
}

function saveOutputRecord(category, filename, details = {}) {
  try {
    const key = 'twinkle_local_outputs';
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    records.unshift({ category, filename, details, createdAt: new Date().toISOString(), storage: 'downloaded-to-device' });
    localStorage.setItem(key, JSON.stringify(records.slice(0, 100)));
  } catch { /* Private browsing may disable local storage; downloads still work. */ }
}

function canvasVideoBlob({ lines, durationSeconds = 12, title = 'TWINKLE Studio' }) {
  return new Promise((resolve, reject) => {
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) {
      reject(new Error('Video export needs a browser that supports Canvas capture and MediaRecorder. Try current Chrome or Edge.'));
      return;
    }
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) { stream.getTracks().forEach(track => track.stop()); reject(new Error('This browser does not expose a supported WebM encoder.')); return; }
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = []; let stopped = false; let frameId; const start = performance.now();
    recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
    recorder.onerror = () => { cancelAnimationFrame(frameId); stream.getTracks().forEach(track => track.stop()); reject(new Error('The browser video encoder failed.')); };
    recorder.onstop = () => { cancelAnimationFrame(frameId); stream.getTracks().forEach(track => track.stop()); resolve(new Blob(chunks, { type: mime })); };
    const draw = now => {
      const elapsed = (now - start) / 1000; const progress = Math.min(1, elapsed / durationSeconds);
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#0b0f17'); gradient.addColorStop(0.5, '#172b46'); gradient.addColorStop(1, '#24143d');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 70; i++) {
        const x = (i * 193 + elapsed * (12 + i % 9)) % canvas.width;
        const y = (i * 97 + Math.sin(elapsed + i) * 45 + canvas.height) % canvas.height;
        ctx.globalAlpha = 0.25 + (i % 5) * 0.12; ctx.fillStyle = i % 2 ? '#14f195' : '#38bdf8';
        ctx.beginPath(); ctx.arc(x, y, 1 + i % 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = '#14f195'; ctx.font = '600 24px Inter, sans-serif'; ctx.fillText(title.toUpperCase(), 640, 125);
      const lineIndex = Math.min(lines.length - 1, Math.floor(progress * lines.length));
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 48px Inter, sans-serif';
      wrapText(ctx, lines[lineIndex] || title, 640, 340, 1040, 60);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(100, 625, 1080, 5);
      ctx.fillStyle = '#14f195'; ctx.fillRect(100, 625, 1080 * progress, 5);
      ctx.fillStyle = '#94a3b8'; ctx.font = '18px Inter, sans-serif'; ctx.fillText(`SCENE ${lineIndex + 1} / ${lines.length}  •  ${Math.floor(elapsed)}s`, 640, 670);
      if (elapsed >= durationSeconds) { if (!stopped) { stopped = true; recorder.stop(); } return; }
      frameId = requestAnimationFrame(draw);
    };
    recorder.start(250); frameId = requestAnimationFrame(draw);
  });
}

function wrapText(ctx, text, centerX, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/); const lines = []; let line = '';
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, 3).forEach((item, index) => ctx.fillText(item, centerX, startY + index * lineHeight));
}

function addNotice() {
  if (document.getElementById('twinkle-production-notice')) return;
  const notice = document.createElement('div'); notice.id = 'twinkle-production-notice';
  notice.className = 'mx-4 my-3 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-xs text-amber-100';
  notice.innerHTML = '<strong>Local production mode:</strong> audio, video, captions and manuscript exports are generated in your browser and downloaded to this device. They are not uploaded to Google Drive. Account access and payment requests are demo-only until a server-side authentication, storage and payment-verification backend is connected.';
  document.querySelector('main')?.prepend(notice);
}

function setRenderButtonBusy(button, busy, label) {
  if (!button) return;
  if (busy) { button.dataset.originalText = button.textContent; button.disabled = true; button.textContent = label; button.classList.add('opacity-60', 'cursor-wait'); }
  else { button.disabled = false; button.textContent = button.dataset.originalText || label; button.classList.remove('opacity-60', 'cursor-wait'); }
}

async function renderPreset(category, baseName, button) {
  if (document.getElementById('user-profile-widget')?.classList.contains('hidden')) { alert('Please sign in to the local demo first.'); return; }
  setRenderButtonBusy(button, true, 'Generating… please keep this tab open');
  try {
    let filename; let blob; const details = {};
    if (category === 'audio') {
      const duration = Number(window.prompt('Audio duration in seconds (10–210):', '30'));
      if (!Number.isFinite(duration) || duration < 1) return;
      const safeDuration = Math.min(210, duration);
      blob = browserWavBlob({ durationSeconds: safeDuration }); filename = `${baseName}_${safeDuration}s.wav`;
      details.durationSeconds = safeDuration;
    } else if (category === 'lyric' || category === 'video') {
      const lines = getLinesFromPrompt(); if (!lines.length) return;
      const qualityId = category === 'lyric' ? 'lyric-quality-select' : 'mvideo-quality-select';
      const formatId = category === 'lyric' ? 'lyric-format-select' : 'mvideo-format-select';
      const requestedQuality = document.getElementById(qualityId)?.value || '1080p60';
      const chosenFormat = document.getElementById(formatId)?.value || 'mp4';
      if (chosenFormat !== 'webm' || requestedQuality !== '720p30') alert('This built-in browser renderer currently exports 720p at up to 30 fps in WebM. The selected preset is not applied; the filename and metadata will reflect the actual output.');
      blob = await canvasVideoBlob({ lines, durationSeconds: 12, title: category === 'lyric' ? 'TWINKLE Lyric Video' : 'TWINKLE Music Video' });
      filename = `${baseName}_720p30.webm`; details.actualResolution = '1280x720'; details.actualFrameRate = 30; details.requestedQuality = requestedQuality; details.format = 'webm';
      if (category === 'lyric') {
        const srt = new Blob([buildSrt(lines, 12)], { type: 'text/plain;charset=utf-8' });
        downloadBlob(srt, `${baseName}_captions.srt`);
      }
    } else if (category === 'longform') {
      const title = window.prompt('Manuscript / episode title:', 'Episode 3 — Equestrian Run');
      if (title === null) return;
      const body = window.prompt('Paste your manuscript or episode notes:', 'Write the story content here. This export preserves the text you provide; it does not generate a full AI screenplay.');
      if (body === null) return;
      blob = new Blob([`${title.trim()}\n${'='.repeat(Math.max(8, title.trim().length))}\n\n${body}\n\n---\nExported by TWINKLE Studio on ${new Date().toLocaleString()}\n`], { type: 'text/plain;charset=utf-8' });
      filename = `${baseName}.txt`; details.title = title.trim(); details.format = 'txt';
    } else throw new Error(`Unsupported export category: ${category}`);
    downloadBlob(blob, filename); saveOutputRecord(category, filename, details);
    alert(`Export generated and downloaded to this device:\n${filename}\n\nThis is a browser-generated local file, not a Google Drive upload.`);
  } catch (error) { alert(`Export could not be completed.\n${error.message || error}`); }
  finally { setRenderButtonBusy(button, false, 'Generate & Download'); }
}

function installProductionFeatures() {
  addNotice();
  document.querySelectorAll('button[onclick*="triggerEngineRender"]').forEach(button => {
    const action = button.getAttribute('onclick') || '';
    if (action.includes('triggerEngineRenderWithPreset')) {
      const match = action.match(/triggerEngineRenderWithPreset\('([^']+)',\s*'([^']+)'\)/);
      if (!match) return;
      const [, category, baseName] = match;
      button.textContent = category === 'lyric' ? 'Generate Lyric Video + SRT' : category === 'video' ? 'Generate Music Video' : 'Export Manuscript';
      button.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); void renderPreset(category, baseName, button); }, true);
    } else {
      button.textContent = 'Generate & Download WAV';
      button.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); void renderPreset('audio', 'SongNah_International_Master', button); }, true);
    }
    button.removeAttribute('onclick');
  });
  const authHint = document.querySelector('#form-landing form');
  if (authHint && !document.getElementById('twinkle-auth-warning')) {
    const warning = document.createElement('p'); warning.id = 'twinkle-auth-warning'; warning.className = 'text-[11px] text-amber-300 leading-relaxed';
    warning.textContent = 'Prototype sign-in only: the passkey is embedded in this static page and is not secure authentication. Do not use sensitive or real payment information.';
    authHint.appendChild(warning);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installProductionFeatures, { once: true });
  else installProductionFeatures();
}

// Node-side tests use a Buffer-backed implementation; browser code uses Blob and DataView.
export { browserWavBlob };
