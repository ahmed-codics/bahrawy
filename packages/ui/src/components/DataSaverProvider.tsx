'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'data-saver';

type DataSaverContextValue = {
  enabled: boolean;
  explicit: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
};

const DataSaverContext = createContext<DataSaverContextValue | null>(null);

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

export function DataSaverProvider({ children }: { children: ReactNode }) {
  const [explicit, setExplicit] = useState(false);
  const [systemSaveData, setSystemSaveData] = useState(false);

  useEffect(() => {
    setExplicit(window.localStorage.getItem(STORAGE_KEY) === 'true');
    setSystemSaveData(Boolean((navigator as NavigatorWithConnection).connection?.saveData));
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setExplicit(enabled);
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    document.documentElement.dataset.dataSaver = enabled ? 'on' : 'off';
  }, []);

  useEffect(() => {
    document.documentElement.dataset.dataSaver = explicit || systemSaveData ? 'on' : 'off';
  }, [explicit, systemSaveData]);

  const value = useMemo(
    () => ({
      enabled: explicit || systemSaveData,
      explicit,
      setEnabled,
      toggle: () => setEnabled(!explicit),
    }),
    [explicit, setEnabled, systemSaveData],
  );

  return <DataSaverContext.Provider value={value}>{children}</DataSaverContext.Provider>;
}

export function useDataSaver() {
  const context = useContext(DataSaverContext);
  if (!context) {
    return {
      enabled: false,
      explicit: false,
      setEnabled: () => undefined,
      toggle: () => undefined,
    };
  }
  return context;
}
