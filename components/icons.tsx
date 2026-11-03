
import React from 'react';

export const UploadIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

export const MagicWandIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.25278C12 6.25278 12.5699 3.74722 14.75 3.74722C16.9301 3.74722 17.5 6.25278 17.5 6.25278C17.5 6.25278 20 6.82267 20 9C20 11.1773 17.5 11.7472 17.5 11.7472C17.5 11.7472 16.9301 14.2528 14.75 14.2528C12.5699 14.2528 12 11.7472 12 11.7472M12 6.25278L5.99998 12.2528M9.5 2.5L10.6464 4.85355M3 8L5.35355 9.14645M3.5 15.5L4.85355 14.1464M9.25281 20L12 11.7472" />
  </svg>
);

export const EyedropperIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.052A2 2 0 0113 3h0a2 2 0 012 2v2.052M15 7.052V9a2 2 0 01-2 2h-2a2 2 0 01-2-2V7.052M11 5.052A2 2 0 009 7h0a2 2 0 002 2v2.052M13 15.948V19a2 2 0 01-2 2h-2a2 2 0 01-2-2v-3.052M11 11.948L13 13m2 0l-2-2" />
  </svg>
);

export const DownloadIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

export const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
