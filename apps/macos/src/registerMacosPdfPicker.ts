import {NativeModules} from 'react-native';
import {
  registerPickPdfFile,
  type PickedPdfFile,
} from '@kiteview/core';

type NativePicker = {
  pickPdf: () => Promise<PickedPdfFile | null>;
};

const {KiteViewFilePicker} = NativeModules as {
  KiteViewFilePicker?: NativePicker;
};

export function registerMacosPdfPicker(): void {
  registerPickPdfFile(async () => {
    if (!KiteViewFilePicker?.pickPdf) {
      throw new Error('KiteViewFilePicker native module is not linked');
    }
    const result = await KiteViewFilePicker.pickPdf();
    if (!result) {
      return null;
    }
    return {
      uri: result.uri,
      name: result.name,
      base64: result.base64,
    };
  });
}
