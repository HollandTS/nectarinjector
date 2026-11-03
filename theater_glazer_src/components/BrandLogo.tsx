import React from 'react';

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
}

export const PinkCrystal: React.FC<LogoProps> = ({ className, ...props }) => (
  <img
    src="https://raw.githubusercontent.com/HollandTS/retro_building_generator/refs/heads/main/logo/crystal_logo.png"
    alt="Crystal Logo"
    className={className}
    referrerPolicy="no-referrer"
    {...props}
  />
);

export const SugarVibesText: React.FC<LogoProps> = ({ className, ...props }) => (
  <img
    src="https://raw.githubusercontent.com/HollandTS/retro_building_generator/refs/heads/main/logo/sugarkane_logo.png"
    alt="Sugarkane Title Logo"
    className={className}
    referrerPolicy="no-referrer"
    {...props}
  />
);
