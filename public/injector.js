window.addEventListener("executeGroknessScript", (event) => {
    try {
        const { code } = event.detail;
        if (typeof code === "string") {
            const script = document.createElement("script");
            script.textContent = code;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
        }
    } catch (e) {
        console.error("Grokness: Error executing patched script.", e);
    }
});
