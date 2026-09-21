#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN
// Objective-C only boundary: the Expo pod never imports Swift/C++ camera types.
@interface DZRecorder : NSObject
+ (nullable NSString *)start:(NSString *)request NS_SWIFT_NAME(start(_:));
+ (nullable NSString *)capturePhoto:(NSString *)request error:(NSError **)error NS_SWIFT_NAME(capturePhoto(_:));
+ (void)stop:(void (^)(NSString *))completion NS_SWIFT_NAME(stop(_:));
+ (NSString *)stats NS_SWIFT_NAME(stats());
+ (void)finish:(NSString *)reason NS_SWIFT_NAME(finish(_:));
+ (void)setStoppedHandler:(nullable void (^)(NSString *))handler NS_SWIFT_NAME(setStoppedHandler(_:));
+ (UIView *)makePreview NS_SWIFT_NAME(makePreview());
+ (void)updatePreview:(UIView *)view channel:(NSInteger)channel portrait:(BOOL)portrait position:(double)position mirrored:(BOOL)mirrored NS_SWIFT_NAME(updatePreview(_:channel:portrait:position:mirrored:));
@end
NS_ASSUME_NONNULL_END
