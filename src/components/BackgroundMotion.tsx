import React from 'react';
import { useTheme } from '../context/ThemeContext';

export type BackgroundConcept = 'flowing' | 'shadow' | 'type' | 'paper' | 'grid';

interface BackgroundMotionProps {
  concept?: BackgroundConcept;
}

const CONCEPTS: BackgroundConcept[] = ['flowing', 'shadow', 'type', 'paper', 'grid'];

function getConcept(): BackgroundConcept {
  if (typeof window === 'undefined') return 'flowing';
  const query = new URLSearchParams(window.location.search).get('background') as BackgroundConcept | null;
  if (query && CONCEPTS.includes(query)) return query;
  return 'flowing';
}

const PaletteDots: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="packsure-bg-palette" aria-hidden="true">
    <span className={dark ? 'dot ivory' : 'dot ivory'} />
    <span className="dot petrol" />
    <span className="dot terracotta" />
  </div>
);

const FlowingShapes: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className={`packsure-bg-scene packsure-flowing ${dark ? 'is-dark' : 'is-light'}`} aria-hidden="true">
    <div className="flow flow-one" />
    <div className="flow flow-two" />
    <div className="flow flow-three" />
    <div className="flow flow-four" />
    <div className="flow-hairline" />
    <PaletteDots dark={dark} />
  </div>
);

const ShadowPlay: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className={`packsure-bg-scene packsure-shadow-play ${dark ? 'is-dark' : 'is-light'}`} aria-hidden="true">
    <div className="architecture arch-left" />
    <div className="architecture arch-right" />
    <div className="sun-plane" />
    <div className="moving-shadow shadow-a" />
    <div className="moving-shadow shadow-b" />
    <div className="moving-shadow shadow-c" />
    <PaletteDots dark={dark} />
  </div>
);

const KineticType: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className={`packsure-bg-scene packsure-kinetic-type ${dark ? 'is-dark' : 'is-light'}`} aria-hidden="true">
    <div className="type-word type-pack">PACKSURE</div>
    <div className="type-word type-verify">VERIFY</div>
    <div className="type-rule" />
    <div className="type-accent" />
    <PaletteDots dark={dark} />
  </div>
);

const PaperFlow: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className={`packsure-bg-scene packsure-paper-flow ${dark ? 'is-dark' : 'is-light'}`} aria-hidden="true">
    <div className="paper-sheet paper-back" />
    <div className="paper-sheet paper-mid" />
    <div className="paper-sheet paper-front" />
    <div className="paper-fold fold-accent" />
    <PaletteDots dark={dark} />
  </div>
);

const AbstractGrid: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className={`packsure-bg-scene packsure-abstract-grid ${dark ? 'is-dark' : 'is-light'}`} aria-hidden="true">
    <div className="grid-lines" />
    <div className="grid-block block-a" />
    <div className="grid-block block-b" />
    <div className="grid-block block-c" />
    <div className="grid-block block-d" />
    <div className="grid-block block-e" />
    <div className="grid-block block-f" />
    <PaletteDots dark={dark} />
  </div>
);

export const BackgroundMotion: React.FC<BackgroundMotionProps> = ({ concept }) => {
  const { isDark } = useTheme();
  const selectedConcept = concept ?? getConcept();

  return (
    <div className="packsure-background-root" data-background-concept={selectedConcept} aria-hidden="true">
      {selectedConcept === 'flowing' && <FlowingShapes dark={isDark} />}
      {selectedConcept === 'shadow' && <ShadowPlay dark={isDark} />}
      {selectedConcept === 'type' && <KineticType dark={isDark} />}
      {selectedConcept === 'paper' && <PaperFlow dark={isDark} />}
      {selectedConcept === 'grid' && <AbstractGrid dark={isDark} />}
      <div className="packsure-bg-vignette" />
    </div>
  );
};
