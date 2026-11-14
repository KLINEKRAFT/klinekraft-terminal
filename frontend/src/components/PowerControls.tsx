import { useEffect, useState } from 'react';
import { localJSON } from './WikiReader';
type Power = {field:boolean;percent:number|null;voltage:number|null;warning:string|null;reserveMinutes:number|null;guard:{externalPower?:boolean|null;shutdownSeconds:number|null;valid:boolean}|null};
export function PowerControls(){
  const [power,setPower]=useState<Power|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    const refresh=async()=>{try{const p=await localJSON('/api/power',{signal:controller.signal});if(!controller.signal.aborted)setPower(p);}catch{/* Unsupported preview hosts have no power controls. */}};
    void refresh();const timer=setInterval(()=>void refresh(),10000);
    return()=>{controller.abort();clearInterval(timer);document.documentElement.classList.remove('field-mode');};
  },[]);
  useEffect(()=>{document.documentElement.classList.toggle('field-mode',!!power?.field);},[power?.field]);
  async function toggle(){setBusy(true);setError('');try{setPower(await localJSON('/api/power/field',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!power?.field})}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if(!power)return null;
  return <div className="power-controls">
    <button disabled={busy} aria-pressed={power.field} onClick={()=>void toggle()}>{busy?'Changing…':`Field mode: ${power.field?'On':'Off'}`}</button>
    <span>{power.percent==null?'Battery unavailable':`${power.percent.toFixed(0)}% battery`} · {power.guard?.externalPower?'External power':power.reserveMinutes==null?'Estimating discharge…':`~${Math.floor(power.reserveMinutes/60)}h ${power.reserveMinutes%60}m to 15% reserve`}</span>
    <details><summary>Power details</summary><p>Field mode visually dims Terminal and stops AirPlay and the idle AI model. Offline AI wakes when asked and sleeps after two idle minutes. Maps and references stay available. Start AirPlay manually when needed. Visual dimming does not reduce the display backlight.</p><p>Runtime uses the last 10–30 minutes of declining charge; charging or unstable readings reset it. It is not a guarantee.</p><p>{power.guard?'Battery guard active: sustained ≤8% with ≤3.60 V, or ≤3.35 V, followed by a 60-second shutdown countdown. Reconnect power to recover. Physical shutdown/restart still needs a controlled test.':'Battery shutdown guard unavailable — do not rely on automatic protection.'}</p></details>
    {error&&<p role="alert">{error}</p>}
    {power.warning&&<p role="alert"><strong>{power.warning==='critical'?'Very low battery':'Low battery'}: {power.percent?.toFixed(0)}%.</strong> Save your work and connect power.</p>}
    {power.guard?.shutdownSeconds!=null&&<p role="alert"><strong>Battery protection: shutdown in about {power.guard.shutdownSeconds} seconds.</strong> Connect power now. Recovery cancels the countdown.</p>}
  </div>;
}
