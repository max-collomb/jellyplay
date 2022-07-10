import React from 'react';

export enum ItemAction {
  play = "play",
  open = "open",
};

export interface CustomToggleProps {
  children?: React.ReactNode;
  onClick: (evt: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const MoreToggle = React.forwardRef<HTMLAnchorElement, CustomToggleProps>(({ children, onClick }, ref: React.LegacyRef<HTMLAnchorElement>) => (
  <a href="" ref={ref} className="link-light me-3" onClick={(e) => {
      e.preventDefault();
      onClick(e);
    }}>
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
      <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
    </svg>
  </a>
));

export const MultiItem = React.forwardRef<HTMLElement, CustomToggleProps>(({ children, onClick }, ref: React.LegacyRef<HTMLElement>) => {
    return <span ref={ref} className="d-block text-nowrap p-2" onClick={onClick}>{children}</span>;
  },
);

export function cleanString(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
