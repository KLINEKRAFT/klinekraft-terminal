import { useEffect, useState } from 'react';
import { localJSON } from './WikiReader';

type CastState = { installed: boolean; active: boolean; state: string; name: string; fullscreen: boolean; pin: string };
export function ScreenCast() {
  const [receiver, setReceiver] = useState<CastState | null>(null);
  const [fullscreen, setFullscreen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const next = await localJSON('/api/casting', { signal: controller.signal });
        if (!controller.signal.aborted) { setReceiver(next); setError(''); }
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  async function change(start: boolean) {
    setBusy(true); setError('');
    try {
      setReceiver(await localJSON(`/api/casting/${start ? 'start' : 'stop'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: start ? JSON.stringify({ fullscreen }) : undefined,
      }));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="settings-panel" aria-label="Screen Cast">
    <h2>Screen Cast <small>· {receiver?.active ? 'Receiver on' : receiver ? 'Off' : 'Checking'}</small></h2>
    <p>Mirror your iPhone, iPad or Mac to <strong>Klinekraft Deck</strong>. Connect both devices to the same Wi-Fi, or join the deck’s hotspot.</p>
    {error && <p role="alert">{error}</p>}
    {receiver?.state === 'failed' && <p role="alert">Receiver stopped unexpectedly. Try starting again from the Pi desktop.</p>}
    <label><input type="checkbox" checked={fullscreen} disabled={busy || receiver?.active} onChange={e => setFullscreen(e.target.checked)} /> Fullscreen when mirroring starts</label>
    <button disabled={busy || !receiver?.installed} onClick={() => void change(!receiver?.active)}>{busy ? 'Working…' : receiver?.active ? 'Stop Screen Cast' : 'Start Screen Cast'}</button>
    {receiver?.active && <><p>On iPhone: <strong>Control Center → Screen Mirroring → Klinekraft Deck</strong>.</p><details><summary>Show pairing PIN</summary><code>{receiver.pin}</code></details><p>Receiver is running; a phone connection has not been confirmed. Stop Mirroring on your phone to return to Terminal. Stop Screen Cast here to turn off the receiver.</p></>}
    {receiver && !receiver.installed && <p>Screen Cast is not installed on this device.</p>}
    <details><summary>Compatibility & offline use</summary><p>Local photos, audio and screen mirroring can use a local network without internet. Online media needs internet. Protected streaming video may show a blank screen. This receives your screen; it does not control your phone or copy files. Audio uses the Pi’s selected output. Changing fullscreen requires stopping and restarting the receiver.</p></details>
  </section>;
}
