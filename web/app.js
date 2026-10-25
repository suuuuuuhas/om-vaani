const $ = id => document.getElementById(id);
let session = null, config = null, recorder = null, stream = null, recordingTimer = null, recordStarted = 0;
let busy = false, lastRequest = null;
let speechQueue = Promise.resolve();
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: {...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...options.headers} });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Please check your input and try again.');
  return data;
}
function notice(message, error = false) { $('chat-notice').hidden = false; $('chat-notice').className = 'notice' + (error ? ' error' : ''); $('chat-notice').textContent = message; }
function bubble(text, role = 'assistant', audio = null) {
  const div = document.createElement('div'); div.className = 'bubble ' + role; div.textContent = text;
  if (audio) { const player = document.createElement('audio'); player.controls = true; player.src = audio; player.preload = 'none'; div.append(player); }
  $('conversation').append(div); $('conversation').scrollTop = $('conversation').scrollHeight;
  return div;
}
function setBusy(value) { busy = value; for (const id of ['send','record','upload','restart']) $(id).disabled = value; $('send').textContent = value ? 'Preparing reply…' : 'Send message ↑'; }
function showRetry(error) { notice(error.message + ' Your message has been kept. Use Retry last message.', true); const retry = document.createElement('button'); retry.id = 'retry'; retry.type = 'button'; retry.className = 'secondary'; retry.textContent = 'Retry last message'; retry.addEventListener('click', retryLast); $('chat-notice').append(document.createElement('br'), retry); }
function attachSpeech(result, container) {
  const currentSession = {...session};
  const status = document.createElement('span'); status.className = 'micro voice-status'; status.setAttribute('role','status');
  const retry = document.createElement('button'); retry.type='button'; retry.className='secondary'; retry.textContent='Retry voice reply';
  const active = () => session?.session_id === currentSession.session_id && container.isConnected;
  async function load() {
    if (!active()) return;
    retry.remove(); status.textContent='Preparing voice reply…';
    try {
      const data=await api(`/api/sessions/${currentSession.session_id}/speech`,{
        method:'POST', headers:{Authorization:'Bearer '+currentSession.access_token},
        body:JSON.stringify({request_id:result.speech_request_id || null})});
      if (!active()) return;
      const audio=document.createElement('audio'); audio.controls=true; audio.preload='none'; audio.src=data.reply_audio_url;
      container.append(audio); status.remove();
    } catch(error) {
      if (!active()) return;
      status.textContent='Voice reply unavailable. '+error.message; container.append(retry);
    }
  }
  function enqueue() {
    retry.remove(); status.textContent='Preparing voice reply…';
    speechQueue = speechQueue.catch(()=>{}).then(load);
  }
  retry.addEventListener('click',enqueue); container.append(status);
  if (result.speech_pending) enqueue();
  else { status.textContent='Voice reply unavailable. '; container.append(retry); }
}
function handleResult(result, audioInput = false) {
  if (audioInput && result.transcript) { const transcript=document.createElement('div');transcript.className='notice transcript';transcript.textContent='Recognised speech: '+result.transcript;$('conversation').append(transcript); }
  const replyBubble = bubble(result.reply_text, 'assistant', result.reply_audio_url);
  if (result.warnings.length) notice(result.warnings.join(' ')); else notice(`Reply received in ${(result.latency_ms / 1000).toFixed(1)}s.`);
  if (!result.reply_audio_url) attachSpeech(result, replyBubble);
  if (result.short_code) {
    const link = document.createElement('a'); link.href = '/status?code=' + encodeURIComponent(result.short_code); link.textContent = 'Open your saved draft →'; link.className = 'btn'; $('conversation').append(link);
  }
  if (result.is_complete) { $('message-form').hidden = true; notice('Your draft is ready to submit. Review it on the status page before sending it yourself.'); }
}
async function sendTurn(body, audio = false) {
  setBusy(true); $('chat-notice').hidden = true;
  const requestId = crypto.randomUUID();
  let requestBody;
  if (audio) { requestBody = new FormData(); requestBody.append('audio', body, 'recording.' + (body.type.includes('ogg') ? 'ogg' : body.type.includes('mp4') ? 'm4a' : 'webm')); requestBody.append('request_id', requestId); requestBody.append('defer_speech','true'); }
  else requestBody = JSON.stringify({text:body, request_id:requestId, defer_speech:true});
  lastRequest = {url:`/api/sessions/${session.session_id}/${audio ? 'audio' : 'turn'}`, body:requestBody, audioInput:audio};
  try { handleResult(await api(lastRequest.url, {method:'POST', headers:{Authorization:'Bearer ' + session.access_token}, body:requestBody}), audio); lastRequest = null; }
  catch (error) { showRetry(error); }
  finally { setBusy(false); }
}
async function retryLast() {
  if (!lastRequest || busy) return;
  setBusy(true);
  try { const result = await api(lastRequest.url, {method:'POST', headers:{Authorization:'Bearer ' + session.access_token}, body:lastRequest.body}); const audioInput=lastRequest.audioInput; lastRequest=null; handleResult(result,audioInput); }
  catch(error) { showRetry(error); }
  finally { setBusy(false); }
}
$('start-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try { session = await api('/api/sessions', {method:'POST', body:JSON.stringify({phone:$('phone').value,language:$('language').value,consent:$('consent').checked})}); $('start-form').hidden=true; $('chat').hidden=false; bubble(session.reply_text); $('message').focus(); }
  catch(error) { $('connection').className='notice error'; $('connection').textContent=error.message; }
  finally { button.disabled=false; }
});
$('message-form').addEventListener('submit', async event => { event.preventDefault(); const text = $('message').value.trim(); if (!text || busy || recorder?.state === 'recording') return; bubble(text,'user'); $('message').value=''; await sendTurn(text); });
$('restart').addEventListener('click', () => { session=null; lastRequest=null; $('conversation').replaceChildren(); $('start-form').hidden=false; $('chat').hidden=true; $('message-form').hidden=false; $('chat-notice').hidden=true; $('phone').value='';$('consent').checked=false; });
$('upload').addEventListener('click', () => $('audio-file').click());
$('audio-file').addEventListener('change', async () => { const file = $('audio-file').files[0]; if (!file) return; if (file.size > (config?.max_audio_bytes || 10 * 1024 * 1024)) return notice('This audio file is too large. Try a shorter recording.',true); bubble('Voice note: ' + file.name,'user'); await sendTurn(file,true); $('audio-file').value=''; });
function stopRecording() { if (recorder && recorder.state === 'recording') recorder.stop(); clearInterval(recordingTimer); $('record').classList.remove('recording'); $('record').textContent='● Record voice'; }
$('record').addEventListener('click', async () => {
  if (recorder?.state === 'recording') return stopRecording();
  if (!navigator.mediaDevices || !window.MediaRecorder) return notice('This browser cannot record audio here. Upload a voice note instead.', true);
  for (const id of ['send','upload','restart','record']) $(id).disabled=true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio:true});
    const mimeType = ['audio/ogg;codecs=opus','audio/webm;codecs=opus','audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, mimeType ? {mimeType} : {}); const parts=[];
    recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
    recorder.onstop = async () => { stream.getTracks().forEach(track => track.stop()); const blob = new Blob(parts, {type:recorder.mimeType}); bubble('Voice recording','user'); await sendTurn(blob,true); $('record-status').textContent='Voice clips: up to 60 seconds.'; };
    recorder.start(); recordStarted=Date.now(); $('record').disabled=false; $('record').textContent='■ Stop & send'; $('record').classList.add('recording');
    recordingTimer=setInterval(() => { const seconds=Math.floor((Date.now()-recordStarted)/1000); $('record-status').textContent=`Recording ${seconds}s / 55s. Tap Stop & send when ready.`; if(seconds>=55) stopRecording(); },250);
  } catch(error) { stream?.getTracks().forEach(track=>track.stop()); setBusy(false); notice('Microphone access was unavailable. You can type or upload a voice note.',true); }
});
api('/api/config').then(data => { config=data; for (const language of data.languages) { const option=document.createElement('option'); option.value=language.code; option.textContent=language.native + ' · ' + language.name; $('language').append(option); } $('language').value=data.default_language; $('connection').textContent=data.ready ? (data.voice_ready ? 'Keys configured. Choose a language and begin.' : 'Gemini key configured. Voice needs both Prisma STT and Timbre TTS keys.') : 'API setup is pending. You can explore the page; conversations need a Gemini key.'; if(data.whatsapp_url) { $('whatsapp').href=data.whatsapp_url; $('whatsapp').textContent='Chat on WhatsApp ↗'; $('whatsapp-note').textContent='Or try the voice and text assistant here.'; } }).catch(()=> { $('connection').textContent='The server could not be reached. Refresh to retry.'; });
