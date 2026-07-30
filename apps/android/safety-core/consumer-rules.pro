# The JNI entry points are resolved by name from native code.
-keepclasseswithmembernames,includedescriptorclasses class no.qrrrgh.safety.NativeSafetyEngine {
    native <methods>;
}

# kotlinx.serialization generated serializers for the frozen v1 contract.
-keepclassmembers class no.qrrrgh.safety.** {
    *** Companion;
}
-keepclasseswithmembers class no.qrrrgh.safety.** {
    kotlinx.serialization.KSerializer serializer(...);
}
