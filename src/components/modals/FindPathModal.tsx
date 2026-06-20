import {useEffect, useRef, type FormEvent} from "react";
import {Modal} from "bootstrap";
import {useController} from "../../map/context";
import {useI18n} from "../../i18n/I18n";

export function FindPathModal() {
    const controller = useController();
    const {t} = useI18n();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const handler = () => el.querySelector("input")?.focus();
        el.addEventListener("shown.bs.modal", handler);
        return () => el.removeEventListener("shown.bs.modal", handler);
    }, []);

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!controller) return;
        const form = e.currentTarget;
        const start = (form.elements.namedItem("start-loc") as HTMLInputElement).value;
        const end = (form.elements.namedItem("end-loc") as HTMLInputElement).value;
        if (ref.current) Modal.getInstance(ref.current)?.hide();
        form.reset();
        if (controller.findPath(start, end)) {
            controller.findRoom(parseInt(start));
        }
    };

    return (
        <div className="modal fade" id="findpath" tabIndex={-1} role="dialog" ref={ref}>
            <div className="modal-dialog" role="document">
                <div className="modal-content">
                    <form className="findpath-form" onSubmit={onSubmit}>
                        <div className="modal-header">
                            <h5 className="modal-title" data-i18n="find-path">
                                {t("find-path")}
                            </h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label" htmlFor="start-loc" data-i18n="start-loc">
                                    {t("start-loc")}
                                </label>
                                <input className="form-control" type="number" id="start-loc" name="start-loc" required />
                            </div>
                            <div className="mb-3">
                                <label className="form-label" htmlFor="end-loc" data-i18n="end-loc">
                                    {t("end-loc")}
                                </label>
                                <input className="form-control" type="number" id="end-loc" name="end-loc" required />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="submit" className="btn btn-primary" data-i18n="search">
                                {t("search")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
