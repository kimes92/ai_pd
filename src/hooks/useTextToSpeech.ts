import { useState, useEffect, useCallback, useRef } from 'react';

export function useTextToSpeech() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [totalSentences, setTotalSentences] = useState(0);
  const [progress, setProgress] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState(1);

  const sentencesRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  // 음성 목록 초기화
  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const voices = synth.getVoices();
      const koVoices = voices.filter(v => v.lang.includes('ko'));
      // 한국어 음성이 없으면 모든 음성 표시
      const available = koVoices.length > 0 ? koVoices : voices;
      setAvailableVoices(available);
      if (available.length > 0 && !selectedVoice) {
        setSelectedVoice(available[0]);
      }
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    return () => {
      synth.onvoiceschanged = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 문장 분리 (한국어 기준)
  const parseSentences = (text: string): string[] => {
    // 마침표, 느낌표, 물음표, 줄바꿈으로 분리
    const raw = text.split(/(?<=[.!?。\n])\s*/);
    return raw.filter(s => s.trim().length > 0).map(s => s.trim());
  };

  // 특정 문장 읽기
  const playSentence = useCallback((index: number) => {
    const synth = window.speechSynthesis;

    if (index >= sentencesRef.current.length) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setProgress(100);
      return;
    }

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(sentencesRef.current[index]);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = rate;
    utterance.lang = 'ko-KR';

    utterance.onstart = () => {
      setCurrentSentenceIndex(index);
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsPaused(false);
      setProgress(Math.round((index / sentencesRef.current.length) * 100));
    };

    utterance.onend = () => {
      if (isPlayingRef.current && index + 1 < sentencesRef.current.length) {
        playSentence(index + 1);
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
        if (index + 1 >= sentencesRef.current.length) {
          setProgress(100);
        }
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') {
        console.error('TTS 오류:', e);
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
    };

    synth.speak(utterance);
  }, [selectedVoice, rate]);

  // 전체 읽기
  const speak = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    sentencesRef.current = parseSentences(text);
    setTotalSentences(sentencesRef.current.length);
    setCurrentSentenceIndex(0);
    setProgress(0);
    if (sentencesRef.current.length > 0) {
      playSentence(0);
    }
  }, [playSentence]);

  // 선택 구간 읽기
  const speakSelection = useCallback((text: string) => {
    speak(text);
  }, [speak]);

  // 일시정지
  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, []);

  // 재개
  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, []);

  // 정지
  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsPaused(false);
    setCurrentSentenceIndex(0);
    setProgress(0);
  }, []);

  // 다음 문장
  const skipForward = useCallback(() => {
    if (currentSentenceIndex + 1 < sentencesRef.current.length) {
      playSentence(currentSentenceIndex + 1);
    }
  }, [currentSentenceIndex, playSentence]);

  // 이전 문장
  const skipBackward = useCallback(() => {
    if (currentSentenceIndex > 0) {
      playSentence(currentSentenceIndex - 1);
    }
  }, [currentSentenceIndex, playSentence]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      isPlayingRef.current = false;
    };
  }, []);

  return {
    isPlaying, isPaused, currentSentenceIndex, totalSentences, progress,
    availableVoices, selectedVoice, rate,
    speak, speakSelection, pause, resume, stop, skipForward, skipBackward,
    setRate, setVoice: setSelectedVoice,
  };
}
