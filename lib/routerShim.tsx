import React, { createContext, useContext } from 'react';

export interface RouteState {
  path: string;
  params: URLSearchParams;
}

export interface RouterContextValue {
  route: RouteState;
  navigate: (pathWithQuery: string) => void;
  back: () => void;
}

export const RouterContext = createContext<RouterContextValue>({
  route: { path: '/', params: new URLSearchParams() },
  navigate: () => { },
  back: () => { },
});

export const useRouterShim = () => useContext(RouterContext);