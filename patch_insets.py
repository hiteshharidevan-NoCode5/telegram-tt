import glob

files = glob.glob("android/app/src/main/java/**/MainActivity.java", recursive=True)
assert files, "MainActivity.java not found"
p = files[0]
s = open(p).read()

target = "super.onCreate(savedInstanceState);"
patch = """super.onCreate(savedInstanceState);
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, windowInsets) -> {
            androidx.core.graphics.Insets insets = windowInsets.getInsets(
                androidx.core.view.WindowInsetsCompat.Type.systemBars() |
                androidx.core.view.WindowInsetsCompat.Type.displayCutout()
            );
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setPadding(insets.left, insets.top, insets.right, insets.bottom);
            }
            return windowInsets;
        });"""

if "setOnApplyWindowInsetsListener" not in s:
    assert target in s, "onCreate not found in MainActivity.java"
    open(p, "w").write(s.replace(target, patch, 1))
    print(f"Patched {p} successfully.")
