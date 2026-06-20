import {useToasts} from "../map/hooks";

export function Toasts() {
    const toasts = useToasts();
    // The original showed one toast element; render the most recent message.
    const current = toasts[toasts.length - 1];
    return (
        <div className="toasts">
            <div className={"toast" + (current ? " show" : "")} data-delay="2000">
                <div className="toast-body">{current?.text}</div>
            </div>
        </div>
    );
}
