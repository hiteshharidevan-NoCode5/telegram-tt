package com.custom.telegramweb;

import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    private static final String NUZEPPR_PACKAGE = "com.example.epaper_reader";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() |
                WindowInsetsCompat.Type.displayCutout()
            );
            if (getBridge() != null && getBridge().getWebView() != null) {
                View wv = getBridge().getWebView();
                ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) wv.getLayoutParams();
                mlp.setMargins(insets.left, insets.top, insets.right, insets.bottom);
                wv.setLayoutParams(mlp);
            }
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(getWindow().getDecorView());

        WebView webView = this.getBridge().getWebView();
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void getBase64FromBlobData(String base64Data, String filename) {
                savePdfToDownloads(base64Data, filename, true);
            }
            @JavascriptInterface
            public void saveSilentEpaper(String base64Data, String filename) {
                savePdfToDownloads(base64Data, filename, false);
            }
        }, "AndroidBlobDownloader");

        EpaperSyncReceiver.scheduleMorningAlarms(this);
        webView.post(() -> {
            injectBlobInterceptor(webView);
            if (getIntent() != null && getIntent().getBooleanExtra("epaper_sync", false)) {
                webView.postDelayed(() -> webView.evaluateJavascript("if(window.__triggerAltGramEpaperSync){window.__triggerAltGramEpaperSync();}", null), 8000);
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge().getWebView();
                if (wv != null) {
                    String backJs = "(function() {" +
                            "  var closeBtn = document.querySelector('.modal-dialog button[aria-label="Close"], .MediaViewer button[aria-label="Close"]');" +
                            "  if (closeBtn) { closeBtn.click(); return 'handled'; }" +
                            "  var backBtn = document.querySelector('#MiddleColumn button[aria-label="Back"], .left-header button[aria-label="Back"], button.Button.smaller.translucent[aria-label="Back"]');" +
                            "  if (backBtn) { backBtn.click(); return 'handled'; }" +
                            "  return 'exit';" +
                            "})();";
                    wv.evaluateJavascript(backJs, result -> {
                        if (result != null && result.contains("handled")) {
                            // Handled inside Telegram Web
                        } else if (wv.canGoBack()) {
                            wv.goBack();
                        } else {
                            moveTaskToBack(true);
                        }
                    });
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.getBooleanExtra("epaper_sync", false) && getBridge() != null && getBridge().getWebView() != null) {
            WebView wv = getBridge().getWebView();
            wv.postDelayed(() -> wv.evaluateJavascript("if(window.__triggerAltGramEpaperSync){window.__triggerAltGramEpaperSync();}", null), 5000);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
            injectBlobInterceptor(webView);
        }
    }

    private void injectBlobInterceptor(WebView webView) {
        String js = "(function() {" +
                "  if (window.__blobHookInstalled) return;" +
                "  window.__blobHookInstalled = true;" +
                "  var origClick = HTMLAnchorElement.prototype.click;" +
                "  HTMLAnchorElement.prototype.click = function() {" +
                "    if (this.href && this.href.startsWith('blob:')) {" +
                "      var filename = this.download || ('file_' + Date.now() + '.pdf');" +
                "      var url = this.href;" +
                "      var xhr = new XMLHttpRequest();" +
                "      xhr.open('GET', url, true);" +
                "      xhr.responseType = 'blob';" +
                "      xhr.onload = function() {" +
                "        if (this.status === 200) {" +
                "          var reader = new FileReader();" +
                "          reader.readAsDataURL(this.response);" +
                "          reader.onloadend = function() {" +
                "            AndroidBlobDownloader.getBase64FromBlobData(reader.result, filename);" +
                "          };" +
                "        }" +
                "      };" +
                "      xhr.send();" +
                "    }" +
                "    return origClick.apply(this, arguments);" +
                "  };" +
                "})();";
        webView.evaluateJavascript(js, null);
    }

    private void savePdfToDownloads(String base64Data, String filename, boolean openViewer) {
        try {
            String cleanBase64 = base64Data.substring(base64Data.indexOf(",") + 1);
            byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

            String mimeType = filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
            Uri openUri = null;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AltGram");

                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os != null) {
                        os.write(fileBytes);
                        os.flush();
                        os.close();
                        openUri = uri;
                    }
                }
            } else {
                File downloadDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "AltGram");
                if (!downloadDir.exists()) downloadDir.mkdirs();
                File targetFile = new File(downloadDir, filename);
                FileOutputStream fos = new FileOutputStream(targetFile);
                fos.write(fileBytes);
                fos.flush();
                fos.close();
                openUri = FileProvider.getUriForFile(this, getApplicationContext().getPackageName() + ".fileprovider", targetFile);
            }

            if (openUri != null && !openViewer) {
                runOnUiThread(() -> Toast.makeText(getApplicationContext(), "Saved ePaper: " + filename, Toast.LENGTH_SHORT).show());
            } else if (openUri != null && openViewer) {
                final Uri finalUri = openUri;
                runOnUiThread(() -> {
                    Intent directIntent = new Intent(Intent.ACTION_VIEW);
                    directIntent.setDataAndType(finalUri, mimeType);
                    directIntent.setPackage(NUZEPPR_PACKAGE);
                    directIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

                    try {
                        startActivity(directIntent);
                    } catch (ActivityNotFoundException e) {
                        Intent fallback = new Intent(Intent.ACTION_VIEW);
                        fallback.setDataAndType(finalUri, mimeType);
                        fallback.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(Intent.createChooser(fallback, "Open ePaper with"));
                    }
                });
            }
        } catch (Exception e) {
            runOnUiThread(() -> Toast.makeText(getApplicationContext(), "Save error: " + e.getMessage(), Toast.LENGTH_LONG).show());
        }
    }
}
