const https = require("https");

const downloadTags = url => {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let data = [];
            res.on("data", chunk => {
                data.push(chunk);
            });
            res.on("error", err => reject(err));
            res.on("end", () => {
                let response = JSON.parse(Buffer.concat(data).toString());
                resolve(response.map(release => release.tag_name));
            });
        });
    });
};

const downloadVersion = (tag, address) => {
    return new Promise((resolve, reject) => {
        https.get(address.replace("%tag%", tag), res => {
            let data = [];
            res.on("data", chunk => {
                data.push(chunk);
            });
            res.on("error", err => reject(err));
            res.on("end", () => {
                let response = JSON.parse(Buffer.concat(data).toString());
                resolve(response);
            });
        });
    });
};

module.exports = {
    downloadVersion,
    downloadTags,
};
