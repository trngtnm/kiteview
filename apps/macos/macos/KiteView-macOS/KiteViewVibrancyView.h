#import <AppKit/AppKit.h>
#import <React/RCTView.h>
#import <React/RCTViewManager.h>

@interface KiteViewVibrancyView : RCTView
@property (nonatomic, copy) NSString *colorScheme;
@end

@interface KiteViewVibrancyViewManager : RCTViewManager
@end
