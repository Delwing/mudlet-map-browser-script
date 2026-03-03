/**
 * Page theme selector
 */

interface BootswatchTheme {
    name: string;
    description: string;
    preview: string;
    thumbnail: string;
    css: string;
    cssMin: string;
    cssCdn: string;
    scss: string;
    scssVariables: string;
}

interface BootswatchResponse {
    version: string;
    themes: BootswatchTheme[];
}

const defaultTheme = "Sandstone";
const templateSelector = document.querySelector<HTMLSelectElement>("#template-selector");
const currentTheme = localStorage.getItem("theme") ?? defaultTheme;
const defaultDarkMode = true;

if (templateSelector) {
    const builtIn = ["Bootstrap", "Sandstone"];

    fetch("https://bootswatch.com/api/5.json")
        .then((response) => response.json())
        .then((data: BootswatchResponse) => load(data));

    function load(data: BootswatchResponse): void {
        const themes = data.themes;
        themes.forEach((value) => {
            if (builtIn.indexOf(value.name) > -1) {
                return;
            }
            const option = document.createElement("option");
            option.value = value.name;
            option.text = value.name;

            templateSelector!.append(option);
        });
        templateSelector!.value = currentTheme;
    }

    function getTemplateCss(theme: string): string {
        if (builtIn.indexOf(theme) > -1) {
            return `css/bootstrap-${theme.toLowerCase()}.min.css`;
        }
        return `https://bootswatch.com/5/${theme.toLowerCase()}/bootstrap.min.css`;
    }

    const darkSelector = document.querySelector<HTMLInputElement>("#page-dark");
    const baseStylesheet = document.querySelector<HTMLLinkElement>("#base-stylesheet");
    const darkStylesheet = document.querySelector<HTMLLinkElement>("#dark-stylesheet");

    function setTheme(theme: string, isDark: boolean): void {
        baseStylesheet!.setAttribute("href", getTemplateCss(theme));
        darkStylesheet!.disabled = !isDark;
        localStorage.setItem("theme", theme);
        localStorage.setItem("dark", String(isDark));
        templateSelector!.value = theme;
        darkSelector!.checked = isDark;
    }

    const storedDark = localStorage.getItem("dark");
    setTheme(currentTheme, storedDark !== null ? storedDark === "true" : defaultDarkMode);

    function setThemeFromControls(): void {
        setTheme(templateSelector!.value, darkSelector!.checked);
    }

    templateSelector.addEventListener("change", setThemeFromControls);
    darkSelector!.addEventListener("change", setThemeFromControls);
}
