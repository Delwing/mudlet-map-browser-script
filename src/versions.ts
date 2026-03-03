export const downloadTags = async (url: string): Promise<unknown> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.status} ${response.statusText}`);
    }
    return response.json();
};

export const downloadVersion = async (tag: string, address: string): Promise<unknown> => {
    const url = address.replace("%tag%", tag);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch version: ${response.status} ${response.statusText}`);
    }
    return response.json();
};
