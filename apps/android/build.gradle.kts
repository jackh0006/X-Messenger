plugins {
    id 'com.android.application' version '8.3.0' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.20' apply false
    id 'com.google.gms.google-services' version '4.4.1' apply false
}

tasks.register('clean', Delete) {
    delete rootProject.buildDir
}

ext {
    compose_ui_version = '1.6.0'
    compose_bom_version = '2024.02.00'
    kotlin_version = '1.9.20'
    agp_version = '8.3.0'
    compile_sdk = 34
    min_sdk = 24
    target_sdk = 34
    java_version = 17
}