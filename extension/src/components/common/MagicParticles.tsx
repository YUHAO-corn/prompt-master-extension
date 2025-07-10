import React from 'react';

export function MagicParticles() {
  return (
    <div className="magic-particles">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="magic-particle" />
      ))}
    </div>
  );
}
