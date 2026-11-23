// Independent speech readers share one radio-duck lease per active owner.
const owners = new Set<symbol | string>();
export function setAudioFocus(owner: symbol | string, active: boolean) {
  if (active) owners.add(owner); else owners.delete(owner);
  window.dispatchEvent(new CustomEvent("klinekraft-voice-duck", { detail: owners.size > 0 }));
}
export function announceSpeech(owner: symbol) {
  window.dispatchEvent(new CustomEvent("klinekraft-speech-owner", { detail: owner }));
}
