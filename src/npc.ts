import autoComplete from "@tarekraafat/autocomplete.js";

interface Npc {
    name: string;
    loc: number;
}

type RoomNpcMap = Record<number, string[]>;
type NpcLocationMap = Record<string, number[]>;

const npcs: NpcLocationMap = {};

const searchFieldSelector = "#search-id";
const defaultMaxResults = 10;
let maxResults = defaultMaxResults;

const searchField = document.querySelector<HTMLInputElement>(searchFieldSelector);

export const downloadNpc = async (): Promise<RoomNpcMap> => {
    const roomNpc: RoomNpcMap = {};
    const url = searchField?.getAttribute("data-npc");
    if (!url) {
        return roomNpc;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch NPCs: ${response.status} ${response.statusText}`);
    }

    const data: Npc[] = await response.json();
    data.forEach((npc) => {
        if (!roomNpc[npc.loc]) {
            roomNpc[npc.loc] = [];
        }
        roomNpc[npc.loc].push(npc.name);
        npcs[npc.name] =
            npcs[npc.name] && npcs[npc.name].indexOf(npc.loc) === -1
                ? npcs[npc.name].concat([npc.loc])
                : [npc.loc];
    });

    return roomNpc;
};

export const findNpc = (name: string): number[] | false => {
    return npcs[name] ?? false;
};

const ac = new autoComplete({
    selector: searchFieldSelector,
    data: {
        src: async () => {
            await downloadNpc();
            const items = Object.keys(npcs).map((item) => {
                return { value: npcs[item], text: item };
            });
            return items;
        },
        keys: ["text"],
        cache: true,
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

document.querySelector(searchFieldSelector)?.addEventListener("selection", function (event: any) {
    if (event.detail.selection.value instanceof Function) {
        event.detail.selection.value();
    } else {
        if (event.detail.selection.value && searchField) {
            searchField.value = event.detail.selection.value.value;
        }
        searchField?.form?.requestSubmit();
    }
});

document.querySelector(searchFieldSelector)?.addEventListener("keyup", ((event: KeyboardEvent) => {
    if (event.keyCode === 13) {
        if (shouldNavigate) {
            ac.select(0);
        }
        if (searchField && searchField.value.trim() !== "" && !isNaN(Number(searchField.value))) {
            searchField.form?.requestSubmit();
        }
    }
}) as EventListener);

document.querySelector(searchFieldSelector)?.addEventListener("navigate", () => {
    shouldNavigate = false;
});

document.querySelector(searchFieldSelector)?.addEventListener("results", function (event: any) {
    let list = event.detail.results;

    const length = list.length;
    if (length > 0) {
        list.sort((a: any, b: any) => {
            const aText: string = a.value.text.toLowerCase();
            const bText: string = b.value.text.toLowerCase();
            const query: string = event.detail.query.toLowerCase();

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
                    const newMax = maxResults + 10;
                    ac.start();
                    maxResults = newMax;
                },
                match: "Więcej...",
            });
        }
    }

    event.detail.results = list;
});

searchField?.addEventListener("input", () => {
    maxResults = defaultMaxResults;
});
