/** SpeechSynthesis helpers for arrival announcements. */

let speechPrimed = false;

function waitForVoices(synth: SpeechSynthesis, timeoutMs = 2500): Promise<SpeechSynthesisVoice[]> {
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

export function isSpeechUnlocked(): boolean {
  return speechPrimed;
}

/**
 * Call from a user-gesture handler. iOS Safari blocks SpeechSynthesis until
 * speak() has run once inside a gesture — and that utterance must not be
 * cancelled immediately (cancel() undoes the unlock).
 */
export function unlockSpeechSynthesis(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (speechPrimed) return;

  const synth = window.speechSynthesis;

  try {
    synth.resume();
  } catch {
    /* ignore */
  }

  try {
    // Near-silent, not volume 0 — some iOS versions ignore fully muted unlocks.
    const unlock = new SpeechSynthesisUtterance(" ");
    unlock.volume = 0.01;
    unlock.rate = 10;
    unlock.lang = "en-US";
    synth.speak(unlock);
    // iOS unlocks on the gesture-scoped speak() itself — do not cancel.
    speechPrimed = true;
  } catch {
    speechPrimed = false;
  }
}

export function speakAnnouncement(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    const synth = window.speechSynthesis;

    void waitForVoices(synth).then((voices) => {
      try {
        synth.resume();
      } catch {
        /* ignore */
      }

      // iOS often drops speak() if it follows cancel() in the same turn.
      synth.cancel();

      const startSpeak = () => {
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

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearInterval(watchdog);
          resolve();
        };

        // iOS / some WebViews leave speechSynthesis.paused stuck; nudge resume.
        const watchdog = window.setInterval(() => {
          if (synth.speaking && synth.paused) {
            try {
              synth.resume();
            } catch {
              /* ignore */
            }
          }
        }, 250);

        utter.onstart = () => {
          speechPrimed = true;
        };
        utter.onend = () => finish();
        utter.onerror = () => finish();
        window.setTimeout(finish, Math.max(8000, text.length * 120));

        synth.speak(utter);
      };

      window.setTimeout(startSpeak, 40);
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
