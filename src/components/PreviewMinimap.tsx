/**
 * The minimap container. The imperative Preview class (src/preview.ts) drives
 * these elements directly (sizing, background image, viewport indicator), so
 * this component only renders the DOM structure it expects.
 */
export function PreviewMinimap() {
    return (
        <div className="preview-container">
            <div className="preview"></div>
            <div className="preview-pan"></div>
        </div>
    );
}
