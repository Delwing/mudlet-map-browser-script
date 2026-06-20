import {useEffect, useRef, type FormEvent} from "react";
import {Modal} from "bootstrap";
import autoComplete from "@tarekraafat/autocomplete.js";
import {useController} from "../../map/context";
import {useI18n} from "../../i18n/I18n";
import {downloadNpc, findNpc, getNpcLocations} from "../../data/npc";
import {ClearIcon} from "../Icons";

const DEFAULT_MAX_RESULTS = 10;

export function SearchModal() {
    const controller = useController();
    const {t} = useI18n();
    const modalRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Autocomplete state (mirrors the original npc.ts module-level vars).
    const maxResults = useRef(DEFAULT_MAX_RESULTS);
    const shouldNavigate = useRef(true);

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;

        const ac: any = new autoComplete({
            selector: "#search-id",
            data: {
                src: async () => {
                    await downloadNpc();
                    const npcs = getNpcLocations();
                    return Object.keys(npcs).map(item => ({value: npcs[item], text: item}));
                },
                keys: ["text"],
                cache: true,
            },
            resultItem: {tag: "a", class: "dropdown-item", selected: "active", highlight: true},
            resultsList: {
                tag: "div",
                class: "npc-autocomplete dropdown-menu show",
                maxResults: undefined,
                destination: "[data-autocomplete-target]",
                position: "beforeend",
            },
            submit: false,
        });

        const onSelection = (event: any) => {
            if (event.detail.selection.value instanceof Function) {
                event.detail.selection.value();
            } else {
                if (event.detail.selection.value) {
                    input.value = event.detail.selection.value.value;
                }
                input.form?.requestSubmit();
            }
        };
        const onKeyup = (event: KeyboardEvent) => {
            if (event.key === "Enter") {
                if (shouldNavigate.current) {
                    ac.select(0);
                }
                if (input.value.trim() !== "" && !isNaN(Number(input.value))) {
                    input.form?.requestSubmit();
                }
            }
        };
        const onNavigate = () => {
            shouldNavigate.current = false;
        };
        const onResults = (event: any) => {
            let list = event.detail.results;
            const length = list.length;
            if (length > 0) {
                const query: string = event.detail.query.toLowerCase();
                list.sort((a: any, b: any) => {
                    const aText: string = a.value.text.toLowerCase();
                    const bText: string = b.value.text.toLowerCase();
                    if (aText.startsWith(query) && !bText.startsWith(query)) return -1;
                    if (!aText.startsWith(event.detail.query) && bText.startsWith(query)) return 1;
                    return aText.localeCompare(bText);
                });
                list = list.slice(0, maxResults.current);
                if (length > maxResults.current) {
                    list.push({
                        value: () => {
                            maxResults.current += 10;
                            ac.start();
                        },
                        match: "Więcej...",
                    });
                }
            }
            event.detail.results = list;
        };
        const onInput = () => {
            maxResults.current = DEFAULT_MAX_RESULTS;
        };

        input.addEventListener("selection", onSelection as EventListener);
        input.addEventListener("keyup", onKeyup as EventListener);
        input.addEventListener("navigate", onNavigate);
        input.addEventListener("results", onResults as EventListener);
        input.addEventListener("input", onInput);

        return () => {
            input.removeEventListener("selection", onSelection as EventListener);
            input.removeEventListener("keyup", onKeyup as EventListener);
            input.removeEventListener("navigate", onNavigate);
            input.removeEventListener("results", onResults as EventListener);
            input.removeEventListener("input", onInput);
        };
    }, []);

    useEffect(() => {
        const el = modalRef.current;
        if (!el) return;
        const onShown = () => inputRef.current?.focus();
        const onHidden = () => {
            const input = inputRef.current;
            if (input && input.value) {
                input.value = "";
                input.dispatchEvent(new Event("input", {bubbles: true}));
            }
        };
        el.addEventListener("shown.bs.modal", onShown);
        el.addEventListener("hidden.bs.modal", onHidden);
        return () => {
            el.removeEventListener("shown.bs.modal", onShown);
            el.removeEventListener("hidden.bs.modal", onHidden);
        };
    }, []);

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!controller) return;
        if (modalRef.current) Modal.getInstance(modalRef.current)?.hide();
        const input = inputRef.current;
        if (!input) return;
        const raw = input.value;
        input.value = "";
        let roomId: (string | number)[] = raw.split(",");
        if (isNaN(Number(roomId[0]))) {
            const found = findNpc(String(roomId));
            if (found === false) return;
            roomId = found;
        }
        controller.findRooms(roomId);
    };

    const onClear = () => {
        const input = inputRef.current;
        if (!input) return;
        input.value = "";
        input.dispatchEvent(new Event("input", {bubbles: true}));
        input.focus();
    };

    return (
        <div className="modal fade" id="search" tabIndex={-1} role="dialog" ref={modalRef}>
            <div className="modal-dialog" role="document">
                <div className="modal-content">
                    <form className="search-form" onSubmit={onSubmit}>
                        <div className="modal-header">
                            <h5 className="modal-title" data-i18n="search">
                                {t("search")}
                            </h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body" data-autocomplete-target>
                            <div className="mb-3">
                                <label className="form-label" htmlFor="search-id" data-i18n="search-label">
                                    {t("search-label")}
                                </label>
                                <input
                                    ref={inputRef}
                                    className="form-control advancedAutoComplete"
                                    type="text"
                                    id="search-id"
                                    name="roomId"
                                    data-search-input
                                    autoComplete="off"
                                    placeholder=" "
                                />
                                <button type="button" className="search-clear" data-clear-input="search-id" title="Wyczyść" aria-label="Clear" onClick={onClear}>
                                    <ClearIcon />
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
