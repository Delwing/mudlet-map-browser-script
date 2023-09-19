const https = require("https");
const autoComplete = require("@tarekraafat/autocomplete.js");

let npcs = {};

const searchFieldSelector = "#search-id";
const defaultMaxResults = 10;
let maxResults = defaultMaxResults;

const searchField = document.querySelector(searchFieldSelector);

const downloadNpc = () => {
    let roomNpc = {};
    return new Promise((resolve, reject) => {
        const url = searchField.getAttribute("data-npc");
        if (!url) {
            resolve([]);
        }
        https.get(url, res => {
            let data = [];
            res.on("data", chunk => {
                data.push(chunk);
            });
            res.on("error", err => reject(err));
            res.on("end", () => {
                let response = JSON.parse(Buffer.concat(data).toString());
                response.forEach(npc => {
                    if (!roomNpc[npc.loc]) {
                        roomNpc[npc.loc] = [];
                    }
                    roomNpc[npc.loc].push(npc.name);
                    npcs[npc.name] = npcs[npc.name] && npcs[npc.name].indexOf(npc.loc) == -1 ? npcs[npc.name].concat([npc.loc]) : [npc.loc];
                });
                resolve(roomNpc);
            });
        });
    });
};

const findNpc = name => {
    return npcs[name] ?? false;
};

let ac;
ac = new autoComplete({
    selector: searchFieldSelector,
    data: {
        src: async () => {
            await downloadNpc();
            let items = Object.keys(npcs);
            items = items.map(item => {
                return {value: npcs[item], text: item};
            });
            return items;
        },
        keys: ["text"],
        cache: true
    },
    resultItem: {
        tag: "a",
        class: "dropdown-item",
        selected: "active",
        highlight: true,
    },
    resultsList: {
        tag: "div",
        class: "npc-autocomplete dropdown-menu show",
        maxResults: undefined,
        destination: "#search .advancedAutoComplete",
    },
    submit: false,
});

let shouldNavigate = true;

document.querySelector(searchFieldSelector).addEventListener("selection", function (event) {
    if (event.detail.selection.value instanceof Function) {
        event.detail.selection.value();
    } else {
        if (event.detail.selection.value) {
            searchField.value = event.detail.selection.value.value;
        }
        searchField.form.requestSubmit();
    }
});

document.querySelector(searchFieldSelector).addEventListener("keyup", event => {
    if (event.keyCode == 13) {
        if (shouldNavigate) {
            ac.select(0);
        }
        if (searchField.value.trim() !== "" && !isNaN(searchField.value)) {
            searchField.form.requestSubmit();
        }
    }
});

document.querySelector(searchFieldSelector).addEventListener("navigate", event => {
    shouldNavigate = false;
});

document.querySelector(searchFieldSelector).addEventListener("results", function (event) {
    let list = event.detail.results;

    let length = list.length;
    if (length > 0) {
        list.sort((a, b) => {

            let aText = a.value.text.toLowerCase();
            let bText = b.value.text.toLowerCase();
            let query = event.detail.query.toLowerCase()

            if (aText.startsWith(query) && !bText.startsWith(query)) {
                return -1;
            } else if (!aText.startsWith(event.detail.query) && bText.startsWith(query)) {
                return 1;
            } else {
                return aText.localeCompare(bText);
            }
        });
        list = list.slice(0, maxResults);
        if (length > maxResults) {
            list.push({
                value: function () {
                    let newMax = maxResults + 10;
                    ac.start();
                    maxResults = newMax;
                },
                match: "Więcej...",
            });
        }
    }

    event.detail.results = list;
});

searchField.addEventListener("input", event => {
    maxResults = defaultMaxResults;
});

module.exports = {
    downloadNpc,
    findNpc,
};
