
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ sockets: [] as unknown[] }));
vi.mock('ws', async () => {
 const { EventEmitter } = await import('node:events');
 class Socket extends EventEmitter {
  static OPEN = 1; static CONNECTING = 0; readyState = 1; bufferedAmount = 0;
  send = vi.fn(); close() { this.readyState = 3; this.emit('close'); }
  constructor() { super(); state.sockets.push(this); }
 }
 return { default: Socket };
});
vi.mock('@/lib/ai/triage-service', () => ({triageGrievance: vi.fn().mockResolvedValue({data:{},mode:'ai'})}));
import WebSocket from 'ws';
import { startVoiceSession } from '@/lib/voice/stream-session';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); state.sockets.length = 0; });
it('does not discard a finalized transcript when another speech-start event arrives', async () => {
 vi.useFakeTimers();
 const fetchMock = vi.fn().mockResolvedValue(new Response(null,{status:503})); vi.stubGlobal('fetch',fetchMock);
 const client = new WebSocket('ws://test'); startVoiceSession(client);
 client.emit('message',Buffer.from(JSON.stringify({type:'start'})),false);
 const stt = state.sockets[1] as WebSocket;
 stt.emit('message',Buffer.from(JSON.stringify({type:'transcript',text:'The streetlight has been broken for two weeks.',detected_language_code:'en-IN'})));
 stt.emit('message',Buffer.from(JSON.stringify({type:'speech_start'})));
 await vi.advanceTimersByTimeAsync(200);
 expect(fetchMock).toHaveBeenCalledTimes(1);
 expect(String(fetchMock.mock.calls[0][0])).toContain('gemini-3.5-flash-lite:');

 const sent = (client.send as ReturnType<typeof vi.fn>).mock.calls.map(args=>JSON.parse(args[0]));
 expect(sent.some(e=>e.type==='user_final')).toBe(true);
 expect(sent.some(e=>e.type==='thinking')).toBe(true);
 expect(sent.some(e=>e.type==='model_fallback')).toBe(false);
 client.close();
});





it('reports a stalled speech stream instead of waiting forever', async () => {
 vi.useFakeTimers();
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('data: {"candidates":[{"content":{"parts":[{"text":"I understand the streetlight is broken. Where is it located?"}]}}]}\n\n', {status:200})));
 const client = new WebSocket('ws://test'); startVoiceSession(client);
 client.emit('message',Buffer.from(JSON.stringify({type:'start',textOnly:true})),false);
 client.emit('message',Buffer.from(JSON.stringify({type:'text',text:'The streetlight has been broken for two weeks.'})),false);
 await vi.advanceTimersByTimeAsync(20);
 const tts = state.sockets[1] as WebSocket; tts.emit('open');
 await vi.advanceTimersByTimeAsync(10050);
 const sent = (client.send as ReturnType<typeof vi.fn>).mock.calls.map(args=>JSON.parse(args[0]));
 expect(sent.some(e=>e.type==='error' && e.code==='voice_unavailable')).toBe(true);
 expect(sent.some(e=>e.type==='response_complete')).toBe(false);
 client.close();
});
