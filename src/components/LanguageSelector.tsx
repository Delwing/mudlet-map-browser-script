import {useI18n} from "../i18n/I18n";

export function LanguageSelector() {
    const {lang, setLang, languages} = useI18n();
    if (languages.length < 2) return null;
    const current = languages.find(l => l.code === lang) ?? languages[0];

    return (
        <>
            <button className="btn btn-secondary dropdown-toggle lang-label" id="dropdownMenuButton" data-bs-toggle="dropdown">
                <span className={`current-language-flag flag flag-${current?.flag}`}>&nbsp;</span>
            </button>
            <div className="dropdown-menu lang-selector lang-dropdown">
                {languages.map(l => (
                    <a
                        key={l.code}
                        className="dropdown-item"
                        href="#"
                        data-lang={l.code}
                        onClick={e => {
                            e.preventDefault();
                            setLang(l.code);
                        }}
                    >
                        <div className={`flag flag-${l.flag}`}></div>
                    </a>
                ))}
            </div>
        </>
    );
}
