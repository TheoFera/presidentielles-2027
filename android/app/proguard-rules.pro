# Pont de connexion (window.PTJNativeAuth) appelé depuis le JavaScript du jeu : à ne pas renommer.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
# Credential Manager (connexion Google) : règle recommandée par Google.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** {
  *;
}
# Bases Room (WorkManager, utilisé par le SDK des pubs) : la bibliothèque crée « WorkDatabase_Impl »
# par son nom, à l'exécution. Sans ces règles, R8 (plugin Android 9) retire son constructeur et
# la version Play Store plante au démarrage (« Failed to create an instance of WorkDatabase », 05/10/2026).
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
