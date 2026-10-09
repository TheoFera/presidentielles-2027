package fr.presidentielles2027.jeu;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.webkit.WebViewAssetLoader;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Arrays;

/**
 * Affiche le jeu web (dossier dist/, copié dans les assets) en plein écran.
 * Les fichiers sont servis depuis une adresse https locale, sans réseau : les modules
 * JavaScript, le stockage du profil et la caméra fonctionnent comme dans un navigateur.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final int CAMERA_REQUEST = 27;

    // Bouton « retour » d'Android : revient au menu précédent ou met le jeu en pause.
    // Sur l'écran d'accueil, il quitte l'application.
    private static final String BACK_SCRIPT = "(() => {"
            + "const menu = document.getElementById('start-menu');"
            + "const escape = () => new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true });"
            + "if (menu && !menu.hidden) {"
            + "  if (menu.dataset.screen === 'home') return 'exit';"
            + "  menu.dispatchEvent(escape()); return 'menu';"
            + "}"
            + "window.dispatchEvent(escape()); return 'game';"
            + "})()";

    private WebView webView;
    private PermissionRequest pendingPermission;
    private AdsManager ads;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        ads = new AdsManager(this, script -> { if (webView != null) webView.evaluateJavascript(script, null); });
        createWebView();
        webView.loadUrl(START_URL);
        ads.start();
        hideSystemBars();
        preferSixtyHertz();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
    }

    private void createWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(0x22, 0x2a, 0x2c));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        // La taille de police du système ne doit pas déformer l'interface du jeu.
        settings.setTextZoom(100);

        // Connexion au compte PartageTonJeu : Google refuse les connexions dans une WebView,
        // le jeu passe donc par ce pont natif (window.PTJNativeAuth, voir src/network/auth-providers.js).
        webView.addJavascriptInterface(new NativeAuthBridge(), "PTJNativeAuth");
        // Pubs de fin de partie (AdMob) : le jeu décide du moment, voir src/presentation/menus/ads.js.
        webView.addJavascriptInterface(ads.bridge(), "PTJNativeAds");

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (HOST.equals(url.getHost())) return false;
                // Un lien externe s'ouvre dans le navigateur, jamais dans le jeu.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException ignored) {
                    // Aucun navigateur installé : le lien est simplement ignoré.
                }
                return true;
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // Le moteur web a été arrêté (mémoire saturée) : on relance le jeu proprement.
                view.destroy();
                webView = null;
                recreate();
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                boolean cameraOnly = Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                        && HOST.equals(request.getOrigin().getHost());
                if (!cameraOnly) {
                    request.deny();
                } else if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                } else {
                    if (pendingPermission != null) pendingPermission.deny();
                    pendingPermission = request;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST);
                }
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (request == pendingPermission) pendingPermission = null;
            }
        });
    }

    /** Pont appelé par le jeu. Il ne renvoie qu'un jeton d'identité Google : notre serveur le vérifie. */
    private final class NativeAuthBridge {
        @JavascriptInterface
        public String providers() {
            return "[\"google\"]";
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }

        @JavascriptInterface
        public void signIn(String provider, String nonce, String clientId, String requestId) {
            runOnUiThread(() -> startSignIn(provider, nonce, clientId, requestId));
        }
    }

    private void startSignIn(String provider, String nonce, String clientId, String requestId) {
        if (!"google".equals(provider) || clientId == null || clientId.isEmpty() || nonce == null || nonce.isEmpty()) {
            deliverAuth(requestId, "error", "Connexion indisponible sur cet appareil.");
            return;
        }
        // Bouton « Se connecter avec Google » : clientId = identifiant client OAuth « Web » (jeton destiné à notre serveur).
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(clientId).setNonce(nonce).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager.create(this).getCredentialAsync(this, request, new CancellationSignal(), this::runOnUiThread,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        Credential credential = response.getCredential();
                        if (credential instanceof CustomCredential
                                && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                            try {
                                deliverAuth(requestId, "id_token", GoogleIdTokenCredential.createFrom(credential.getData()).getIdToken());
                            } catch (Exception error) {
                                deliverAuth(requestId, "error", "Réponse de Google illisible.");
                            }
                        } else {
                            deliverAuth(requestId, "error", "Type de connexion inattendu.");
                        }
                    }

                    @Override
                    public void onError(GetCredentialException error) {
                        if (error instanceof GetCredentialCancellationException) deliverAuth(requestId, "cancelled", null);
                        else deliverAuth(requestId, "error", "La connexion Google a échoué. Vérifiez la connexion Internet.");
                    }
                });
    }

    private void deliverAuth(String requestId, String kind, String value) {
        if (webView == null) return;
        JSONObject result = new JSONObject();
        try {
            if ("cancelled".equals(kind)) result.put("cancelled", true);
            else result.put(kind, value);
        } catch (JSONException ignored) {
            // Clés fixes : ne peut pas arriver.
        }
        webView.evaluateJavascript("window.PTJNativeAuthResult && window.PTJNativeAuthResult("
                + JSONObject.quote(String.valueOf(requestId)) + "," + JSONObject.quote(result.toString()) + ")", null);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != CAMERA_REQUEST || pendingPermission == null) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            pendingPermission.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            pendingPermission.deny();
            Toast.makeText(this, R.string.camera_refused, Toast.LENGTH_LONG).show();
        }
        pendingPermission = null;
    }

    private void handleBack() {
        if (webView == null) {
            finish();
            return;
        }
        webView.evaluateJavascript(BACK_SCRIPT, result -> {
            if ("\"exit\"".equals(result)) moveTaskToBack(true);
        });
    }

    // Android 12 et moins seulement : à partir d'Android 13, le manifeste active
    // enableOnBackInvokedCallback et le retour passe par registerOnBackInvokedCallback.
    @SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        handleBack();
    }

    /**
     * Écran calé sur 60 Hz pendant le jeu, comme Chrome le fait pour le même jeu. Le jeu affiche
     * environ 60 images par seconde : sur un écran laissé à 120 Hz, elles tombaient tantôt après
     * 16 ms, tantôt après 25 ms, et ce rythme irrégulier se voyait comme des saccades
     * (mesuré le 05/10/2026 : 61 % d'images saccadées dans l'appli, aucune dans Chrome).
     * Deux fois moins d'images à composer : le téléphone chauffe aussi moins vite.
     */
    @SuppressWarnings("deprecation")
    private void preferSixtyHertz() {
        Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? getDisplay() : getWindowManager().getDefaultDisplay();
        if (display == null) return;
        Display.Mode current = display.getMode();
        for (Display.Mode mode : display.getSupportedModes()) {
            if (mode.getPhysicalWidth() == current.getPhysicalWidth() && mode.getPhysicalHeight() == current.getPhysicalHeight()
                    && Math.abs(mode.getRefreshRate() - 60f) < 1f) {
                WindowManager.LayoutParams attributes = getWindow().getAttributes();
                attributes.preferredDisplayModeId = mode.getModeId();
                attributes.preferredRefreshRate = mode.getRefreshRate();
                getWindow().setAttributes(attributes);
                return;
            }
        }
    }

    private void hideSystemBars() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            hideSystemBarsLegacy(window.getDecorView());
        }
    }

    @SuppressWarnings("deprecation")
    private static void hideSystemBarsLegacy(View decor) {
        decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (pendingPermission != null) pendingPermission.deny();
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
