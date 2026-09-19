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

RCT_EXPORT_METHOD(renamePdf:(NSString *)uri
                  name:(NSString *)name
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  RCTExecuteOnMainQueue(^{
    NSURL *sourceURL = [NSURL URLWithString:uri];
    NSString *safeName = [name lastPathComponent];
    if (sourceURL == nil || safeName.length == 0 || [safeName isEqualToString:@"."]) {
      reject(@"invalid_name", @"Enter a valid PDF name", nil);
      return;
    }
    if (![[safeName pathExtension].lowercaseString isEqualToString:@"pdf"]) {
      safeName = [safeName stringByAppendingPathExtension:@"pdf"];
    }

    NSURL *destinationURL = [[sourceURL URLByDeletingLastPathComponent]
      URLByAppendingPathComponent:safeName];
    BOOL accessed = [sourceURL startAccessingSecurityScopedResource];
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSError *moveError = nil;
    BOOL moved = [fileManager moveItemAtURL:sourceURL toURL:destinationURL error:&moveError];
    if (accessed) {
      [sourceURL stopAccessingSecurityScopedResource];
    }
    if (!moved) {
      reject(@"rename_failed", moveError.localizedDescription ?: @"Could not rename PDF", moveError);
      return;
    }

    BOOL destinationAccessed = [destinationURL startAccessingSecurityScopedResource];
    NSError *readError = nil;
    NSData *data = [NSData dataWithContentsOfURL:destinationURL options:0 error:&readError];
    if (destinationAccessed) {
      [destinationURL stopAccessingSecurityScopedResource];
    }
    if (data == nil) {
      reject(@"read_failed", readError.localizedDescription ?: @"Could not read renamed PDF", readError);
      return;
    }
    resolve(@{
      @"uri": destinationURL.absoluteString ?: @"",
      @"name": safeName,
      @"base64": [data base64EncodedStringWithOptions:0] ?: @"",
    });
  });
}

RCT_EXPORT_METHOD(annotatePhrase:(NSString *)endpoint
                  anonKey:(NSString *)anonKey
                  phrase:(NSString *)phrase
                  pageNumber:(NSNumber *)pageNumber
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [NSURL URLWithString:endpoint];
  if (url == nil || anonKey.length == 0 || phrase.length == 0) {
    reject(@"invalid_request", @"GPT endpoint configuration is invalid", nil);
    return;
  }
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  [request setValue:[NSString stringWithFormat:@"Bearer %@", anonKey] forHTTPHeaderField:@"Authorization"];
  [request setValue:anonKey forHTTPHeaderField:@"apikey"];
  NSDictionary *body = @{
    @"selection_text": phrase,
    @"text": phrase,
    @"page_number": pageNumber ?: @0,
    @"annotation_type": @"paraphrase",
    @"instruction": @"Explain the selected phrase in clear layman terms and briefly describe what it means in context.",
  };
  NSError *serializationError = nil;
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:&serializationError];
  if (serializationError != nil) {
    reject(@"serialization_failed", serializationError.localizedDescription, serializationError);
    return;
  }
  [[[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error != nil) {
      reject(@"network_failed", error.localizedDescription ?: @"GPT request failed", error);
      return;
    }
    NSInteger status = [(NSHTTPURLResponse *)response statusCode];
    NSError *jsonError = nil;
    id json = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:&jsonError] : nil;
    if (status < 200 || status >= 300) {
      NSString *message = [json isKindOfClass:[NSDictionary class]] ? json[@"message"] : nil;
      reject(@"request_failed", message ?: [NSString stringWithFormat:@"GPT request failed (%ld)", (long)status], jsonError);
      return;
    }
    if (jsonError != nil || json == nil) {
      reject(@"invalid_response", @"GPT returned invalid JSON", jsonError);
      return;
    }
    resolve(json);
  }] resume];
}

@end
