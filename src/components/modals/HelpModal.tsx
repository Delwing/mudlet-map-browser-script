import {useEffect, useRef, useState, type ChangeEvent} from "react";
import {Modal} from "bootstrap";
import {useController} from "../../map/context";
import {useI18n} from "../../i18n/I18n";
import {downloadTags} from "../../versions";
import {config, resolveLocalized} from "../../config";

interface Tag {
    tag_name: string;
    body?: string;
}

export function HelpModal() {
    const controller = useController();
    const {t, lang} = useI18n();
    const modalRef = useRef<HTMLDivElement>(null);
    const [tags, setTags] = useState<Tag[]>([]);
    const [description, setDescription] = useState("");

    const credits = config.credits;
    const remarkHtml = resolveLocalized(credits?.remark, lang);

    useEffect(() => {
        const el = modalRef.current;
        if (!el) return;
        const onShown = () => {
            if (tags.length === 0 && config.versionsTagsUrl) {
                (downloadTags(config.versionsTagsUrl) as Promise<Tag[]>).then(loaded => {
                    setTags(loaded);
                    setDescription((loaded[0]?.body ?? "").replaceAll("\n\n", "\n"));
                });
            }
        };
        el.addEventListener("shown.bs.modal", onShown);
        return () => el.removeEventListener("shown.bs.modal", onShown);
    }, [tags.length]);

    const onVersionChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const tag = tags.find(t => t.tag_name === e.target.value);
        controller?.replaceVersion(e.target.value);
        setDescription((tag?.body ?? "").replaceAll("\n\n", "\n"));
        if (modalRef.current) Modal.getInstance(modalRef.current)?.hide();
    };

    return (
        <div className="modal fade" id="help" tabIndex={-1} role="dialog" ref={modalRef}>
            <div className="modal-dialog modal-lg" role="document">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" data-i18n="help">
                            {t("help")}
                        </h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div className="modal-body">
                        <p>
                            <kbd>F1</kbd> - <span data-i18n="this-help">{t("this-help")}</span>
                        </p>
                        <p>
                            <kbd>Ctrl + F</kbd> - <span data-i18n="search-help">{t("search-help")}</span>
                        </p>
                        <p></p>
                        <p>
                            <kbd>+</kbd> - <span data-i18n="zoom-in">{t("zoom-in")}</span>
                        </p>
                        <p>
                            <kbd>-</kbd> - <span data-i18n="zoom-out">{t("zoom-out")}</span>
                        </p>
                        <p>
                            <kbd>↑ ↓ → ←</kbd> - <span data-i18n="map-move">{t("map-move")}</span>
                        </p>
                        <p data-i18n="move-instruction">{t("move-instruction")}</p>
                    </div>
                    <div className="modal-footer">
                        <div>
                            {credits && (credits.author || credits.githubUrl || remarkHtml) && (
                                <p className="help-credits">
                                    {credits.author && (
                                        <>
                                            <span data-i18n="author">{t("author")}</span>: {credits.author}
                                            <br />
                                        </>
                                    )}
                                    {credits.githubUrl && (
                                        <>
                                            GitHub:{" "}
                                            <a target="_blank" rel="noreferrer" href={credits.githubUrl}>
                                                {credits.githubLabel ?? credits.githubUrl}
                                            </a>
                                            <br />
                                        </>
                                    )}
                                    {remarkHtml && (
                                        <>
                                            <br />
                                            <span dangerouslySetInnerHTML={{__html: remarkHtml}} />
                                        </>
                                    )}
                                </p>
                            )}
                            {config.versionsTagsUrl && (
                                <div>
                                    <label className="form-label" htmlFor="versions" data-i18n="switch-map-version">
                                        {t("switch-map-version")}
                                    </label>
                                    <select id="versions" className="form-select" value={controller?.versionTag ?? ""} onChange={onVersionChange}>
                                        {controller?.versionTag === null && tags.length === 0 && <option value=""></option>}
                                        {tags.map(tag => (
                                            <option key={tag.tag_name} value={tag.tag_name} data-description={(tag.body ?? "").replaceAll("\n\n", "\n")}>
                                                {tag.tag_name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="release-description">{description}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
