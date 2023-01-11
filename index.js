import Translator from "@andreasremdt/simple-translator";
import bootstrap from "bootstrap";
import {MapReader, Renderer, Settings} from "mudlet-map-renderer";
import {Preview} from "./preview";
import {downloadTags, downloadVersion} from "./versions";
import convert from "color-convert";

const rainbow = [
    "#CC99C9",
    "#9EC1CF",
    "#9EE09E",
    "#FDFD97",
    "#FEB144",
    "#FF6663"
];
let pathPick = 0;

var translator = new Translator({
    defaultLanguage: "pl",
    detectLanguage: true,
    selector: "[data-i18n]",
    debug: false,
    registerGlobally: "__",
    persist: true,
    persistKey: "preferred_language",
    filesLocation: "i18n",
});
window.translator = translator;

if (location.hostname !== "") {
    translator
        .fetch(["pl"], false)
        .then(json => {
            let defaultLanguage = {};
            document.querySelectorAll("[data-i18n]").forEach(item => {
                defaultLanguage[item.getAttribute("data-i18n")] = item.innerHTML;
            });
            translator.add("pl", {...defaultLanguage, ...json});
        })
        .catch(e => console.log(`Cannot fetch translations. ${e.message}`));

    translator
        .fetch(["en"])
        .then(() => {
            translator.translatePageTo();
        })
        .catch(e => console.log(`Cannot fetch translations. ${e.message}`));
} else if (translations) {
    let defaultLanguage = {};
    document.querySelectorAll("[data-i18n]").forEach(item => {
        defaultLanguage[item.getAttribute("data-i18n")] = item.innerHTML;
    });
    translator.add("pl", {...defaultLanguage, ...translations.pl});
    translator.add("en", translations.en);
}

const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());
const url = window.location.origin + window.location.pathname;

const svgToDataURL = svgStr => {
    const encoded = encodeURIComponent(svgStr).replace(/'/g, "%27").replace(/"/g, "%22");

    const header = "data:image/svg+xml,";
    const dataUrl = header + encoded;

    return dataUrl;
};

import {downloadNpc, findNpc} from "./npc";
let roomNpc = {};
downloadNpc().then(value => (roomNpc = value));

let position = localStorage.getItem("position");
if (position) {
    position = JSON.parse(position);
}
class PageControls {
    constructor(reader) {
        this.map = document.querySelector("#map");
        this.map.addEventListener("roomSelected", event => this.selectRoom(event.detail));
        this.map.addEventListener("roomDeselected", () => this.deselectRoom());
        this.map.addEventListener("zoom", event => this.adjustZoomBar(event.detail));
        this.map.addEventListener("zoom", event => (this.zoom = event.detail.zoom));
        this.map.addEventListener("zoom", event => this.preview.update());
        this.map.addEventListener("drag", event => this.preview.update());
        this.map.addEventListener("goToArea", event =>
            setTimeout(() => {
                if (event.detail.id) {
                    this.findRoom(event.detail.id);
                }
            })
        );
        this.reader = reader;
        this.select = document.querySelector("#area");
        this.infoBox = document.querySelector(".info-box");
        this.levels = document.querySelector(".levels");
        this.saveImageButton = document.querySelector(".save-image");
        this.saveSvgImageButton = document.querySelector(".save-image-svg");
        this.copyImageButton = document.querySelector(".copy-image");
        this.zoomButtons = document.querySelectorAll(".zoom-controls .btn");
        this.toastContainer = document.querySelector(".toast");
        this.searchModal = document.querySelector("#search");
        this.search = document.querySelector(".search-form");
        this.findPathForm = document.querySelector(".findpath-form");
        this.findPathModal = document.querySelector("#findpath");
        this.helpModal = document.querySelector("#help");
        this.zoomBar = document.querySelector(".progress-container");
        this.settingsModal = document.querySelector("#settings");
        this.settingsForm = document.querySelector("#settings form");
        this.resetSettingsButton = document.querySelector("#settings button[type='reset']");
        this.versions = document.querySelector("#versions");
        this.settings = new Settings();
        this.preview = new Preview(this.map, this);
        this.versionBadge = document.querySelector(".version-number");
        this.languageSelector = document.querySelector(".lang-dropdown");
        this.currentLanguageFlag = document.querySelector(".current-language-flag");
        this.pathBox = document.querySelector(".path-box ul");
        this.zIndex = 0;
        this.settings.optimizeDrag = true;
        this.settings.preview = true;
        let loaded = localStorage.getItem("settings");
        if (loaded) {
            Object.assign(this.settings, JSON.parse(loaded));
        }

        if (this.versions) {
            this.versions.addEventListener("change", event => {
                this.replaceVersion(event.target.value);
                bootstrap.Modal.getInstance(this.helpModal).hide();
            });

            this.helpModal.addEventListener("shown.bs.modal", () => {
                if (this.versions.children.length == 0) {
                    downloadTags(this.versions.getAttribute("data-tags")).then(tags => {
                        tags.forEach(tag => {
                            let option = document.createElement("option");
                            option.setAttribute("value", tag);
                            option.innerHTML = tag;
                            this.versions.append(option);
                        });
                    });
                }
            });
        }

        this.saveImageButton?.addEventListener("click", () => this.saveImage());
        this.saveSvgImageButton?.addEventListener("click", event => {
            event.preventDefault();
            this.downloadImage();
        });
        this.copyImageButton?.addEventListener("click", () => this.copyImage());

        this.zoomButtons.forEach(item =>
            item.addEventListener("click", event => {
                let delta = parseFloat(event.currentTarget.getAttribute("data-factor"));
                this.renderer.controls.deltaZoom(delta);
            })
        );

        this.search.addEventListener("submit", event => {
            event.preventDefault();
            this.submitSearch(event);
        });

        this.findPathForm?.addEventListener("submit", event => {
            event.preventDefault();
            this.submitPathFind(event);
        });

        this.findPathModal?.addEventListener("shown.bs.modal", () => {
            this.findPathModal.querySelector("input").focus();
        });

        this.searchModal.addEventListener("shown.bs.modal", () => {
            this.searchModal.querySelector("input").focus();
        });

        this.settingsModal.addEventListener("show.bs.modal", () => {
            this.populateSettings(this.settings);
        });

        this.settingsModal.addEventListener("shown.bs.modal", () => {
            this.settingsModal.querySelector("input").focus();
        });

        this.settingsForm.addEventListener("submit", event => {
            event.preventDefault();
            this.handleSaveSettings();
        });

        this.resetSettingsButton.addEventListener("click", event => {
            event.preventDefault();
            this.resetSettings();
        });

        window.addEventListener("resize", () => {
            this.render();
        });

        this.translatePage();
        this.languageSelector.querySelectorAll("a").forEach(element => {
            element.addEventListener("click", event => {
                event.preventDefault();
                this.translatePage(element.getAttribute("data-lang"));
            });
        });

        this.paths = {};
    }

    init() {
        let area = 37;
        let zIndex = 0;
        if (params.loc) {
            this.findRoom(params.loc);
            history.replaceState(null, null, url);
        } else {
            if (params.area) {
                area = params.area;
                history.replaceState(null, null, url);
            } else if (position !== null && position.area) {
                area = position.area;
                zIndex = position.zIndex;
            }
            this.renderArea(area, zIndex);
        }
    }

    handleSaveSettings() {
        let inputs = this.settingsModal.querySelectorAll("input");

        let formData = {};
        inputs.forEach(element => {
            let name = element.getAttribute("name");
            let type = element.getAttribute("type");
            if (type === "checkbox") {
                formData[name] = element.checked;
            } else if (type === "number") {
                formData[name] = parseInt(element.value);
            } else {
                formData[name] = element.value;
            }
        });

        Object.assign(this.settings, formData);

        this.showToast(translator.translateForKey("settings-saved", translator.currentLanguage));
        bootstrap.Modal.getInstance(this.settingsModal).hide();
        this.saveSettings();
        this.render(true);
    }

    saveSettings() {
        localStorage.setItem("settings", JSON.stringify(this.settings));
    }

    render(force) {
        return this.renderArea(this.select.value, this.zIndex, force);
    }

    renderArea(areaId, zIndex, force) {
        return new Promise((resolve, reject) => {
            if (this.areaId !== areaId || this.zIndex !== zIndex || force) {
                this.map.addEventListener(
                    "renderComplete",
                    (event, renderer) => {
                        this.preview.init(event.detail.controls).then(() => resolve());
                    },
                    {once: true}
                );
                this.areaId = areaId;
                this.zIndex = zIndex;

                localStorage.setItem("position", JSON.stringify({area: areaId, zIndex: zIndex}));
                document.querySelector("body").style.background = this.settings.mapBackground;
                let area = this.reader.getArea(areaId, zIndex);
                if (this.renderer) {
                    this.renderer.clear();
                }
                this.renderer = new Renderer(this.map, this.reader, area, this.reader.getColors(), this.settings);
                this.select.value = areaId;
                this.populateLevelButtons(area.getLevels(), zIndex);
                this.hideRoomInfo();

                Object.entries(this.paths).forEach(([key, group]) => {
                    group.remove();
                    let [from, to] = key.split("#");
                    this.findPath(from, to);
                });

                this.renderer.clearHighlight();
                if (this.settings.keepZoomLevel && this.zoom) {
                    this.renderer.controls.setZoom(this.zoom);
                }
            } else {
                resolve();
            }
        });
    }

    genericSetup() {
        document.querySelectorAll(".btn").forEach(element => element.addEventListener("click", () => element.blur()));
    }

    populateLevelButtons(levelsSet, zIndex) {
        this.levels.innerHTML = "";
        if (levelsSet.size <= 1) {
            return;
        }
        let levelsSorted = Array.from(levelsSet).sort(function (a, b) {
            return a - b;
        });

        if (levelsSorted.length > 10) {
            let container = document.createElement("div");
            container.classList.add("dropdown");
            let button = document.createElement("button");
            button.classList.add("btn", "btn-secondary", "dropdown-toggle");
            button.setAttribute("type", "button");
            button.setAttribute("data-bs-toggle", "dropdown");
            button.append(document.createTextNode(zIndex));
            let menu = document.createElement("div");
            menu.classList.add("dropdown-menu");
            container.append(button);
            container.append(menu);
            for (let level of levelsSorted) {
                let link = document.createElement("a");
                link.classList.add("dropdown-item", "btn-level");
                link.setAttribute("href", "#");
                link.setAttribute("data-level", level);
                link.append(document.createTextNode(level));
                menu.append(link);
            }
            this.levels.append(container);
        } else {
            for (let level of levelsSorted) {
                let button = document.createElement("button");
                button.setAttribute("type", "button");
                button.setAttribute("data-level", level);
                button.classList.add("btn", "btn-level");
                if (level === zIndex) {
                    button.classList.add("btn-primary");
                } else {
                    button.classList.add("btn-secondary");
                }
                button.append(document.createTextNode(level));
                this.levels.append(button);
            }
        }
        this.levels.querySelectorAll(".btn-level").forEach(item => {
            item.addEventListener("click", event => {
                event.preventDefault();
                let zIndex = parseInt(event.target.getAttribute("data-level"));
                this.renderArea(this.select.value, zIndex);
            });
        });
    }

    populateSelectBox() {
        this.select.querySelectorAll("option").forEach(item => item.remove());
        this.reader
            .getAreas()
            .filter(area => area.rooms.length > 0 && area.areaName !== undefined && area.areaName !== "")
            .sort((a, b) => {
                var nameA = a.areaName.toLowerCase(),
                    nameB = b.areaName.toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            })
            .forEach((areaElement, index) => {
                if (!areaElement.rooms.length) {
                    return;
                }
                this.select.append(new Option(areaElement.areaName, areaElement.areaId));
            });
        this.select.addEventListener("change", event => {
            this.renderArea(event.target.value, 0);
        });
    }

    submitSearch() {
        bootstrap.Modal.getInstance(this.searchModal).hide();
        let inputs = this.search.querySelectorAll("input");

        let formData = {};
        inputs.forEach(element => {
            formData[element.name] = element.value;
            element.value = "";
        });

        if (formData.roomId !== undefined) {
            let roomId = formData.roomId;
            if (isNaN(roomId)) {
                roomId = findNpc(roomId);
            } else {
                roomId = [roomId];
            }
            this.findRooms(roomId);
        }
    }

    submitPathFind() {
        bootstrap.Modal.getInstance(this.findPathModal).hide();
        let inputs = this.findPathForm.querySelectorAll("input");

        let formData = {};
        inputs.forEach(element => {
            formData[element.name] = element.value;
            element.value = "";
        });
        this.findPath(formData["start-loc"], formData["end-loc"]);
        this.findRoom(formData["start-loc"])
    }

    findRoom(id) {
        if (!id) {
            return;
        }
        let area = this.reader.getAreaByRoomId(id);
        if (area !== undefined) {
            this.renderArea(area.areaId, area.zIndex).then(() => {
                this.renderer.controls.setZoom(1);
                this.renderer.controls.centerRoom(id);
            });
        } else {
            this.showToast(translator.translateForKey("location-not-found", translator.currentLanguage));
        }
    }

    findRooms(rooms) {
        //TODO Should actually use multiple rooms
        let area = this.reader.getAreaByRoomId(rooms[0]);
        if (area !== undefined) {
            this.renderArea(area.areaId, area.zIndex).then(() => {
                this.renderer.controls.setZoom(1);
                this.renderer.clearHighlight();
                rooms.forEach(room => {
                    this.renderer.renderHighlight(room);
                });
                this.findRoom(rooms[0]);
                this.renderer.controls.centerOnItem(this.renderer.highlights);
            });
        } else {
            this.showToast(translator.translateForKey("location-not-found", translator.currentLanguage));
        }
    }

    findPath(from, to) {
        let key = `${from}#${to}`;
        let pathColor = this.pathBox.querySelector(`[data-path-key='${key}'] input[type='color']`)?.value ?? rainbow[pathPick++ % rainbow.length];
        this.paths[key] = this.renderer.controls.renderPath(from, to, convert.hex.rgb(pathColor).map(item => item / 255));
        if (!this.pathBox.querySelector(`[data-path-key='${key}']`)) {
            let pathSelector = document.createElement("li");
            pathSelector.classList.add("list-group-item", "d-inline-flex", "align-items-center", "position-relative");
            pathSelector.setAttribute("data-path-key", key);

            let color = document.createElement("input");
            color.setAttribute("type", "color");
            color.classList.add("small-color", "me-2");
            color.value = pathColor;
            color.addEventListener("input", event => {
                this.paths[key].strokeColor = event.target.value;
            });
            pathSelector.appendChild(color);

            pathSelector.appendChild(document.createTextNode(`${from} -> ${to}`));

            let deletePath = document.createElement("span");
            deletePath.classList.add("badge", "bg-secondary", "position-absolute", "end-0", "me-2");
            deletePath.appendChild(document.createTextNode(translator.translateForKey("delete", translator.currentLanguage)));
            deletePath.onclick = () => {
                this.paths[key].remove();
                delete this.paths[key];
                pathSelector.remove();

                if (Object.keys(this.paths).length === 0) {
                    this.pathBox.parentNode.classList.add("invisible");
                }
            };
            pathSelector.appendChild(deletePath);
            this.pathBox.appendChild(pathSelector);
            this.pathBox.parentNode.classList.remove("invisible");
        }
    }

    adjustZoomBar(view) {
        let percentage = (view.zoom - view.minZoom) / (10 - view.minZoom);

        this.zoomBar.querySelector(".progress-bar").style.width = percentage * 100 + "%";
        if (!this.zoomBar.classList.contains("visible")) {
            this.zoomBar.classList.add("visible");
            this.zoomBar.classList.remove("hidden");
            this.progressTimeout = setTimeout(() => {
                this.zoomBar.classList.add("hidden");
                this.zoomBar.classList.remove("visible");
            }, 3000);
        } else {
            if (this.progressTimeout !== undefined) {
                clearTimeout(this.progressTimeout);
                this.progressTimeout = undefined;
            }
            this.progressTimeout = setTimeout(() => {
                this.zoomBar.classList.add("hidden");
                this.zoomBar.classList.remove("visible");
            }, 3000);
        }
    }

    selectRoom(room) {
        this.showRoomInfo(room);
    }

    deselectRoom() {
        this.hideRoomInfo();
    }

    showRoomInfo(room) {
        this.infoBox.style.display = "initial";
        this.infoBox.querySelector(".room-id").innerHTML = room.id;
        this.infoBox.querySelector(".room-link").setAttribute("href", `${url}?loc=${room.id}`);
        this.infoBox.querySelector(".room-name").innerHTML = room.name;
        this.infoBox.querySelector(".room-env").innerHTML = room.env;
        this.infoBox.querySelector(".coord-x").innerHTML = room.x;
        this.infoBox.querySelector(".coord-y").innerHTML = room.y;
        this.infoBox.querySelector(".coord-z").innerHTML = room.z;
        this.infoBox.querySelector(".room-hash").innerHTML = "";
        this.infoBox.querySelector(".room-hash").innerHTML = room.hash ?? "";

        this.infoExitsGroup(this.infoBox.querySelector(".exits"), room.exits);
        this.infoExitsGroup(this.infoBox.querySelector(".special"), room.specialExits);

        this.userDataGroup(this.infoBox.querySelector(".userData"), room.userData);
        this.npcDataGroup(this.infoBox.querySelector(".npc"), roomNpc[room.id] || {});
    }

    userDataGroup(container, userData) {
        let containerList = container.querySelector("ul");
        containerList.innerHTML = "";
        let show = false;
        for (let userDataKey in userData) {
            show = true;
            let dataElement = document.createElement("li");
            dataElement.innerHTML = `${userDataKey}:<br>&nbsp; &nbsp; &nbsp;${userData[userDataKey]}`;
            containerList.append(dataElement);
        }
        container.style.display = show ? "initial" : "none";
    }

    infoExitsGroup(container, exits) {
        let containerList = container.querySelector("ul");
        containerList.innerHTML = "";
        let show = false;
        for (let exit in exits) {
            show = true;
            containerList.append(this.infoExit(exit, exits[exit]));
        }
        container.style.display = show ? "initial" : "none";
    }

    npcDataGroup(container, npcs) {
        let containerList = container.querySelector("ul");
        containerList.innerHTML = "";
        let show = false;
        for (let npc in npcs) {
            show = true;
            let element = document.createElement("li");
            element.append(document.createTextNode(npcs[npc]));
            containerList.append(element);
        }
        container.style.display = show ? "initial" : "none";
    }

    infoExit(exit, id) {
        let exitElement = document.createElement("li");

        let exitDir = document.createElement("span");
        exitDir.setAttribute("data-i18n", exit);
        exitDir.innerHTML = this.translateDir(exit);
        exitElement.append(exitDir);
        exitElement.append(document.createTextNode(": "));

        let link = document.createElement("a");
        link.setAttribute("href", "#");
        link.setAttribute("data-room", id);
        link.innerHTML = id;
        link.addEventListener("click", event => {
            event.preventDefault();
            this.findRoom(parseInt(event.currentTarget.getAttribute("data-room")));
        });
        exitElement.append(link);

        let destRoom = this.reader.getRoomById(id);
        if (parseInt(destRoom.areaId) !== this.renderer.area.areaId) {
            let area = this.reader.getAreaProperties(destRoom.areaId);
            exitElement.append(document.createTextNode(" ->  "));
            let areaLink = document.createElement("a");
            areaLink.setAttribute("href", "#");
            areaLink.setAttribute("data-room", destRoom.id);
            areaLink.innerHTML = area.areaName;
            areaLink.addEventListener("click", event => {
                event.preventDefault();
                this.findRoom(parseInt(event.currentTarget.getAttribute("data-room")));
            });
            exitElement.append(areaLink);
        }

        return exitElement;
    }

    showToast(text) {
        this.toastContainer.querySelector(".toast-body").innerHTML = text;
        bootstrap.Toast.getOrCreateInstance(this.toastContainer).show();
    }

    translateDir(dir) {
        return translator.translateForKey(dir) ?? dir;
    }

    translatePage(lang) {
        this.currentLanguageFlag.classList.remove(`flag-${translator.currentLanguage}`);
        if (lang) {
            translator.translatePageTo(lang);
        }
        this.currentLanguageFlag.classList.add(`flag-${translator.currentLanguage}`);
    }

    hideRoomInfo() {
        this.infoBox.style.display = "none";
    }

    populateSettings(settings) {
        for (let setting in settings) {
            let input = this.settingsModal.querySelector("input[name='" + setting + "']");
            if (!input) {
                continue;
            }
            if (input.getAttribute("type") === "checkbox") {
                input.checked = settings[setting];
            } else if (input.getAttribute("type") === "color") {
                input.value = settings[setting].toCSS ? settings[setting].toCSS(true) : settings[setting];
            } else {
                input.value = settings[setting];
            }
        }
    }

    resetSettings() {
        let defaults = new Settings();
        defaults.preview = true;
        defaults.optimizeDrag = true;
        this.populateSettings(defaults);
    }

    saveImage() {
        let a = document.createElement("a");
        a.setAttribute("href", this.map.toDataURL());
        a.setAttribute("download", this.renderer.area.areaName + ".png");
        document.querySelector("body").append(a);
        a.click();
        a.remove();
    }

    downloadImage() {
        let a = document.createElement("a");
        a.setAttribute("href", svgToDataURL(this.renderer.exportSvg()));
        a.setAttribute("download", this.renderer.area.areaName + ".svg");
        document.querySelector("body").append(a);
        a.click();
        a.remove();
    }

    copyImage() {
        if (typeof ClipboardItem !== "undefined") {
            this.map.toBlob(blob => navigator.clipboard.write([new ClipboardItem({"image/png": blob})]));
            this.showToast(translator.translateForKey("copied", translator.currentLanguage));
        } else {
            this.showToast(translator.translateForKey("no-clipboard", translator.currentLanguage));
        }
    }

    move(x, y) {
        this.renderer.controls.move(x, y);
    }

    goDirection(directionKey) {
        let fullDirection = dirsShortToLong(directionKey);
        if (this.renderer.controls.selected) {
            this.findRoom(this.renderer.controls.selected.exits[fullDirection]);
        }
    }

    registerKeyBoard() {
        let directionKeys = {
            Numpad1: "sw",
            Numpad2: "s",
            Numpad3: "se",
            Numpad4: "w",
            Numpad6: "e",
            Numpad7: "nw",
            Numpad8: "n",
            Numpad9: "ne",
            NumpadMultiply: "u",
            NumpadDivide: "d",
        };

        window.addEventListener("keydown", event => {
            if (this.settings.disableKeyBinds) {
                return;
            }

            if (event.code === "F1") {
                event.preventDefault();
                this.showHelp();
            }

            if (event.ctrlKey && event.code === "KeyF") {
                event.preventDefault();
                this.showSearch();
            }
        });

        window.addEventListener("resize", () => {
            this.render(true);
        });

        window.addEventListener("keydown", event => {
            if (document.querySelector("input:focus") || this.settings.disableKeyBinds) {
                return;
            }

            if (event.ctrlKey && event.code === "KeyS") {
                this.saveImage();
                event.preventDefault();
            }

            if (event.code === "Equal") {
                this.renderer.controls.deltaZoom(1.1);
                event.preventDefault();
            }

            if (event.code === "Minus") {
                this.renderer.controls.deltaZoom(0.9);
                event.preventDefault();
            }

            if (event.code === "ArrowUp") {
                this.move(0, -1);
                event.preventDefault();
            }
            if (event.code === "ArrowDown") {
                this.move(0, 1);
                event.preventDefault();
            }
            if (event.code === "ArrowLeft") {
                this.move(-1, 0);
                event.preventDefault();
            }
            if (event.code === "ArrowRight") {
                this.move(1, 0);
                event.preventDefault();
            }

            if (directionKeys.hasOwnProperty(event.code)) {
                this.goDirection(directionKeys[event.code]);
                event.preventDefault();
            }
        });
    }

    showHelp() {
        bootstrap.Modal.getOrCreateInstance(this.helpModal).show();
    }

    showSearch() {
        bootstrap.Modal.getOrCreateInstance(this.searchModal).show();
    }

    replaceVersion(tag) {
        downloadVersion(tag, this.versions.getAttribute("data-files")).then(data => {
            this.reader = new MapReader(data, colors);
            this.populateSelectBox();
            this.renderArea(controls.areaId, controls.zIndex, true).then(() => this.showToast(`Przeładowano wersję na ${tag}`));
            this.versionBadge.innerHTML = `v${tag}`;
            this.versionBadge.style.display = "initial";
        });
    }
}

let controls = new PageControls(new MapReader(mapData, colors));
window.controls = controls;
controls.genericSetup();
controls.populateSelectBox();
controls.init();
controls.registerKeyBoard();


let dirs = {
    north: "n",
    south: "s",
    east: "e",
    west: "w",
    northeast: "ne",
    northwest: "nw",
    southeast: "se",
    southwest: "sw",
    up: "u",
    down: "d",
};

function getKeyByValue(obj, val) {
    for (let k in obj) {
        if (obj.hasOwnProperty(k) && obj[k] === val) {
            return k;
        }
    }
}

function dirsShortToLong(dir) {
    let result = getKeyByValue(dirs, dir);
    return result !== undefined ? result : dir;
}
