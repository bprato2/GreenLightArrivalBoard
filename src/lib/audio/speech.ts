/** SpeechSynthesis helpers for arrival announcements. */

function waitForVoices(synth: SpeechSynthesis, timeoutMs = 500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = synth.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }

    const onChange = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        synth.removeEventListener("voiceschanged", onChange);
        resolve(voices);
      }
    };

    synth.addEventListener("voiceschanged", onChange);
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", onChange);
      resolve(synth.getVoices());
    }, timeoutMs);
  });
}

export function speakAnnouncement(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    const synth = window.speechSynthesis;

    void waitForVoices(synth).then((voices) => {
      synth.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.pitch = 1;
      utter.volume = 1;
      utter.lang = "en-US";

      const preferred =
        voices.find((v) => /en-US/i.test(v.lang) && /Google|Microsoft|Samantha|Jenny/i.test(v.name)) ||
        voices.find((v) => /en-US/i.test(v.lang)) ||
        voices.find((v) => /^en/i.test(v.lang));
      if (preferred) utter.voice = preferred;

      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      synth.speak(utter);
    });
  });
}

export function buildThreeMinuteAnnouncement(headsign: string): string {
  const dest = headsign?.trim() || "Union Square";
  return `The next train to ${dest} is arriving in three minutes.`;
}

export function buildArrivingAnnouncement(headsign: string): string {
  const dest = headsign?.trim() || "Union Square";
  return `The next train to ${dest} is now arriving.`;
}

/** @deprecated Use buildThreeMinuteAnnouncement or buildArrivingAnnouncement */
export function buildArrivalAnnouncement(headsign: string): string {
  return buildArrivingAnnouncement(headsign);
}

/** Prime speech synthesis voices on kiosk boot. */
export function primeSpeechSynthesis(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  void waitForVoices(window.speechSynthesis);
}
