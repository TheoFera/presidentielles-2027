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
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Publicités AdMob. Le jeu choisit le moment (src/presentation/menus/ads.js, fin de partie) ;
 * ici on demande le consentement (RGPD), on précharge les pubs et on les affiche sur demande :
 * - interstitielle : plein écran après un clic de fin de partie ;
 * - récompensée : vidéo que le joueur choisit de regarder pour débloquer un candidat de plus.
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
    private final String rewardedUnitId = BuildConfig.ADMOB_REWARDED_ID;
    private volatile ConsentInformation consent;
    private volatile InterstitialAd interstitial;
    private volatile long loadedAt;
    private volatile RewardedAd rewarded;
    private volatile long rewardedLoadedAt;
    private volatile boolean showing;
    private boolean loading;
    private boolean rewardedLoading;

    AdsManager(Activity activity, ScriptRunner script) {
        this.activity = activity;
        this.script = script;
    }

    Object bridge() {
        return new Bridge();
    }

    /** Au lancement : formulaire de consentement si la loi l'exige (Europe), puis préchargement. */
    void start() {
        if (unitId.isEmpty() && rewardedUnitId.isEmpty()) return;
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
        new Thread(() -> MobileAds.initialize(activity, status -> handler.post(() -> {
            load();
            loadRewarded();
        }))).start();
    }

    private boolean ready() {
        return interstitial != null && SystemClock.elapsedRealtime() - loadedAt < MAX_AGE_MS;
    }

    private void load() {
        if (unitId.isEmpty() || loading || showing || ready() || activity.isFinishing() || activity.isDestroyed()) return;
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

    private boolean rewardedReady() {
        return rewarded != null && SystemClock.elapsedRealtime() - rewardedLoadedAt < MAX_AGE_MS;
    }

    private void loadRewarded() {
        if (rewardedUnitId.isEmpty() || !started.get() || rewardedLoading || showing || rewardedReady()
                || consent == null || !consent.canRequestAds() || activity.isFinishing() || activity.isDestroyed()) return;
        rewarded = null;
        rewardedLoading = true;
        RewardedAd.load(activity, rewardedUnitId, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(RewardedAd ad) {
                rewardedLoading = false;
                rewarded = ad;
                rewardedLoadedAt = SystemClock.elapsedRealtime();
            }

            @Override
            public void onAdFailedToLoad(LoadAdError error) {
                rewardedLoading = false;
                handler.postDelayed(AdsManager.this::loadRewarded, RETRY_MS);
            }
        });
    }

    /** Statut renvoyé au jeu : « rewarded » seulement si Google confirme que la vidéo a été regardée jusqu'au bout. */
    private void presentRewarded(String requestId) {
        RewardedAd ad = rewarded;
        rewarded = null;
        if (ad == null || activity.isFinishing()) {
            finish(requestId, "notReady");
            return;
        }
        AtomicBoolean earned = new AtomicBoolean(false);
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                finish(requestId, earned.get() ? "rewarded" : "dismissed");
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError error) {
                finish(requestId, "error");
            }
        });
        ad.show(activity, reward -> earned.set(true));
    }

    private void finish(String requestId, String status) {
        showing = false;
        script.run("window.PTJNativeAdsResult && window.PTJNativeAdsResult("
                + JSONObject.quote(requestId) + "," + JSONObject.quote(status) + ")");
        load();
        loadRewarded();
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

        /** true si une pub récompensée est chargée : le jeu propose alors le bouton « Regarder une pub ». */
        @JavascriptInterface
        public boolean rewardedReady() {
            if (AdsManager.this.rewardedReady()) return true;
            handler.post(AdsManager.this::loadRewarded);
            return false;
        }

        /** Lance la pub récompensée ; le résultat arrive par window.PTJNativeAdsResult (« rewarded », « dismissed »…). */
        @JavascriptInterface
        public boolean showRewarded(String requestId) {
            if (showing || !AdsManager.this.rewardedReady()) {
                handler.post(AdsManager.this::loadRewarded);
                return false;
            }
            showing = true;
            handler.post(() -> presentRewarded(requestId));
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
