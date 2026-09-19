import {create} from 'zustand';
import type {PickedPdfFile} from './filePicker';

export type DocumentTab = PickedPdfFile & {id: string};

type DocumentState = {
  file: PickedPdfFile | null;
  tabs: DocumentTab[];
  activeTabId: string | null;
  setFile: (file: PickedPdfFile) => void;
  updateFile: (file: PickedPdfFile) => void;
  selectTab: (id: string) => void;
  renameFile: (name: string) => void;
  closeTab: (id: string) => void;
  clearFile: () => void;
};

let nextTabId = 0;

export const useDocumentStore = create<DocumentState>(set => ({
  file: null,
  tabs: [],
  activeTabId: null,
  setFile: file =>
    set(state => {
      const tab = {
        ...file,
        id: `${Date.now()}-${nextTabId++}`,
      };
      return {
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
        file: tab,
      };
    }),
  updateFile: file =>
    set(state => {
      if (!state.activeTabId) {
        return state;
      }
      const tabs = state.tabs.map(tab =>
        tab.id === state.activeTabId ? {...file, id: tab.id} : tab,
      );
      return {tabs, file: {...file}};
    }),
  selectTab: id =>
    set(state => {
      const tab = state.tabs.find(item => item.id === id);
      return tab ? {activeTabId: id, file: tab} : state;
    }),
  renameFile: name =>
    set(state => {
      if (!state.file) {
        return state;
      }
      const tabs = state.tabs.map(tab =>
        tab.id === state.activeTabId ? {...tab, name} : tab,
      );
      return {tabs, file: {...state.file, name}};
    }),
  closeTab: id =>
    set(state => {
      const index = state.tabs.findIndex(tab => tab.id === id);
      if (index < 0) {
        return state;
      }
      const tabs = state.tabs.filter(tab => tab.id !== id);
      if (id !== state.activeTabId) {
        return {tabs};
      }
      const nextTab = tabs[Math.max(0, index - 1)] ?? tabs[0] ?? null;
      return {
        tabs,
        activeTabId: nextTab?.id ?? null,
        file: nextTab,
      };
    }),
  clearFile: () => set({file: null, tabs: [], activeTabId: null}),
}));
