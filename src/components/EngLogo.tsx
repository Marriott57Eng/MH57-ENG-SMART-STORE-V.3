import React, { useState } from 'react';
import logoImg from '../assets/images/eng_official_logo_1787076844404.jpg';

interface EngLogoProps {
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export const EngLogo: React.FC<EngLogoProps> = ({
  className = 'object-contain',
  style,
  alt = 'ENG Smart Store Logo',
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <img
        src={logoImg || '/logo.png'}
        alt={alt}
        style={style}
        loading="eager"
        decoding="async"
        onLoad={() => setImgLoaded(true)}
        onError={(e) => {
          const target = e.currentTarget;
          if (target.src !== window.location.origin + '/logo.png') {
            target.src = '/logo.png';
          }
        }}
        className={`${className}`}
      />
    </div>
  );
};

