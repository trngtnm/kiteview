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
                  accessToken:(NSString *)accessToken
                  anonKey:(NSString *)anonKey
                  phrase:(NSString *)phrase
                  pageNumber:(NSNumber *)pageNumber
                  annotationType:(NSString *)annotationType
                  context:(NSString *)context
                  customInstructions:(NSString *)customInstructions
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [NSURL URLWithString:endpoint];
  if (url == nil || accessToken.length == 0 || anonKey.length == 0 || phrase.length == 0) {
    reject(@"invalid_request", @"GPT endpoint configuration is invalid", nil);
    return;
  }
  NSString *type =
      (annotationType != nil && annotationType.length > 0) ? annotationType : @"explain";
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  [request setValue:[NSString stringWithFormat:@"Bearer %@", accessToken] forHTTPHeaderField:@"Authorization"];
  [request setValue:anonKey forHTTPHeaderField:@"apikey"];
  NSMutableDictionary *body = [@{
    @"selection_text": phrase ?: @"",
    @"text": phrase ?: @"",
    @"page_number": pageNumber ?: @0,
    @"annotation_type": type,
  } mutableCopy];
  if (context != nil && context.length > 0) {
    body[@"context"] = context;
  }
  if (customInstructions != nil && customInstructions.length > 0) {
    body[@"custom_instructions"] = customInstructions;
  }
  NSError *serializationError = nil;
  NSData *bodyData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&serializationError];
  if (serializationError != nil || bodyData == nil) {
    reject(@"serialization_failed", serializationError.localizedDescription ?: @"Could not encode request", serializationError);
    return;
  }
  request.HTTPBody = bodyData;
  [[[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error != nil) {
      reject(@"network_failed", error.localizedDescription ?: @"GPT request failed", error);
      return;
    }
    NSInteger status = [(NSHTTPURLResponse *)response statusCode];
    NSError *jsonError = nil;
    id json = nil;
    if (data.length > 0) {
      json = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingAllowFragments error:&jsonError];
    }
    if (status < 200 || status >= 300) {
      NSString *message = nil;
      if ([json isKindOfClass:[NSDictionary class]]) {
        message = json[@"error"] ?: json[@"message"];
      }
      reject(@"request_failed", message ?: [NSString stringWithFormat:@"GPT request failed (%ld)", (long)status], jsonError);
      return;
    }
    if ([json isKindOfClass:[NSDictionary class]]) {
      NSDictionary *dict = (NSDictionary *)json;
      NSString *content = nil;
      id contentValue = dict[@"content"] ?: dict[@"explanation"] ?: dict[@"paraphrase"] ?: dict[@"result"];
      if ([contentValue isKindOfClass:[NSString class]]) {
        content = [(NSString *)contentValue stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
      }
      if (content.length == 0) {
        id choices = dict[@"choices"];
        if ([choices isKindOfClass:[NSArray class]] && [(NSArray *)choices count] > 0) {
          id first = [(NSArray *)choices firstObject];
          if ([first isKindOfClass:[NSDictionary class]]) {
            id message = first[@"message"];
            if ([message isKindOfClass:[NSDictionary class]]) {
              id nested = message[@"content"];
              if ([nested isKindOfClass:[NSString class]]) {
                content = [(NSString *)nested stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
              }
            }
          }
        }
      }
      if (content.length == 0) {
        NSString *err = [dict[@"error"] isKindOfClass:[NSString class]] ? dict[@"error"] : @"The annotation response was empty";
        reject(@"empty_response", err, nil);
        return;
      }
      // Always resolve a JS-friendly contract so Metro/JSC never drops fields.
      resolve(@{
        @"content": content,
        @"explanation": content,
        @"paraphrase": content,
        @"annotation_type": dict[@"annotation_type"] ?: type,
        @"page_number": dict[@"page_number"] ?: (pageNumber ?: @0),
      });
      return;
    }
    if ([json isKindOfClass:[NSString class]]) {
      NSString *content = [(NSString *)json stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
      if (content.length == 0) {
        reject(@"empty_response", @"The annotation response was empty", nil);
        return;
      }
      resolve(@{
        @"content": content,
        @"explanation": content,
        @"paraphrase": content,
        @"annotation_type": type,
        @"page_number": pageNumber ?: @0,
      });
      return;
    }
    reject(@"invalid_response", @"GPT returned invalid JSON", jsonError);
  }] resume];
}

@end
