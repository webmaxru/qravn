import com.android.build.api.artifact.SingleArtifact
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

// Upload-key material never lives in the repository. Without this file the
// release build is simply unsigned, which is what CI and local size checks want.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

android {
    namespace = "no.qravn.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "no.qravn.android"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // The bundled ML Kit model plus the Rust core are the whole analyser.
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
        }
    }

    signingConfigs {
        if (keystoreProperties.containsKey("storeFile")) {
            create("upload") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("upload")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    androidResources {
        // Per-app language selection is offered through localeConfig.
        localeFilters += listOf("en", "nb", "nn")
    }

    lint {
        warningsAsErrors = true
        abortOnError = true
        // Dependency-freshness checks are handled by review, not by the build:
        // a newer AGP or library appearing upstream must not break CI.
        disable += listOf(
            "GradleDependency",
            "NewerVersionAvailable",
            "AndroidGradlePluginVersion",
            "ObsoleteLintCustomCheck",
            // Same reasoning, and worse: OldTargetApi compares targetSdk against
            // whatever platforms happen to be installed on the build machine, so
            // it passes locally and fails on a CI runner with a newer SDK image.
            // A machine-dependent gate cannot be a gate. Raising targetSdk is a
            // deliberate act that follows testing against the new behaviours.
            "OldTargetApi",
        )
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

/**
 * Fails the build if any dependency introduces a permission we did not ask for.
 *
 * The product promise is that checking a hostile code never tells its
 * destination that anyone looked. Architecture alone cannot guarantee that:
 * a transitive library only has to declare INTERNET for the guarantee to
 * quietly become "we believe no code calls out". With no network permission
 * in the merged manifest the OS enforces it instead of us.
 *
 * This is an allowlist rather than a list of banned permissions, so a
 * dependency cannot sneak past it by requesting something we never thought of.
 */
abstract class VerifyOfflineManifestTask : DefaultTask() {

    @get:InputFile
    abstract val mergedManifest: RegularFileProperty

    @get:Input
    abstract val allowedPermissions: SetProperty<String>

    @TaskAction
    fun verify() {
        val document = javax.xml.parsers.DocumentBuilderFactory.newInstance()
            .apply { isNamespaceAware = true }
            .newDocumentBuilder()
            .parse(mergedManifest.get().asFile)

        val androidNs = "http://schemas.android.com/apk/res/android"
        val declared = sequenceOf("uses-permission", "uses-permission-sdk-23")
            .flatMap { tag ->
                val nodes = document.getElementsByTagName(tag)
                (0 until nodes.length).asSequence().map { nodes.item(it) }
            }
            .mapNotNull { it.attributes.getNamedItemNS(androidNs, "name")?.nodeValue }
            .toSortedSet()

        val allowed = allowedPermissions.get()
        val unexpected = declared - allowed

        if (unexpected.isNotEmpty()) {
            throw GradleException(
                buildString {
                    appendLine("The merged manifest requests permissions this app did not ask for:")
                    unexpected.forEach { appendLine("  - $it") }
                    appendLine()
                    appendLine("A dependency added them. Either drop that dependency or add a")
                    appendLine("tools:node=\"remove\" entry, and explain it in the pull request.")
                    appendLine("A network permission in particular breaks a product invariant:")
                    appendLine("offline analysis is enforced by the platform, not just by our code.")
                },
            )
        }

        logger.lifecycle("Manifest permissions verified: ${declared.joinToString()}")
    }
}

androidComponents {
    onVariants { variant ->
        val name = variant.name.replaceFirstChar { it.uppercase() }
        val verify = tasks.register<VerifyOfflineManifestTask>("verify${name}OfflineManifest") {
            group = "verification"
            description = "Fails if the merged $name manifest requests an unexpected permission."
            mergedManifest.set(variant.artifacts.get(SingleArtifact.MERGED_MANIFEST))
            allowedPermissions.set(
                variant.applicationId.map { applicationId ->
                    setOf(
                        "android.permission.CAMERA",
                        // Added by AndroidX for its own runtime-registered receivers.
                        "$applicationId.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION",
                    )
                },
            )
        }
        tasks.matching { it.name == "assemble$name" || it.name == "bundle$name" }
            .configureEach { dependsOn(verify) }
    }
}

dependencies {
    implementation(project(":safety-core"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.kotlinx.coroutines.android)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)

    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)

    // Bundled model: the product promises offline scanning from first launch,
    // so the Play Services variant that may need a download is not acceptable.
    implementation(libs.mlkit.barcode.scanning)

    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)

    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
