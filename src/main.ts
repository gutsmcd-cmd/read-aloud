import './style.css'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

type Lang = 'ja' | 'en'
const T = {
  ja: {
    app: '読みきかせ', big: '大きい文字', lead: '文章・PDF・ウェブページを、声で読み上げます。',
    paste: '貼りつける', pdf: 'PDFを開く', edit: '文章を直す', wipe: '消す',
    play: '▶ 読む', pause: '❚❚ 一時停止', resume: '▶ つづきから', stop: '■ 止める',
    speed: '速さ', voice: '声', auto: '自動（文章に合わせる）',
    placeholder: 'ここに文章を貼りつけるか、入力してください。\n\nほかのアプリ（ブラウザなど）の「共有」から、この「読みきかせ」を選んで送ることもできます（ホーム画面に追加したとき）。',
    note: 'スマホに入っている声を使うので、電波がなくても読めます。文章はどこにも送りません。文をタップすると、そこから読みます。',
    empty: '先に文章を入れてください。', pasteFail: '貼りつけできませんでした。文章の欄を長押しして「貼り付け」を選んでください。',
    loadingPdf: 'PDFを読みこんでいます…', pdfFail: 'このPDFから文字を取り出せませんでした（写真だけのPDFかもしれません）。',
    fetching: 'ページを読みこんでいます…', fetched: 'ページの文章を取り出しました。',
    blocked: 'このページは、ほかのアプリから読みこめないようになっています。\n\nページを開いて、読みたい文章を選んでコピーし、ここに貼りつけるか、文章を選んで「共有」→「読みきかせ」で送ってください。',
    noVoice: 'この端末では読み上げの声が見つかりませんでした。端末の設定で「テキスト読み上げ」を確認してください。',
  },
  en: {
    app: 'Read Aloud', big: 'Large text', lead: 'Your phone reads text, PDFs and web pages out loud.',
    paste: 'Paste', pdf: 'Open a PDF', edit: 'Edit text', wipe: 'Clear',
    play: '▶ Read', pause: '❚❚ Pause', resume: '▶ Carry on', stop: '■ Stop',
    speed: 'Speed', voice: 'Voice', auto: 'Automatic (match the text)',
    placeholder: 'Paste or type text here.\n\nYou can also tap “Share” in another app (like your browser) and pick “Read Aloud” (after adding it to your home screen).',
    note: 'Uses the voices already on your phone, so it works with no signal. Your text is never sent anywhere. Tap a sentence to read from there.',
    empty: 'Please add some text first.', pasteFail: 'Could not paste. Long-press the text box and choose “Paste”.',
    loadingPdf: 'Opening the PDF…', pdfFail: 'Could not get any text from this PDF (it may be pictures only).',
    fetching: 'Loading the page…', fetched: 'Got the text from the page.',
    blocked: 'This website doesn’t let other apps load it.\n\nOpen the page, select the text you want, copy it and paste it here — or select it and tap “Share” → “Read Aloud”.',
    noVoice: 'No reading voices were found on this device. Check “Text-to-speech” in your phone settings.',
  },
}
type Key = keyof typeof T.ja
let lang: Lang = (localStorage.getItem('ra-lang') as Lang) || 'ja'
const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E
const t = (k: Key) => T[lang][k]
const text = $<HTMLTextAreaElement>('text'), reader = $('reader'), playBtn = $('play')
const voiceSel = $<HTMLSelectElement>('voice'), rate = $<HTMLInputElement>('rate')
const synth = window.speechSynthesis

function msg(s: string | null) { const m = $('msg'); m.hidden = !s; m.textContent = s ?? '' }

// ----- language + large text -----
function applyLang() {
  document.documentElement.lang = lang
  document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t as Key)))
  $('lang').textContent = lang === 'ja' ? 'English' : '日本語'
  text.placeholder = t('placeholder')
  document.title = lang === 'ja' ? '読みきかせ' : 'Read Aloud'
  fillVoices(); setPlayLabel()
}
$('lang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; localStorage.setItem('ra-lang', lang); applyLang() }
const big = $('big')
if (localStorage.getItem('ra-big') === '1') { document.documentElement.classList.add('big'); big.setAttribute('aria-pressed', 'true') }
big.onclick = () => { const on = document.documentElement.classList.toggle('big'); big.setAttribute('aria-pressed', String(on)); localStorage.setItem('ra-big', on ? '1' : '0') }

// ----- voices -----
let voices: SpeechSynthesisVoice[] = []
function fillVoices() {
  voices = (synth?.getVoices() ?? []).filter((v) => /^(ja|en)/i.test(v.lang))
  const keep = voiceSel.value || localStorage.getItem('ra-voice') || ''
  voiceSel.innerHTML = ''
  voiceSel.add(new Option(t('auto'), ''))
  for (const v of voices) voiceSel.add(new Option(`${v.lang.startsWith('ja') ? '日本語' : 'English'} — ${v.name}`, v.voiceURI))
  voiceSel.value = voices.some((v) => v.voiceURI === keep) ? keep : ''
}
synth?.addEventListener?.('voiceschanged', fillVoices)
voiceSel.onchange = () => localStorage.setItem('ra-voice', voiceSel.value)
rate.value = localStorage.getItem('ra-rate') || '1'
const showRate = () => ($('rateVal').textContent = Number(rate.value).toFixed(1))
rate.oninput = () => { showRate(); localStorage.setItem('ra-rate', rate.value); if (state === 'playing') { synth.cancel(); speakFrom(idx) } }
showRate()

const isJa = (s: string) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(s)
function pickVoice(s: string): SpeechSynthesisVoice | undefined {
  if (voiceSel.value) return voices.find((v) => v.voiceURI === voiceSel.value)
  const want = isJa(s) ? 'ja' : 'en'
  return voices.find((v) => v.lang.toLowerCase().startsWith(want) && v.localService) ?? voices.find((v) => v.lang.toLowerCase().startsWith(want))
}

// ----- sentences -----
export function splitSentences(s: string): string[] {
  const out: string[] = []
  const re = /[^。！？!?.\n]*(?:[。！？!?]+|\.(?=\s|$)|\n+|$)/g
  for (const m of s.matchAll(re)) { if (m[0]) out.push(m[0]) }
  // merge pieces that are only whitespace into previous
  return out.reduce<string[]>((a, p) => { if (!p.trim() && a.length) a[a.length - 1] += p; else a.push(p); return a }, [])
}

let sentences: string[] = [], idx = 0, state: 'idle' | 'playing' | 'paused' = 'idle'
function setPlayLabel() { playBtn.textContent = state === 'playing' ? t('pause') : state === 'paused' ? t('resume') : t('play') }

function buildReader() {
  sentences = splitSentences(text.value)
  reader.innerHTML = ''
  sentences.forEach((s, i) => {
    const sp = document.createElement('span'); sp.textContent = s
    sp.onclick = () => { synth.cancel(); speakFrom(i) }
    reader.appendChild(sp)
  })
  text.hidden = true; reader.hidden = false; $('edit').hidden = false
}
function highlight(i: number) {
  reader.querySelectorAll('span.now').forEach((e) => e.classList.remove('now'))
  const sp = reader.children[i] as HTMLElement | undefined
  if (sp) { sp.classList.add('now'); sp.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }
}

let token = 0
function speakFrom(i: number) {
  const my = ++token
  idx = i
  while (idx < sentences.length && !sentences[idx].trim()) idx++
  if (idx >= sentences.length) { state = 'idle'; setPlayLabel(); highlight(-1); idx = 0; return }
  state = 'playing'; setPlayLabel(); highlight(idx)
  const u = new SpeechSynthesisUtterance(sentences[idx].trim())
  const v = pickVoice(sentences[idx]); if (v) { u.voice = v; u.lang = v.lang } else u.lang = isJa(sentences[idx]) ? 'ja-JP' : 'en-US'
  u.rate = Number(rate.value)
  u.onend = () => { if (my === token && state === 'playing') speakFrom(idx + 1) }
  u.onerror = (e) => { if (my === token && state === 'playing' && e.error !== 'interrupted' && e.error !== 'canceled') speakFrom(idx + 1) }
  synth.speak(u)
}

playBtn.onclick = () => {
  if (!synth) return msg(t('noVoice'))
  if (state === 'playing') { state = 'paused'; token++; synth.cancel(); setPlayLabel(); return }
  if (state === 'paused') { speakFrom(idx); return }
  if (!text.value.trim()) return msg(t('empty'))
  msg(null); if (reader.hidden) buildReader(); speakFrom(0)
}
function stop() { state = 'idle'; token++; synth?.cancel(); idx = 0; setPlayLabel(); highlight(-1) }
$('stop').onclick = stop
$('edit').onclick = () => { stop(); reader.hidden = true; text.hidden = false; $('edit').hidden = true; text.focus() }
$('wipe').onclick = () => { stop(); text.value = ''; reader.hidden = true; text.hidden = false; $('edit').hidden = true; msg(null) }
function setText(s: string) { stop(); text.value = s.replace(/\n{3,}/g, '\n\n').trim(); reader.hidden = true; text.hidden = false; $('edit').hidden = true; buildReader() }

$('paste').onclick = async () => {
  try { const s = await navigator.clipboard.readText(); if (s) { setText(s); msg(null) } } catch { msg(t('pasteFail')) }
}

// ----- PDF / txt -----
export async function pdfToText(data: ArrayBuffer): Promise<string> {
  const doc = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent()
    let line = '', out = ''
    for (const it of c.items as { str: string; hasEOL?: boolean }[]) {
      line += it.str
      if (it.hasEOL) { out += line + '\n'; line = '' }
    }
    pages.push(out + line)
  }
  // join lines broken mid-sentence
  return pages.join('\n\n').replace(/([^\n。！？.!?])\n(?!\n)/g, (_m, a: string) => (isJa(a) ? a : a + ' '))
}
$<HTMLInputElement>('pdf').onchange = async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  if (f.type.startsWith('text/') || f.name.endsWith('.txt')) { setText(await f.text()); return }
  msg(t('loadingPdf'))
  try { const s = await pdfToText(await f.arrayBuffer()); if (!s.trim()) throw 0; setText(s); msg(null) } catch { msg(t('pdfFail')) }
  ;(e.target as HTMLInputElement).value = ''
}

// ----- web pages -----
export function htmlToText(html: string): string {
  const d = new DOMParser().parseFromString(html, 'text/html')
  d.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,iframe,svg,button').forEach((n) => n.remove())
  const root = d.querySelector('article') || d.querySelector('main') || d.body
  const title = d.querySelector('h1')?.textContent?.trim() || d.title.trim()
  const parts = [...root.querySelectorAll('h1,h2,h3,p,li,blockquote')].map((n) => n.textContent!.replace(/\s+/g, ' ').trim()).filter((s) => s.length > 1)
  const body = parts.length ? parts : [root.textContent!.replace(/\s+/g, ' ').trim()]
  if (title && body[0] !== title) body.unshift(title)
  return body.join('\n')
}
async function loadUrl(url: string) {
  msg(t('fetching'))
  try {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!r.ok) throw 0
    const type = r.headers.get('content-type') || ''
    if (type.includes('pdf')) { setText(await pdfToText(await r.arrayBuffer())); msg(t('fetched')); return }
    const s = htmlToText(await r.text()); if (s.length < 20) throw 0
    setText(s); msg(t('fetched'))
  } catch { msg(t('blocked') + '\n\n' + url) }
}

// ----- share target -----
const q = new URLSearchParams(location.search)
const sharedText = q.get('text') || '', sharedUrl = q.get('url') || ''
const urlInText = sharedText.match(/https?:\/\/\S+/)?.[0]
if (sharedText || sharedUrl || q.get('title')) {
  history.replaceState(null, '', location.pathname)
  const onlyUrl = !sharedText.replace(urlInText ?? '', '').trim()
  if (sharedText && !onlyUrl) setText(sharedText)
  else if (sharedUrl || urlInText) loadUrl(sharedUrl || urlInText!)
  else setText(q.get('title') || '')
}

applyLang()
if (!synth) msg(t('noVoice'))
