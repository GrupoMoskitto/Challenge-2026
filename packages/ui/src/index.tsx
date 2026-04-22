import React from 'react';

export function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props}>{children}</button>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
