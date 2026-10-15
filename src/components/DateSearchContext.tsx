import { createContext } from 'react';
export const DateSearchContext = createContext<{ query: string; clear: () => void }>({ query: '', clear: () => {} });
