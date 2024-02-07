/**
 * Page theme selector
 */
const defaultTheme = "Sandstone"
let templateSelector = document.querySelector("#template-selector");
let currentTheme = localStorage.getItem("theme") ?? defaultTheme;
let defaultDarkMode = true;

if (templateSelector) {
    const builtIn = ["Bootstrap", "Sandstone"];

    fetch("https://bootswatch.com/api/5.json")
        .then(response => response.json())
        .then(data => load(data));

    function load(data) {
        const themes = data.themes;
        themes.forEach((value, index) => {
            if (builtIn.indexOf(value.name) > -1) {
                return;
            }
            const option = document.createElement("option");
            option.value = value.name;
            option.text = value.name;

            templateSelector.append(option);
        });
        templateSelector.value = currentTheme;
    }

    function getTemplateCss(theme) {
        if (builtIn.indexOf(theme) > -1) {
            return `css/bootstrap-${theme.toLowerCase()}.min.css`;
        }
        return `https://bootswatch.com/5/${theme.toLowerCase()}/bootstrap.min.css`;
    }

    let darkSelector = document.querySelector("#page-dark");
    let baseStylesheet = document.querySelector("#base-stylesheet");
    let darkStylesheet = document.querySelector("#dark-stylesheet");

    function setTheme(theme, isDark) {
        baseStylesheet.setAttribute("href", getTemplateCss(theme));
        darkStylesheet.disabled = !isDark;
        localStorage.setItem("theme", theme);
        localStorage.setItem("dark", isDark);
        templateSelector.value = theme;
        darkSelector.checked = isDark;
    }

    setTheme(currentTheme, localStorage.getItem("dark") === "true" ?? defaultDarkMode);

    function setThemeFromControls() {
        setTheme(templateSelector.value, darkSelector.checked);
    }

    templateSelector.addEventListener("change", setThemeFromControls);
    darkSelector.addEventListener("change", setThemeFromControls);
}
