import {create} from 'zustand';
import type {PickedPdfFile} from './filePicker';

type DocumentState = {
  file: PickedPdfFile | null;
  setFile: (file: PickedPdfFile) => void;
  renameFile: (name: string) => void;
  clearFile: () => void;
};

export const useDocumentStore = create<DocumentState>(set => ({
  file: null,
  setFile: file => set({file}),
  renameFile: name =>
    set(state => (state.file ? {file: {...state.file, name}} : state)),
  clearFile: () => set({file: null}),
}));
