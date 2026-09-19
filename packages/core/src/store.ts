import {create} from 'zustand';
import type {PickedPdfFile} from './filePicker';

type DocumentState = {
  file: PickedPdfFile | null;
  setFile: (file: PickedPdfFile) => void;
  clearFile: () => void;
};

export const useDocumentStore = create<DocumentState>(set => ({
  file: null,
  setFile: file => set({file}),
  clearFile: () => set({file: null}),
}));
