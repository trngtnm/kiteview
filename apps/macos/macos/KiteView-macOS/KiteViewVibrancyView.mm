#import "KiteViewVibrancyView.h"

@interface KiteViewVibrancyView ()
@property (nonatomic, strong) NSVisualEffectView *effectView;
@property (nonatomic, strong) NSView *tintView;
@end

@implementation KiteViewVibrancyView

- (instancetype)initWithFrame:(NSRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    self.wantsLayer = YES;
    self.layer.backgroundColor = NSColor.clearColor.CGColor;
    self.layer.cornerRadius = 12.0;
    self.layer.masksToBounds = YES;
    if ([self respondsToSelector:@selector(setBackgroundColor:)]) {
      [(id)self setBackgroundColor:[NSColor clearColor]];
    }

    // Behind-window blending gives a real frosted blur even when the
    // content under the panel is a WKWebView (which within-window can't sample).
    _effectView = [[NSVisualEffectView alloc] initWithFrame:self.bounds];
    _effectView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    _effectView.material = NSVisualEffectMaterialHUDWindow;
    _effectView.blendingMode = NSVisualEffectBlendingModeBehindWindow;
    _effectView.state = NSVisualEffectStateActive;
    _effectView.wantsLayer = YES;
    _effectView.layer.cornerRadius = 12.0;
    _effectView.layer.masksToBounds = YES;
    if (@available(macOS 10.14, *)) {
      _effectView.appearance =
          [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];
    }

    // Extra dark tint so the panel stays readable over bright desktops.
    _tintView = [[NSView alloc] initWithFrame:self.bounds];
    _tintView.wantsLayer = YES;
    _tintView.layer.backgroundColor =
        [NSColor colorWithCalibratedWhite:0.0 alpha:0.28].CGColor;
    _tintView.layer.cornerRadius = 12.0;
    _tintView.layer.masksToBounds = YES;
    _tintView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;

    [self addSubview:_effectView positioned:NSWindowBelow relativeTo:nil];
    [self addSubview:_tintView positioned:NSWindowAbove relativeTo:_effectView];
  }
  return self;
}

- (void)layout
{
  [super layout];
  self.effectView.frame = self.bounds;
  self.tintView.frame = self.bounds;
}

- (void)didAddSubview:(NSView *)subview
{
  [super didAddSubview:subview];
  if (subview != self.effectView && subview != self.tintView) {
    [self addSubview:self.effectView positioned:NSWindowBelow relativeTo:nil];
    [self addSubview:self.tintView
          positioned:NSWindowAbove
          relativeTo:self.effectView];
  }
}

@end

@implementation KiteViewVibrancyViewManager

RCT_EXPORT_MODULE(KiteViewVibrancyView)

- (NSView *)view
{
  return [[KiteViewVibrancyView alloc] init];
}

@end
