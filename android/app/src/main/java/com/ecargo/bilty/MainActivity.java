package com.ecargo.bilty;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final int obsidianBg = Color.parseColor("#060B16");

        // Configure edge-to-edge & light icons over dark obsidian system bars
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        getWindow().setBackgroundDrawable(new ColorDrawable(obsidianBg));
        View decorView = getWindow().getDecorView();
        decorView.setBackgroundColor(obsidianBg);
        decorView.setPadding(0, 0, 0, 0);

        if (Build.VERSION.SDK_INT < 35) {
            getWindow().setStatusBarColor(obsidianBg);
            getWindow().setNavigationBarColor(obsidianBg);
        }

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decorView);
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }

        // Single authoritative insets listener (SystemBars insetsHandling is disabled in capacitor.config.json)
        // Applies status-bar, display-cutout, nav-bar & IME insets ONCE without double-shrinking on keyboard open.
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(obsidianBg);
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
                Insets sys = windowInsets.getInsets(
                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                boolean imeVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());

                int[] loc = new int[2];
                view.getLocationOnScreen(loc);
                int decorHeight = decorView.getHeight();
                int viewBottom = loc[1] + view.getHeight();
                int alreadyShrunkBottom = (decorHeight > 0 && viewBottom > 0)
                        ? Math.max(0, decorHeight - viewBottom)
                        : 0;
                int effectiveImeBottom = imeVisible ? Math.max(0, ime.bottom - alreadyShrunkBottom) : 0;
                int bottomInset = Math.max(sys.bottom, effectiveImeBottom);

                view.setPadding(sys.left, sys.top, sys.right, bottomInset);

                // Clear consumed insets instead of returning CONSUMED so subsequent IME open/close events keep updating.
                return new WindowInsetsCompat.Builder(windowInsets)
                        .setInsets(
                                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime(),
                                Insets.NONE
                        )
                        .build();
            });
            ViewCompat.requestApplyInsets(contentView);
        }

        // Configure WebView settings for optimal responsiveness across phone densities
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            webView.setBackgroundColor(obsidianBg);
            WebSettings settings = webView.getSettings();
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
            if (settings.getTextZoom() > 110) {
                settings.setTextZoom(110);
            }
        }
    }
}

