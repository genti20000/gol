"use client";

import { useNavigate, useLocation } from 'react-router-dom';

export interface RouteState {
  path: string;
  params: URLSearchParams;
}

export interface RouterContextValue {
  route: RouteState;
  navigate: (pathWithQuery: string) => void;
  back: () => void;
}

export const useRouterShim = (): RouterContextValue => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  return {
    route: { 
      path: location.pathname, 
      params: searchParams 
    },
    navigate: (path: string) => navigate(path),
    back: () => navigate(-1)
  };
};