plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
}

/** Repository root: apps/android -> apps -> repo root. */
val repoRoot: File = rootDir.parentFile.parentFile
val rustWorkspace = File(repoRoot, "core")
val localizationDir = File(repoRoot, "localization")

val abiTargets = listOf("arm64-v8a", "armeabi-v7a", "x86_64")
val skipNativeBuild = providers.gradleProperty("qrrrgh.skipNativeBuild").orNull == "true"

android {
    namespace = "no.qrrrgh.safety"
    compileSdk = 36
    ndkVersion = "28.2.13676358"

    defaultConfig {
        minSdk = 26
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets.named("main") {
        jniLibs.srcDir(layout.buildDirectory.dir("generated/jniLibs"))
        assets.srcDir(layout.buildDirectory.dir("generated/assets"))
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

/**
 * Cross-compiles core/bindings/android with cargo-ndk.
 *
 * The Rust core is the single source of every verdict; the Android client is
 * not permitted to re-derive one. Building the real binding here is therefore
 * part of the product contract, not an optimisation.
 */
val buildRustJni by tasks.registering(Exec::class) {
    group = "build"
    description = "Cross-compiles the Rust safety core JNI binding for Android."

    val outputDir = layout.buildDirectory.dir("generated/jniLibs")
    workingDir = rustWorkspace
    environment("ANDROID_NDK_HOME", android.ndkDirectory.absolutePath)

    commandLine(
        buildList {
            add("cargo")
            add("ndk")
            add("--platform")
            add("26")
            abiTargets.forEach {
                add("-t")
                add(it)
            }
            add("-o")
            add(outputDir.get().asFile.absolutePath)
            add("build")
            add("--release")
            add("-p")
            add("qrrrgh-safety-jni")
        },
    )

    inputs.dir(File(rustWorkspace, "crates/safety-core/src"))
    inputs.dir(File(rustWorkspace, "bindings/android/src"))
    inputs.file(File(rustWorkspace, "Cargo.toml"))
    inputs.file(File(rustWorkspace, "Cargo.lock"))
    outputs.dir(outputDir)

    onlyIf { !skipNativeBuild }
}

/**
 * The localization catalogs are shared with the web client and are the only
 * source of finding, limitation and verdict wording. They are copied rather
 * than duplicated so a Norwegian string can never drift between surfaces.
 */
val syncLocalizationCatalogs by tasks.registering(Sync::class) {
    group = "build"
    description = "Copies the shared localization catalogs into library assets."
    from(localizationDir) {
        include("nb.json", "nn.json", "en.json")
    }
    into(layout.buildDirectory.dir("generated/assets/localization"))
}

tasks.named("preBuild") {
    dependsOn(buildRustJni, syncLocalizationCatalogs)
}

dependencies {
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.kotlinx.coroutines.test)
}
