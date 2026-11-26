package nz.radwan.navylauncher;

import android.app.Activity;
import android.app.Notification;
import android.app.PendingIntent;
import android.service.notification.StatusBarNotification;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.media.tv.TvContract;
import android.media.tv.TvInputInfo;
import android.media.tv.TvInputManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setFocusable(true);
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
        hideBars();
    }

    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override protected void onResume() {
        super.onResume();
        hideBars();
        if (web != null) { web.onResume(); web.evaluateJavascript("window.onShown&&onShown()", null); web.requestFocus(); }
    }

    @Override protected void onPause() { super.onPause(); if (web != null) web.onPause(); }

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i != null && i.getBooleanExtra("panel", false)) {
            i.removeExtra("panel");
            if (web != null) web.evaluateJavascript("window.togglePanel&&togglePanel()", null);
            return;
        }
        // Home pressed while already here: reset to the home view.
        if (web != null) web.evaluateJavascript("window.onHome&&onHome()", null);
    }

    // The button beside Home sends raw Linux key 372 (KEY_FULL_SCREEN), unmapped by Android.
    @Override public boolean dispatchKeyEvent(android.view.KeyEvent e) {
        if (e.getScanCode() == 372) {
            if (e.getAction() == android.view.KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0 && web != null) {
                web.evaluateJavascript("window.togglePanel&&togglePanel()", null);
            }
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override public boolean onKeyDown(int keyCode, android.view.KeyEvent event) {
        if ((keyCode == android.view.KeyEvent.KEYCODE_SETTINGS || keyCode == android.view.KeyEvent.KEYCODE_MENU) && web != null) {
            web.evaluateJavascript("window.togglePanel&&togglePanel()", null);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override public void onBackPressed() {
        // A launcher never exits; let the page close overlays.
        if (web != null) web.evaluateJavascript("window.onBack&&onBack()", null);
    }

    class Bridge {
        @JavascriptInterface public boolean launch(String pkg) {
            PackageManager pm = getPackageManager();
            Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
            if (i == null) i = pm.getLaunchIntentForPackage(pkg);
            if (i == null) return false;
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { startActivity(i); return true; } catch (Exception e) { return false; }
        }

        @JavascriptInterface public boolean isInstalled(String pkg) {
            PackageManager pm = getPackageManager();
            return pm.getLeanbackLaunchIntentForPackage(pkg) != null || pm.getLaunchIntentForPackage(pkg) != null;
        }

        @JavascriptInterface public String listApps() {
            PackageManager pm = getPackageManager();
            List<ResolveInfo> all = new ArrayList<>();
            Intent lb = new Intent(Intent.ACTION_MAIN).addCategory("android.intent.category.LEANBACK_LAUNCHER");
            Intent la = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            all.addAll(pm.queryIntentActivities(lb, 0));
            all.addAll(pm.queryIntentActivities(la, 0));
            JSONArray out = new JSONArray();
            List<String> seen = new ArrayList<>();
            List<JSONObject> rows = new ArrayList<>();
            for (ResolveInfo r : all) {
                String p = r.activityInfo.packageName;
                if (p.equals(getPackageName()) || seen.contains(p)) continue;
                seen.add(p);
                try {
                    JSONObject o = new JSONObject();
                    o.put("pkg", p);
                    o.put("label", String.valueOf(r.loadLabel(pm)));
                    rows.add(o);
                } catch (Exception ignored) {}
            }
            Collections.sort(rows, (a, c) -> a.optString("label").compareToIgnoreCase(c.optString("label")));
            for (JSONObject o : rows) out.put(o);
            return out.toString();
        }

        @JavascriptInterface public String appIcon(String pkg) {
            try {
                PackageManager pm = getPackageManager();
                Drawable d = pm.getApplicationBanner(pkg);
                if (d == null) d = pm.getApplicationIcon(pkg);
                int w = 320, h = d.getIntrinsicWidth() > d.getIntrinsicHeight() * 1.4 ? 180 : 320;
                Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                Canvas c = new Canvas(bmp);
                d.setBounds(0, 0, w, h);
                d.draw(c);
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                bmp.compress(Bitmap.CompressFormat.PNG, 90, bo);
                return "data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface public String appLogo(String pkg) {
            try {
                Drawable d = getPackageManager().getApplicationIcon(pkg);
                int n = 256;
                Bitmap bmp = Bitmap.createBitmap(n, n, Bitmap.Config.ARGB_8888);
                Canvas c = new Canvas(bmp);
                d.setBounds(0, 0, n, n);
                d.draw(c);
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                bmp.compress(Bitmap.CompressFormat.PNG, 95, bo);
                return "data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface public String hdmiInputs() {
            JSONArray out = new JSONArray();
            try {
                TvInputManager tm = (TvInputManager) getSystemService(TV_INPUT_SERVICE);
                for (TvInputInfo info : tm.getTvInputList()) {
                    if (info.getType() != TvInputInfo.TYPE_HDMI) continue;
                    JSONObject o = new JSONObject();
                    o.put("id", info.getId());
                    String label = String.valueOf(info.loadLabel(MainActivity.this));
                    String custom = String.valueOf(info.loadCustomLabel(MainActivity.this));
                    o.put("label", label);
                    o.put("custom", custom.equals("null") ? "" : custom);
                    out.put(o);
                }
            } catch (Exception e) { /* return what we have */ }
            return out.toString();
        }

        @JavascriptInterface public void fetchUrl(final String url, final String cb) {
            new Thread(new Runnable() { public void run() {
                String js;
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(10000); c.setReadTimeout(10000);
                    BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()));
                    StringBuilder sb = new StringBuilder(); String line;
                    while ((line = r.readLine()) != null) sb.append(line);
                    r.close();
                    js = "window." + cb + "(" + JSONObject.quote(sb.toString()) + ")";
                } catch (Exception e) {
                    js = "window." + cb + "Err(" + JSONObject.quote(String.valueOf(e)) + ")";
                }
                final String fjs = js;
                runOnUiThread(new Runnable() { public void run() { if (web != null) web.evaluateJavascript(fjs, null); } });
            } }).start();
        }

        @JavascriptInterface public boolean openInput(String inputId) {
            try {
                Uri u = TvContract.buildChannelUriForPassthroughInput(inputId);
                Intent i = new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface public String getNotifications() {
            JSONObject res = new JSONObject();
            JSONArray items = new JSONArray();
            try {
                NotifService s = NotifService.inst;
                res.put("enabled", s != null);
                if (s != null) {
                    StatusBarNotification[] arr = s.getActiveNotifications();
                    List<StatusBarNotification> list = new ArrayList<>(Arrays.asList(arr));
                    Collections.sort(list, (a, b) -> Long.compare(b.getPostTime(), a.getPostTime()));
                    PackageManager pm = getPackageManager();
                    for (StatusBarNotification sbn : list) {
                        Notification n = sbn.getNotification();
                        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) continue;
                        CharSequence title = n.extras.getCharSequence(Notification.EXTRA_TITLE);
                        CharSequence text = n.extras.getCharSequence(Notification.EXTRA_TEXT);
                        if (title == null && text == null) continue;
                        String app = sbn.getPackageName();
                        try { app = String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(sbn.getPackageName(), 0))); } catch (Exception ignored) {}
                        JSONObject o = new JSONObject();
                        o.put("key", sbn.getKey()); o.put("pkg", sbn.getPackageName());
                        o.put("app", app);
                        o.put("title", title == null ? "" : title.toString());
                        o.put("text", text == null ? "" : text.toString());
                        o.put("time", sbn.getPostTime());
                        items.put(o);
                    }
                }
                res.put("items", items);
            } catch (Exception e) { /* return what we have */ }
            return res.toString();
        }

        @JavascriptInterface public boolean openNotification(String key) {
            try {
                NotifService s = NotifService.inst;
                if (s == null) return false;
                for (StatusBarNotification sbn : s.getActiveNotifications()) {
                    if (sbn.getKey().equals(key)) {
                        PendingIntent pi = sbn.getNotification().contentIntent;
                        if (pi != null) { pi.send(); return true; }
                        return launch(sbn.getPackageName());
                    }
                }
            } catch (Exception e) { /* fall through */ }
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

        @JavascriptInterface public boolean startActionPkg(String action, String pkg) {
            try {
                Intent i = new Intent(action).setPackage(pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i); return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface public boolean startComponent(String pkg, String cls) {
            try {
                Intent i = new Intent().setClassName(pkg, cls).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i); return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface public boolean startAction(String action) {
            try {
                startActivity(new Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface public void openSettings() {
            try { startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) {}
        }

        @JavascriptInterface public void openStore(String pkg) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (ActivityNotFoundException e) { toast("Play Store not available"); }
        }

        @JavascriptInterface public void toast(String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show());
        }
    }
}
