import React, { useState } from 'react';
import logoImg1 from '../assets/logo.png';
import logoImg2 from '../assets/logo.jpg';
import logoImg3 from '../assets/images/eng_official_logo_1787076844404.jpg';

interface EngLogoProps {
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
  showFallbackText?: boolean;
}

export const EngLogo: React.FC<EngLogoProps> = ({
  className = 'object-contain',
  style,
  alt = 'ENG Smart Store Logo',
}) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Robust sources list: Bundled asset imports first, followed by public static paths
  const sources = [
    logoImg1,
    logoImg2,
    logoImg3,
    '/logo.png',
    '/logo.jpg',
    '/icon.png'
  ];
  const currentSrc = sources[srcIndex] || logoImg1;

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <img
        src={currentSrc}
        alt={alt}
        style={style}
        loading="eager"
        decoding="async"
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          if (srcIndex < sources.length - 1) {
            setSrcIndex((prev) => prev + 1);
          }
        }}
        className={`${className} transition-opacity duration-200 ${
          imgLoaded ? 'opacity-100' : 'opacity-90'
        }`}
      />
    </div>
  );
};
