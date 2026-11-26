package nz.radwan.navylauncher;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.provider.Settings;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.content.pm.PackageManager;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Catches the remote's side-menu button before the system does and shows the
 * Navy Home side panel as an overlay on top of whatever app is running.
 * Look at `adb logcat -s NavyKey` to see the raw code of any button you press.
 */
public class KeyService extends AccessibilityService {
    private static final int[] TRIGGER_SCANCODES = { 138, 372 };
    private WebView web;
    private boolean shown = false, loaded = false;

    private boolean isTrigger(KeyEvent e) {
        for (int c : TRIGGER_SCANCODES) if (e.getScanCode() == c) return true;
        return false;
    }

    @Override protected boolean onKeyEvent(KeyEvent e) {
        Log.d("NavyKey", "scan=" + e.getScanCode() + " key=" + KeyEvent.keyCodeToString(e.getKeyCode()) + " act=" + e.getAction());
        if (isTrigger(e)) {
            if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) { if (shown) hide(); else show(); }
            return true;
        }
        if (shown && e.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == KeyEvent.ACTION_UP) hide();
            return true;
        }
        return false;
    }

    private void show() {
        try {
            WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
            if (web == null) {
                web = new WebView(this);
                web.setBackgroundColor(Color.TRANSPARENT);
                WebSettings s = web.getSettings();
                s.setJavaScriptEnabled(true);
                s.setDomStorageEnabled(true);
                web.addJavascriptInterface(new Bridge(), "Android");
                web.setWebViewClient(new WebViewClient() {
                    @Override public void onPageFinished(WebView v, String url) {
                        loaded = true;
                        if (shown) v.evaluateJavascript("window.show&&show()", null);
                    }
                });
                web.setFocusable(true);
                web.loadUrl("file:///android_asset/www/overlay.html");
            }
            WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
            lp.gravity = Gravity.TOP | Gravity.START;
            if (web.getParent() == null) wm.addView(web, lp);
            shown = true;
            web.requestFocus();
            if (loaded) web.evaluateJavascript("window.show&&show()", null);
        } catch (Exception ex) { Log.e("NavyKey", "show failed", ex); }
    }

    private void hide() {
        try {
            shown = false;
            if (web != null) {
                web.evaluateJavascript("window.hide&&hide()", null);
                WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
                if (web.getParent() != null) wm.removeView(web);
            }
        } catch (Exception ex) { Log.e("NavyKey", "hide failed", ex); }
    }

    @Override public void onAccessibilityEvent(AccessibilityEvent event) {}
    @Override public void onInterrupt() { hide(); }
    @Override public void onDestroy() { hide(); super.onDestroy(); }

    class Bridge {
        @JavascriptInterface public void close() { web.post(new Runnable() { public void run() { hide(); } }); }

        @JavascriptInterface public boolean startAction(final String action) {
            try { startActivity(new Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return true; }
            catch (Exception e) { return false; }
        }

        @JavascriptInterface public String getNotifications() {
            JSONObject res = new JSONObject(); JSONArray items = new JSONArray();
            try {
                NotifService s = NotifService.inst;
                res.put("enabled", s != null);
                if (s != null) {
                    List<StatusBarNotification> list = new ArrayList<>(Arrays.asList(s.getActiveNotifications()));
                    Collections.sort(list, (a, b) -> Long.compare(b.getPostTime(), a.getPostTime()));
                    PackageManager pm = getPackageManager();
                    for (StatusBarNotification sbn : list) {
                        Notification n = sbn.getNotification();
                        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) continue;
                        CharSequence title = n.extras.getCharSequence(Notification.EXTRA_TITLE);
                        CharSequence text = n.extras.getCharSequence(Notification.EXTRA_TEXT);
                        if (title == null && text == null) continue;
                        String app = sbn.getPackageName();
                        try { app = String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(app, 0))); } catch (Exception ignored) {}
                        JSONObject o = new JSONObject();
                        o.put("key", sbn.getKey()); o.put("pkg", sbn.getPackageName()); o.put("app", app);
                        o.put("title", title == null ? "" : title.toString());
                        o.put("text", text == null ? "" : text.toString());
                        o.put("time", sbn.getPostTime());
                        items.put(o);
                    }
                }
                res.put("items", items);
            } catch (Exception e) { }
            return res.toString();
        }

        @JavascriptInterface public boolean openNotification(String key) {
            try {
                NotifService s = NotifService.inst; if (s == null) return false;
                for (StatusBarNotification sbn : s.getActiveNotifications()) {
                    if (sbn.getKey().equals(key)) {
                        PendingIntent pi = sbn.getNotification().contentIntent;
                        if (pi != null) { pi.send(); return true; }
                        Intent li = getPackageManager().getLaunchIntentForPackage(sbn.getPackageName());
                        if (li != null) { startActivity(li.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return true; }
                    }
                }
            } catch (Exception e) { }
            return false;
        }

        @JavascriptInterface public void dismissNotification(String key) {
            try { NotifService s = NotifService.inst; if (s != null) s.cancelNotification(key); } catch (Exception ignored) {}
        }

        @JavascriptInterface public void dismissApp(String pkg) {
            try {
                NotifService s = NotifService.inst; if (s == null) return;
                for (StatusBarNotification sbn : s.getActiveNotifications()) {
                    if (sbn.getPackageName().equals(pkg)) s.cancelNotification(sbn.getKey());
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface public void dismissAll() {
            try { NotifService s = NotifService.inst; if (s != null) s.cancelAllNotifications(); } catch (Exception ignored) {}
        }
    }
}
