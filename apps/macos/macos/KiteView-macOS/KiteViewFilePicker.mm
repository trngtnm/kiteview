#import "KiteViewFilePicker.h"

#import <AppKit/AppKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <React/RCTUtils.h>

@implementation KiteViewFilePicker

RCT_EXPORT_MODULE(KiteViewFilePicker);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(pickPdf:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  RCTExecuteOnMainQueue(^{
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.canChooseFiles = YES;
    panel.canChooseDirectories = NO;
    panel.allowsMultipleSelection = NO;
    panel.allowedContentTypes = @[ UTTypePDF ];
    panel.message = @"Select a PDF to open in KiteView";
    panel.prompt = @"Open";

    NSModalResponse response = [panel runModal];
    if (response != NSModalResponseOK || panel.URL == nil) {
      resolve([NSNull null]);
      return;
    }

    NSURL *url = panel.URL;
    BOOL accessed = [url startAccessingSecurityScopedResource];
    NSError *readError = nil;
    NSData *data = [NSData dataWithContentsOfURL:url options:0 error:&readError];
    if (accessed) {
      [url stopAccessingSecurityScopedResource];
    }

    if (data == nil) {
      reject(@"read_failed", readError.localizedDescription ?: @"Could not read PDF", readError);
      return;
    }

    NSString *base64 = [data base64EncodedStringWithOptions:0];
    NSString *name = url.lastPathComponent ?: @"document.pdf";
    NSString *uri = url.absoluteString ?: @"";

    resolve(@{
      @"uri" : uri,
      @"name" : name,
      @"base64" : base64 ?: @"",
    });
  });
}

@end
