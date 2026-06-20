/** Helpers shared by SettingsModal for the uncontrolled settings form. */

export function toHexColor(color: string): string {
    if (color.startsWith("#")) return color;
    const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, "0");
        const g = parseInt(match[2]).toString(16).padStart(2, "0");
        const b = parseInt(match[3]).toString(16).padStart(2, "0");
        return `#${r}${g}${b}`;
    }
    return color;
}

export function collectForm(form: HTMLFormElement): Record<string, any> {
    const data: Record<string, any> = {};
    form.querySelectorAll<HTMLInputElement>("input[name]").forEach(el => {
        const name = el.getAttribute("name");
        if (!name) return;
        const type = el.getAttribute("type");
        if (type === "checkbox") {
            data[name] = el.checked;
        } else if (type === "number" || type === "range") {
            data[name] = parseFloat(el.value);
        } else {
            data[name] = el.value;
        }
    });
    form.querySelectorAll<HTMLSelectElement>("select[name]").forEach(el => {
        const name = el.getAttribute("name");
        if (name) data[name] = el.value;
    });
    return data;
}

export function populateForm(form: HTMLFormElement, snapshot: Record<string, any>) {
    for (const key in snapshot) {
        const input = form.querySelector<HTMLInputElement>(`input[name='${key}']`);
        if (input) {
            const type = input.getAttribute("type");
            if (type === "checkbox") {
                input.checked = !!snapshot[key];
            } else if (type === "color") {
                input.value = toHexColor(snapshot[key]);
            } else {
                input.value = snapshot[key];
                input.dispatchEvent(new Event("input", {bubbles: true}));
            }
            continue;
        }
        const select = form.querySelector<HTMLSelectElement>(`select[name='${key}']`);
        if (select) {
            select.value = snapshot[key];
        }
    }
}
