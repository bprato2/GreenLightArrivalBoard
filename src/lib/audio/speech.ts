/** SpeechSynthesis helpers for arrival announcements. */

export function speakAnnouncement(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.volume = 1;
    utter.lang = "en-US";

    const voices = synth.getVoices();
    const preferred =
      voices.find((v) => /en-US/i.test(v.lang) && /Google|Microsoft|Samantha|Jenny/i.test(v.name)) ||
      voices.find((v) => /en-US/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang));
    if (preferred) utter.voice = preferred;

    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    synth.speak(utter);
  });
}

export function buildThreeMinuteAnnouncement(headsign: string): string {
  const dest = headsign?.trim() || "Government Center";
  return `The next train to ${dest} is arriving in three minutes.`;
}

export function buildArrivingAnnouncement(headsign: string): string {
  const dest = headsign?.trim() || "Government Center";
  return `The next train to ${dest} is now arriving.`;
}

/** @deprecated Use buildThreeMinuteAnnouncement or buildArrivingAnnouncement */
export function buildArrivalAnnouncement(headsign: string): string {
  return buildArrivingAnnouncement(headsign);
}
