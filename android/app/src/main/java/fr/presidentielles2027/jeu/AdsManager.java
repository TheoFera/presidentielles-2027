package fr.presidentielles2027.jeu;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Publicités interstitielles AdMob. Le jeu choisit le moment (src/presentation/menus/ads.js, fin de partie) ;
 * ici on demande le consentement (RGPD), on précharge une pub et on l'affiche sur demande.
 * Pont JavaScript : window.PTJNativeAds. Sans identifiant de bloc d'annonces, rien n'est chargé.
 */
final class AdsManager {
    /** Exécute un script dans le jeu (WebView). */
    interface ScriptRunner {
        void run(String script);
    }

    // Une pub chargée expire au bout d'une heure : on la recharge un peu avant.
    private static final long MAX_AGE_MS = 55 * 60 * 1000L;
    private static final long RETRY_MS = 60 * 1000L;

    private final Activity activity;
    private final ScriptRunner script;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final AtomicBoolean started = new AtomicBoolean(false);
    private final String unitId = BuildConfig.ADMOB_INTERSTITIAL_ID;
    private volatile ConsentInformation consent;
    private volatile InterstitialAd interstitial;
    private volatile long loadedAt;
    private volatile boolean showing;
    private boolean loading;

    AdsManager(Activity activity, ScriptRunner script) {
        this.activity = activity;
        this.script = script;
    }

    Object bridge() {
        return new Bridge();
    }

    /** Au lancement : formulaire de consentement si la loi l'exige (Europe), puis préchargement. */
    void start() {
        if (unitId.isEmpty()) return;
        consent = UserMessagingPlatform.getConsentInformation(activity);
        ConsentRequestParameters parameters = new ConsentRequestParameters.Builder().build();
        consent.requestConsentInfoUpdate(activity, parameters,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> initialize()),
                requestError -> initialize());
        // Consentement déjà donné lors d'un lancement précédent : inutile d'attendre la réponse.
        initialize();
    }

    private void initialize() {
        if (consent == null || !consent.canRequestAds() || !started.compareAndSet(false, true)) return;
        new Thread(() -> MobileAds.initialize(activity, status -> handler.post(this::load))).start();
    }

    private boolean ready() {
        return interstitial != null && SystemClock.elapsedRealtime() - loadedAt < MAX_AGE_MS;
    }

    private void load() {
        if (loading || showing || ready() || activity.isFinishing() || activity.isDestroyed()) return;
        interstitial = null;
        loading = true;
        InterstitialAd.load(activity, unitId, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(InterstitialAd ad) {
                loading = false;
                interstitial = ad;
                loadedAt = SystemClock.elapsedRealtime();
            }

            @Override
            public void onAdFailedToLoad(LoadAdError error) {
                // Pas de réseau ou pas de pub disponible : nouvel essai plus tard.
                loading = false;
                handler.postDelayed(AdsManager.this::load, RETRY_MS);
            }
        });
    }

    private void present(String requestId) {
        InterstitialAd ad = interstitial;
        interstitial = null;
        if (ad == null || activity.isFinishing()) {
            finish(requestId, "notReady");
            return;
        }
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                finish(requestId, "viewed");
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError error) {
                finish(requestId, "error");
            }
        });
        ad.show(activity);
    }

    private void finish(String requestId, String status) {
        showing = false;
        script.run("window.PTJNativeAdsResult && window.PTJNativeAdsResult("
                + JSONObject.quote(requestId) + "," + JSONObject.quote(status) + ")");
        load();
    }

    /** Méthodes appelées par le JavaScript du jeu (sur un fil secondaire). */
    private final class Bridge {
        /** true si une pub va s'afficher : le jeu attend alors window.PTJNativeAdsResult. */
        @JavascriptInterface
        public boolean show(String requestId) {
            if (showing || !ready()) {
                handler.post(AdsManager.this::load);
                return false;
            }
            showing = true;
            handler.post(() -> present(requestId));
            return true;
        }

        /** En Europe, le joueur doit pouvoir revoir ses choix : le menu affiche alors un bouton « Pubs ». */
        @JavascriptInterface
        public boolean privacyOptionsRequired() {
            return consent != null && consent.getPrivacyOptionsRequirementStatus()
                    == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
        }

        @JavascriptInterface
        public void showPrivacyOptions() {
            handler.post(() -> UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> initialize()));
        }
    }
}
