#import "../bridge/DZRecorder.h"
#import "DualRecorderCore-Swift-Cxx-Umbrella.hpp"

@implementation DZRecorder
+ (NSString *)start:(NSString *)request { return [DZRecorderCore start:request]; }
+ (NSString *)capturePhoto:(NSString *)request error:(NSError **)error {
  return [DZRecorderCore capturePhoto:request error:error];
}
+ (void)stop:(void (^)(NSString *))completion { [DZRecorderCore stop:completion]; }
+ (NSString *)stats { return [DZRecorderCore stats]; }
+ (void)finish:(NSString *)reason { [DZRecorderCore finish:reason]; }
+ (void)setStoppedHandler:(void (^)(NSString *))handler { [DZRecorderCore setStoppedHandler:handler]; }
+ (UIView *)makePreview { return [DZRecorderCore makePreview]; }
+ (void)updatePreview:(UIView *)view channel:(NSInteger)channel portrait:(BOOL)portrait position:(double)position mirrored:(BOOL)mirrored {
  [DZRecorderCore updatePreview:view channel:channel portrait:portrait position:position mirrored:mirrored];
}
@end
