"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cleanMdxForSpeech } from "@/lib/tts/cleaner";
import { Button } from "@/components/ui/button";

type AudioArticlePlayerProps = {
  title: string;
  contentMdx: string;
  className?: string;
};

export function AudioArticlePlayer({ title, contentMdx, className = "" }: AudioArticlePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isSupported] = useState<boolean>(() => typeof window === "undefined" || "speechSynthesis" in window);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Compute clean text and duration synchronously
  const { cleanText, totalSeconds } = useMemo(() => {
    const text = cleanMdxForSpeech(contentMdx);
    const fullText = `${title}. ${text}`;
    const words = fullText.split(/\s+/).filter(Boolean).length;
    const duration = Math.max(10, Math.round((words / 150) * 60));
    return { cleanText: fullText, totalSeconds: duration };
  }, [title, contentMdx]);

  // Load available voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    function loadVoices() {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        // Default to first English voice if available, else first voice
        const englishIndex = availableVoices.findIndex((v) => v.lang.startsWith("en"));
        setSelectedVoiceIndex(englishIndex >= 0 ? englishIndex : 0);
      }
    }

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  function handleStop() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setProgressPercent(0);
  }

  // Sync timer during playback
  useEffect(() => {
    if (isPlaying && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const effectiveDuration = totalSeconds / playbackRate;
          const next = prev + 1;
          const pct = Math.min(100, Math.round((next / effectiveDuration) * 100));
          setProgressPercent(pct);
          if (next >= effectiveDuration) {
            handleStop();
            return 0;
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isPaused, totalSeconds, playbackRate]);

  function handlePlay() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      // Fallback simulation mode
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }

    if (isPaused && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel(); // Stop any active audio

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = playbackRate;
    if (voices[selectedVoiceIndex]) {
      utterance.voice = voices[selectedVoiceIndex];
    }

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgressPercent(100);
    };

    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  }

  function handlePause() {
    if (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
    setIsPaused(true);
    setIsPlaying(false);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const newPercent = Number(e.target.value);
    setProgressPercent(newPercent);
    const effectiveDuration = totalSeconds / playbackRate;
    const newElapsed = Math.round((newPercent / 100) * effectiveDuration);
    setElapsedSeconds(newElapsed);

    if (isPlaying) {
      handlePlay();
    }
  }

  function handleRateChange(rate: number) {
    setPlaybackRate(rate);
    if (isPlaying) {
      // Restart speech with new rate
      handlePlay();
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-card/90 via-card/70 to-card/90 p-5 shadow-lg backdrop-blur-xl transition-all hover:border-primary/30 hover:shadow-xl ${className}`}
      aria-label="Text-to-Speech Article Player"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Article Title & Status */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            {isPlaying ? (
              // Equalizer Animated Icon
              <div className="flex items-end justify-center gap-[3px] h-4">
                <span className="w-1 bg-current rounded-full animate-[bounce_0.6s_infinite_100ms] h-full" />
                <span className="w-1 bg-current rounded-full animate-[bounce_0.6s_infinite_300ms] h-3" />
                <span className="w-1 bg-current rounded-full animate-[bounce_0.6s_infinite_200ms] h-4" />
                <span className="w-1 bg-current rounded-full animate-[bounce_0.6s_infinite_400ms] h-2" />
              </div>
            ) : (
              <svg className="h-5 w-5 fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Audio Narration (TTS)
              </span>
              {!isSupported ? (
                <span className="rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                  Simulation Mode
                </span>
              ) : null}
            </div>
            <p className="text-xs font-semibold text-foreground line-clamp-1">
              Listen to article: {title}
            </p>
          </div>
        </div>

        {/* Right: Controls & Speed Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {!isPlaying ? (
            <Button
              type="button"
              size="sm"
              onClick={handlePlay}
              className="gap-1.5 rounded-xl font-medium text-xs shadow-sm"
              aria-label="Play audio narration"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>{isPaused ? "Resume" : "Listen Now"}</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handlePause}
              className="gap-1.5 rounded-xl text-xs"
              aria-label="Pause audio narration"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              <span>Pause</span>
            </Button>
          )}

          {isPlaying || isPaused ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleStop}
              className="rounded-xl text-xs text-muted-foreground hover:text-foreground"
              aria-label="Stop audio narration"
            >
              Stop
            </Button>
          ) : null}

          {/* Speed Selector */}
          <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 text-[11px] font-medium">
            {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => handleRateChange(rate)}
                className={`rounded-lg px-2 py-0.5 transition ${
                  playbackRate === rate
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Voice dropdown if multiple voices exist */}
          {voices.length > 1 ? (
            <select
              value={selectedVoiceIndex}
              onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}
              className="max-w-32 rounded-xl border border-border/80 bg-background px-2 py-1 text-[11px] font-medium text-foreground focus:outline-none"
              aria-label="Select voice"
            >
              {voices.map((voice, idx) => (
                <option key={voice.name + idx} value={idx}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {/* Seek Progress Bar & Time Stamps */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">
          {formatTime(elapsedSeconds)}
        </span>
        <div className="relative flex-1">
          <input
            type="range"
            min="0"
            max="100"
            value={progressPercent}
            onChange={handleSeek}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary transition"
            aria-label="Seek audio position"
          />
        </div>
        <span className="text-[11px] font-mono text-muted-foreground w-10">
          {formatTime(totalSeconds / playbackRate)}
        </span>
      </div>
    </div>
  );
}
