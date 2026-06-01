'use client';

import React, { useState, useEffect, useCallback } from 'react';

/* ── Guide sections definition ─────────────────────────────────────────── */
const SECTIONS = [
  { id: 'overview',      icon: '📖', label: 'OVERVIEW',   title: 'SYSTEM OVERVIEW' },
  { id: 'engine1',       icon: '🏟', label: 'ENGINE 1',   title: 'GYM TEAM BUILDER' },
  { id: 'engine2',       icon: '🎯', label: 'ENGINE 2',   title: 'COUNTER PICK' },
  { id: 'engine3',       icon: '⚔',  label: 'ENGINE 3',   title: 'BATTLE PREDICTOR' },
  { id: 'history',       icon: '📜', label: 'HISTORY',    title: 'BATTLE HISTORY' },
  { id: 'metrics',       icon: '📊', label: 'METRICS',    title: 'MODEL METRICS' },
  { id: 'pokedb',        icon: '🔴', label: 'POKÉMON DB', title: 'POKÉMON DATABASE' },
  { id: 'section3isc',   icon: '🗺', label: '3ISC',       title: 'SECTION 3ISC' },
  { id: 'restrictions',  icon: '⛔', label: 'RESTRICT.',  title: 'RESTRICTIONS' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

/* ── Shared sub-components ──────────────────────────────────────────────── */
function Heading({ children }: { readonly children: React.ReactNode }) {
  return (
    <p style={{ margin: '0 0 0.5rem', fontSize: '0.46rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      {children}
    </p>
  );
}

function SubHeading({ children }: { readonly children: React.ReactNode }) {
  return (
    <p style={{ margin: '1rem 0 0.375rem', fontSize: '0.44rem', fontFamily: 'var(--font-pixel)', color: 'rgba(239,68,68,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {children}
    </p>
  );
}

function Body({ children }: { readonly children: React.ReactNode }) {
  return (
    <p style={{ margin: '0 0 0.625rem', fontSize: '0.8rem', color: 'var(--pk-text-muted)', lineHeight: 1.7, fontFamily: 'var(--font-body)' }}>
      {children}
    </p>
  );
}

function InfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.375rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ flexShrink: 0, fontSize: '0.44rem', fontFamily: 'var(--font-pixel)', color: 'rgba(239,68,68,0.65)', letterSpacing: '0.06em', minWidth: '90px' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.78rem', color: 'var(--pk-text-muted)', fontFamily: 'var(--font-body)' }}>
        {value}
      </span>
    </div>
  );
}

function PillList({ items }: { readonly items: readonly string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', margin: '0.5rem 0' }}>
      {items.map((item) => (
        <span key={item} style={{ fontSize: '0.44rem', fontFamily: 'var(--font-pixel)', color: 'rgba(239,68,68,0.85)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.3rem', padding: '0.2rem 0.5rem', letterSpacing: '0.04em' }}>
          {item}
        </span>
      ))}
    </div>
  );
}

function TipBox({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="pk-guide-tip-box">
      <span style={{ fontSize: '0.78rem', color: 'var(--pk-text-muted)', lineHeight: 1.7, fontFamily: 'var(--font-body)' }}>{children}</span>
    </div>
  );
}

/* ── Section: Overview ──────────────────────────────────────────────────── */
function SectionOverview() {
  return (
    <div>
      {/* Quick Start box */}
      <div className="pk-guide-quick-start">
        <p className="pk-guide-quick-start-title">◆ QUICK START</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {[
            ['1', 'Open ENGINE 1 — choose a type and difficulty'],
            ['2', 'Click CHOOSE THIS TEAM then TAKE THIS TEAM TO BATTLE'],
            ['3', 'In ENGINE 3, review the prediction then play in Showdown'],
          ].map(([num, desc]) => (
            <div key={num} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
              <span style={{ flexShrink: 0, width: '1.25rem', height: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '50%', fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)' }}>
                {num}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--pk-text-muted)', lineHeight: 1.55, fontFamily: 'var(--font-body)', paddingTop: '0.1rem' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <Heading>◆ ARCHITECTURE</Heading>
      <Body>
        A 3-tier data engineering platform built with real PokeAPI data covering Pokémon across all 9 generations (Kanto through Paldea).
        The full stack spans Next.js on the frontend, a NestJS API gateway in the middle tier, and a
        Python FastAPI service running the ML models — all backed by Supabase PostgreSQL.
      </Body>
      <InfoRow label="FRONTEND"   value="Next.js 14 (App Router) + TypeScript" />
      <InfoRow label="API GATEWAY" value="NestJS — routes requests to Python" />
      <InfoRow label="ML BACKEND" value="Python FastAPI — scikit-learn models" />
      <InfoRow label="DATABASE"   value="Supabase PostgreSQL — Pokémon data + battle records" />
      <InfoRow label="POKÉMON"    value="Gen 1–9 · 1,025 Pokémon · live PokeAPI sprites" />

      <SubHeading>◆ RECOMMENDED WORKFLOW</SubHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.25rem' }}>
        {[
          ['1', 'ENGINE 1', 'Build your Gym Leader team'],
          ['2', 'ENGINE 2', 'Find counter picks against opponents'],
          ['3', 'ENGINE 3', 'Predict the battle winner'],
          ['4', 'BATTLE',   'Play the battle in Pokémon Showdown'],
          ['5', 'RECORD',   'Return and log the actual result'],
          ['6', 'METRICS',  'Watch model accuracy improve over time'],
        ].map(([num, tag, desc]) => (
          <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ flexShrink: 0, width: '1.25rem', height: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '50%', fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)' }}>
              {num}
            </span>
            <span style={{ fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: 'rgba(239,68,68,0.7)', letterSpacing: '0.05em', minWidth: '65px' }}>
              {tag}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--pk-text-muted)', fontFamily: 'var(--font-body)' }}>
              {desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Section: Engine 1 ──────────────────────────────────────────────────── */
function SectionEngine1() {
  return (
    <div>
      <Heading>◆ HOW TO USE</Heading>
      <Body>
        Select a type speciality (e.g. Fire) and a Challenge Rank, then click CHOOSE THIS TEAM.
        The ML pipeline builds a balanced 4-Pokémon team optimised for that gym type.
      </Body>

      <SubHeading>◆ INPUTS</SubHeading>
      <InfoRow label="TYPE"        value="18 types + Balanced (19 options total)" />
      <InfoRow label="EASY"        value="BOULDER BADGE — lower BST, basic roles" />
      <InfoRow label="MEDIUM"      value="THUNDER BADGE — balanced composition" />
      <InfoRow label="HARD"        value="VOLCANO BADGE — optimised, high BST" />
      <InfoRow label="REGION"      value="Select the gym leader region (all 9 regions: Kanto through Paldea)" />
      <InfoRow label="GYM LEADER"  value="Enter the gym leader name — used to tag the match record" />
      <InfoRow label="SECTION"     value="3ISC tag — assign this team to a Section (e.g. 3ISC-A)" />
      <InfoRow label="GROUP NAME"  value="Optional group label (e.g. GROUP 1) for team organisation" />

      <TipBox>
        The Region field determines which Pokémon pool is available. Restricted Pokémon (Legendaries/Mythicals) are always excluded from the output regardless of region.
      </TipBox>

      <SubHeading>◆ ML PIPELINE</SubHeading>
      <PillList items={['K-Means Clustering', 'Decision Tree', 'Random Forest', 'Cosine Similarity', 'Gower Distance']} />
      <Body>
        K-Means groups Pokémon by stat profile. A Decision Tree assigns tactical roles.
        Random Forest scores candidates. Cosine + Gower distance selects the final 6 for best diversity.
      </Body>

      <SubHeading>◆ TEAM ROLES</SubHeading>
      <PillList items={['ACE', 'TANK', 'SWEEPER', 'SUPPORT', 'WALL', 'BALANCED']} />

      <SubHeading>◆ NEXT STEP</SubHeading>
      <Body>
        After your team is built, use the TAKE THIS TEAM TO BATTLE button at the bottom to send
        your team directly to Engine 3 with Team A pre-filled. No copy-pasting needed.
      </Body>
    </div>
  );
}

/* ── Section: Engine 2 ──────────────────────────────────────────────────── */
function SectionEngine2() {
  return (
    <div>
      <Heading>◆ HOW TO USE</Heading>
      <Body>
        Enter up to 4 opponent Pokémon names (lowercase, e.g. charizard) and click FIND COUNTERS.
        The engine returns the top counter picks with a full score breakdown.
      </Body>

      <SubHeading>◆ INPUT FORMAT</SubHeading>
      <InfoRow label="FORMAT"           value="Lowercase Pokémon name (e.g. charizard)" />
      <InfoRow label="SLOTS"            value="1–6 opponent Pokémon" />
      <InfoRow label="EXAMPLE"          value="charizard, blastoise, venusaur" />
      <InfoRow label="CHALLENGER REGION" value="For 3ISC: choose Johto, Kalos, or Alola — filters counter pool to that region only" />

      <TipBox>
        In 3ISC mode, the Challenger Region field narrows the counter pool to the selected region. Johto gives 94 options, Kalos 66, Alola 68 — all after restricted Pokémon are removed.
      </TipBox>

      <SubHeading>◆ SCORING MODEL</SubHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', margin: '0.5rem 0' }}>
        {[
          ['40%', 'Type Coverage Score',  'type advantage across all opponent Pokémon'],
          ['25%', 'K-NN Similarity',       'nearest neighbours by stat vector'],
          ['20%', 'Stat Advantage',         'direct base stat comparison'],
          ['15%', 'Decision Tree',          'role-based counter classification'],
        ].map(([pct, name, desc]) => (
          <div key={name} style={{ display: 'flex', gap: '0.625rem', alignItems: 'baseline' }}>
            <span style={{ flexShrink: 0, minWidth: '2.25rem', fontSize: '0.44rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.04em' }}>
              {pct}
            </span>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--pk-text)', fontFamily: 'var(--font-body)' }}>{name}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--pk-text-muted)', fontFamily: 'var(--font-body)' }}>{' — '}{desc}</span>
            </div>
          </div>
        ))}
      </div>

      <SubHeading>◆ OUTPUT</SubHeading>
      <Body>
        Top 6 counter picks ranked by composite score, each with a score breakdown bar chart
        and a type matchup matrix showing coverage against every opponent Pokémon.
      </Body>
    </div>
  );
}

/* ── Section: Engine 3 ──────────────────────────────────────────────────── */
function SectionEngine3() {
  return (
    <div>
      <Heading>◆ HOW TO USE</Heading>
      <Body>
        Fill in both teams, click PREDICT WINNER to lock in the prediction before the battle,
        then return after the battle to record the actual result.
      </Body>

      <SubHeading>◆ TAKE THIS TEAM TO BATTLE</SubHeading>
      <Body>
        When you generate a team in Engine 1, click TAKE THIS TEAM TO BATTLE at the bottom of the
        results screen. Your team is transferred via session storage and Team A is pre-filled on
        the Engine 3 page automatically — no manual entry needed.
      </Body>
      <TipBox>
        If Team A is already filled when you open Engine 3, it was pre-loaded from Engine 1. You can edit it at any time before clicking PREDICT WINNER.
      </TipBox>

      <SubHeading>◆ STEP-BY-STEP</SubHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.375rem 0' }}>
        {[
          ['STEP 1', 'Fill Team A (your team) + Team B (opponent) — minimum 1 Pokémon each'],
          ['STEP 2', 'Click PREDICT WINNER — the prediction is locked in immediately'],
          ['STEP 3', 'Play the battle in Pokémon Showdown or wherever'],
          ['STEP 4', 'Return here → find your match in Battle History → click Record Result'],
          ['STEP 5', 'Models auto-retrain on the new ground truth data'],
        ].map(([step, desc]) => (
          <div key={step} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, minWidth: '52px', fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: 'rgba(239,68,68,0.7)', letterSpacing: '0.04em', paddingTop: '0.15rem' }}>
              {step}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--pk-text-muted)', lineHeight: 1.55, fontFamily: 'var(--font-body)' }}>
              {desc}
            </span>
          </div>
        ))}
      </div>

      <SubHeading>◆ 5-MODEL ENSEMBLE</SubHeading>
      <PillList items={['Decision Tree', 'Random Forest', 'Logistic Regression', 'Naive Bayes', 'K-NN']} />
      <Body>
        All 5 models vote on the predicted winner. The ensemble aggregates confidence scores
        and returns the winner with probability and per-model breakdown.
      </Body>
    </div>
  );
}

/* ── Section: History ───────────────────────────────────────────────────── */
function SectionHistory() {
  return (
    <div>
      <Heading>◆ OVERVIEW</Heading>
      <Body>
        Battle History shows every past prediction made in Engine 3 along with its recorded outcome.
        Each entry tracks accuracy in real time as results are submitted.
      </Body>

      <SubHeading>◆ STATUS BADGES</SubHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0.375rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ fontSize: '0.9rem' }}>✅</span>
          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-body)', color: 'var(--pk-text-muted)' }}>CORRECT — prediction matched the actual result</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ fontSize: '0.9rem' }}>⏳</span>
          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-body)', color: 'var(--pk-text-muted)' }}>PENDING — battle result not yet recorded</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ fontSize: '0.9rem' }}>❌</span>
          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-body)', color: 'var(--pk-text-muted)' }}>WRONG — prediction did not match outcome</span>
        </div>
      </div>

      <SubHeading>◆ FEATURES</SubHeading>
      <InfoRow label="EXPORT CSV"  value="Downloads battle_history_<timestamp>.csv" />
      <InfoRow label="REPLAY"      value="Paste Pokémon Showdown replay URLs when recording results" />
      <InfoRow label="SCREENSHOT"  value="Optional imgur link to attach to the record" />
      <InfoRow label="FINAL SCORE" value="e.g. 6-3 — optional text field" />

      <TipBox>
        Record results as soon as possible after a battle. The ML models retrain on every new data point — more results = more accurate predictions over time.
      </TipBox>

      <SubHeading>◆ RECORDING A RESULT</SubHeading>
      <Body>
        After a battle, open the History page, find your pending match, and click Record Result.
        Select the actual winner, optionally add a replay link, and submit.
        The ML models in Engine 3 will automatically retrain on the new data.
      </Body>
    </div>
  );
}

/* ── Section: Metrics ───────────────────────────────────────────────────── */
function SectionMetrics() {
  return (
    <div>
      <Heading>◆ MODEL PERFORMANCE</Heading>
      <Body>
        The Metrics page shows real-time accuracy statistics for all 5 ensemble models.
        Stats update automatically every time a battle result is recorded.
      </Body>

      <SubHeading>◆ KEY METRICS</SubHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.375rem 0' }}>
        {[
          ['ACCURACY',    'SUPER EFFECTIVE!',   '% of predictions that matched the actual winner'],
          ['F1 SCORE',    'COMBO ATTACK!',       'Balance of precision and recall (0–1, higher = better)'],
          ['BRIER SCORE', 'NOT VERY EFFECTIVE…', 'Probability calibration — lower is better (0 = perfect)'],
        ].map(([metric, badge, desc]) => (
          <div key={metric} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.5rem', padding: '0.625rem 0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.44rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.06em' }}>{metric}</span>
              <span style={{ fontSize: '0.38rem', fontFamily: 'var(--font-pixel)', color: 'rgba(248,208,48,0.75)', border: '1px solid rgba(248,208,48,0.2)', borderRadius: '0.25rem', padding: '0.1rem 0.35rem', letterSpacing: '0.04em' }}>{badge}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--pk-text-muted)', fontFamily: 'var(--font-body)' }}>{desc}</p>
          </div>
        ))}
      </div>

      <SubHeading>◆ CONFUSION MATRIX LABELS</SubHeading>
      <PillList items={['SUPER EFFECTIVE (TP)', 'CRITICAL HIT (TN)', 'MISSED (FP)', 'DODGED (FN)']} />

      <SubHeading>◆ CHARTS</SubHeading>
      <Body>
        Accuracy over time is plotted as a line chart. Requires at least 2 evaluated battles
        to render. Each data point represents the running accuracy after each recorded result.
      </Body>
    </div>
  );
}

/* ── Section: Pokémon DB ─────────────────────────────────────────────────── */
function SectionPokeDB() {
  return (
    <div>
      <Heading>◆ DATABASE OVERVIEW</Heading>
      <Body>
        Browse all 151 Gen 1 Pokémon with their base stats, types, ML-assigned roles, and sprites.
        The database powers all three engines — every prediction and counter pick draws from it.
      </Body>

      <SubHeading>◆ FILTERS</SubHeading>
      <InfoRow label="NAME"   value="Text search across all 151 Pokémon" />
      <InfoRow label="TYPE"   value="Filter by primary or secondary type — tap the pill buttons" />
      <InfoRow label="ROLE"   value="Sweeper / Tank / Wall / Support / Balanced" />
      <InfoRow label="REGION" value="Kanto · Johto · Hoenn · Sinnoh · Unova · Kalos · Alola · Galar · Paldea" />

      <SubHeading>◆ STAT COLUMNS</SubHeading>
      <PillList items={['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed', 'BST']} />
      <Body>
        BST (Base Stat Total) = sum of all 6 base stats. Higher BST generally means a stronger
        Pokémon, though role and typing matter more in team composition.
      </Body>

      <SubHeading>◆ FLAGS</SubHeading>
      <InfoRow label="IS_ASSIGNED"  value="Available to Engine 2 counter picks — not all Pokémon are in the counter pool" />
      <InfoRow label="NATIVE REGION" value="The generation the Pokémon originates from — shown as a badge on each row" />
      <InfoRow label="RESTRICTED"    value="Legendary or Mythical — excluded from all engine outputs by default" />

      <TipBox>
        Click any row to expand the full Pokédex entry — includes stat bars, type weaknesses, native region, and pool status.
      </TipBox>
    </div>
  );
}

/* ── Section: 3ISC ───────────────────────────────────────────────────────── */
function Section3ISC() {
  return (
    <div>
      <Heading>◆ SECTION 3ISC — CHALLENGER REGIONS</Heading>
      <Body>
        Section 3ISC is a structured competition format where challengers are assigned a region.
        Each region has its own pool of eligible Pokémon — all restricted (Legendary/Mythical) are excluded.
      </Body>

      <SubHeading>◆ CHALLENGER POOL</SubHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', margin: '0.5rem 0' }}>
        {[
          { region: 'JOHTO',  color: '#F8D030', count: '94', total: '94 non-restricted Pokémon available' },
          { region: 'KALOS',  color: '#6890F0', count: '66', total: '66 non-restricted Pokémon available' },
          { region: 'ALOLA',  color: '#78C850', count: '68', total: '68 non-restricted Pokémon available' },
        ].map(({ region, color, count, total }) => (
          <div key={region} className="pk-3isc-region-block">
            <p className="pk-3isc-region-title">{region}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75rem', color, fontWeight: 900 }}>{count}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--pk-text-muted)', fontFamily: 'var(--font-body)' }}>{total}</span>
            </div>
          </div>
        ))}
      </div>

      <SubHeading>◆ COMBINED POOL</SubHeading>
      <Body>
        228 non-restricted Pokémon across all 3 regions combined (Johto + Kalos + Alola).
        Use Engine 2 with the Challenger Region field set to filter counter picks to the correct pool.
      </Body>

      <TipBox>
        In Engine 1, set the REGION field to the challenger region before generating a gym team. This ensures the output respects the 3ISC pool restrictions.
      </TipBox>
    </div>
  );
}

/* ── Section: Restrictions ───────────────────────────────────────────────── */
function SectionRestrictions() {
  const restricted: Array<{ region: string; color: string; pokemon: readonly string[] }> = [
    {
      region: 'JOHTO',
      color: '#F8D030',
      pokemon: ['Raikou', 'Entei', 'Suicune', 'Lugia', 'Ho-Oh', 'Celebi'],
    },
    {
      region: 'KALOS',
      color: '#6890F0',
      pokemon: ['Xerneas', 'Yveltal', 'Zygarde', 'Diancie', 'Hoopa', 'Volcanion'],
    },
    {
      region: 'ALOLA',
      color: '#78C850',
      pokemon: [
        'Tapu Koko', 'Tapu Lele', 'Tapu Bulu', 'Tapu Fini',
        'Solgaleo', 'Lunala', 'Necrozma',
        'Nihilego', 'Buzzwole', 'Pheromosa', 'Xurkitree', 'Celesteela',
        'Kartana', 'Guzzlord', 'Cosmog', 'Cosmoem', 'Magearna',
      ],
    },
  ];

  return (
    <div>
      <Heading>◆ RESTRICTED POKÉMON</Heading>
      <Body>
        The following Pokémon are classified as Legendary or Mythical and are excluded from all engine outputs.
        They will not appear in generated teams, counter recommendations, or battle predictions.
      </Body>

      {restricted.map(({ region, color, pokemon }) => (
        <div key={region} style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.4rem', fontFamily: 'var(--font-pixel)', fontSize: '0.44rem', color, letterSpacing: '0.08em' }}>
            {region} — {pokemon.length} RESTRICTED
          </p>
          <div className="pk-3isc-restricted-list">
            {pokemon.map((p) => (
              <span key={p} className="pk-3isc-restricted-chip">{p}</span>
            ))}
          </div>
        </div>
      ))}

      <TipBox>
        If a Pokémon name appears in the database marked with a red RESTRICTED badge, it is in this list and will be excluded from all engine outputs regardless of settings.
      </TipBox>
    </div>
  );
}

/* ── Section renderer ────────────────────────────────────────────────────── */
function SectionContent({ id }: { readonly id: SectionId }) {
  switch (id) {
    case 'overview':     return <SectionOverview />;
    case 'engine1':      return <SectionEngine1 />;
    case 'engine2':      return <SectionEngine2 />;
    case 'engine3':      return <SectionEngine3 />;
    case 'history':      return <SectionHistory />;
    case 'metrics':      return <SectionMetrics />;
    case 'pokedb':       return <SectionPokeDB />;
    case 'section3isc':  return <Section3ISC />;
    case 'restrictions': return <SectionRestrictions />;
  }
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function GuideModal({ collapsed = false }: { readonly collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const activeData = SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <>
      {/* ── Trigger button ────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open system guide"
        title="System Guide"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: '0.5rem',
          padding: collapsed ? '0.45rem' : '0.45rem 0.625rem',
          borderRadius: '0.375rem',
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: 'rgba(239,68,68,0.75)',
          fontSize: collapsed ? '0.875rem' : '0.7rem',
          cursor: 'pointer',
          transition: 'background 0.15s ease, color 0.15s ease',
          fontFamily: collapsed ? 'inherit' : 'var(--font-pixel)',
          letterSpacing: collapsed ? 'normal' : '0.06em',
          textAlign: 'left',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          marginBottom: '0.5rem',
        }}
        className="guide-trigger-btn"
      >
        {collapsed ? (
          <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>?</span>
        ) : (
          <>
            <span style={{ fontSize: '0.75rem', lineHeight: 1 }} aria-hidden="true">◆</span>
            <span>GUIDE</span>
          </>
        )}
      </button>

      {/* ── Modal overlay ─────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="System Guide"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.88)',
            padding: '1rem',
            animation: 'guide-fade-in 0.15s ease-out',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '84vh',
              background: '#0a0e1a',
              border: '2px solid rgba(239,68,68,0.4)',
              borderRadius: '0.875rem',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 0 60px rgba(239,68,68,0.15), 0 24px 64px rgba(0,0,0,0.7)',
              animation: 'slide-in-up 0.2s ease-out',
              position: 'relative',
            }}
          >
            {/* Subtle Pokéball watermark */}
            <div aria-hidden="true" style={{ position: 'absolute', right: '-40px', top: '20px', width: '200px', height: '200px', borderRadius: '50%', border: '24px solid rgba(239,68,68,0.04)', pointerEvents: 'none', zIndex: 0 }} />
            <div aria-hidden="true" style={{ position: 'absolute', right: '-40px', top: '118px', width: '200px', height: '2px', background: 'rgba(239,68,68,0.03)', pointerEvents: 'none', zIndex: 0 }} />

            {/* ── Modal header — game cartridge label style ── */}
            <div style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1.25rem 0.75rem',
              borderBottom: '1px solid rgba(239,68,68,0.2)',
              background: 'linear-gradient(180deg, rgba(139,0,0,0.25) 0%, rgba(80,0,0,0.08) 100%)',
              position: 'relative',
              zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                {/* Pokédex indicator light */}
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #ff6666, #cc0000)', boxShadow: '0 0 8px rgba(239,68,68,0.7)', flexShrink: 0 }} aria-hidden="true" />
                {(['#FFCC00', '#44CC44'] as const).map((c) => (
                  <div key={c} aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}88`, flexShrink: 0 }} />
                ))}
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.58rem', color: 'var(--pk-red)', letterSpacing: '0.12em', marginLeft: '0.25rem' }}>
                  ◆ SYSTEM GUIDE
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close system guide"
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem', color: 'rgba(239,68,68,0.75)', fontSize: '0.875rem', cursor: 'pointer', transition: 'background 0.15s ease', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* ── Tab bar — in-game menu tabs ──────────────── */}
            <div style={{
              flexShrink: 0,
              display: 'flex',
              overflowX: 'auto',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(0,0,0,0.35)',
              scrollbarWidth: 'none',
              position: 'relative',
              zIndex: 1,
            }}>
              {SECTIONS.map((s) => {
                const active = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.625rem 0.75rem 0.5rem',
                      background: active ? 'rgba(239,68,68,0.07)' : 'transparent',
                      border: 'none',
                      borderBottom: active ? '2px solid var(--pk-red)' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, background 0.15s ease',
                      marginBottom: '-1px',
                    }}
                    aria-pressed={active}
                  >
                    <span style={{ fontSize: '0.9rem', lineHeight: 1 }} aria-hidden="true">{s.icon}</span>
                    <span style={{ fontSize: '0.35rem', fontFamily: 'var(--font-pixel)', color: active ? 'var(--pk-red)' : 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', whiteSpace: 'nowrap', transition: 'color 0.15s ease' }}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Section body ────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', scrollbarWidth: 'thin', scrollbarColor: 'rgba(239,68,68,0.3) transparent', position: 'relative', zIndex: 1 }}>
              {/* Section title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '1.3rem', lineHeight: 1 }} aria-hidden="true">{activeData.icon}</span>
                <h2 style={{ margin: 0, fontSize: 'clamp(0.9rem, 2vw, 1.1rem)', fontWeight: 900, color: 'var(--pk-text)', fontFamily: 'var(--font-body)' }}>
                  {activeData.title}
                </h2>
              </div>

              <SectionContent id={activeSection} />
            </div>

            {/* ── Modal footer ────────────────────────────── */}
            <div style={{ flexShrink: 0, padding: '0.5rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              <span style={{ fontSize: '0.38rem', fontFamily: 'var(--font-pixel)', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>
                POKÉMON DATA ENGINE · GEN 1–9 · ALL REGIONS
              </span>
              <span style={{ fontSize: '0.38rem', fontFamily: 'var(--font-pixel)', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>
                ESC TO CLOSE
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Keyframe injection ────────────────────────────── */}
      <style>{`
        @keyframes guide-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .guide-trigger-btn:hover {
          background: rgba(239,68,68,0.13) !important;
          color: rgba(239,68,68,1) !important;
          border-color: rgba(239,68,68,0.4) !important;
        }
        .guide-trigger-btn:focus-visible {
          outline: 2px solid var(--pk-red);
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
}
