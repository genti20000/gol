"use client";

import React from 'react';

export default function Spinner({ className = '' }: { className?: string }) {
  return <span className={`lkc-spinner ${className}`.trim()} aria-hidden="true" />;
}
