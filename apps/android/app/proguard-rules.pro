# The frozen v1 contract classes are decoded from JSON produced by the Rust core.
-keepclassmembers class no.qrrrgh.safety.** {
    <fields>;
}

# ML Kit bundled barcode model.
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Raw payloads must never reach a production log.
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
