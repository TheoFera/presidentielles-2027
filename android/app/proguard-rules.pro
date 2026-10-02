# Pont de connexion (window.PTJNativeAuth) appelé depuis le JavaScript du jeu : à ne pas renommer.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
# Credential Manager (connexion Google) : règle recommandée par Google.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** {
  *;
}
