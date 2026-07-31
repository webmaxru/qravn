# The JNI entry points are resolved by name from native code.
-keepclasseswithmembernames,includedescriptorclasses class no.qravn.safety.NativeSafetyEngine {
    native <methods>;
}

# kotlinx.serialization generated serializers for the frozen v1 contract.
-keepclassmembers class no.qravn.safety.** {
    *** Companion;
}
-keepclasseswithmembers class no.qravn.safety.** {
    kotlinx.serialization.KSerializer serializer(...);
}
