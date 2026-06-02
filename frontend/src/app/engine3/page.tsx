'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PredictionResult } from '@/components/engines/PredictionResult';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { PokemonAutocomplete } from '@/components/ui/PokemonAutocomplete';
import { api } from '@/lib/api';
import { parsePokemonCsv, parseShowdownTeam } from '@/lib/pokemon-import';
import { useSessionState } from '@/hooks/useSessionState';
import type { Engine3Response } from '@/types';

/* ── Gen 1 Pokémon list ─────────────────────────────────── */
const GEN1_POKEMON = [
  {id:1,name:'bulbasaur'},{id:2,name:'ivysaur'},{id:3,name:'venusaur'},
  {id:4,name:'charmander'},{id:5,name:'charmeleon'},{id:6,name:'charizard'},
  {id:7,name:'squirtle'},{id:8,name:'wartortle'},{id:9,name:'blastoise'},
  {id:10,name:'caterpie'},{id:11,name:'metapod'},{id:12,name:'butterfree'},
  {id:13,name:'weedle'},{id:14,name:'kakuna'},{id:15,name:'beedrill'},
  {id:16,name:'pidgey'},{id:17,name:'pidgeotto'},{id:18,name:'pidgeot'},
  {id:19,name:'rattata'},{id:20,name:'raticate'},{id:21,name:'spearow'},
  {id:22,name:'fearow'},{id:23,name:'ekans'},{id:24,name:'arbok'},
  {id:25,name:'pikachu'},{id:26,name:'raichu'},{id:27,name:'sandshrew'},
  {id:28,name:'sandslash'},{id:29,name:'nidoran-f'},{id:30,name:'nidorina'},
  {id:31,name:'nidoqueen'},{id:32,name:'nidoran-m'},{id:33,name:'nidorino'},
  {id:34,name:'nidoking'},{id:35,name:'clefairy'},{id:36,name:'clefable'},
  {id:37,name:'vulpix'},{id:38,name:'ninetales'},{id:39,name:'jigglypuff'},
  {id:40,name:'wigglytuff'},{id:41,name:'zubat'},{id:42,name:'golbat'},
  {id:43,name:'oddish'},{id:44,name:'gloom'},{id:45,name:'vileplume'},
  {id:46,name:'paras'},{id:47,name:'parasect'},{id:48,name:'venonat'},
  {id:49,name:'venomoth'},{id:50,name:'diglett'},{id:51,name:'dugtrio'},
  {id:52,name:'meowth'},{id:53,name:'persian'},{id:54,name:'psyduck'},
  {id:55,name:'golduck'},{id:56,name:'mankey'},{id:57,name:'primeape'},
  {id:58,name:'growlithe'},{id:59,name:'arcanine'},{id:60,name:'poliwag'},
  {id:61,name:'poliwhirl'},{id:62,name:'poliwrath'},{id:63,name:'abra'},
  {id:64,name:'kadabra'},{id:65,name:'alakazam'},{id:66,name:'machop'},
  {id:67,name:'machoke'},{id:68,name:'machamp'},{id:69,name:'bellsprout'},
  {id:70,name:'weepinbell'},{id:71,name:'victreebel'},{id:72,name:'tentacool'},
  {id:73,name:'tentacruel'},{id:74,name:'geodude'},{id:75,name:'graveler'},
  {id:76,name:'golem'},{id:77,name:'ponyta'},{id:78,name:'rapidash'},
  {id:79,name:'slowpoke'},{id:80,name:'slowbro'},{id:81,name:'magnemite'},
  {id:82,name:'magneton'},{id:83,name:"farfetch'd"},{id:84,name:'doduo'},
  {id:85,name:'dodrio'},{id:86,name:'seel'},{id:87,name:'dewgong'},
  {id:88,name:'grimer'},{id:89,name:'muk'},{id:90,name:'shellder'},
  {id:91,name:'cloyster'},{id:92,name:'gastly'},{id:93,name:'haunter'},
  {id:94,name:'gengar'},{id:95,name:'onix'},{id:96,name:'drowzee'},
  {id:97,name:'hypno'},{id:98,name:'krabby'},{id:99,name:'kingler'},
  {id:100,name:'voltorb'},{id:101,name:'electrode'},{id:102,name:'exeggcute'},
  {id:103,name:'exeggutor'},{id:104,name:'cubone'},{id:105,name:'marowak'},
  {id:106,name:'hitmonlee'},{id:107,name:'hitmonchan'},{id:108,name:'lickitung'},
  {id:109,name:'koffing'},{id:110,name:'weezing'},{id:111,name:'rhyhorn'},
  {id:112,name:'rhydon'},{id:113,name:'chansey'},{id:114,name:'tangela'},
  {id:115,name:'kangaskhan'},{id:116,name:'horsea'},{id:117,name:'seadra'},
  {id:118,name:'goldeen'},{id:119,name:'seaking'},{id:120,name:'staryu'},
  {id:121,name:'starmie'},{id:122,name:"mr-mime"},{id:123,name:'scyther'},
  {id:124,name:'jynx'},{id:125,name:'electabuzz'},{id:126,name:'magmar'},
  {id:127,name:'pinsir'},{id:128,name:'tauros'},{id:129,name:'magikarp'},
  {id:130,name:'gyarados'},{id:131,name:'lapras'},{id:132,name:'ditto'},
  {id:133,name:'eevee'},{id:134,name:'vaporeon'},{id:135,name:'jolteon'},
  {id:136,name:'flareon'},{id:137,name:'porygon'},{id:138,name:'omanyte'},
  {id:139,name:'omastar'},{id:140,name:'kabuto'},{id:141,name:'kabutops'},
  {id:142,name:'aerodactyl'},{id:143,name:'snorlax'},{id:144,name:'articuno'},
  {id:145,name:'zapdos'},{id:146,name:'moltres'},{id:147,name:'dratini'},
  {id:148,name:'dragonair'},{id:149,name:'dragonite'},{id:150,name:'mewtwo'},
  {id:151,name:'mew'},
] as const;

/* ── Pokémon slot input — delegates to shared PokemonAutocomplete ── */
interface PokemonSlotInputProps {
  value: string;
  onChange: (v: string) => void;
  slotNumber: number;
  /** accent color — retained for API compatibility with TeamInput callers */
  accent: string;
  label: string;
}

function PokemonSlotInput({ value, onChange, slotNumber }: PokemonSlotInputProps) {
  return (
    <PokemonAutocomplete
      value={value}
      onChange={onChange}
      onSelect={(pokemon) => onChange(pokemon.name)}
      placeholder={`Pokémon ${slotNumber}`}
    />
  );
}

/* ── Battle-side team input ─────────────────────────────── */
function TeamInput({
  label, battlerName, onBattlerChange, slots, onSlotChange, accentColor, onRandomize, onImport, showCounterPick,
}: {
  readonly label: string;
  readonly battlerName: string;
  readonly onBattlerChange: (v: string) => void;
  readonly slots: string[];
  readonly onSlotChange: (i: number, v: string) => void;
  readonly accentColor: 'red' | 'blue';
  readonly onRandomize?: (names: string[]) => void;
  readonly onImport?: (names: string[]) => void;
  readonly showCounterPick?: boolean;
}) {
  const isRed = accentColor === 'red';
  const accent = isRed ? '#EF4444' : '#6890F0';
  const accentBg = isRed ? 'rgba(239,68,68,0.12)' : 'rgba(104,144,240,0.12)';
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const [pasteText, setPasteText] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);

  function handleRandomize() {
    const shuffled = [...GEN1_POKEMON].sort(() => Math.random() - 0.5);
    const names = shuffled.slice(0, 6).map((p) => p.name);
    onRandomize?.(names);
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const names = parsePokemonCsv(text);
      onImport?.(names);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handlePasteLoad() {
    const names = parseShowdownTeam(pasteText);
    if (names.length > 0) { onImport?.(names); setPasteOpen(false); setPasteText(''); }
  }

  function handleCounterPick() {
    const raw = sessionStorage.getItem('counter_team_transfer');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { myTeam?: string[] };
      if (Array.isArray(parsed.myTeam) && parsed.myTeam.length > 0) {
        onImport?.(parsed.myTeam.slice(0, 6));
      }
    } catch { /* ignore */ }
  }

  const btnStyle = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    background: 'transparent', border: `1px solid ${color}55`,
    borderRadius: '0.4rem', color, fontFamily: 'var(--font-pixel)',
    fontSize: '0.38rem', letterSpacing: '0.05em', padding: '0.3rem 0.6rem',
    cursor: 'pointer', transition: 'all 0.15s ease',
  });

  return (
    <div className={isRed ? 'battle-side-player' : 'battle-side-opponent'}>
      {/* Team label pill */}
      <div style={{ marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '999px', padding: '0.25rem 0.875rem', background: accent, fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: '#fff', letterSpacing: '0.06em', boxShadow: `0 0 12px ${accent}55` }}>
          {isRed ? '🔴' : '🔵'} {label}
        </div>
        <span style={{ fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: accent, letterSpacing: '0.08em', opacity: 0.85 }}>
          {isRed ? '— MY TEAM' : '— OPPONENT'}
        </span>
      </div>

      {/* Action buttons row */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
        <button type="button" onClick={handleRandomize} style={btnStyle(accent)}>
          🎲 RANDOM
        </button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVUpload} />
        <button type="button" onClick={() => fileRef.current?.click()} style={btnStyle('#F8D030')}>
          📂 CSV
        </button>
        <button type="button" onClick={() => setPasteOpen((v) => !v)} style={btnStyle('#A890F0')}>
          📋 PASTE PS
        </button>
        {showCounterPick && (
          <button type="button" onClick={handleCounterPick} style={btnStyle('#4ADE80')}>
            ⚔ COUNTER PICK
          </button>
        )}
      </div>

      {/* Paste PS textarea */}
      {pasteOpen && (
        <div style={{ marginBottom: '0.75rem' }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'Paste Pokémon Showdown team text here...\n\nPikachu\n- Thunderbolt\n...'}
            rows={5}
            style={{ width: '100%', background: 'rgba(10,14,26,0.8)', border: `1px solid ${accent}44`, borderRadius: '0.4rem', color: 'var(--pk-text)', fontFamily: 'var(--font-body)', fontSize: '0.75rem', padding: '0.5rem', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <button type="button" onClick={handlePasteLoad} style={{ ...btnStyle(accent), marginTop: '0.35rem', padding: '0.35rem 0.75rem' }}>
            LOAD TEAM
          </button>
        </div>
      )}

      <div style={{ marginBottom: '0.875rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', marginBottom: '0.375rem', letterSpacing: '0.06em' }}>
          <span aria-hidden="true">◆</span> TRAINER NAME
        </label>
        <input
          type="text"
          value={battlerName}
          onChange={(e) => onBattlerChange(e.target.value)}
          placeholder={isRed ? 'e.g. Ash' : 'e.g. Gary'}
          className="pk-input"
          style={{ fontSize: '16px', borderColor: `${accent}44`, boxShadow: battlerName ? `0 0 0 2px ${accent}22` : 'none' }}
          aria-label={`${label} trainer name`}
        />
      </div>

      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', marginBottom: '0.5rem', letterSpacing: '0.06em' }}>
          <span aria-hidden="true">▶</span> TEAM POKÉMON
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {slots.map((val, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '1.1rem', textAlign: 'center', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: accent, flexShrink: 0 }}>{i + 1}</span>
              <PokemonSlotInput
                value={val}
                onChange={(v) => onSlotChange(i, v)}
                slotNumber={i + 1}
                accent={accent}
                label={`${label} Pokémon slot ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Platform glow shadow */}
      <div aria-hidden="true" style={{ position: 'absolute', bottom: '-6px', left: '15%', right: '15%', height: '12px', background: `radial-gradient(ellipse, ${accentBg} 0%, transparent 70%)`, filter: 'blur(3px)' }} />
    </div>
  );
}

function generateMatchId(): string {
  return `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ── Battle flash overlay ───────────────────────────────── */
function BattleFlash({ active }: { readonly active: boolean }) {
  if (!active) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        pointerEvents: 'none', background: 'white',
        animation: 'battle-reveal 0.6s ease-out forwards',
      }}
    />
  );
}

export default function Engine3Page() {
  const [battlerA, setBattlerA] = useSessionState('engine3.battlerA', '');
  const [battlerB, setBattlerB] = useSessionState('engine3.battlerB', '');
  const [teamA, setTeamA] = useSessionState<string[]>('engine3.teamA', ['', '', '', '', '', '']);
  const [teamB, setTeamB] = useSessionState<string[]>('engine3.teamB', ['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useSessionState<Engine3Response | null>('engine3.prediction', null);
  const [currentMatchId, setCurrentMatchId] = useSessionState('engine3.currentMatchId', '');
  const [predError, setPredError] = useState<string | null>(null);
  const [actualWinner, setActualWinner] = useSessionState('engine3.actualWinner', '');
  const [replayLink, setReplayLink] = useSessionState('engine3.replayLink', '');
  const [screenshotLink, setScreenshotLink] = useSessionState('engine3.screenshotLink', '');
  const [finalScore, setFinalScore] = useSessionState('engine3.finalScore', '');
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useSessionState('engine3.recorded', false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const [gymTeamToast, setGymTeamToast] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateTeamA(i: number, v: string) { setTeamA((prev) => { const n = [...prev]; n[i] = v; return n; }); }
  function updateTeamB(i: number, v: string) { setTeamB((prev) => { const n = [...prev]; n[i] = v; return n; }); }

  function randomizeTeam(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    const shuffled = [...GEN1_POKEMON].sort(() => Math.random() - 0.5);
    setter(shuffled.slice(0, 6).map((p) => p.name));
  }

  const handleRandomizeA = useCallback((names: string[]) => { setTeamA(names); }, []);
  const handleRandomizeB = useCallback((names: string[]) => { setTeamB(names); }, []);

  const handleImportA = useCallback((names: string[]) => {
    const padded = [...names.slice(0, 6)];
    while (padded.length < 6) padded.push('');
    setTeamA(padded);
  }, []);

  const handleImportB = useCallback((names: string[]) => {
    const padded = [...names.slice(0, 6)];
    while (padded.length < 6) padded.push('');
    setTeamB(padded);
  }, []);

  /* ── Read counter team transfer from Engine 2 ─────────── */
  useEffect(() => {
    const raw = sessionStorage.getItem('counter_team_transfer');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { myTeam?: string[]; opponentTeam?: string[] };
      sessionStorage.removeItem('counter_team_transfer');
      if (Array.isArray(parsed.myTeam) && parsed.myTeam.length > 0) {
        const padded = [...parsed.myTeam.slice(0, 6)];
        while (padded.length < 6) padded.push('');
        setTeamA(padded);
      }
      if (Array.isArray(parsed.opponentTeam) && parsed.opponentTeam.length > 0) {
        const padded = [...parsed.opponentTeam.slice(0, 6)];
        while (padded.length < 6) padded.push('');
        setTeamB(padded);
      }
    } catch { /* ignore */ }
  }, []);

  /* ── Read gym team transfer from Engine 1 ─────────────── */
  useEffect(() => {
    const raw = sessionStorage.getItem('gym_team_transfer');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { names?: string[]; theme?: string; difficulty?: string };
      sessionStorage.removeItem('gym_team_transfer');
      if (Array.isArray(parsed.names)) {
        const padded: string[] = [...parsed.names.slice(0, 6)];
        while (padded.length < 6) padded.push('');
        setTeamA(padded);
      }
      const trainerName = parsed.theme ? `${parsed.theme} Gym Leader` : 'Gym Leader';
      setBattlerA(trainerName);
      setGymTeamToast(true);
      toastTimerRef.current = setTimeout(() => setGymTeamToast(false), 3000);
    } catch {
      // malformed JSON — silently ignore
    }
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  async function handlePredict(e: React.FormEvent) {
    e.preventDefault();
    if (!battlerA.trim() || !battlerB.trim()) { setPredError('Both trainer names are required.'); return; }
    const filledA = teamA.filter((s) => s.trim() !== '');
    const filledB = teamB.filter((s) => s.trim() !== '');
    if (filledA.length === 0 || filledB.length === 0) { setPredError('Each team needs at least one Pokémon.'); return; }
    const matchId = generateMatchId();
    setCurrentMatchId(matchId);
    setLoading(true); setPredError(null); setPrediction(null); setRecorded(false);
    setActualWinner(''); setReplayLink(''); setScreenshotLink(''); setFinalScore('');
    try {
      const data = await api.predictBattle(matchId, battlerA.trim(), battlerB.trim(), filledA, filledB);
      setFlashActive(true);
      flashTimerRef.current = setTimeout(() => {
        setFlashActive(false);
        setPrediction(data);
      }, 650);
    } catch (err) {
      setPredError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!actualWinner.trim()) { setRecordError('Select the actual winner.'); return; }
    setRecording(true); setRecordError(null);
    try {
      await api.recordBattleResult(currentMatchId, actualWinner.trim(), replayLink.trim() || undefined, screenshotLink.trim() || undefined, finalScore.trim() || undefined);
      setRecorded(true);
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : 'Failed to record result');
    } finally {
      setRecording(false);
    }
  }

  // Suppress unused variable warning — randomizeTeam is available for direct setter use if needed
  void randomizeTeam;

  const winnerIsA = prediction ? prediction.predicted_winner.toLowerCase() === battlerA.toLowerCase() : false;

  return (
    <AuthGuard>
    <div className="pk-section">
      <BattleFlash active={flashActive} />

      {/* ── Gym team loaded toast ────────────────────────── */}
      {gymTeamToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '1.25rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9995,
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            background: 'rgba(10,14,26,0.97)',
            border: '2px solid rgba(74,222,128,0.5)',
            borderRadius: '0.625rem',
            padding: '0.75rem 1.25rem',
            boxShadow: '0 0 24px rgba(74,222,128,0.2), 0 8px 32px rgba(0,0,0,0.6)',
            animation: 'slide-in-up 0.3s ease-out',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>✅</span>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.52rem', color: '#4ADE80', letterSpacing: '0.08em' }}>
            GYM TEAM LOADED
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--pk-text-muted)', fontFamily: 'var(--font-body)' }}>
            Team A pre-filled from Gym Team Builder
          </span>
        </div>
      )}

      <div className="pk-page-glow" aria-hidden="true" />

      {/* ── Page header ────────────────────────────────── */}
      <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 2rem)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>ENGINE 3</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.4rem', padding: '0.25rem 0.6rem' }}>
            <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.06em' }}>⚔ BATTLE PREDICTOR</span>
          </div>
        </div>
        <h1 style={{ margin: '0 0 0.375rem', fontSize: 'clamp(1.3rem, 3vw, 2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
          Battle Predictor
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--pk-text-muted)' }}>
          Predict the winner of a battle using an ensemble of ML models, then record the actual result.
        </p>
      </header>

      {/* ── Battle form ─────────────────────────────────── */}
      <form onSubmit={handlePredict} aria-label="Battle prediction form" noValidate style={{ marginBottom: '1.5rem' }}>
        {/* Battle screen layout */}
        <div className="battle-screen" style={{ marginBottom: '1rem' }}>
          <TeamInput
            label="TEAM A"
            battlerName={battlerA}
            onBattlerChange={setBattlerA}
            slots={teamA}
            onSlotChange={updateTeamA}
            accentColor="red"
            onRandomize={handleRandomizeA}
            onImport={handleImportA}
            showCounterPick={true}
          />
          <div className="battle-vs-badge" aria-hidden="true">VS</div>
          <TeamInput
            label="TEAM B"
            battlerName={battlerB}
            onBattlerChange={setBattlerB}
            slots={teamB}
            onSlotChange={updateTeamB}
            accentColor="blue"
            onRandomize={handleRandomizeB}
            onImport={handleImportB}
            showCounterPick={false}
          />
        </div>

        {predError && (
          <div className="pk-error" role="alert" style={{ marginBottom: '1rem' }}>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.5rem', letterSpacing: '0.06em' }}>⚠ ERROR: </span>{predError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="submit"
            disabled={loading}
            className="pk-analyse-btn"
            style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading
              ? <><LoadingSpinner size="sm" /><span>PREDICTING...</span></>
              : <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9.5" stroke="#fff" strokeWidth="1.5"/>
                    <circle cx="12" cy="12" r="6" stroke="#fff" strokeWidth="1.2" opacity="0.6"/>
                    <circle cx="12" cy="12" r="2.8" fill="#fff" opacity="0.9"/>
                  </svg>
                  PREDICT WINNER
                </>
            }
          </button>
        </div>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="pk-loading-msg">
          <LoadingSpinner size="lg" />
          <p className="pk-loading-title">RUNNING ENSEMBLE MODELS...</p>
          <p className="pk-loading-sub">Analysing team compositions with ML algorithms</p>
        </div>
      )}

      {/* Results */}
      {prediction && !loading && !flashActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'slide-in-up 0.4s ease-out' }}>

          {/* Prediction result */}
          <div style={{
            position: 'relative', borderRadius: '1rem', overflow: 'hidden',
            border: '2px solid rgba(248,208,48,0.3)',
            background: '#0d1120',
            boxShadow: '0 0 40px rgba(248,208,48,0.12)',
          }}>
            {/* Diagonal stripe decoration */}
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, transparent, transparent 18px, rgba(248,208,48,0.02) 18px, rgba(248,208,48,0.02) 20px)', pointerEvents: 'none' }} />
            {/* Radial glow */}
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(248,208,48,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, padding: 'clamp(1rem, 2.5vw, 1.75rem)' }}>
              {/* Winner stamp */}
              <div className="winner-stamp" style={{ marginBottom: '0.75rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M8 21h8M12 17v4M7 3H17V13C17 15.76 14.76 18 12 18C9.24 18 7 15.76 7 13V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                    <path d="M7 7H4C4 9.5 5.5 11 7 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M17 7H20C20 9.5 18.5 11 17 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  🏆 WINNER: {prediction.predicted_winner === battlerA || prediction.predicted_winner.toUpperCase() === 'A' ? `${battlerA || 'Team A'} (MY TEAM)` : `${battlerB || 'Team B'} (OPPONENT)`} 🏆
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 'clamp(1rem, 2vw, 1.3rem)', fontWeight: 900, color: 'var(--pk-text)' }}>Prediction Result</h2>
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem', color: 'var(--pk-text-dim)' }}>{prediction.match_id}</span>
              </div>

              {/* Winner / loser banners */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { name: battlerA || 'Team A', label: 'MY TEAM', isWinner: winnerIsA, accent: '#EF4444' },
                  { name: battlerB || 'Team B', label: 'OPPONENT', isWinner: !winnerIsA, accent: '#6890F0' },
                ].map(({ name, label, isWinner, accent }) => (
                  <div key={name} style={{
                    borderRadius: '0.75rem',
                    padding: '0.875rem 0.75rem',
                    border: `2px solid ${isWinner ? accent : 'rgba(255,255,255,0.08)'}`,
                    background: isWinner ? `${accent}18` : 'var(--pk-glass)',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {isWinner && (
                      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${accent}18 0%, transparent 70%)`, pointerEvents: 'none' }} />
                    )}
                    <p style={{ margin: '0 0 0.15rem', fontSize: '0.38rem', fontFamily: 'var(--font-pixel)', color: accent, letterSpacing: '0.08em', opacity: 0.7 }}>
                      {label}
                    </p>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.48rem', fontFamily: 'var(--font-pixel)', color: isWinner ? accent : 'var(--pk-text-dim)', letterSpacing: '0.06em' }}>
                      {isWinner ? '🏆 WINNER 🏆' : 'DEFEATED'}
                    </p>
                    <p style={{ margin: 0, fontWeight: 800, color: isWinner ? '#fff' : 'var(--pk-text-muted)', textTransform: 'capitalize', fontSize: '0.95rem' }}>
                      {name}
                    </p>
                  </div>
                ))}
              </div>

              <PredictionResult result={prediction} battlerA={battlerA} />
            </div>
          </div>

          {/* Record result panel */}
          <div className="pk-record-panel">
            <h2 style={{ margin: '0 0 0.375rem', fontSize: 'clamp(0.9rem, 1.8vw, 1.2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>Record Actual Result</h2>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: 'var(--pk-text-muted)' }}>
              After the battle, record the ground truth to improve model accuracy.
            </p>

            {recorded ? (
              <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '0.75rem', padding: '0.875rem 1rem', fontSize: '0.85rem', color: '#4ADE80', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="#4ADE80" strokeWidth="1.8"/>
                  <polyline points="7,12 10.5,15.5 17,9" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.52rem', letterSpacing: '0.06em' }}>RESULT SAVED TO BATTLE LOG!</span>
              </div>
            ) : (
              <form onSubmit={handleRecord} aria-label="Record battle result" noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Winner selector */}
                <div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', marginBottom: '0.5rem', letterSpacing: '0.06em' }}>
                    <span aria-hidden="true">▶</span> ACTUAL WINNER <span style={{ color: 'var(--pk-red)' }}>*</span>
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {[{ name: battlerA || 'Team A', color: '#EF4444' }, { name: battlerB || 'Team B', color: '#6890F0' }].map(({ name, color }) => (
                      <label key={name} style={{
                        flex: 1, borderRadius: '0.625rem',
                        border: `2px solid ${actualWinner === name ? color : 'rgba(255,255,255,0.08)'}`,
                        padding: '0.625rem', cursor: 'pointer',
                        background: actualWinner === name ? `${color}18` : 'var(--pk-glass)',
                        textAlign: 'center', transition: 'all 0.15s ease',
                      }}>
                        <input type="radio" name="actualWinner" value={name} checked={actualWinner === name} onChange={() => setActualWinner(name)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: actualWinner === name ? color : 'var(--pk-text-muted)', textTransform: 'capitalize' }}>{name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Optional fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.875rem' }}>
                  {[
                    { id: 'final-score', label: 'FINAL SCORE (optional)', value: finalScore, setter: setFinalScore, placeholder: 'e.g. 6-3', type: 'text' },
                    { id: 'replay-link', label: 'REPLAY LINK (optional)', value: replayLink, setter: setReplayLink, placeholder: 'https://replay.pokemonshowdown.com/…', type: 'url' },
                    { id: 'screenshot-link', label: 'SCREENSHOT (optional)', value: screenshotLink, setter: setScreenshotLink, placeholder: 'https://imgur.com/…', type: 'url' },
                  ].map(({ id, label, value, setter, placeholder, type }) => (
                    <div key={id}>
                      <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', marginBottom: '0.375rem', letterSpacing: '0.06em' }}>
                        <span aria-hidden="true">◆</span> {label}
                      </label>
                      <input id={id} type={type} value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder} className="pk-input" style={{ fontSize: '16px' }} />
                    </div>
                  ))}
                </div>

                {recordError && <div className="pk-error" role="alert"><span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.5rem' }}>⚠ ERROR: </span>{recordError}</div>}

                <button
                  type="submit"
                  disabled={recording || !actualWinner}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    background: recording || !actualWinner ? 'rgba(255,255,255,0.04)' : 'rgba(74,222,128,0.12)',
                    border: `2px solid ${recording || !actualWinner ? 'rgba(255,255,255,0.1)' : 'rgba(74,222,128,0.4)'}`,
                    borderRadius: '0.625rem',
                    color: recording || !actualWinner ? 'var(--pk-text-dim)' : '#4ADE80',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '0.52rem',
                    letterSpacing: '0.06em',
                    padding: '0.75rem 1.5rem',
                    cursor: recording || !actualWinner ? 'not-allowed' : 'pointer',
                    opacity: recording || !actualWinner ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    alignSelf: 'flex-start',
                    textTransform: 'uppercase',
                  }}
                >
                  {recording
                    ? <><LoadingSpinner size="sm" /><span>SAVING...</span></>
                    : <><span>💾</span><span>SAVE TO BATTLE LOG</span></>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
